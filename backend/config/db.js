import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, "../.env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "safeone",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Fail-fast database validation on startup
try {
  const connection = await pool.getConnection();
  console.log("🔌 Kết nối cơ sở dữ liệu MySQL thành công qua config/db.js.");
  connection.release();
} catch (error) {
  console.error("❌ LỖI KẾT NỐI CƠ SỞ DỮ LIỆU MYSQL TRÊN KHỞI ĐỘNG!");
  console.error("Chi tiết lỗi:", error.message);
  process.exit(1);
}

export default pool;
