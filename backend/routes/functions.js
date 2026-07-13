import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { authenticateToken, requireAdmin, invalidateUserStatus } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "../uploads");

const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_APIKEY || "";

// Cache for embedded chunks (RAG). Invalidated whenever chunks are written.
let cachedChunks = null;
let lastChunksCacheTime = 0;
function invalidateChunkCache() {
  cachedChunks = null;
  lastChunksCacheTime = 0;
}

// Model dùng để tạo embedding (rẻ, gần như miễn phí so với generate)
const EMBEDDING_MODEL = "text-embedding-004";
// Số chunk liên quan nhất gửi cho AI mỗi câu hỏi (giữ thấp để tiết kiệm token)
const TOP_K_CHUNKS = 5;

/**
 * Retrieve the active Gemini API Key, prioritizing environment variables
 * and falling back to MySQL settings/ai_config
 */
async function getApiKey() {
  if (GOOGLE_API_KEY) {
    return GOOGLE_API_KEY;
  }
  try {
    const [rows] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      ["settings", "ai_config"]
    );
    if (rows.length > 0) {
      const parsed = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
      return parsed?.apiKey || "";
    }
  } catch (err) {
    console.warn("Failed to retrieve fallback API key from MySQL settings:", err.message);
  }
  return "";
}

/**
 * Checks role-based access to EHS documents
 */
function hasDocAccess(docType, roles) {
  const normalizedDocType = String(docType).toLowerCase().trim();
  if (normalizedDocType === "msds") {
    return roles.some(r => ["admin", "ehs", "manager"].includes(r));
  }
  if (["sop", "quytrinh", "bieumau"].includes(normalizedDocType)) {
    return roles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
  }
  return roles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
}

/**
 * Cắt văn bản markdown thành các đoạn nhỏ (~maxChars ký tự) để embedding.
 * Cắt theo đoạn văn / tiêu đề, gộp dần cho tới khi đạt ngưỡng, có overlap nhẹ
 * để tránh mất ngữ cảnh ở ranh giới đoạn.
 */
function chunkText(text, maxChars = 1800, overlap = 200) {
  const clean = (text || "").replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  // Tách theo đoạn (dòng trống) — giữ tiêu đề đi cùng nội dung kế tiếp.
  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    const t = current.trim();
    if (t) chunks.push(t);
  };

  for (const para of paragraphs) {
    // Đoạn quá dài thì cắt cứng theo câu.
    if (para.length > maxChars) {
      pushCurrent();
      current = "";
      const sentences = para.split(/(?<=[.!?…])\s+/);
      let buf = "";
      for (const s of sentences) {
        if ((buf + " " + s).length > maxChars && buf) {
          chunks.push(buf.trim());
          buf = s;
        } else {
          buf = buf ? buf + " " + s : s;
        }
      }
      if (buf.trim()) chunks.push(buf.trim());
      continue;
    }

    if ((current + "\n\n" + para).length > maxChars && current) {
      pushCurrent();
      // overlap: giữ lại phần đuôi của chunk trước
      current = overlap > 0 ? current.slice(-overlap) + "\n\n" + para : para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  pushCurrent();
  return chunks;
}

/**
 * Tính cosine similarity giữa 2 vector.
 */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return -1;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Tạo embedding cho một mảng văn bản (batch). Trả về mảng vector tương ứng.
 * taskType: "RETRIEVAL_DOCUMENT" khi lưu tài liệu, "RETRIEVAL_QUERY" khi hỏi.
 */
async function embedTexts(texts, apiKey, taskType = "RETRIEVAL_DOCUMENT") {
  if (!texts || texts.length === 0) return [];
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const results = [];
  const BATCH = 100; // giới hạn an toàn cho batchEmbedContents
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const resp = await model.batchEmbedContents({
      requests: slice.map(t => ({
        content: { role: "user", parts: [{ text: t }] },
        taskType
      }))
    });
    (resp.embeddings || []).forEach(e => results.push(e.values || []));
  }
  return results;
}

