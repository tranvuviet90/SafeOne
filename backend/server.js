// backend/server.js
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Import modules
import pool from "./config/db.js";
import { initSocket } from "./socket/index.js";

// Import Routers
import authRouter from "./routes/auth.js";
import dbRouter from "./routes/db.js";
import storageRouter from "./routes/storage.js";
import functionsRouter from "./routes/functions.js";
import notificationsRouter from "./routes/notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment configurations from backend/.env
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
// Trust the first reverse-proxy hop so req.ip reflects the real client (rate limiting).
app.set("trust proxy", 1);
const server = http.createServer(app);

// Initialize Socket.io WebSocket server
initSocket(server);

// Enable CORS and Express body parsers.
// In production set CORS_ORIGIN (comma-separated allowlist); defaults to open for dev.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
// Security headers. CSP tắt vì React bundle dùng inline style/blob (bật CSP sẽ
// trắng trang); các header còn lại (nosniff, frame-deny, HSTS sau proxy...) vẫn áp dụng.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// Body-size limits: chỉ /api/db/batch (import Excel hàng loạt) cần payload lớn.
// Các route còn lại giữ 5mb (đủ cho markdown tài liệu/trainedDocs) để hạn chế DoS.
app.use("/api/db/batch", express.json({ limit: "25mb" }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Serve uploaded files statically at /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check cho pm2/nginx/monitoring: xác nhận cả tiến trình lẫn kết nối DB.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true, db: true, uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

// Mount API Routers
app.use("/api/auth", authRouter);
app.use("/api/db", dbRouter);
app.use("/api/storage", storageRouter);
app.use("/api/functions", functionsRouter);
app.use("/api/notifications", notificationsRouter);

// Serve React production build statically from public directory.
// LƯU Ý: chỉ index.html được commit; thư mục assets/ (bundle JS/CSS) do `npm run build`
// sinh ra và bị gitignore. Vì vậy phải kiểm tra CẢ index.html LẪN assets/ — nếu thiếu
// (quên build), báo rõ ràng thay vì phục vụ trang trắng trỏ tới /assets/*.js không tồn tại.
const FRONTEND_DIST_DIR = path.join(__dirname, "public");
const INDEX_HTML = path.join(FRONTEND_DIST_DIR, "index.html");
const ASSETS_DIR = path.join(FRONTEND_DIST_DIR, "assets");
const hasBuiltFrontend = fs.existsSync(INDEX_HTML) && fs.existsSync(ASSETS_DIR);

if (hasBuiltFrontend) {
  console.log("Serving static frontend files from:", FRONTEND_DIST_DIR);
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get("*", (req, res, next) => {
    // Only serve index.html for non-API client requests
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(INDEX_HTML);
  });
} else {
  console.warn("\n⚠️  ========================================================");
  console.warn("⚠️  CHƯA BUILD FRONTEND — thiếu backend/public/index.html hoặc backend/public/assets/");
  console.warn("⚠️  Hãy chạy 'npm run build' ở thư mục gốc để sinh giao diện, rồi khởi động lại.");
  console.warn("⚠️  Backend vẫn chạy ở chế độ CHỈ API.");
  console.warn("⚠️  ========================================================\n");
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.status(503).type("html").send(
      "<h2>SafeOne: giao diện chưa được build</h2>" +
      "<p>Máy chủ API đang chạy, nhưng chưa có bản build frontend.</p>" +
      "<p>Chạy <code>npm run build</code> ở thư mục gốc rồi khởi động lại backend.</p>"
    );
  });
}

