// backend/controllers/functionsController.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import pool from "../db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "safeone_super_secret_key_2026";
const GOOGLE_API_KEY = process.env.GOOGLE_APIKEY || "";

// Cache system for documents & knowledge chunks to minimize MySQL operations
let cachedDocuments = null;
let lastDocsCacheTime = 0;

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
 * Query documents with isAITrained = true from MySQL database (with 5 minutes cache)
 */
async function getAITrainedDocuments() {
  const now = Date.now();
  if (cachedDocuments && (now - lastDocsCacheTime < 300000)) {
    return cachedDocuments;
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, data FROM firestore_mock WHERE collection = ?",
      ["documents"]
    );
    const docs = [];
    rows.forEach(r => {
      try {
        const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        if (parsed && parsed.isAITrained === true) {
          docs.push({ id: r.id, ...parsed });
        }
      } catch (e) {
        // ignore invalid JSON
      }
    });
    cachedDocuments = docs;
    lastDocsCacheTime = now;
    return docs;
  } catch (error) {
    console.error("Failed to query documents from MySQL:", error);
    if (cachedDocuments) {
      return cachedDocuments; // fallback to stale cache
    }
    return [];
  }
}

/**
 * Helper to split text into small semantic chunks locally
 */
function chunkText(text, size = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end >= text.length) {
      chunks.push(text.substring(start).trim());
      break;
    }
    let lastSpace = text.lastIndexOf(" ", end);
    if (lastSpace > start + 300) {
      end = lastSpace;
    }
    const chunk = text.substring(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start = end;
  }
  return chunks;
}

/**
 * Checks role-based access to EHS documents
 */
function hasDocAccess(docType, roles) {
  const normalizedDocType = String(docType).toLowerCase().trim();
  // MSDS access restricted to: admin, ehs, manager
  if (normalizedDocType === "msds") {
    return roles.some(r => ["admin", "ehs", "manager"].includes(r));
  }
  // SOP, quytrinh, bieumau access restricted to: admin, ehs, ehs committee, trainer, manager
  if (["sop", "quytrinh", "bieumau"].includes(normalizedDocType)) {
    return roles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
  }
  // Default role requirement for safety
  return roles.some(r => ["admin", "ehs", "ehs committee", "trainer", "manager"].includes(r));
}

/**
 * Endpoint for RAG-augmented chatbot (askAI)
 */
