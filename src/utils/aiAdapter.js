// src/utils/aiAdapter.js
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Call AI Service with Smart Adapter (Google Gemini / OpenAI ChatGPT / Fallback URL)
 * @param {string} prompt 
 * @param {Array} history 
 * @param {string} fallbackUrl 
 * @returns {Promise<{response: string}>}
 */
export async function callAIService(prompt, history = [], fallbackUrl) {
  try {
    // 1. Lấy cấu hình AI từ Firestore
    const docRef = doc(db, "settings", "ai_config");
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const config = snap.data();
      const { provider, model, apiKey } = config;

      // Nếu có đầy đủ API Key và Nhà cung cấp hợp lệ
      if (apiKey && apiKey.trim() !== "" && apiKey !== "MOCKED_SAVED_KEY") {
        if (provider === 'google') {
          // Gọi API chính thức của Google Gemini
          const geminiModel = model || 'gemini-2.0-flash';
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

          // Format tin nhắn từ history sang Gemini format
          // Gemini role: "user" | "model"
          const contents = history.map(h => ({
            role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
            parts: Array.isArray(h.parts) ? h.parts : [{ text: h.parts?.[0]?.text || h.text || "" }]
          }));

          // Thêm tin nhắn hiện tại vào
          contents.push({
            role: "user",
            parts: [{ text: prompt }]
          });

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
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
          // OpenAI role: "user" | "assistant" | "system"
          const messages = history.map(h => ({
            role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
            content: typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "")
          }));

          // Thêm tin nhắn hiện tại vào
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
    console.error("Lỗi trong Bộ chuyển đổi AI (Adapter):", error);
    // Nếu có lỗi khi gọi trực tiếp, tự động chuyển về fallback bên dưới
  }

  // 2. Fallback: Nếu không có cấu hình, thiếu API Key, lỗi hoặc không khớp nhà cung cấp
  console.log("Không có cấu hình API Key tùy chỉnh hoặc xảy ra lỗi. Đang sử dụng Fallback Cloud Function:", fallbackUrl);
  
  // Format lịch sử về dạng chuẩn của Cloud Function ban đầu
  const standardHistory = history.map(h => {
    const text = typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "");
    const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
    return {
      role,
      parts: [{ text }]
    };
  });

  const response = await fetch(fallbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, history: standardHistory }),
  });

  if (!response.ok) {
    throw new Error(`Fallback Cloud Function returned ${response.status}`);
  }

  return await response.json();
}
