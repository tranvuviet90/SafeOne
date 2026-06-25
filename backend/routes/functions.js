import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

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

    const STOP_WORDS = new Set(["cho", "tôi", "của", "và", "là", "các", "trong", "tại", "có", "này", "để", "với", "những", "một", "về", "ra", "lên", "ta", "nào", "đó", "này"]);

    const keywords = question.toLowerCase()
      .replace(/[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

    const docs = await getAITrainedDocuments();

    const scoredDocs = docs.map(docItem => {
      const docType = docItem.type || "";
      if (!hasDocAccess(docType, userRoles)) {
        return { docItem, score: -1 };
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
          score += 15;
        }
        if (fileName.includes(kw)) {
          keywordMatchedInTitle = true;
          score += 8;
        }
        if (content.includes(kw)) {
          keywordMatchedInContent = true;
          score += 2;
          
          const wordRegex = new RegExp("(?<=^|[^\\p{L}\\p{N}])" + kw + "(?=[^\\p{L}\\p{N}]|$)", "giu");
          const wordMatches = content.match(wordRegex);
          if (wordMatches) {
            score += Math.min(wordMatches.length * 0.2, 5);
          }
        }

        if (keywordMatchedInTitle) matchedTitleKeywords++;
        if (keywordMatchedInContent) matchedContentKeywords++;
      });

      const uniqueKeywordsMatched = Math.max(matchedTitleKeywords, matchedContentKeywords);
      score += uniqueKeywordsMatched * 20;

      return { docItem, score };
    });

    const topDocs = scoredDocs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(item => item.docItem);

    const apiKey = await getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: "Gemini API key is not configured." });
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

    let systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
    if (additionalContext) {
      systemInstruction += "\n\n" + additionalContext;
    }

    let context = "";
    if (topDocs.length > 0) {
      context = "=== TÀI LIỆU HUẤN LUYỆN KHÁCH HÀNG / KNOWLEDGE BASE (RAG) ===\n";
      topDocs.forEach(d => {
        context += `\n[Tài liệu: ${d.title}]\n${d.markdownContent || ""}\n[Kết thúc tài liệu: ${d.title}]\n`;
      });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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

    if (topDocs.length > 0) {
      const docItem = topDocs[0];
      const resolvedFileUrl = docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn || "";
      res.status(200).json({ 
        response: responseText,
        file_url: resolvedFileUrl,
        doc_title: docItem.title || "Tài liệu"
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
});

// 3. POST /extractMarkdown (JWT authentication required - Correction)
router.post("/extractMarkdown", authenticateToken, async (req, res) => {
  const { docId, fileUrl } = req.body;
  if (!docId || !fileUrl) {
    return res.status(400).json({ error: "Thiếu ID hoặc đường dẫn tài liệu." });
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

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

    if (existing.length > 0) {
      const currentData = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
      currentData.markdownContent = markdown;
      
      await pool.query(
        "UPDATE firestore_mock SET data = ? WHERE collection = ? AND id = ?",
        [JSON.stringify(currentData), "documents", docId]
      );
    }

    res.status(200).json({ success: true, length: markdown.length });
  } catch (error) {
    console.error("Error in extractMarkdown:", error);
    res.status(500).json({ error: error.message || "Lỗi khi trích xuất tài liệu." });
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
        
        // Hashing via bcrypt with 12 salt rounds (Rule 5)
        const newPasswordHash = await bcrypt.hash(data.newPassword, 12);
        
        await pool.query("UPDATE users SET password_hash = ? WHERE uid = ?", [newPasswordHash, targetUid]);
        break;
      }
      case "changeRole":
        if (!data || !data.newRole) return res.status(400).json({ error: "Thiếu quyền mới" });
        const newRoleStr = Array.isArray(data.newRole) ? data.newRole.join(",") : data.newRole;
        await pool.query("UPDATE users SET role = ? WHERE uid = ?", [newRoleStr, targetUid]);
        break;
      case "disable":
        await pool.query("UPDATE users SET disabled = 1 WHERE uid = ?", [targetUid]);
        break;
      case "enable":
        await pool.query("UPDATE users SET disabled = 0 WHERE uid = ?", [targetUid]);
        break;
      case "delete":
        await pool.query("DELETE FROM users WHERE uid = ?", [targetUid]);
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
      case "rejectRoleRequest":
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
