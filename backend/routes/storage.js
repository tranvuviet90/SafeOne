import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import pool from "../config/db.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

// Whitelist of allowed upload extensions. Reject executable/markup types
// (.html, .svg, .js, etc.) that could become stored XSS when served from /uploads.
const ALLOWED_UPLOAD_EXT = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"
]);

const uploadMiddleware = multer({
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_EXT.has(ext)) return cb(null, true);
    cb(new Error("Loại tệp không được phép"));
  }
}).single("file");

// 1. POST /upload
router.post("/upload", authenticateToken, (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload thất bại" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Không tìm thấy file để upload" });
    }

    // Ghi lại chủ sở hữu để kiểm quyền khi xóa. Best-effort: lỗi ghi sổ không
    // được làm hỏng upload (file đã nằm trên đĩa thành công).
    try {
      await pool.query(
        "INSERT INTO uploads (filename, uid) VALUES (?, ?) ON DUPLICATE KEY UPDATE uid = VALUES(uid)",
        [req.file.filename, req.user?.uid || null]
      );
    } catch (e) {
      console.error("Không ghi được sổ uploads:", e.message);
    }

    // Trả về URL TƯƠNG ĐỐI (không kèm host/cổng). Nhờ vậy ảnh luôn tải theo đúng
    // origin đang mở: dev chạy 5173 sẽ đi qua proxy Vite -> 5000, production thì
    // cùng origin với backend. Nếu trả absolute (vd http://localhost:5000/...) thì
    // ảnh luôn trỏ cổng 5000 dù frontend chạy ở cổng khác.
    const fileUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      message: "Upload file thành công",
      url: fileUrl,
      filename: req.file.filename
    });
  });
});

// 2. DELETE /:filename — chỉ CHỦ FILE hoặc admin/ehs được xóa. Trước đây bất kỳ
// user đăng nhập nào cũng xóa được mọi file (ảnh hiện trường, tài liệu) của người khác.
router.delete("/:filename", authenticateToken, async (req, res) => {
  const { filename } = req.params;

  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  const rawRole = req.user?.role;
  const roles = (Array.isArray(rawRole) ? rawRole : String(rawRole || "").split(","))
    .map(r => r.trim().toLowerCase());
  const isPrivileged = roles.includes("admin") || roles.includes("ehs");

  if (!isPrivileged) {
    try {
      const [rows] = await pool.query("SELECT uid FROM uploads WHERE filename = ?", [safeFilename]);
      // File cũ (upload trước khi có sổ uploads) không xác định được chủ —
      // chỉ admin/ehs xóa được.
      if (rows.length === 0 || rows[0].uid !== req.user?.uid) {
        return res.status(403).json({ error: "Bạn chỉ có thể xóa file do chính mình tải lên" });
      }
    } catch (e) {
      console.error("Không kiểm tra được chủ sở hữu file:", e.message);
      return res.status(500).json({ error: "Xóa file thất bại" });
    }
  }

  fs.unlink(filePath, async (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "Không tìm thấy file để xóa" });
      }
      console.error("Delete file error:", err);
      return res.status(500).json({ error: "Xóa file thất bại" });
    }
    try {
      await pool.query("DELETE FROM uploads WHERE filename = ?", [safeFilename]);
    } catch { /* sổ uploads lệch không ảnh hưởng kết quả xóa */ }
    res.status(200).json({ success: true, message: "Xóa file thành công" });
  });
});

export default router;
