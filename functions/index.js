/* eslint-env node */
/* global fetch, Buffer */
// functions/index.js
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const GOOGLE_API_KEY = process.env.GOOGLE_APIKEY;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// In-memory cache variables for Firestore EHS knowledge to minimize read operations
let cachedKnowledgeChunks = null;
let lastCacheUpdateTime = 0;

async function getKnowledgeChunks() {
  const now = Date.now();
  // Cache expires in 5 minutes (300,000 ms)
  if (cachedKnowledgeChunks && (now - lastCacheUpdateTime < 300000)) {
    return cachedKnowledgeChunks;
  }
  try {
    const snapshot = await db.collection("ehs_knowledge").get();
    const chunks = [];
    snapshot.forEach(doc => {
      chunks.push(doc.data());
    });
    cachedKnowledgeChunks = chunks;
    lastCacheUpdateTime = now;
    logger.info(`Updated ehs_knowledge cache. Total chunks retrieved: ${chunks.length}`);
    return cachedKnowledgeChunks;
  } catch (error) {
    logger.error("Failed to update ehs_knowledge cache:", error);
    if (cachedKnowledgeChunks) {
      logger.warn("Using stale in-memory cache due to Firestore error.");
      return cachedKnowledgeChunks;
    }
    throw error;
  }
}

// In-memory cache variables for Firestore documents to minimize read operations
let cachedDocuments = null;
let lastDocsCacheTime = 0;

async function getAITrainedDocuments() {
  const now = Date.now();
  // Cache expires in 5 minutes (300,000 ms)
  if (cachedDocuments && (now - lastDocsCacheTime < 300000)) {
    return cachedDocuments;
  }
  try {
    const snapshot = await db.collection("documents").where("isAITrained", "==", true).get();
    const docs = [];
    snapshot.forEach(docSnap => {
      docs.push({ id: docSnap.id, ...docSnap.data() });
    });
    cachedDocuments = docs;
    lastDocsCacheTime = now;
    logger.info(`Updated documents cache. Total documents retrieved: ${docs.length}`);
    return cachedDocuments;
  } catch (error) {
    logger.error("Failed to update documents cache:", error);
    if (cachedDocuments) {
      logger.warn("Using stale in-memory documents cache due to Firestore error.");
      return cachedDocuments;
    }
    throw error;
  }
}

// ===================================================================
// ### CHATBOT ENGINE - RAG SYSTEM & SPELL CHECKER ###
// ===================================================================

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

