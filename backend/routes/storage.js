import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";

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
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload thất bại" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Không tìm thấy file để upload" });
    }

    const host = req.get("host");
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.status(200).json({
      message: "Upload file thành công",
      url: fileUrl,
      filename: req.file.filename
    });
  });
});

// 2. DELETE /:filename (New / Corrected)
router.delete("/:filename", authenticateToken, (req, res) => {
  const { filename } = req.params;
  
  // Prevent directory traversal attacks
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  fs.unlink(filePath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "Không tìm thấy file để xóa" });
      }
      console.error("Delete file error:", err);
      return res.status(500).json({ error: "Xóa file thất bại" });
    }
    res.status(200).json({ success: true, message: "Xóa file thành công" });
  });
});

export default router;