// API 404 + error handler tập trung: mọi lỗi (kể cả body quá lớn / JSON hỏng
// từ body-parser) trả về JSON thay vì trang HTML mặc định của Express.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API không tồn tại" });
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Dữ liệu gửi lên quá lớn" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Dữ liệu JSON không hợp lệ" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Lỗi máy chủ" });
});

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Schema Migration helper (executing queries sequentially)
async function initializeDatabaseSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Ensure notifications table has related_id column
    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM notifications LIKE 'related_id'");
      if (columns.length === 0) {
        console.log("🔄 Bảng 'notifications' thiếu cột 'related_id'. Đang tự động thêm cột...");
        await connection.query("ALTER TABLE notifications ADD COLUMN related_id VARCHAR(255) DEFAULT NULL");
        console.log("✅ Thêm cột 'related_id' thành công!");
      }
    } catch (e) {
      console.error("⚠️ Không thể kiểm tra hoặc thêm cột 'related_id' vào bảng 'notifications':", e.message);
    }

    // Ensure firestore_mock table exists. Đây là bảng xương sống chứa mọi
    // "generic collection" (documents, settings, lockers, licenses...) mà
    // routes/db.js đọc/ghi. Trước đây bảng này KHÔNG nằm trong schema.sql nên
    // deploy trên DB mới sẽ sập toàn bộ module generic — tạo tự động ở đây.
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS firestore_mock (
          collection VARCHAR(128) NOT NULL,
          id VARCHAR(191) NOT NULL,
          data LONGTEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (collection, id)
        ) ENGINE=InnoDB
      `);
    } catch (e) {
      console.error("⚠️ Không thể tạo bảng 'firestore_mock':", e.message);
    }

    // Ensure uploads table exists — ghi lại ai upload file nào để routes/storage.js
    // kiểm quyền khi xóa (chủ file hoặc admin/ehs mới được xóa).
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS uploads (
          filename VARCHAR(255) NOT NULL PRIMARY KEY,
          uid VARCHAR(128) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
      `);
    } catch (e) {
      console.error("⚠️ Không thể tạo bảng 'uploads':", e.message);
    }

    // Ensure doc_chunks table exists (embedding RAG cho chatbot). Có trong schema.sql
    // nhưng schema.sql chỉ chạy khi DB trống hoàn toàn — DB nâng cấp từ bản cũ sẽ thiếu.
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS doc_chunks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          doc_id VARCHAR(191) NOT NULL,
          doc_title VARCHAR(255) DEFAULT NULL,
          doc_type VARCHAR(50) DEFAULT NULL,
          chunk_index INT NOT NULL,
          content MEDIUMTEXT NOT NULL,
          embedding JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_doc (doc_id)
        ) ENGINE=InnoDB
      `);
    } catch (e) {
      console.error("⚠️ Không thể tạo bảng 'doc_chunks':", e.message);
    }

    // Ensure password_resets table exists (one-time tokens for "forgot password").
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          token VARCHAR(255) NOT NULL PRIMARY KEY,
          uid VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          expires_at BIGINT NOT NULL,
          used TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (e) {
      console.error("⚠️ Không thể tạo bảng 'password_resets':", e.message);
    }

    // Check if users table exists
    const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log("🔄 Bảng 'users' chưa tồn tại. Đang tiến hành chạy schema.sql tuần tự để khởi tạo bảng...");
      const schemaPath = path.join(__dirname, "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const sqlContent = fs.readFileSync(schemaPath, "utf8");
        
        // Strip SQL comments and split by semicolons
        const queries = sqlContent
          .split("\n")
          // Remove lines starting with --
          .filter(line => !line.trim().startsWith("--"))
          .join("\n")
          // Split by semicolon (ignoring semicolons within strings is complex, but safe for schema.sql layout)
          .split(";")
          .map(q => q.trim())
          .filter(q => q.length > 0);

        for (const queryStr of queries) {
          // If query sets active DB, run it, otherwise run on pool/connection
          if (queryStr.toUpperCase().startsWith("USE ")) {
            continue; // Node client selects database via connection parameters automatically
          }
          await connection.query(queryStr);
        }
        console.log("✅ Khởi tạo database thành công!");
      } else {
        console.error("❌ Không tìm thấy file schema.sql tại:", schemaPath);
      }
    } else {
      console.log("✅ Database đã sẵn sàng, không cần chạy schema.sql.");
    }
  } catch (error) {
    console.error("\n❌ ========================================================");
    console.error("❌ LỖI KHỞI TẠO CƠ SỞ DỮ LIỆU SCHEMA!");
    console.error("Chi tiết lỗi:", error.message);
    console.error("❌ ========================================================\n");
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

const PORT = process.env.PORT || 5000;
// Khởi tạo/migrate schema XONG rồi mới nhận request — tránh race lúc mới bật
// (request đến trong lúc bảng chưa kịp tạo).
(async () => {
  await initializeDatabaseSchema();
  server.listen(PORT, () => {
    console.log(`SafeOne local server successfully listening on port ${PORT}`);
  });
})();
