// src/utils/aiAdapter.js
import dbService from '../services/dbService';
import apiClient from '../services/apiClient';

/**
 * Call AI Service with Smart Adapter (Google Gemini / OpenAI ChatGPT / Fallback URL)
 * @param {string} prompt 
 * @param {Array} history 
 * @param {string} fallbackUrl 
 * @returns {Promise<{response: string}>}
 */
export async function callAIService(prompt, history = [], fallbackUrl, additionalContext = "") {
  try {
    // 1. Lấy cấu hình AI từ dbService settings/ai_config
    const config = await dbService.getDoc("settings", "ai_config");

    if (config && config._exists !== false) {
      const { provider, model, apiKey, systemInstruction, trainedDocs } = config;

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
        const STOP_WORDS = new Set(["cho", "tôi", "của", "và", "là", "các", "trong", "tại", "có", "này", "để", "với", "những", "một", "về", "ra", "lên", "ta", "nào", "đó", "này"]);

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
              score += 15;
            }
            if (content.includes(kw)) {
              keywordMatchedInContent = true;
              score += 2;
              
              const wordRegex = new RegExp(kw, "g");
              const matches = content.match(wordRegex);
              if (matches) {
                score += Math.min(matches.length * 0.2, 5);
              }
            }

            if (keywordMatchedInTitle) matchedTitleKeywords++;
            if (keywordMatchedInContent) matchedContentKeywords++;
          });

          const uniqueKeywordsMatched = Math.max(matchedTitleKeywords, matchedContentKeywords);
          score += uniqueKeywordsMatched * 20;

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

      if (apiKey && apiKey.trim() !== "" && apiKey !== "MOCKED_SAVED_KEY") {
        if (provider === 'google') {
          let geminiModel = model || 'gemini-2.5-flash';
          
          if (geminiModel === 'gemini-2.0-flash' || geminiModel === 'gemini-1.5-flash') {
            geminiModel = 'gemini-2.5-flash';
          } else if (geminiModel === 'gemini-1.5-pro') {
            geminiModel = 'gemini-2.5-pro';
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

          const contents = history.map(h => ({
            role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
            parts: Array.isArray(h.parts) ? h.parts : [{ text: h.parts?.[0]?.text || h.text || "" }]
          }));

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
          const openaiModel = model || 'gpt-4o-mini';
          const messages = [];

          if (fullSystemInstruction && fullSystemInstruction.trim() !== "") {
            messages.push({
              role: "system",
              content: fullSystemInstruction
            });
          }

          history.forEach(h => {
            messages.push({
              role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
              content: typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "")
            });
          });

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
  }

  // Fallback to Express single-port backend askAI function
  const standardHistory = history.map(h => {
    const text = typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "");
    const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text }]
    };
  });

  const response = await apiClient.post("/api/functions/askAI", {
    prompt: prompt,
    additionalContext: additionalContext,
    history: standardHistory
  });

  return response.data;
}

/**
 * Call Spell Check Service with optimized parameters
 * @param {string} text 
 * @param {string} fallbackUrl
 * @returns {Promise<{response: string}>}
 */
export async function callSpellCheckService(text, fallbackUrl) {
  if (!text || !text.trim()) {
    return { response: "" };
  }

  try {
    const config = await dbService.getDoc("settings", "ai_config");

    if (config && config._exists !== false) {
      const { provider, model, apiKey } = config;

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
          }
        }
      }
    }
  } catch (error) {
    console.warn("Lỗi trong Bộ chuyển đổi AI Spellcheck - chuyển sang Cloud Function fallback:", error.message || error);
  }

  // Fallback to Express single-port backend checkSpelling function
  const response = await apiClient.post("/api/functions/checkSpelling", { text });
  return response.data;
}
