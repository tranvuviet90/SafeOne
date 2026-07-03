// backend/seed-admin.js
//
// Lưới an toàn tạo tài khoản admin đầu tiên TỪ TERMINAL, không cần giao diện web.
// Dùng khi form "Khởi Tạo Hệ Thống" không hiện được (backend/DB trục trặc) hoặc
// khi cần tạo lại admin trên VPS.
//
// ⚠️ KHÔNG hardcode mật khẩu mặc định (như admin/admin) — bắt buộc truyền vào.
//
// Cách dùng (đứng trong thư mục backend/):
//   node seed-admin.js <email> <password> [tên]
//   npm run seed-admin -- <email> <password> [tên]
// Hoặc qua biến môi trường:
//   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... SEED_ADMIN_NAME=... node seed-admin.js
//
// Ví dụ:
//   node seed-admin.js admin@congty.com 'MatKhauManh#2026' "Super Admin"

import bcrypt from "bcrypt";
import pool from "./config/db.js";

function usage(msg) {
  if (msg) console.error(`\n❌ ${msg}`);
  console.error(`
Cách dùng:
  node seed-admin.js <email> <password> [tên]
  npm run seed-admin -- <email> <password> [tên]

Hoặc qua biến môi trường:
  SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.SEED_ADMIN_EMAIL || "").trim();
  const password = args[1] || process.env.SEED_ADMIN_PASSWORD || "";
  const name = (args[2] || process.env.SEED_ADMIN_NAME || "Super Admin").trim();

  if (!email || !password) {
    usage("Thiếu email hoặc mật khẩu.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    usage(`Email không hợp lệ: ${email}`);
  }
  if (password.length < 6) {
    usage("Mật khẩu quá ngắn (tối thiểu 6 ký tự).");
  }

  try {
    // Nếu email đã tồn tại thì dừng lại, không ghi đè âm thầm.
    const [existing] = await pool.query("SELECT uid FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      console.error(`\n❌ Đã tồn tại người dùng với email '${email}'. Không tạo trùng.`);
      console.error("   Nếu muốn đặt lại mật khẩu, dùng chức năng 'Quên mật khẩu' trên giao diện.");
      process.exit(1);
    }

    const uid = "admin-uid-" + Date.now() + Math.random().toString(36).substring(2, 11);
    const passwordHash = await bcrypt.hash(password, 12);
    const role = "admin,ehs";

    await pool.query(
      "INSERT INTO users (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
      [uid, email, passwordHash, name, role]
    );

    console.log(`\n✅ Tạo tài khoản admin thành công:`);
    console.log(`   Email: ${email}`);
    console.log(`   Tên:   ${name}`);
    console.log(`   Quyền: ${role}`);
    console.log(`\n👉 Đăng nhập bằng email + mật khẩu vừa đặt.\n`);
    process.exit(0);
  } catch (err) {
    if (err && err.code === "ER_NO_SUCH_TABLE") {
      console.error("\n❌ Bảng 'users' chưa tồn tại.");
      console.error("   Khởi động backend một lần (node server.js) để tự tạo schema, rồi chạy lại lệnh này.");
    } else {
      console.error("\n❌ Lỗi tạo admin:", err.message);
    }
    process.exit(1);
  }
}

main();
