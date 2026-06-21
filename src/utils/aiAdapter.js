// src/utils/aiAdapter.js
import { db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Call AI Service with Smart Adapter (Google Gemini / OpenAI ChatGPT / Fallback URL)
 * @param {string} prompt 
 * @param {Array} history 
 * @param {string} fallbackUrl 
 * @returns {Promise<{response: string}>}
 */
export async function callAIService(prompt, history = [], fallbackUrl, additionalContext = "") {
  try {
    // 1. Lấy cấu hình AI từ Firestore
    const docRef = doc(db, "settings", "ai_config");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const config = snap.data();
      const { provider, model, apiKey, systemInstruction, trainedDocs } = config;

      // Kết hợp chỉ dẫn hệ thống với các tài liệu đã huấn luyện để làm tri thức nền
      const DEFAULT_SYSTEM_INSTRUCTION = "Bạn là một nhân viên thuộc bộ phận EHS (An toàn, Sức khỏe và Môi trường) của nhà máy SafeOne. Hãy xưng hô và trả lời một cách tự nhiên, thân thiện và chân thực như một người đồng nghiệp thật sự.\n\n" +
        "Nguyên tắc trả lời:\n" +
        "1. Lối nói ngắn gọn, súc tích, dễ hiểu và đi thẳng vào vấn đề. Tránh dài dòng hoặc quá phức tạp.\n" +
        "2. Sử dụng tiếng Việt lịch sự, thể hiện tinh thần hỗ trợ và trách nhiệm cao về an toàn lao động.\n" +
        "3. Khi trả lời, hãy ưu tiên tuyệt đối dựa trên các thông tin được cung cấp trong phần tài liệu huấn luyện (Knowledge Base) nếu có.\n\n" +
        "Xử lý khi thông tin vượt ngoài phạm vi huấn luyện:\n" +
        "- Nếu câu hỏi của người dùng nằm ngoài các tài liệu đã được huấn luyện hoặc chỉ dẫn an toàn nội bộ:\n" +
        "  * Hãy gợi ý một cách lịch sự rằng họ nên liên hệ trực tiếp với bộ phận EHS của nhà máy để nhận được hướng dẫn chính thức và rõ ràng nhất.\n" +
        "  * Đồng thời, hãy gợi ý thêm rằng trong thời gian chờ đợi phản hồi trực tiếp từ bộ phận EHS, bạn (với vai trò chatbot hỗ trợ) vẫn có thể cung cấp cho họ một số thông tin tham khảo nhanh dựa trên cơ sở dữ liệu AI tổng hợp của mình.";

      let fullSystemInstruction = systemInstruction && systemInstruction.trim() !== "" ? systemInstruction : DEFAULT_SYSTEM_INSTRUCTION;
      if (additionalContext) {
        fullSystemInstruction += "\n\n" + additionalContext;
      }
      if (Array.isArray(trainedDocs) && trainedDocs.length > 0) {
        // Stop words to exclude from keyword scoring to reduce noise from common words
        const STOP_WORDS = new Set(["cho", "tôi", "của", "và", "là", "các", "trong", "tại", "có", "này", "để", "với", "những", "một", "về", "ra", "lên", "ta", "nào", "đó", "này"]);

        // RAG client-side: chỉ chọn các tài liệu có từ khóa trùng khớp với câu hỏi để tiết kiệm tối đa token
        const keywords = prompt.toLowerCase()
          .replace(/[^a-zA-Z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐ\s]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

        const scoredDocs = trainedDocs.map(d => {
          const content = (d.content || "").toLowerCase();
          const name = (d.name || "").toLowerCase();
          
          let score = 0;
          let matchedTitleKeywords = 0;
          let matchedContentKeywords = 0;

          keywords.forEach(kw => {
            let keywordMatchedInTitle = false;
            let keywordMatchedInContent = false;

            if (name.includes(kw)) {
              keywordMatchedInTitle = true;
              score += 15; // Title match
            }
            if (content.includes(kw)) {
              keywordMatchedInContent = true;
              score += 2; // Content include
              
              // Frequency score (capped)
              const wordRegex = new RegExp(kw, "g");
              const matches = content.match(wordRegex);
              if (matches) {
                score += Math.min(matches.length * 0.2, 5); // Capped to 5 points max per keyword frequency
              }
            }

            if (keywordMatchedInTitle) matchedTitleKeywords++;
            if (keywordMatchedInContent) matchedContentKeywords++;
          });

          // Boost score based on number of unique core keywords matched
          const uniqueKeywordsMatched = Math.max(matchedTitleKeywords, matchedContentKeywords);
          score += uniqueKeywordsMatched * 20; // 20 points per unique keyword matched

          return { doc: d, score };
        });

        const relevantDocs = scoredDocs
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map(item => item.doc);

        if (relevantDocs.length > 0) {
          fullSystemInstruction += "\n\n=== TÀI LIỆU HUẤN LUYỆN KHÁCH HÀNG / KNOWLEDGE BASE (RAG) ===\n";
          relevantDocs.forEach(d => {
            fullSystemInstruction += `\n[Tài liệu: ${d.name}]\n${d.content}\n[Kết thúc tài liệu: ${d.name}]\n`;
          });
          fullSystemInstruction += "\nBạn hãy sử dụng các thông tin và tài liệu hướng dẫn trên để trả lời các câu hỏi của người dùng một cách chính xác nhất. Nếu thông tin không có trong tài liệu và cũng không có trong chỉ dẫn của bạn, hãy trả lời dựa trên kiến thức chung nhưng phải lịch sự và chuyên nghiệp.";
        }
      }

      // Nếu có đầy đủ API Key và Nhà cung cấp hợp lệ
      if (apiKey && apiKey.trim() !== "" && apiKey !== "MOCKED_SAVED_KEY") {
        if (provider === 'google') {
          // Gọi API chính thức của Google Gemini
          let geminiModel = model || 'gemini-2.5-flash';
          
          // Tự động chuyển đổi các mô hình cũ đã bị Google ngừng hỗ trợ sang mô hình mới hơn
          if (geminiModel === 'gemini-2.0-flash' || geminiModel === 'gemini-1.5-flash') {
            geminiModel = 'gemini-2.5-flash';
          } else if (geminiModel === 'gemini-1.5-pro') {
            geminiModel = 'gemini-2.5-pro';
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

          // Format tin nhắn từ history sang Gemini format
          const contents = history.map(h => ({
            role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
            parts: Array.isArray(h.parts) ? h.parts : [{ text: h.parts?.[0]?.text || h.text || "" }]
          }));

          // Thêm tin nhắn hiện tại vào
          contents.push({
            role: "user",
            parts: [{ text: prompt }]
          });

          const reqBody = { contents };
          if (fullSystemInstruction && fullSystemInstruction.trim() !== "") {
            reqBody.systemInstruction = {
              parts: [{ text: fullSystemInstruction }]
            };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Google API returned ${response.status}: ${errBody}`);
          }

          const resData = await response.json();
          const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          return { response: text };
        } else if (provider === 'openai') {
          // Gọi API chính thức của OpenAI
          const openaiModel = model || 'gpt-4o-mini';
          
          // Format tin nhắn từ history sang OpenAI format
          const messages = [];

          // Thêm system instruction ở đầu nếu có
          if (fullSystemInstruction && fullSystemInstruction.trim() !== "") {
            messages.push({
              role: "system",
              content: fullSystemInstruction
            });
          }

          // Thêm lịch sử trò chuyện
          history.forEach(h => {
            messages.push({
              role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
              content: typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "")
            });
          });

          // Thêm tin nhắn hiện tại
          messages.push({
            role: "user",
            content: prompt
          });

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: openaiModel,
              messages: messages
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OpenAI API returned ${response.status}: ${errBody}`);
          }

          const resData = await response.json();
          const text = resData?.choices?.[0]?.message?.content || '';
          return { response: text };
        }
      }
    }
  } catch (error) {
    console.warn("Lỗi trong Bộ chuyển đổi AI (Adapter) - chuyển sang Cloud Function fallback:", error.message || error);
    // Nếu có lỗi khi gọi trực tiếp, tự động chuyển về fallback bên dưới
  }

  let activeFallbackUrl = fallbackUrl;
  if (auth.isMock || import.meta.env.VITE_USE_MOCK_FIREBASE === 'true') {
    const API_BASE = import.meta.env.VITE_API_BASE || (() => {
      if (typeof window !== "undefined" && window.location) {
        if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          return window.location.origin;
        }
        if (window.location.port === "5000") {
          return window.location.origin;
        }
      }
      return "http://localhost:5000";
    })();
    activeFallbackUrl = `${API_BASE}/api/functions/askAI`;
  }

  console.log("Không có cấu hình API Key tùy chỉnh hoặc xảy ra lỗi. Đang sử dụng Fallback Cloud Function:", activeFallbackUrl);
  
  // Format lịch sử về dạng chuẩn của Cloud Function ban đầu
  const standardHistory = history.map(h => {
    const text = typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "");
    const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text }]
    };
  });

  const currentUser = auth.currentUser;
  let idToken = "";
  if (currentUser) {
    try {
      idToken = await currentUser.getIdToken();
    } catch (tokenErr) {
      console.warn("Không lấy được Firebase ID token:", tokenErr);
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(activeFallbackUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      prompt: prompt,
      additionalContext: additionalContext,
      history: standardHistory
    }),
  });

  if (!response.ok) {
    throw new Error(`Fallback Cloud Function returned ${response.status}`);
  }

  return await response.json();
}