/**
 * Cắt + embedding nội dung tài liệu rồi lưu vào doc_chunks (thay thế chunk cũ).
 * Trả về số chunk đã lưu.
 */
async function storeDocChunks(docId, title, type, content, apiKey) {
  const chunks = chunkText(content);
  // Luôn xóa chunk cũ trước (kể cả khi nội dung rỗng) để giữ đồng bộ.
  await pool.query("DELETE FROM doc_chunks WHERE doc_id = ?", [docId]);
  if (chunks.length === 0) {
    invalidateChunkCache();
    return 0;
  }

  const embeddings = await embedTexts(chunks, apiKey, "RETRIEVAL_DOCUMENT");
  const values = [];
  const placeholders = [];
  chunks.forEach((c, idx) => {
    const emb = embeddings[idx];
    if (!emb || emb.length === 0) return;
    placeholders.push("(?, ?, ?, ?, ?, ?)");
    values.push(docId, title || null, type || null, idx, c, JSON.stringify(emb));
  });

  if (placeholders.length > 0) {
    await pool.query(
      `INSERT INTO doc_chunks (doc_id, doc_title, doc_type, chunk_index, content, embedding) VALUES ${placeholders.join(", ")}`,
      values
    );
  }
  invalidateChunkCache();
  return placeholders.length;
}

/**
 * Lấy toàn bộ chunk (đã parse embedding) với cache 5 phút.
 */
async function getAllChunks() {
  const now = Date.now();
  if (cachedChunks && (now - lastChunksCacheTime < 300000)) {
    return cachedChunks;
  }
  const [rows] = await pool.query(
    "SELECT doc_id, doc_title, doc_type, chunk_index, content, embedding FROM doc_chunks"
  );
  const chunks = rows.map(r => ({
    docId: r.doc_id,
    title: r.doc_title,
    type: r.doc_type,
    chunkIndex: r.chunk_index,
    content: r.content,
    embedding: typeof r.embedding === "string" ? JSON.parse(r.embedding) : r.embedding
  }));
  cachedChunks = chunks;
  lastChunksCacheTime = now;
  return chunks;
}

