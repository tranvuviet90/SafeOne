import pool from "./config/db.js";
import bcrypt from "bcrypt";

export async function seedDefaultAdmin() {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM users");
    const count = rows[0].count;
    if (count === 0) {
      console.log("🔄 Bảng users trống. Đang tự động gieo hạt Admin mặc định...");
      const uid = "admin-uid-default";
      const name = "Default Admin";
      const role = "admin,ehs";
      
      // Hash password strictly with bcrypt and 12 salt rounds
      const passwordHash = await bcrypt.hash("admin", 12);
      
      await pool.query(
        "INSERT INTO users (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
        [uid, "admin", passwordHash, name, role]
      );
      console.log("✅ Tài khoản Admin mặc định đã được tạo thành công: admin / admin");
    } else {
      console.log("🔄 Bảng users đã có dữ liệu. Bỏ qua gieo hạt Admin.");
    }
  } catch (e) {
    console.error("❌ Lỗi khi tự động gieo hạt Admin:", e.message);
  }
}
