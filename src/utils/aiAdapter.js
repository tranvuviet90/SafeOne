// src/utils/aiAdapter.js
import apiClient from '../services/apiClient';

/**
 * Gọi dịch vụ Chatbot AI qua backend.
 *
 * Toàn bộ logic AI (chọn API key, embedding retrieval, gọi Gemini) chạy ở backend
 * để: (1) không lộ API key ra trình duyệt, (2) chỉ gửi vài đoạn tài liệu liên quan
 * thay vì cả file — tiết kiệm token. Vì vậy frontend chỉ cần chuyển tiếp request.
 *
 * @param {string} prompt
 * @param {Array} history
 * @param {string} _fallbackUrl  (giữ để tương thích chữ ký cũ, không dùng)
 * @param {string} additionalContext
 * @returns {Promise<{response: string, file_url?: string, doc_title?: string}>}
 */
export async function callAIService(prompt, history = [], _fallbackUrl, additionalContext = "") {
  const standardHistory = history.map(h => {
    const text = typeof h.text === 'string' ? h.text : (h.parts?.[0]?.text || "");
    const role = h.role === 'model' || h.role === 'assistant' ? 'model' : 'user';
    return { role, parts: [{ text }] };
  });

  const response = await apiClient.post("/api/functions/askAI", {
    prompt,
    additionalContext,
    history: standardHistory
  });

  return response.data;
}

/**
 * Gọi dịch vụ kiểm tra chính tả qua backend (model lite, rẻ & nhanh).
 * Chỉ dò và trả về văn bản đã sửa cho đúng chính tả.
 *
 * @param {string} text
 * @returns {Promise<string>} văn bản đã sửa (hoặc văn bản gốc nếu không có lỗi)
 */
export async function callSpellCheckService(text) {
  if (!text || !text.trim()) {
    return "";
  }
  const response = await apiClient.post("/api/functions/checkSpelling", { text });
  return response.data?.response ?? "";
}