// 1. POST /askAI (JWT authentication required - Correction)
router.post("/askAI", authenticateToken, async (req, res) => {
  try {
    const question = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
    const additionalContext = (req.body && req.body.additionalContext) ? String(req.body.additionalContext).trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!question) {
      return res.status(400).json({ error: "Thiếu nội dung câu hỏi (prompt)" });
    }

    const rawRole = req.user?.role;
    const userRoles = (Array.isArray(rawRole) ? rawRole : (rawRole ? String(rawRole).split(",") : []))
      .map(r => r.trim().toLowerCase());

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }

    // === RAG ngữ nghĩa: embedding câu hỏi -> chỉ lấy vài chunk liên quan nhất ===
    // (tiết kiệm token: không đổ cả tài liệu vào prompt như trước)
    let topChunks = [];
    try {
      const allChunks = await getAllChunks();
      const accessible = allChunks.filter(c => {
        const t = (c.type || "").toLowerCase();
        if (t === "global" || t === "") return true; // tài liệu chung, không giới hạn quyền
        return hasDocAccess(t, userRoles);
      });

      if (accessible.length > 0) {
        const [qVec] = await embedTexts([question], apiKey, "RETRIEVAL_QUERY");
        if (qVec && qVec.length > 0) {
          topChunks = accessible
            .map(c => ({ chunk: c, score: cosineSimilarity(qVec, c.embedding) }))
            .filter(item => item.score > 0.5) // ngưỡng liên quan tối thiểu
            .sort((a, b) => b.score - a.score)
            .slice(0, TOP_K_CHUNKS)
            .map(item => item.chunk);
        }
      }
    } catch (embErr) {
      console.warn("Embedding retrieval thất bại, trả lời không kèm tài liệu:", embErr.message);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const DEFAULT_SYSTEM_INSTRUCTION = "Bạn là một nhân viên thuộc bộ phận EHS (An toàn, Sức khỏe và Môi trường) của nhà máy SafeOne. Hãy xưng hô và trả lời một cách tự nhiên, thân thiện và chân thực như một người đồng nghiệp thật sự.\n\n" +
      "Nguyên tắc trả lời:\n" +
      "1. Lối nói ngắn gọn, súc tích, dễ hiểu và đi thẳng vào vấn đề. Tránh dài dòng hoặc quá phức tạp.\n" +
      "2. Sử dụng tiếng Việt lịch sự, thể hiện tinh thần hỗ trợ và trách nhiệm cao về an toàn lao động.\n" +
      "3. Khi trả lời, hãy ưu tiên tuyệt đối dựa trên các thông tin được cung cấp trong phần tài liệu huấn luyện (Knowledge Base) nếu có.\n\n" +
      "Xử lý khi thông tin vượt ngoài phạm vi huấn luyện:\n" +
      "- Nếu câu hỏi của người dùng nằm ngoài các tài liệu đã được huấn luyện hoặc chỉ dẫn an toàn nội bộ:\n" +
      "  * Hãy gợi ý một cách lịch sự rằng họ nên liên hệ trực tiếp với bộ phận EHS của nhà máy để nhận được hướng dẫn chính thức và rõ ràng nhất.\n" +
      "  * Đồng thời, hãy gợi ý thêm rằng trong thời gian chờ đợi phản hồi trực tiếp từ bộ phận EHS, bạn (với vai trò chatbot hỗ trợ) vẫn có thể cung cấp cho họ một số thông tin tham khảo nhanh dựa trên cơ sở dữ liệu AI tổng hợp của mình.";

    // Cho phép admin tùy chỉnh system instruction & model qua settings/ai_config
    let configuredInstruction = "";
    let configuredModel = "gemini-2.5-flash";
    try {
      const [cfgRows] = await pool.query(
        "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
        ["settings", "ai_config"]
      );
      if (cfgRows.length > 0) {
        const cfg = typeof cfgRows[0].data === "string" ? JSON.parse(cfgRows[0].data) : cfgRows[0].data;
        if (cfg?.systemInstruction && cfg.systemInstruction.trim()) {
          configuredInstruction = cfg.systemInstruction.trim();
        }
        if (cfg?.provider === "google" && cfg?.model) {
          configuredModel = cfg.model;
        }
      }
    } catch { /* dùng mặc định */ }

    // Map model cũ đã ngừng hỗ trợ sang model mới
    if (configuredModel === "gemini-2.0-flash" || configuredModel === "gemini-1.5-flash") {
      configuredModel = "gemini-2.5-flash";
    } else if (configuredModel === "gemini-1.5-pro") {
      configuredModel = "gemini-2.5-pro";
    }

    let systemInstruction = configuredInstruction || DEFAULT_SYSTEM_INSTRUCTION;
    if (additionalContext) {
      systemInstruction += "\n\n" + additionalContext;
    }

    let context = "";
    if (topChunks.length > 0) {
      context = "=== TRÍCH ĐOẠN TÀI LIỆU LIÊN QUAN (KNOWLEDGE BASE / RAG) ===\n";
      topChunks.forEach(c => {
        context += `\n[Nguồn: ${c.title || "Tài liệu"}]\n${c.content}\n`;
      });
    }

    const model = genAI.getGenerativeModel({
      model: configuredModel,
      systemInstruction: systemInstruction
    });

    const cleanHistory = history.map(h => ({
      role: h.role === "assistant" || h.role === "model" ? "model" : "user",
      parts: Array.isArray(h.parts) ? h.parts : [{ text: h.text || "" }]
    }));

    const chat = model.startChat({
      history: cleanHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2
      }
    });

    const userPrompt = `Context:\n${context}\n\nCâu hỏi: ${question}`;
    const result = await chat.sendMessage(userPrompt);
    const responseText = result.response.text();

    // Đính kèm link tài liệu gốc nếu chunk liên quan nhất thuộc một document thật
    let resolvedFileUrl = "";
    let resolvedDocTitle = "";
    if (topChunks.length > 0) {
      const top = topChunks[0];
      resolvedDocTitle = top.title || "Tài liệu";
      if (top.docId && !String(top.docId).startsWith("trained:")) {
        try {
          const [drows] = await pool.query(
            "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
            ["documents", top.docId]
          );
          if (drows.length > 0) {
            const d = typeof drows[0].data === "string" ? JSON.parse(drows[0].data) : drows[0].data;
            resolvedFileUrl = d.fileUrlVi || d.fileUrl || d.fileUrlEn || "";
          }
        } catch { /* bỏ qua nếu không tra được link */ }
      }
    }

    if (resolvedFileUrl) {
      res.status(200).json({
        response: responseText,
        file_url: resolvedFileUrl,
        doc_title: resolvedDocTitle
      });
    } else {
      res.status(200).json({ response: responseText });
    }
  } catch (error) {
    console.error("Generative AI error in askAI:", error);
    res.status(500).json({ error: "Lỗi kết nối dịch vụ Gemini AI" });
  }
});