exports.upsertDocument = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn phải đăng nhập để tải tài liệu.");
    }
    
    const { doc_id, doc_name, doc_type, file_url, markdown_content } = request.data;
    if (!doc_id || !doc_name || !doc_type || !markdown_content) {
      throw new HttpsError("invalid-argument", "Thiếu thông tin tài liệu bắt buộc.");
    }

    try {
      // 1. Delete old chunks for this doc_id
      const collectionRef = db.collection("ehs_knowledge");
      const snapshot = await collectionRef.where("doc_id", "==", doc_id).get();
      
      const deletePromises = [];
      snapshot.forEach(doc => {
        deletePromises.push(doc.ref.delete());
      });
      await Promise.all(deletePromises);
      logger.info(`Deleted old chunks for doc_id: ${doc_id}`);

      // 2. Split content into chunks
      const chunks = chunkText(markdown_content, 500);
      logger.info(`Generated ${chunks.length} chunks for doc_id: ${doc_id}`);

      // 3. Write new chunks
      const batch = db.batch();
      chunks.forEach((chunk, index) => {
        const chunkDocId = `${doc_id}_chunk_${index}`;
        const docRef = collectionRef.doc(chunkDocId);
        batch.set(docRef, {
          chunk_content: chunk,
          doc_id: doc_id,
          doc_name: doc_name,
          doc_type: doc_type,
          file_url: file_url || "",
          last_updated: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      logger.info(`Uploaded new chunks successfully for doc_id: ${doc_id}`);

      return { success: true, chunksCount: chunks.length };
    } catch (error) {
      logger.error("Error upserting document:", error);
      throw new HttpsError("internal", error.message || "Lỗi khi nạp tài liệu.");
    }
  }
);

exports.askAI = onRequest(
  {
    region: "asia-southeast1",
    secrets: ["GOOGLE_APIKEY"],
    cors: true,
  },
  async (req, res) => {
    try {
      if (req.method === "GET") {
        return res.status(200).json({ ok: true, message: "SafeOne EHS Assistant ready" });
      }

      const question = (req.body && req.body.prompt) ? String(req.body.prompt).trim() : "";
      const additionalContext = (req.body && req.body.additionalContext) ? String(req.body.additionalContext).trim() : "";
      const history = Array.isArray(req.body?.history) ? req.body.history : [];

      if (!question) {
        return res.status(400).json({ error: "Missing prompt/question" });
      }

      // Check User Authentication and Roles from token and Firestore
      const authHeader = req.headers.authorization;
      let userRoles = [];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);
          const uid = decodedToken.uid;
          const userSnap = await db.collection("users").doc(uid).get();
          if (userSnap.exists) {
            const rawRole = userSnap.data().role;
            userRoles = (Array.isArray(rawRole) ? rawRole : (rawRole ? String(rawRole).split(",") : []))
              .map(r => r.trim().toLowerCase());
          }
        } catch (err) {
          logger.warn("Verify user token failed in askAI:", err.message);
        }
      }

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

      // Stop words to exclude from keyword scoring to reduce noise from common words
      const STOP_WORDS = new Set(["cho", "tôi", "của", "và", "là", "các", "trong", "tại", "có", "này", "để", "với", "những", "một", "về", "ra", "lên", "ta", "nào", "đó", "này"]);

      // 1. Extract keywords for search (based purely on the clean user query)
      const keywords = question.toLowerCase()
        .replace(/[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

      // 2. Fetch all isAITrained documents (utilizing in-memory cache to save Firestore reads)
      const docs = await getAITrainedDocuments();

      // 3. Score documents based on keyword match and check role access permissions
      const scoredDocs = docs.map(docItem => {
        const docType = docItem.type || "";
        if (!hasDocAccess(docType, userRoles)) {
          return { docItem, score: -1 }; // Exclude unauthorized documents
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

      // 4. Sort and select top 1 document with score > 0 (strictly limited to 1 document to save tokens)
      const topDocs = scoredDocs
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 1)
        .map(item => item.docItem);

      // 5. Generate Context (with local RAG chunking to prevent huge contexts)
      let context = "";
      if (topDocs.length > 0) {
        const docItem = topDocs[0];
        const fullContent = docItem.markdownContent || "";
        let retrievedContent = "";

        if (fullContent.length <= 10000) {
          retrievedContent = fullContent;
        } else {
          // Split full content into small chunks locally (e.g., 2500 characters per chunk)
          const contentChunks = chunkText(fullContent, 2500);
          
          // Score each chunk against keywords
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
          
          // Take top 3 highest scoring chunks
          const topChunks = scoredChunks
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(c => c.chunk);
            
          if (topChunks.length > 0) {
            retrievedContent = topChunks.join("\n...\n");
          } else {
            // Fallback: take first 4000 chars if no keyword match
            retrievedContent = fullContent.substring(0, 4000) + "\n...[Nội dung còn tiếp]...";
          }
        }

        const resolvedFileUrl = docItem.fileUrlVi || docItem.fileUrl || docItem.fileUrlEn || "";
        context = `[Tài liệu] Tên: ${docItem.title || "Không rõ"}, Loại: ${docItem.type || "Không rõ"}\nfile_url: ${resolvedFileUrl}\nNội dung trích xuất:\n${retrievedContent}`;
      } else {
        context = "Không tìm thấy tài liệu EHS liên quan trực tiếp đến câu hỏi hoặc bạn không có quyền truy cập.";
      }

      // 6. Build model instance
      let systemInstruction = "Bạn là Trợ lý EHS AI SafeOne. Khi người dùng hỏi về một quy trình, SOP, hoặc MSDS, hãy đọc kỹ phần Context được cung cấp và TÓM TẮT CHI TIẾT các bước thực hiện, quy định an toàn hoặc cách vận hành cho họ. Ở cuối câu trả lời, ĐỒNG THỜI cung cấp đường link tài liệu gốc dựa trên file_url dưới dạng hyperlink Tên tài liệu để họ tải về nếu muốn xem toàn văn.";
      if (additionalContext) {
        systemInstruction += "\n\n" + additionalContext;
      }
      
      // Resolve API key in case global genAI is not configured (e.g. local emulator or custom VPS)
      let activeGenAI = genAI;
      if (!GOOGLE_API_KEY) {
        try {
          const configSnap = await db.collection("settings").doc("ai_config").get();
          const apiKey = configSnap.data()?.apiKey;
          if (apiKey) {
            activeGenAI = new GoogleGenerativeAI(apiKey);
          }
        } catch (err) {
          logger.warn("Failed to retrieve fallback API key from Firestore settings:", err.message);
        }
      }

      const model = activeGenAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction,
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
      logger.error("Error in askAI:", error);
      res.status(500).json({ error: "Failed to get response from AI" });
    }
  }
);

exports.checkSpelling = onRequest(
  {
    region: "asia-southeast1",
    secrets: ["GOOGLE_APIKEY"],
    cors: true,
  },
  async (req, res) => {
    try {
      if (req.method === "GET") {
        return res.status(200).json({ ok: true, message: "SafeOne Spellchecker ready" });
      }

      const text = (req.body && req.body.text) ? String(req.body.text) : "";
      if (!text.trim()) {
        return res.status(200).json({ response: "" });
      }

      // Tăng giới hạn token để đủ chỗ cho suy nghĩ (reasoning/thoughts) của mô hình Gemini 2.5
      const maxOutputTokens = 200;

      const systemInstruction = "Hãy sửa lỗi chính tả và ngữ pháp tiếng Việt cho văn bản sau (nếu có). Chỉ trả về văn bản kết quả đã sửa, không giải thích, không thêm bất kỳ văn bản nào khác. Nếu văn bản gốc không có lỗi, hãy trả về chính xác văn bản gốc.";

      // Resolve API key in case global genAI is not configured (e.g. local emulator or custom VPS)
      let activeGenAI = genAI;
      if (!GOOGLE_API_KEY) {
        try {
          const configSnap = await db.collection("settings").doc("ai_config").get();
          const apiKey = configSnap.data()?.apiKey;
          if (apiKey) {
            activeGenAI = new GoogleGenerativeAI(apiKey);
          }
        } catch (err) {
          logger.warn("Failed to retrieve fallback API key from Firestore settings:", err.message);
        }
      }

      const model = activeGenAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: text }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: maxOutputTokens
        }
      });

      logger.info(`checkSpelling input: "${text}"`);
      logger.info("Gemini full response object:", JSON.stringify(result.response));

      const responseText = result.response.text().trim();
      logger.info(`checkSpelling output responseText: "${responseText}"`);
      res.status(200).json({ response: responseText });
    } catch (error) {
      logger.error("Error in checkSpelling:", error);
      res.status(500).json({ error: "Failed to verify spelling" });
    }
  }
);