export async function askAI(req, res) {
  try {
    const question = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
    const additionalContext = (req.body && req.body.additionalContext) ? String(req.body.additionalContext).trim() : "";
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!question) {
      return res.status(400).json({ error: "Thiếu nội dung câu hỏi (prompt)" });
    }

    // Determine current user roles via JWT token authorization
    const authHeader = req.headers.authorization;
    let userRoles = [];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split("Bearer ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [userRows] = await pool.query("SELECT role FROM users WHERE uid = ?", [decoded.uid]);
        if (userRows.length > 0) {
          const rawRole = userRows[0].role;
          userRoles = (Array.isArray(rawRole) ? rawRole : (rawRole ? String(rawRole).split(",") : []))
            .map(r => r.trim().toLowerCase());
        }
      } catch (err) {
        console.warn("Verify user token failed in askAI:", err.message);
      }
    }

    // Stop words to exclude from keyword scoring to reduce noise from common words
    const STOP_WORDS = new Set(["cho", "tôi", "của", "và", "là", "các", "trong", "tại", "có", "này", "để", "với", "những", "một", "về", "ra", "lên", "ta", "nào", "đó", "này"]);

    // 1. Extract keywords for keyword scoring
    const keywords = question.toLowerCase()
      .replace(/[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

    // 2. Query trained documents
    const docs = await getAITrainedDocuments();

    // 3. Score documents and enforce permission-based pruning
    const scoredDocs = docs.map(docItem => {
      const docType = docItem.type || "";
      if (!hasDocAccess(docType, userRoles)) {
        return { docItem, score: -1 }; // Hide unauthorized docs
      }

      const title = (docItem.title || "").toLowerCase();
      const fileName = (docItem.fileName || "").toLowerCase();
      const content = (docItem.markdownContent || "").toLowerCase();
      
      let score = 0;
      let matchedTitleKeywords = 0;
      let matchedContentKeywords = 0;

      keywords.forEach(kw => {
        let keywordMatchedInTitle = false;
        let keywordMatchedInContent = false;

        if (title.includes(kw)) {
          keywordMatchedInTitle = true;
          score += 15; // Title match gets high priority
        }
        if (fileName.includes(kw)) {
          keywordMatchedInTitle = true;
          score += 8; // Filename match gets medium priority
        }
        if (content.includes(kw)) {
          keywordMatchedInContent = true;
          score += 2; // Content includes keyword
          
          // Frequency score (capped to prevent long documents from inflating their score)
          const wordRegex = new RegExp("(?<=^|[^\\p{L}\\p{N}])" + kw + "(?=[^\\p{L}\\p{N}]|$)", "giu");
          const wordMatches = content.match(wordRegex);
          if (wordMatches) {
            score += Math.min(wordMatches.length * 0.2, 5); // Capped to 5 points max per keyword frequency
          }
        }

        if (keywordMatchedInTitle) matchedTitleKeywords++;
        if (keywordMatchedInContent) matchedContentKeywords++;
      });

      // Boost score based on number of unique core keywords matched
      const uniqueKeywordsMatched = Math.max(matchedTitleKeywords, matchedContentKeywords);
      score += uniqueKeywordsMatched * 20; // 20 points per unique keyword matched

      return { docItem, score };
    });

    // 4. Sort and pick top 1 document
    const topDocs = scoredDocs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map(item => item.docItem);

    // 5. Build RAG context (with local chunking to preserve tokens)
    let context = "";
    if (topDocs.length > 0) {
      const docItem = topDocs[0];
      const fullContent = docItem.markdownContent || "";
      let retrievedContent = "";

      if (fullContent.length <= 10000) {
        retrievedContent = fullContent;
      } else {
        const contentChunks = chunkText(fullContent, 2500);
        const scoredChunks = contentChunks.map(chunk => {
          let score = 0;
          keywords.forEach(kw => {
            if (chunk.toLowerCase().includes(kw)) {
              score += 2;
              const wordRegex = new RegExp("(?<=^|[^\\p{L}\\p{N}])" + kw + "(?=[^\\p{L}\\p{N}]|$)", "giu");
              const matches = chunk.toLowerCase().match(wordRegex);
              if (matches) {
                score += matches.length * 0.5;
              }
            }
          });
          return { chunk, score };
        });
        
        const topChunks = scoredChunks
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(c => c.chunk);
          
        if (topChunks.length > 0) {
          retrievedContent = topChunks.join("\n...\n");
        } else {
          retrievedContent = fullContent.substring(0, 4000) + "\n...[Nội dung còn tiếp]...";
        }
      }

      const resolvedFileUrl = docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn || "";
      context = `[Tài liệu] Tên: ${docItem.title || "Không rõ"}, Loại: ${docItem.type || "Không rõ"}\nfile_url: ${resolvedFileUrl}\nNội dung trích xuất:\n${retrievedContent}`;
    } else {
      context = "Không tìm thấy tài liệu EHS liên quan trực tiếp đến câu hỏi hoặc bạn không có quyền truy cập.";
    }

    // 6. Build Generative AI client
    let systemInstruction = "Bạn là Trợ lý EHS AI SafeOne. Khi người dùng hỏi về một quy trình, SOP, hoặc MSDS, hãy đọc kỹ phần Context được cung cấp và TÓM TẮT CHI TIẾT các bước thực hiện, quy định an toàn hoặc cách vận hành cho họ. Ở cuối câu trả lời, ĐỒNG THỜI cung cấp đường link tài liệu gốc dựa trên file_url dưới dạng hyperlink Tên tài liệu để họ tải về nếu muốn xem toàn văn.";
    if (additionalContext) {
      systemInstruction += "\n\n" + additionalContext;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(200).json({
        response: "Xin lỗi, Hệ thống Trợ lý ảo EHS hiện chưa được cấu hình Google Gemini API Key. Vui lòng liên hệ IT để cập nhật khóa cấu hình."
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstruction
    });

    // 7. Limit history to last 3 pairs (6 messages)
    let cleanHistory = [];
    if (history.length > 0) {
      const lastMessages = history.slice(-6);
      let startIndex = 0;
      while (startIndex < lastMessages.length && lastMessages[startIndex].role !== "user") {
        startIndex++;
      }
      cleanHistory = lastMessages.slice(startIndex);
    }

    const chat = model.startChat({
      history: cleanHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.2
      }
    });

    const userPrompt = `Context:\n${context}\n\nCâu hỏi: ${question}`;
    const result = await chat.sendMessage(userPrompt);
    const text = result.response.text();

    if (topDocs.length > 0) {
      const docItem = topDocs[0];
      const resolvedFileUrl = docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn || "";
      res.status(200).json({ 
        response: text,
        file_url: resolvedFileUrl,
        doc_title: docItem.title || "Tài liệu"
      });
    } else {
      res.status(200).json({ response: text });
    }
  } catch (error) {
    console.error("Generative AI error in askAI:", error);
    res.status(500).json({ error: "Lỗi kết nối dịch vụ Gemini AI" });
  }
}

/**
 * Endpoint for spell checking (checkSpelling)
 */
export async function checkSpelling(req, res) {
  try {
    const text = (req.body && req.body.text) ? String(req.body.text) : "";
    if (!text.trim()) {
      return res.status(200).json({ response: "" });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(200).json({ response: text }); // return original text if no key is configured
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = "Hãy sửa lỗi chính tả và ngữ pháp tiếng Việt cho văn bản sau (nếu có). Chỉ trả về văn bản kết quả đã sửa, không giải thích, không thêm bất kỳ văn bản nào khác. Nếu văn bản gốc không có lỗi, hãy trả về chính xác văn bản gốc.";

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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
}

/**
 * Endpoint for PDF text extraction (extractMarkdown)
 */
export async function extractMarkdown(req, res) {
  const { docId, fileUrl } = req.body;
  if (!docId || !fileUrl) {
    return res.status(400).json({ error: "Thiếu ID hoặc đường dẫn tài liệu." });
  }

  try {
    console.log(`Starting PDF to Markdown extraction via local Express backend for doc ${docId}`);
    
    // Download the PDF from fileUrl
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured on this server." });
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
    console.log(`Extracted markdown for document ${docId}. Length: ${markdown.length}`);

    // Update in MySQL firestore_mock database
    const [existing] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      ["documents", docId]
    );

    if (existing.length > 0) {
      const currentData = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
      currentData.markdownContent = markdown;
      
      await pool.query(
        "UPDATE firestore_mock SET data = ? WHERE collection = ? AND id = ?",
        [JSON.stringify(currentData), "documents", docId]
      );
      console.log(`Successfully updated markdown content for document ${docId} in firestore_mock.`);
    } else {
      console.warn(`Document ${docId} not found in MySQL firestore_mock, cannot update markdown.`);
    }

    res.status(200).json({ success: true, length: markdown.length });
  } catch (error) {
    console.error(`Error in extractMarkdown controller:`, error);
    res.status(500).json({ error: error.message || "Lỗi khi trích xuất tài liệu." });
  }
}