// 2. POST /checkSpelling (JWT authentication required - Correction)
router.post("/checkSpelling", authenticateToken, async (req, res) => {
  try {
    const text = (req.body && req.body.text) ? String(req.body.text) : "";
    if (!text.trim()) {
      return res.status(200).json({ response: "" });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(200).json({ response: text });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = "Hãy sửa lỗi chính tả và ngữ pháp tiếng Việt cho văn bản sau (nếu có). Chỉ trả về văn bản kết quả đã sửa, không giải thích, không thêm bất kỳ văn bản nào khác. Nếu văn bản gốc không có lỗi, hãy trả về chính xác văn bản gốc.";

    // Dùng model lite cho sửa chính tả: rẻ & nhanh hơn, đủ cho tác vụ đơn giản này.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: text }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 200
      }
    });

    const responseText = result.response.text().trim();
    res.status(200).json({ response: responseText });
  } catch (error) {
    console.error("Spelling service error:", error);
    res.status(500).json({ error: "Lỗi kiểm tra chính tả" });
  }
});

// 3. POST /extractMarkdown (JWT authentication required - Correction)
router.post("/extractMarkdown", authenticateToken, async (req, res) => {
  const { docId, fileUrl } = req.body;
  if (!docId || !fileUrl) {
    return res.status(400).json({ error: "Thiếu ID hoặc đường dẫn tài liệu." });
  }

  try {
    // Chống SSRF: KHÔNG fetch URL tùy ý do client gửi (kẻ xấu có thể ép server
    // gọi vào mạng nội bộ VPS). Chỉ chấp nhận file đã upload lên chính app
    // (/uploads/...) và đọc thẳng từ đĩa.
    let pathname;
    try {
      pathname = String(fileUrl).startsWith("/") ? String(fileUrl) : new URL(fileUrl).pathname;
    } catch {
      return res.status(400).json({ error: "Đường dẫn tài liệu không hợp lệ." });
    }
    if (!pathname.startsWith("/uploads/")) {
      return res.status(400).json({ error: "Chỉ hỗ trợ tài liệu đã tải lên hệ thống (/uploads)." });
    }
    const localPath = path.join(UPLOADS_DIR, path.basename(pathname));
    let pdfBase64;
    try {
      pdfBase64 = (await fs.promises.readFile(localPath)).toString("base64");
    } catch (e) {
      if (e.code === "ENOENT") {
        return res.status(404).json({ error: "Không tìm thấy file tài liệu trên máy chủ." });
      }
      throw e;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          data: pdfBase64,
          mimeType: "application/pdf"
        }
      },
      "Hãy đọc tài liệu PDF này và trích xuất toàn bộ nội dung văn bản bên trong, định dạng lại thành cấu trúc Markdown sạch sẽ và chính xác (giữ nguyên tiêu đề, bảng biểu, danh sách nếu có). Chỉ trả về nội dung Markdown, không thêm bất kỳ lời chào hay giải thích nào khác."
    ]);

    const markdown = result.response.text().trim();

    const [existing] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      ["documents", docId]
    );

    let docTitle = "";
    let docType = "";
    if (existing.length > 0) {
      const currentData = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
      currentData.markdownContent = markdown;
      docTitle = currentData.title || currentData.fileName || "";
      docType = currentData.type || "";

      await pool.query(
        "UPDATE firestore_mock SET data = ? WHERE collection = ? AND id = ?",
        [JSON.stringify(currentData), "documents", docId]
      );
    }

    // Cắt + embedding nội dung để RAG (chỉ gửi chunk liên quan khi hỏi)
    let chunkCount = 0;
    try {
      chunkCount = await storeDocChunks(docId, docTitle, docType, markdown, apiKey);
    } catch (embErr) {
      console.error("Lỗi tạo embedding cho tài liệu:", embErr.message);
    }

    res.status(200).json({ success: true, length: markdown.length, chunks: chunkCount });
  } catch (error) {
    console.error("Error in extractMarkdown:", error);
    res.status(500).json({ error: error.message || "Lỗi khi trích xuất tài liệu." });
  }
});

