import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import pool from "../config/db.js";
import JWT_SECRET from "../config/jwtSecret.js";
import { authenticateToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Throttle credential-guessing on the login endpoint.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
// Throttle quên/đặt lại mật khẩu (chặn dò token & spam email).
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

const MIN_PASSWORD_LENGTH = 6;

// Lazily build a single SMTP transporter from environment configuration.
// Returns null when SMTP is not configured (dev fallback logs the reset link).
let mailTransporter = null;
function getTransporter() {
  if (mailTransporter) return mailTransporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  mailTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE) === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  return mailTransporter;
}

// 1. check-init
router.get("/check-init", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM users");
    const count = rows[0].count;
    res.status(200).json({ initialized: count > 0 });
  } catch (error) {
    console.error("Check init error:", error);
    res.status(500).json({ error: "Lỗi kiểm tra trạng thái khởi tạo" });
  }
});

// 2. init-admin
router.post("/init-admin", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ thông tin: Tên, Email và Mật khẩu" });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
  }

  try {
    const [checkRows] = await pool.query("SELECT COUNT(*) as count FROM users");
    if (checkRows[0].count > 0) {
      return res.status(400).json({ error: "Hệ thống đã được khởi tạo. Không thể đăng ký thêm admin qua endpoint này." });
    }

    const uid = "admin-uid-" + Date.now() + Math.random().toString(36).substr(2, 9);
    const passwordHash = await bcrypt.hash(password, 12);
    const role = "admin,ehs";

    await pool.query(
      "INSERT INTO users (uid, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
      [uid, email, passwordHash, name, role]
    );

    res.status(200).json({ success: true, message: "Khởi tạo tài khoản admin đầu tiên thành công!" });
  } catch (error) {
    console.error("Init admin error:", error);
    res.status(500).json({ error: "Lỗi khởi tạo tài khoản admin đầu tiên" });
  }
});

// 3. login
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Thiếu email hoặc mật khẩu" });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const user = rows[0];
    if (user.disabled) {
      return res.status(403).json({ error: "Tài khoản này đã bị khóa" });
    }

    // Verify password via bcrypt.compare()
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const roleList = user.role.split(",");
    const effectiveRole = roleList.length === 1 ? roleList[0] : roleList;

    const payload = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: effectiveRole,
      meal_dept: user.meal_dept
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
    res.status(200).json({ token, user: payload });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Lỗi đăng nhập hệ thống" });
  }
});

// 4. getMe
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM users WHERE uid = ?", [req.user.uid]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }
    const user = rows[0];
    const roleList = user.role.split(",");
    // Wrap under `user` to match the /login response shape (App.jsx reads data.user).
    res.status(200).json({
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: roleList.length === 1 ? roleList[0] : roleList,
        meal_dept: user.meal_dept
      }
    });
  } catch {
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

// 5. verify-password
router.post("/verify-password", authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: "Thiếu mật khẩu xác thực" });
  }

  try {
    const [rows] = await pool.query("SELECT password_hash FROM users WHERE uid = ?", [req.user.uid]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Người dùng không tồn tại" });
    }

    const validPassword = await bcrypt.compare(password, rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Mật khẩu xác thực không đúng" });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Verify password error:", error);
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

// 6. update-password
router.post("/update-password", authenticateToken, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: "Thiếu mật khẩu mới" });
  }
  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE uid = ?", [passwordHash, req.user.uid]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

// 7. forgot-password (public) — emails a one-time reset link.
// Always responds with a generic success message so the endpoint can't be used
// to enumerate which emails have accounts.
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Vui lòng nhập email" });
  }

  const genericMsg = "Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi đến hộp thư của bạn.";

  try {
    const [rows] = await pool.query(
      "SELECT uid, name, email, disabled FROM users WHERE email = ?",
      [email]
    );
    // Silently succeed for unknown/disabled accounts (no enumeration).
    if (rows.length === 0 || rows[0].disabled) {
      return res.status(200).json({ success: true, message: genericMsg });
    }

    const u = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // valid for 1 hour

    // Dọn token đã hết hạn >24h để bảng không phình vô hạn.
    pool.query("DELETE FROM password_resets WHERE expires_at < ?", [Date.now() - 24 * 60 * 60 * 1000])
      .catch(() => { /* dọn dẹp best-effort */ });

    await pool.query(
      "INSERT INTO password_resets (token, uid, email, expires_at, used) VALUES (?, ?, ?, ?, 0)",
      [token, u.uid, u.email, expiresAt]
    );

    const baseUrl = (process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const link = `${baseUrl}/?reset=${token}`;

    // Admin-configurable email content (settings/password_recovery), with defaults.
    let subject = "Đặt lại mật khẩu SafeOne";
    let body = "Xin chào {name},\n\nBạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản SafeOne của bạn.\nNhấp vào liên kết sau để đặt lại mật khẩu (có hiệu lực trong 1 giờ):\n\n{link}\n\nNếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.";
    try {
      const [srows] = await pool.query(
        "SELECT data FROM firestore_mock WHERE collection = 'settings' AND id = 'password_recovery'"
      );
      if (srows.length > 0) {
        const data = typeof srows[0].data === "string" ? JSON.parse(srows[0].data) : srows[0].data;
        if (data?.emailSubject) subject = data.emailSubject;
        if (data?.emailBody) body = data.emailBody;
      }
    } catch {
      // fall back to defaults on any parse/query error
    }

    const text = body.replace(/\{name\}/g, u.name || u.email).replace(/\{link\}/g, link);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${
      text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
        .replace(/\n/g, "<br>")
    }</div>`;

    const tx = getTransporter();
    let devLink;
    if (tx) {
      await tx.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: u.email,
        subject,
        text,
        html
      });
    } else {
      // No SMTP configured — log the link AND return it so local testing works
      // without an email server. This branch only runs when SMTP is unset (dev).
      console.log(`[forgot-password] SMTP chưa cấu hình. Link đặt lại cho ${u.email}: ${link}`);
      devLink = link;
    }

    const payload = { success: true, message: genericMsg };
    if (devLink) payload.devLink = devLink;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Lỗi gửi yêu cầu đặt lại mật khẩu" });
  }
});

// 8. reset-password (public) — consumes a one-time token and sets a new password.
router.post("/reset-password", resetLimiter, async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Thiếu token hoặc mật khẩu mới" });
  }
  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự` });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM password_resets WHERE token = ?", [token]);
    if (rows.length === 0) {
      return res.status(400).json({ error: "Liên kết không hợp lệ" });
    }
    const reset = rows[0];
    if (reset.used) {
      return res.status(400).json({ error: "Liên kết đã được sử dụng" });
    }
    if (Number(reset.expires_at) < Date.now()) {
      return res.status(400).json({ error: "Liên kết đã hết hạn. Vui lòng yêu cầu lại." });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE uid = ?", [passwordHash, reset.uid]);
    await pool.query("UPDATE password_resets SET used = 1 WHERE token = ?", [token]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Lỗi đặt lại mật khẩu" });
  }
});

export default router;
