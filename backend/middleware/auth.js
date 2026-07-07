import jwt from "jsonwebtoken";
import JWT_SECRET from "../config/jwtSecret.js";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Chưa đăng nhập" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
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