// 3b. POST /embedTrainingDoc (Admin only) — embedding tài liệu txt/md upload trực tiếp
// (mục "Huấn luyện Chatbot"). Lưu dưới doc_id "trained:<id>", type "global" (mọi role đọc được).
router.post("/embedTrainingDoc", authenticateToken, requireAdmin, async (req, res) => {
  const { id, name, content } = req.body || {};
  if (!id || !content) {
    return res.status(400).json({ error: "Thiếu id hoặc nội dung tài liệu." });
  }
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }
    const chunkCount = await storeDocChunks(`trained:${id}`, name || "Tài liệu", "global", content, apiKey);
    res.status(200).json({ success: true, chunks: chunkCount });
  } catch (error) {
    console.error("Error in embedTrainingDoc:", error);
    res.status(500).json({ error: error.message || "Lỗi khi tạo embedding tài liệu." });
  }
});

// 3c. POST /deleteTrainingDoc (Admin only) — xóa chunk của tài liệu txt/md đã upload
router.post("/deleteTrainingDoc", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    return res.status(400).json({ error: "Thiếu id tài liệu." });
  }
  try {
    await pool.query("DELETE FROM doc_chunks WHERE doc_id = ?", [`trained:${id}`]);
    invalidateChunkCache();
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error in deleteTrainingDoc:", error);
    res.status(500).json({ error: "Lỗi khi xóa embedding tài liệu." });
  }
});

// 3e. POST /syncDocChunks (Admin only) — bật/tắt embedding cho 1 document.
// enabled=false: xóa chunk. enabled=true: tạo chunk từ markdownContent sẵn có;
// nếu chưa có markdown thì trả needsExtract để frontend gọi /extractMarkdown.
router.post("/syncDocChunks", authenticateToken, requireAdmin, async (req, res) => {
  const { docId, enabled } = req.body || {};
  if (!docId) {
    return res.status(400).json({ error: "Thiếu docId." });
  }
  try {
    if (!enabled) {
      await pool.query("DELETE FROM doc_chunks WHERE doc_id = ?", [docId]);
      invalidateChunkCache();
      return res.status(200).json({ success: true, chunks: 0, removed: true });
    }

    const [rows] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      ["documents", docId]
    );
    if (rows.length === 0) {
      return res.status(200).json({ success: true, chunks: 0, needsExtract: true });
    }
    const d = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
    if (!d.markdownContent) {
      return res.status(200).json({ success: true, chunks: 0, needsExtract: true });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }
    const n = await storeDocChunks(docId, d.title || d.fileName || "", d.type || "", d.markdownContent, apiKey);
    res.status(200).json({ success: true, chunks: n });
  } catch (error) {
    console.error("Error in syncDocChunks:", error);
    res.status(500).json({ error: error.message || "Lỗi khi đồng bộ embedding tài liệu." });
  }
});

