import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";
import { broadcastChange } from "../socket/index.js";

const router = express.Router();

// Sao chép logic normalizeRole của frontend: bỏ dấu + trim + lowercase
const stripDiacritics = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizeRole = (r) => stripDiacritics(String(r || "").trim()).toLowerCase();

// mysql2 có thể đã parse sẵn cột JSON; xử lý cả 2 trường hợp
function parseJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

/**
 * PUT /api/notifications/read-all  (JWT protected)
 * Đánh dấu TẤT CẢ thông báo mà user hiện tại nhìn thấy là đã đọc.
 * Schema dùng read_by (JSON array UID) vì thông báo gửi theo role/dùng chung,
 * nên "đã đọc" = thêm uid của user vào mảng read_by.
 */
router.put("/read-all", authenticateToken, async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: "Chưa đăng nhập" });

  const rawRoles = Array.isArray(req.user.role)
    ? req.user.role
    : String(req.user.role || "").split(",");
  const userRoleSet = new Set(rawRoles.map(normalizeRole).filter(Boolean));

  let connection;
  try {
    connection = await pool.getConnection();

    // Ứng viên: thông báo gửi riêng cho user HOẶC gửi theo role
    const [rows] = await connection.query(
      "SELECT id, read_by, target_user_id, target_roles FROM notifications WHERE target_user_id = ? OR target_roles IS NOT NULL",
      [uid]
    );

    const toUpdate = [];
    for (const row of rows) {
      const readBy = parseJson(row.read_by, []) || [];
      if (Array.isArray(readBy) && readBy.includes(uid)) continue; // đã đọc rồi

      let visible = row.target_user_id === uid;
      if (!visible) {
        const targetRoles = parseJson(row.target_roles, []) || [];
        if (Array.isArray(targetRoles)) {
          visible = targetRoles.some((r) => userRoleSet.has(normalizeRole(r)));
        }
      }
      if (visible) toUpdate.push(row.id);
    }

    if (toUpdate.length > 0) {
      const placeholders = toUpdate.map(() => "?").join(",");
      // JSON_ARRAY_APPEND thêm uid; COALESCE xử lý trường hợp read_by = NULL
      await connection.query(
        `UPDATE notifications
         SET read_by = JSON_ARRAY_APPEND(COALESCE(read_by, JSON_ARRAY()), '$', ?)
         WHERE id IN (${placeholders})`,
        [uid, ...toUpdate]
      );
    }

    // Báo các tab/thiết bị khác refetch lại danh sách
    broadcastChange("notifications", { action: "read_all", uid });

    res.status(200).json({ ok: true, updated: toUpdate.length });
  } catch (error) {
    console.error("Lỗi đánh dấu tất cả đã đọc:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi đánh dấu đã đọc" });
  } finally {
    if (connection) connection.release();
  }
});

export default router;
