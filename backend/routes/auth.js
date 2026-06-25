import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

// Throttle credential-guessing on the login endpoint.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

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

    const JWT_SECRET = process.env.JWT_SECRET;
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
  } catch (error) {
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

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash = ? WHERE uid = ?", [passwordHash, req.user.uid]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update password error:", error);
    res.status(500).json({ error: "Lỗi hệ thống" });
  }
});

export default router;