// 3d. POST /backfillChunks (Admin only) — tạo embedding cho dữ liệu cũ đã huấn luyện
// nhưng chưa có chunk: tài liệu documents có markdownContent + trainedDocs trong ai_config.
router.post("/backfillChunks", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
    }

    // Lấy danh sách doc_id đã có chunk để bỏ qua
    const [existingRows] = await pool.query("SELECT DISTINCT doc_id FROM doc_chunks");
    const existingIds = new Set(existingRows.map(r => r.doc_id));

    let processed = 0;
    let totalChunks = 0;

    // 1) Tài liệu trong collection documents có markdownContent
    const [docRows] = await pool.query(
      "SELECT id, data FROM firestore_mock WHERE collection = ?",
      ["documents"]
    );
    for (const r of docRows) {
      let d;
      try { d = typeof r.data === "string" ? JSON.parse(r.data) : r.data; } catch { continue; }
      if (d && d.isAITrained === true && d.markdownContent && !existingIds.has(r.id)) {
        try {
          const n = await storeDocChunks(r.id, d.title || d.fileName || "", d.type || "", d.markdownContent, apiKey);
          processed++; totalChunks += n;
        } catch (e) { console.error("Backfill doc lỗi:", r.id, e.message); }
      }
    }

    // 2) trainedDocs trong settings/ai_config
    const [cfgRows] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      ["settings", "ai_config"]
    );
    if (cfgRows.length > 0) {
      const cfg = typeof cfgRows[0].data === "string" ? JSON.parse(cfgRows[0].data) : cfgRows[0].data;
      const trainedDocs = Array.isArray(cfg?.trainedDocs) ? cfg.trainedDocs : [];
      for (const t of trainedDocs) {
        if (!t || !t.id || !t.content) continue;
        const docId = `trained:${t.id}`;
        if (existingIds.has(docId)) continue;
        try {
          const n = await storeDocChunks(docId, t.name || "Tài liệu", "global", t.content, apiKey);
          processed++; totalChunks += n;
        } catch (e) { console.error("Backfill trainedDoc lỗi:", t.id, e.message); }
      }
    }

    res.status(200).json({ success: true, processed, chunks: totalChunks });
  } catch (error) {
    console.error("Error in backfillChunks:", error);
    res.status(500).json({ error: error.message || "Lỗi khi đồng bộ embedding." });
  }
});

// 4. POST /listUsers (Admin only)
router.post("/listUsers", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT uid, email, name, role, disabled, created_at FROM users");
    const users = rows.map(u => ({
      uid: u.uid,
      email: u.email,
      name: u.name,
      role: u.role.includes(",") ? u.role.split(",") : u.role,
      disabled: !!u.disabled,
      createdAt: u.created_at
    }));
    res.status(200).json({ users });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách người dùng" });
  }
});