// ===================================================================
// ### ADMIN USER MANAGEMENT & ROLE REQUESTS ###
// ===================================================================

async function verifyAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Bạn phải đăng nhập để thực hiện hành động này.");
  }
  const uid = request.auth.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Bạn không có quyền thực hiện hành động này.");
  }
}

exports.listUsers = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    await verifyAdmin(request);
    
    try {
      const listUsersResult = await admin.auth().listUsers(1000);
      const authUsers = listUsersResult.users;
      
      const usersSnap = await db.collection("users").get();
      const firestoreUsers = {};
      usersSnap.forEach(doc => {
        firestoreUsers[doc.id] = doc.data();
      });
      
      const users = authUsers.map(u => ({
        uid: u.uid,
        email: u.email,
        name: firestoreUsers[u.uid]?.name || "Unknown",
        role: firestoreUsers[u.uid]?.role || "Unknown",
        disabled: u.disabled,
        createdAt: u.metadata.creationTime,
        lastSignInTime: u.metadata.lastSignInTime
      }));
      
      return { users };
    } catch (error) {
      logger.error("Error listing users:", error);
      throw new HttpsError("internal", "Không thể lấy danh sách người dùng.");
    }
  }
);

exports.adminUserAction = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    await verifyAdmin(request);
    const { action, targetUid, data } = request.data;
    
    if (!targetUid && action !== "createUser") {
      throw new HttpsError("invalid-argument", "Thiếu UID người dùng.");
    }
    
    try {
      switch (action) {
        case "createUser": {
          if (!data || !data.email || !data.password || !data.role) {
            throw new HttpsError("invalid-argument", "Thiếu thông tin tạo tài khoản.");
          }
          const newAuthUser = await admin.auth().createUser({
            email: data.email,
            password: data.password,
            displayName: data.name || data.email.split("@")[0],
          });
          await db.collection("users").doc(newAuthUser.uid).set({
            email: data.email,
            name: data.name || data.email.split("@")[0],
            role: data.role,
            disabled: false,
          });
          break;
        }
        case "resetPassword":
          if (!data || !data.newPassword) throw new HttpsError("invalid-argument", "Thiếu mật khẩu mới.");
          await admin.auth().updateUser(targetUid, { password: data.newPassword });
          break;
        case "changeRole":
          if (!data || !data.newRole) throw new HttpsError("invalid-argument", "Thiếu quyền mới.");
          await db.collection("users").doc(targetUid).update({ role: data.newRole });
          break;
        case "disable":
          await admin.auth().updateUser(targetUid, { disabled: true });
          break;
        case "enable":
          await admin.auth().updateUser(targetUid, { disabled: false });
          break;
        case "delete":
          await admin.auth().deleteUser(targetUid);
          await db.collection("users").doc(targetUid).delete();
          break;
        case "changeName":
          if (!data || !data.newName) throw new HttpsError("invalid-argument", "Thiếu tên mới.");
          await db.collection("users").doc(targetUid).update({ name: data.newName });
          await admin.auth().updateUser(targetUid, { displayName: data.newName });
          break;
        case "approveRoleRequest":
          if (!data || !data.requestId || !data.newRole) throw new HttpsError("invalid-argument", "Thiếu thông tin yêu cầu.");
          await db.collection("users").doc(targetUid).update({ role: data.newRole });
          await db.collection("role_requests").doc(data.requestId).update({ status: "approved" });
          await db.collection("notifications").add({
            type: "role_response",
            message: `Yêu cầu đổi quyền thành "${data.newRole}" của bạn đã được chấp nhận.`,
            targetUserId: targetUid,
            readBy: [],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          break;
        case "rejectRoleRequest":
          if (!data || !data.requestId) throw new HttpsError("invalid-argument", "Thiếu ID yêu cầu.");
          await db.collection("role_requests").doc(data.requestId).update({ status: "rejected" });
          await db.collection("notifications").add({
            type: "role_response",
            message: "Yêu cầu đổi quyền của bạn đã bị từ chối.",
            targetUserId: targetUid,
            readBy: [],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          break;
        default:
          throw new HttpsError("invalid-argument", "Hành động không hợp lệ.");
      }
      return { success: true };
    } catch (error) {
      logger.error("Admin user action error:", error);
      throw new HttpsError("internal", error.message || "Lỗi khi thực hiện hành động.");
    }
  }
);

exports.submitRoleRequest = onCall(
  { region: "asia-southeast1", cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Bạn phải đăng nhập.");
    const uid = request.auth.uid;
    const { requestedRole, currentRole, name, email } = request.data;
    
    if (!requestedRole) throw new HttpsError("invalid-argument", "Thiếu role yêu cầu.");
    
    try {
      await db.collection("role_requests").add({
        uid,
        name,
        email,
        currentRole,
        requestedRole,
        status: "pending",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("notifications").add({
        type: "role_request",
        message: `${name} vừa yêu cầu đổi quyền từ "${currentRole || "Chưa có"}" sang "${requestedRole}".`,
        targetRoles: ["admin"],
        readBy: [],
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      logger.error("Submit role request error:", error);
      throw new HttpsError("internal", "Không thể gửi yêu cầu.");
    }
  }
);

exports.extractMarkdown = onCall(
  {
    region: "asia-southeast1",
    secrets: ["GOOGLE_APIKEY"],
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Bạn phải đăng nhập để thực hiện hành động này.");
    }
    const { docId, fileUrl } = request.data;
    if (!docId || !fileUrl) {
      throw new HttpsError("invalid-argument", "Thiếu ID hoặc đường dẫn tài liệu.");
    }

    try {
      logger.info(`Starting PDF to Markdown extraction via extractMarkdown onCall for doc ${docId}`);
      // Download the PDF from fileUrl
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

      // Resolve API key in case global genAI is not configured (e.g. local environment)
      let activeGenAI = genAI;
      if (!GOOGLE_API_KEY) {
        const configSnap = await db.collection("settings").doc("ai_config").get();
        const apiKey = configSnap.data()?.apiKey;
        if (apiKey) {
          activeGenAI = new GoogleGenerativeAI(apiKey);
        }
      }

      const model = activeGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
      logger.info(`Extracted markdown for document ${docId}. Length: ${markdown.length}`);

      // Update the Firestore document with the extracted markdown
      await db.collection("documents").doc(docId).update({
        markdownContent: markdown
      });

      return { success: true, length: markdown.length };

    } catch (error) {
      logger.error(`Error processing PDF to Markdown in extractMarkdown for doc ${docId}:`, error);
      throw new HttpsError("internal", error.message || "Lỗi khi trích xuất tài liệu.");
    }
  }
);
