// backend/config/jwtSecret.js
//
// Khóa ký/xác thực JWT dùng chung cho toàn hệ thống.
//
// Thứ tự ưu tiên:
//   1) Biến môi trường JWT_SECRET trong .env (khuyến nghị cho production).
//   2) Khóa đã lưu ở backend/.jwt_secret (từ lần chạy trước).
//   3) Nếu chưa có: TỰ SINH khóa ngẫu nhiên MỘT LẦN và lưu vào backend/.jwt_secret.
//
// Nhờ vậy IT không cần chạy lệnh tạo khóa — chỉ khởi động backend là đăng nhập được,
// mà vẫn an toàn (khóa ngẫu nhiên, không hardcode) và ổn định (không đổi sau mỗi lần chạy).

import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tự nạp .env (giống config/db.js) để không phụ thuộc thứ tự import của server.js.
dotenv.config({ path: path.join(__dirname, "../.env") });

const secretFile = path.join(__dirname, "..", ".jwt_secret");

function resolveJwtSecret() {
  const fromEnv = (process.env.JWT_SECRET || "").trim();
  if (fromEnv) return fromEnv;

  // Đọc lại khóa đã sinh ở lần chạy trước (nếu có).
  try {
    const saved = fs.readFileSync(secretFile, "utf8").trim();
    if (saved) return saved;
  } catch {
    /* chưa có file — sẽ tạo mới bên dưới */
  }

  // Sinh khóa mới và lưu lại để dùng ổn định.
  const generated = crypto.randomBytes(48).toString("hex");
  try {
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.warn(
      "⚠️  Chưa cấu hình JWT_SECRET trong .env — đã tự sinh khóa ngẫu nhiên và lưu tại backend/.jwt_secret.\n" +
      "   Khuyến nghị: đặt JWT_SECRET trong .env để chủ động quản lý."
    );
  } catch (err) {
    console.warn("⚠️  Không ghi được backend/.jwt_secret, tạm dùng khóa trong bộ nhớ (sẽ đổi sau mỗi lần khởi động):", err.message);
  }
  return generated;
}

// Giải quyết một lần khi nạp module rồi cache lại (module ESM là singleton).
const JWT_SECRET = resolveJwtSecret();

export default JWT_SECRET;