// 5. POST /adminUserAction (Admin only, hashing passwords with bcrypt)
router.post("/adminUserAction", authenticateToken, requireAdmin, async (req, res) => {
  const { action, targetUid, data } = req.body;

  try {
    switch (action) {
      case "createUser": {
        if (!data || !data.email || !data.password || !data.role) {
          return res.status(400).json({ error: "Thiếu thông tin tạo tài khoản" });
        }
        if (String(data.password).length < 6) {
          return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
        }
        const uid = "user-" + Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Hashing via bcrypt with 12 salt rounds (Rule 5)
        const passwordHash = await bcrypt.hash(data.password, 12);
        
        const roleStr = Array.isArray(data.role) ? data.role.join(",") : data.role;
        const name = data.name || data.email.split("@")[0];

        await pool.query(
          "INSERT INTO users (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
          [uid, data.email, passwordHash, name, roleStr]
        );
        break;
      }
      case "resetPassword": {
        if (!data || !data.newPassword) return res.status(400).json({ error: "Thiếu mật khẩu mới" });
        if (String(data.newPassword).length < 6) {
          return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
        }

        // Hashing via bcrypt with 12 salt rounds (Rule 5)
        const newPasswordHash = await bcrypt.hash(data.newPassword, 12);
        
        await pool.query("UPDATE users SET password_hash = ? WHERE uid = ?", [newPasswordHash, targetUid]);
        break;
      }
      case "changeRole": {
        if (!data || !data.newRole) return res.status(400).json({ error: "Thiếu quyền mới" });
        const newRoleStr = Array.isArray(data.newRole) ? data.newRole.join(",") : data.newRole;
        await pool.query("UPDATE users SET role = ? WHERE uid = ?", [newRoleStr, targetUid]);
        break;
      }
      case "disable":
        await pool.query("UPDATE users SET disabled = 1 WHERE uid = ?", [targetUid]);
        // Xóa cache trạng thái để lệnh khóa có hiệu lực ngay (không đợi hết TTL 60s).
        invalidateUserStatus(targetUid);
        break;
      case "enable":
        await pool.query("UPDATE users SET disabled = 0 WHERE uid = ?", [targetUid]);
        invalidateUserStatus(targetUid);
        break;
      case "delete":
        await pool.query("DELETE FROM users WHERE uid = ?", [targetUid]);
        invalidateUserStatus(targetUid);
        break;
      case "changeName":
        if (!data || !data.newName) return res.status(400).json({ error: "Thiếu tên mới" });
        await pool.query("UPDATE users SET name = ? WHERE uid = ?", [data.newName, targetUid]);
        break;
      case "approveRoleRequest": {
        if (!data || !data.requestId || !data.newRole) return res.status(400).json({ error: "Thiếu thông tin yêu cầu" });
        const roleStr = Array.isArray(data.newRole) ? data.newRole.join(",") : data.newRole;
        await pool.query("UPDATE users SET role = ? WHERE uid = ?", [roleStr, targetUid]);
        await pool.query("UPDATE role_requests SET status = 'approved' WHERE id = ?", [data.requestId]);

        const notification = {
          type: "role_response",
          message: `Yêu cầu đổi quyền thành "${data.newRole}" của bạn đã được chấp nhận.`,
          target_user_id: targetUid,
          read_by: JSON.stringify([])
        };
        await pool.query(
          "INSERT INTO notifications (type, message, target_user_id, read_by) VALUES (?, ?, ?, ?)",
          [notification.type, notification.message, notification.target_user_id, notification.read_by]
        );
        break;
      }
      case "rejectRoleRequest": {
        if (!data || !data.requestId) return res.status(400).json({ error: "Thiếu ID yêu cầu" });
        await pool.query("UPDATE role_requests SET status = 'rejected' WHERE id = ?", [data.requestId]);

        const notificationReject = {
          type: "role_response",
          message: "Yêu cầu đổi quyền của bạn đã bị từ chối.",
          target_user_id: targetUid,
          read_by: JSON.stringify([])
        };
        await pool.query(
          "INSERT INTO notifications (type, message, target_user_id, read_by) VALUES (?, ?, ?, ?)",
          [notificationReject.type, notificationReject.message, notificationReject.target_user_id, notificationReject.read_by]
        );
        break;
      }
      default:
        return res.status(400).json({ error: "Hành động không hợp lệ" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Admin user action error:", error);
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

// 6. POST /submitRoleRequest
router.post("/submitRoleRequest", authenticateToken, async (req, res) => {
  const { requestedRole, currentRole, name, email } = req.body;
  if (!requestedRole) {
    return res.status(400).json({ error: "Thiếu quyền yêu cầu" });
  }

  try {
    await pool.query(
      "INSERT INTO role_requests (uid, name, email, current_role, requested_role) VALUES (?, ?, ?, ?, ?)",
      [req.user.uid, name, email, currentRole, requestedRole]
    );

    const notification = {
      type: "role_request",
      message: `${name} vừa yêu cầu đổi quyền từ "${currentRole || "Chưa có"}" sang "${requestedRole}".`,
      target_roles: JSON.stringify(["admin"]),
      read_by: JSON.stringify([])
    };
    await pool.query(
      "INSERT INTO notifications (type, message, target_roles, read_by) VALUES (?, ?, ?, ?)",
      [notification.type, notification.message, notification.target_roles, notification.read_by]
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Submit role request error:", error);
    res.status(500).json({ error: "Lỗi khi gửi yêu cầu đổi quyền" });
  }
});

export default router;