/**
 * Call Spell Check Service with optimized parameters (No history, no RAG context, temperature 0, constrained tokens)
 * @param {string} text 
 * @param {string} fallbackUrl (The askAI fallback URL, which will be converted to the checkSpelling URL)
 * @returns {Promise<{response: string}>}
 */
export async function callSpellCheckService(text, fallbackUrl) {
  if (!text || !text.trim()) {
    return { response: "" };
  }

  try {
    // 1. Kiểm tra cấu hình AI từ Firestore
    const docRef = doc(db, "settings", "ai_config");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const config = snap.data();
      const { provider, model, apiKey } = config;

      // Nếu có API Key hợp lệ và là Google Gemini, thực hiện trực tiếp phía client (không nạp trainedDocs)
      if (apiKey && apiKey.trim() !== "" && apiKey !== "MOCKED_SAVED_KEY") {
        if (provider === 'google') {
          let geminiModel = model || 'gemini-2.5-flash';
          if (geminiModel === 'gemini-2.0-flash' || geminiModel === 'gemini-1.5-flash' || geminiModel === 'gemini-2.0-flash-lite') {
            geminiModel = 'gemini-2.5-flash';
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
          const maxOutputTokens = 200;

          const systemInstruction = "Hãy sửa lỗi chính tả và ngữ pháp tiếng Việt cho văn bản sau (nếu có). Chỉ trả về văn bản kết quả đã sửa, không giải thích, không thêm bất kỳ văn bản nào khác. Nếu văn bản gốc không có lỗi, hãy trả về chính xác văn bản gốc.";

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: text }] }],
              systemInstruction: {
                parts: [{ text: systemInstruction }]
              },
              generationConfig: {
                temperature: 0,
                maxOutputTokens: maxOutputTokens
              }
            })
          });

          if (response.ok) {
            const resData = await response.json();
            const responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return { response: responseText.trim() };
          } else {
            const errBody = await response.text();
            console.warn(`Direct Google Spellcheck returned ${response.status}: ${errBody}, falling back to Cloud Function.`);
          }
        }
      }
    }
  } catch (error) {
    console.warn("Lỗi trong Bộ chuyển đổi AI Spellcheck - chuyển sang Cloud Function fallback:", error.message || error);
  }

  // 2. Chuyển đổi thông minh askAI URL sang checkSpelling URL
  let activeFallbackUrl = fallbackUrl;
  if (auth.isMock || import.meta.env.VITE_USE_MOCK_FIREBASE === 'true') {
    const API_BASE = import.meta.env.VITE_API_BASE || (() => {
      if (typeof window !== "undefined" && window.location) {
        if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
          return window.location.origin;
        }
        if (window.location.port === "5000") {
          return window.location.origin;
        }
      }
      return "http://localhost:5000";
    })();
    activeFallbackUrl = `${API_BASE}/api/functions/checkSpelling`;
  } else {
    activeFallbackUrl = fallbackUrl
      .replace("/askAI", "/checkSpelling")
      .replace("askai-", "checkspelling-");
  }

  const response = await fetch(activeFallbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    throw new Error(`Fallback Cloud Function returned ${response.status}`);
  }

  return await response.json();
}
