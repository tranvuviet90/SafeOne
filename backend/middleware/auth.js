import jwt from "jsonwebtoken";
import JWT_SECRET from "../config/jwtSecret.js";
import pool from "../config/db.js";

// Cache trạng thái khóa tài khoản (60s) để mỗi request không tốn 1 query.
// JWT sống 30 ngày nên nếu KHÔNG kiểm tra DB, tài khoản bị khóa/xóa vẫn dùng
// được app tới khi token hết hạn — cache ngắn ở đây là điểm cân bằng.
const userStatusCache = new Map(); // uid -> { disabled, exp }
const USER_STATUS_TTL_MS = 60 * 1000;

// Gọi khi admin khóa/mở/xóa tài khoản để hiệu lực tức thì (không đợi hết TTL).
export function invalidateUserStatus(uid) {
  if (uid) userStatusCache.delete(uid);
  else userStatusCache.clear();
}

async function isUserDisabled(uid) {
  const now = Date.now();
  const hit = userStatusCache.get(uid);
  if (hit && hit.exp > now) return hit.disabled;
  try {
    const [rows] = await pool.query("SELECT disabled FROM users WHERE uid = ?", [uid]);
    // User không còn trong DB (đã bị xóa) => coi như bị khóa.
    const disabled = rows.length === 0 ? true : !!rows[0].disabled;
    userStatusCache.set(uid, { disabled, exp: now + USER_STATUS_TTL_MS });
    return disabled;
  } catch (e) {
    // Sự cố DB tạm thời không được khóa cả hệ thống — fail-open, request sau kiểm lại.
    console.error("Không kiểm tra được trạng thái tài khoản:", e.message);
    return false;
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
    if (await isUserDisabled(decoded.uid)) {
      return res.status(403).json({ error: "Tài khoản này đã bị khóa" });
    }
    req.user = decoded;
    next();
  });
}

export function requireAdmin(req, res, next) {
  const rawRole = req.user?.role;
  const roles = (Array.isArray(rawRole) ? rawRole : String(rawRole || "").split(","))
    .map(r => r.trim().toLowerCase());

  if (!roles.includes("admin")) {
    return res.status(403).json({ error: "Quyền truy cập bị từ chối" });
  }
  next();
}
