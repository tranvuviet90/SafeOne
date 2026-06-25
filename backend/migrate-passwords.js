import pool from "./config/db.js";
import bcrypt from "bcrypt";

async function migratePasswords() {
  console.log("🔄 Bắt đầu kiểm tra và di chuyển mật khẩu sang định dạng bcrypt...");
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Fetch all users
    const [users] = await connection.query("SELECT uid, email, password_hash FROM users");
    
    let migratedCount = 0;
    for (const user of users) {
      const hash = user.password_hash;
      
      // If the password hash does not start with the bcrypt prefix '$2b$' or '$2a$', treat it as plain text
      const isHashed = hash.startsWith("$2b$") || hash.startsWith("$2a$");
      
      if (!isHashed) {
        console.log(`🔑 Đang di chuyển tài khoản: ${user.email} (Mã hóa mật khẩu)...`);
        const newHash = await bcrypt.hash(hash, 12);
        
        await connection.query(
          "UPDATE users SET password_hash = ? WHERE uid = ?",
          [newHash, user.uid]
        );
        console.log(`✅ Đã cập nhật thành công tài khoản: ${user.email}`);
        migratedCount++;
      }
    }
    
    console.log(`\n🎉 Hoàn thành di chuyển mật khẩu! Tổng số tài khoản đã xử lý: ${migratedCount}`);
  } catch (error) {
    console.error("❌ Lỗi trong quá trình di chuyển mật khẩu:", error.message);
  } finally {
    if (connection) connection.release();
    // Exit pool cleanly to close all idle connection threads
    await pool.end();
    process.exit(0);
  }
}

migratePasswords();
