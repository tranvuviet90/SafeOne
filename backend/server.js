// backend/server.js
import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Import modules
import pool from "./config/db.js";
import { initSocket } from "./socket/index.js";
import { seedDefaultAdmin } from "./seed.js";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically at /uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Mount API Routers
app.use("/api/auth", authRouter);
app.use("/api/db", dbRouter);
app.use("/api/storage", storageRouter);
app.use("/api/functions", functionsRouter);
app.use("/api/notifications", notificationsRouter);

// Serve React production build statically from public directory
const FRONTEND_DIST_DIR = path.join(__dirname, "public");
if (fs.existsSync(FRONTEND_DIST_DIR)) {
  console.log("Serving static frontend files from:", FRONTEND_DIST_DIR);
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get("*", (req, res, next) => {
    // Only serve index.html for non-API client requests
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST_DIR, "index.html"));
  });
} else {
  console.log("Frontend production build ('public') not found. Server running in API-only mode.");
  app.get("/", (req, res) => {
    res.status(200).json({ ok: true, message: "SafeOne API Server is running" });
  });
}

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
server.listen(PORT, async () => {
  console.log(`SafeOne local server successfully listening on port ${PORT}`);
  
  // Verify database schema configurations
  await initializeDatabaseSchema();

  // Auto-seed default admin account if users table is empty
  await seedDefaultAdmin();
});
