/* eslint-env node */
/* global console */
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection("settings").doc("ai_config").get();
    const config = snap.data();
    const apiKey = config.apiKey;
    const genAI = new GoogleGenerativeAI(apiKey);

    const testCases = [
      {
        name: "Old System Instruction",
        systemInstruction: "Bạn là bộ lọc sửa lỗi chính tả và ngữ pháp tiếng Việt cho hệ thống SafeOne. Hãy sửa lỗi chính tả cho đoạn văn sau. CHỈ trả về đoạn văn đã sửa lỗi, TUYỆT ĐỐI KHÔNG giải thích, KHÔNG chào hỏi, KHÔNG thêm bớt nội dung của người dùng."
      },
      {
        name: "New System Instruction 1",
        systemInstruction: "Hãy sửa lỗi chính tả tiếng Việt trong đoạn văn được cung cấp. Chỉ trả về đoạn văn sau khi đã được sửa lỗi, không thêm bất kỳ văn bản nào khác. Nếu không có lỗi, hãy trả về chính xác đoạn văn gốc."
      },
      {
        name: "New System Instruction 2 (Simple)",
        systemInstruction: "Sửa lỗi chính tả và dấu câu cho văn bản tiếng Việt sau. Chỉ trả về văn bản kết quả đã sửa, không giải thích gì thêm."
      }
    ];

    const text = "ăng uống";

    for (const tc of testCases) {
      console.log(`\n=== Testing: ${tc.name} ===`);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: tc.systemInstruction
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: text }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 20
        }
      });
      console.log("responseText:", JSON.stringify(result.response.text()));
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

run();
