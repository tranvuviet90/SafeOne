import express from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Helper to broadcast changes to WebSocket connections (bound in server.js)
let ioInstance = null;
export function setIoInstance(io) {
  ioInstance = io;
}

function broadcastChange(path, data) {
  if (ioInstance) {
    // Emit only to clients subscribed to this path (room), not to everyone.
    ioInstance.to(path).emit("db_change", { path, data });
  }
}

// Map collection name to MySQL table name and key field
const TABLE_MAPPING = {
  users: { table: "users", key: "uid" },
  notifications: { table: "notifications", key: "id" },
  role_requests: { table: "role_requests", key: "id" },
  chat_messages: { table: "chat_messages", key: "id" },
  msds_chemicals: { table: "msds_chemicals", key: "chemical_code" },
  gemba: { table: "gemba_reports", key: "id", filter: { type: "gemba" } },
  tu_gemba: { table: "gemba_reports", key: "id", filter: { type: "tu_gemba" } },
  hutthuoc: { table: "smoking_violations", key: "id" },
  meal_reports: { table: "meal_reports", key: "date_key" }
};

// Map frontend camelCase fields to database snake_case columns
const COLUMN_MAP = {
  notifications: {
    targetRoles: "target_roles",
    targetUserId: "target_user_id",
    readBy: "read_by",
    createdBy: "created_by",
    relatedId: "related_id"
  }
};

function mapPayloadKeys(collection, payload) {
  const mapping = COLUMN_MAP[collection];
  if (!mapping || !payload) return payload;
  const mapped = {};
  for (const key of Object.keys(payload)) {
    const dbKey = mapping[key] || key;
    mapped[dbKey] = payload[key];
  }
  return mapped;
}

// ---- Access control policy (defense-in-depth for the generic /api/db routes) ----
// Columns that must never be serialized back to any client.
const SENSITIVE_COLUMNS = {
  users: ["password_hash"]
};

// Per-collection write policy. Collections NOT listed keep the legacy behavior
// (any authenticated user may read/write) so existing modules keep working.
const COLLECTION_POLICY = {
  users: {
    selfWriteOnly: true,                       // may only mutate one's own row
    writableFields: ["notificationSettings"],  // ...and only these fields
    denyCreate: true,                          // creating users must go through admin functions
    denyDelete: true                           // deleting users must go through admin functions
  }
};

// Validate a single mutation against COLLECTION_POLICY. Strict: any field outside
// the whitelist is rejected (not silently dropped) so single-doc and batch paths
// can safely execute the original payload after this passes.
function checkMutationPolicy(collection, id, method, payload, reqUser) {
  const policy = COLLECTION_POLICY[collection];
  if (!policy) return { ok: true };

  if (method === "DELETE") {
    if (policy.denyDelete) return { ok: false, status: 403, error: "Không được phép xóa bản ghi này" };
    if (policy.selfWriteOnly && id !== reqUser?.uid) return { ok: false, status: 403, error: "Không có quyền trên bản ghi này" };
    return { ok: true };
  }

  // POST (upsert) / PATCH
  if (policy.selfWriteOnly && id !== reqUser?.uid) {
    return { ok: false, status: 403, error: "Chỉ được phép sửa bản ghi của chính mình" };
  }
  if (policy.writableFields) {
    const keys = Object.keys(payload || {});
    if (keys.length === 0) {
      return { ok: false, status: 400, error: "Không có dữ liệu cập nhật" };
    }
    const illegal = keys.filter(k => !policy.writableFields.includes(k));
    if (illegal.length > 0) {
      return { ok: false, status: 403, error: `Không được phép cập nhật trường: ${illegal.join(", ")}` };
    }
  }
  return { ok: true };
}

// Reject payload keys that aren't plain SQL identifiers. Column names are
// interpolated into queries for mapped tables, so guard against identifier
// injection (values are already parameterized). Generic firestore_mock writes
// may use dotted nested paths and are validated separately, not here.
const SAFE_IDENTIFIER = /^[A-Za-z0-9_]+$/;
function unsafeColumns(keys) {
  return keys.filter(k => !SAFE_IDENTIFIER.test(k));
}

// JSON Columns helper
const JSON_COLUMNS = {
  notifications: ["target_roles", "read_by"],
  weekly_shifts: ["data"],
  meal_reports: ["summary", "confirmed_summary", "reports", "overtime_fulfilled", "history"]
};

function isJsonCol(table, col) {
  return JSON_COLUMNS[table] && JSON_COLUMNS[table].includes(col);
}

// Convert DB row to frontend object
function formatRow(table, row) {
  if (!row) return null;
  const formatted = { ...row };

  // Defense-in-depth: never expose secret columns (e.g. password_hash) to clients.
  if (SENSITIVE_COLUMNS[table]) {
    SENSITIVE_COLUMNS[table].forEach(col => { delete formatted[col]; });
  }

  if (row.uid) formatted.id = row.uid;
  
  if (JSON_COLUMNS[table]) {
    JSON_COLUMNS[table].forEach(col => {
      if (formatted[col] !== undefined) {
        try {
          formatted[col] = typeof formatted[col] === "string" ? JSON.parse(formatted[col]) : formatted[col];
        } catch (e) {
          formatted[col] = null;
        }
      }
    });
  }

  // Handle camelCase mapping for compatibility
  if (table === "notifications") {
    if (formatted.target_roles !== undefined) formatted.targetRoles = formatted.target_roles || [];
    if (formatted.target_user_id !== undefined) formatted.targetUserId = formatted.target_user_id || null;
    if (formatted.read_by !== undefined) formatted.readBy = formatted.read_by || [];
    if (formatted.created_by !== undefined) formatted.createdBy = formatted.created_by || null;
    if (formatted.related_id !== undefined) formatted.relatedId = formatted.related_id || null;
  }

  return formatted;
}

// Helper to compile updates with serverTimestamp and arrayUnion
function processFieldUpdate(currentValue, updateValue) {
  if (updateValue && updateValue.type === "serverTimestamp") {
    return new Date().toISOString();
  }
  if (updateValue && updateValue.type === "arrayUnion") {
    const list = Array.isArray(currentValue) ? currentValue : [];
    const elementsToAdd = Array.isArray(updateValue.elements) ? updateValue.elements : [];
    const combined = [...list];
    elementsToAdd.forEach(el => {
      const match = combined.some(item => JSON.stringify(item) === JSON.stringify(el));
      if (!match) combined.push(el);
    });
    return combined;
  }
  return updateValue;
}

function updateNestedField(obj, path, updateValue) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }
  const lastPart = parts[parts.length - 1];
  const currentValue = current[lastPart];
  
  if (updateValue && updateValue.type === "deleteField") {
    delete current[lastPart];
  } else {
    current[lastPart] = processFieldUpdate(currentValue, updateValue);
  }
}

// Helper to broadcast collection and document changes
async function triggerBroadcasts(collection, id) {
  broadcastChange(collection, { action: 'updated' });
  const cfg = TABLE_MAPPING[collection];
  if (!cfg) {
    // Generic collection fallback
    const [rows] = await pool.query(
      "SELECT id, data FROM firestore_mock WHERE collection = ?",
      [collection]
    );
    const list = rows.map(r => {
      try {
        const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
        return { id: r.id, ...parsed };
      } catch (e) {
        return { id: r.id };
      }
    });
    broadcastChange(collection, list);

    const [docRow] = await pool.query(
      "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
      [collection, id]
    );
    if (docRow.length > 0) {
      try {
        const parsed = typeof docRow[0].data === "string" ? JSON.parse(docRow[0].data) : docRow[0].data;
        broadcastChange(`${collection}/${id}`, { id, ...parsed });
      } catch (e) {}
    } else {
      broadcastChange(`${collection}/${id}`, null);
    }
  } else {
    // Specific table mapping
    let queryStr = `SELECT * FROM ${cfg.table}`;
    const params = [];
    if (cfg.filter) {
      const [[k, v]] = Object.entries(cfg.filter);
      queryStr += ` WHERE ${k} = ?`;
      params.push(v);
    }
    const [allRows] = await pool.query(queryStr, params);
    const list = allRows.map(r => formatRow(cfg.table, r));
    broadcastChange(collection, list);

    if (cfg.table === "meal_reports") {
      // meal_reports uses compound layout
      const [rows] = await pool.query("SELECT * FROM meal_reports WHERE date_key = ?", [id]);
      if (rows.length > 0) {
        const payload = {};
        rows.forEach(r => {
          payload[r.shift_key] = {
            summary: JSON.parse(r.summary || "null"),
            confirmedSummary: JSON.parse(r.confirmed_summary || "null"),
            confirmedByAdmin: r.confirmed_by_admin,
            confirmedAtAdmin: r.confirmed_at_admin,
            confirmedByCanteen: r.confirmed_by_canteen,
            confirmedAtCanteen: r.confirmed_at_canteen,
            reports: JSON.parse(r.reports || "null"),
            overtimeFulfilled: JSON.parse(r.overtime_fulfilled || "null"),
            lastReportAt: r.last_report_at
          };
        });
        payload.history = JSON.parse(rows[0].history || "[]");
        payload.lastHistoryAt = rows[0].last_history_at;
        broadcastChange(`${collection}/${id}`, payload);
      } else {
        broadcastChange(`${collection}/${id}`, null);
      }
    } else {
      const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
      if (rows.length > 0) {
        broadcastChange(`${collection}/${id}`, formatRow(cfg.table, rows[0]));
      } else {
        broadcastChange(`${collection}/${id}`, null);
      }
    }
  }
}

// 1. GET all items in a collection
router.get("/:collection", authenticateToken, async (req, res) => {
  const { collection } = req.params;
  const cfg = TABLE_MAPPING[collection];
  
  if (!cfg) {
    try {
      const [rows] = await pool.query(
        "SELECT * FROM firestore_mock WHERE collection = ?",
        [collection]
      );
      const result = rows.map(r => {
        try {
          const parsed = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
          return { id: r.id, ...parsed };
        } catch (e) {
          return { id: r.id };
        }
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error(`Get generic collection ${collection} error:`, error);
      return res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
    }
  }

  try {
    let queryStr = `SELECT * FROM ${cfg.table}`;
    const params = [];
    if (cfg.filter) {
      const [[k, v]] = Object.entries(cfg.filter);
      queryStr += ` WHERE ${k} = ?`;
      params.push(v);
    }
    
    if (cfg.table === "chat_messages" || cfg.table === "notifications") {
      queryStr += " ORDER BY id DESC LIMIT 100";
    }

    const [rows] = await pool.query(queryStr, params);
    const result = rows.map(r => formatRow(cfg.table, r));
    res.status(200).json(result);
  } catch (error) {
    console.error(`Get collection ${collection} error:`, error);
    res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
  }
});

// 2. GET single document by ID
router.get("/:collection/:id", authenticateToken, async (req, res) => {
  const { collection, id } = req.params;
  const cfg = TABLE_MAPPING[collection];
  
  if (!cfg) {
    try {
      const [rows] = await pool.query(
        "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
        [collection, id]
      );
      if (rows.length === 0) {
        return res.status(200).json({ _exists: false });
      }
      const parsed = typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
      return res.status(200).json({ id, ...parsed });
    } catch (error) {
      console.error(`Get generic document ${collection}/${id} error:`, error);
      return res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
    }
  }

  try {
    if (cfg.table === "meal_reports") {
      const [rows] = await pool.query("SELECT * FROM meal_reports WHERE date_key = ?", [id]);
      if (rows.length === 0) {
        return res.status(200).json({ _exists: false });
      }

      const payload = {};
      rows.forEach(r => {
        payload[r.shift_key] = {
          summary: JSON.parse(r.summary || "null"),
          confirmedSummary: JSON.parse(r.confirmed_summary || "null"),
          confirmedByAdmin: r.confirmed_by_admin,
          confirmedAtAdmin: r.confirmed_at_admin,
          confirmedByCanteen: r.confirmed_by_canteen,
          confirmedAtCanteen: r.confirmed_at_canteen,
          reports: JSON.parse(r.reports || "null"),
          overtimeFulfilled: JSON.parse(r.overtime_fulfilled || "null"),
          lastReportAt: r.last_report_at
        };
      });
      payload.history = JSON.parse(rows[0].history || "[]");
      payload.lastHistoryAt = rows[0].last_history_at;

      return res.status(200).json(payload);
    }

    const [rows] = await pool.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
    if (rows.length === 0) {
      return res.status(200).json({ _exists: false });
    }
    res.status(200).json(formatRow(cfg.table, rows[0]));
  } catch (error) {
    console.error(`Get document ${collection}/${id} error:`, error);
    res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
  }
});

// 3. POST or PATCH single document
router.post("/:collection/:id", authenticateToken, async (req, res) => {
  await updateDocumentHandler(req, res);
});
router.patch("/:collection/:id", authenticateToken, async (req, res) => {
  await updateDocumentHandler(req, res);
});

async function updateDocumentHandler(req, res) {
  const { collection, id } = req.params;
  const cfg = TABLE_MAPPING[collection];
  const payload = mapPayloadKeys(collection, req.body);

  const policyCheck = checkMutationPolicy(collection, id, req.method, payload, req.user);
  if (!policyCheck.ok) {
    return res.status(policyCheck.status).json({ error: policyCheck.error });
  }
  if (cfg) {
    const bad = unsafeColumns(Object.keys(payload));
    if (bad.length) {
      return res.status(400).json({ error: `Tên trường không hợp lệ: ${bad.join(", ")}` });
    }
  }

  if (!cfg) {
    try {
      const [existing] = await pool.query(
        "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
        [collection, id]
      );
      const rowExists = existing.length > 0;
      let currentData = {};
      if (rowExists) {
        try {
          currentData = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
        } catch (e) {
          currentData = {};
        }
      }

      for (const key of Object.keys(payload)) {
        updateNestedField(currentData, key, payload[key]);
      }

      const serializedData = JSON.stringify(currentData);

      if (rowExists) {
        await pool.query(
          "UPDATE firestore_mock SET data = ? WHERE collection = ? AND id = ?",
          [serializedData, collection, id]
        );
      } else {
        await pool.query(
          "INSERT INTO firestore_mock (collection, id, data) VALUES (?, ?, ?)",
          [collection, id, serializedData]
        );
      }

      const formatted = { id, ...currentData };
      await triggerBroadcasts(collection, id);
      return res.status(200).json(formatted);
    } catch (error) {
      console.error(`Update generic document ${collection}/${id} error:`, error);
      return res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
    }
  }

  try {
    if (cfg.table === "meal_reports") {
      const shifts = ["HC", "S1", "S2", "S3", "S8"];
      for (const shift of shifts) {
        if (payload[shift]) {
          const shiftData = payload[shift];
          const [existing] = await pool.query(
            "SELECT * FROM meal_reports WHERE date_key = ? AND shift_key = ?",
            [id, shift]
          );
          const rowExists = existing.length > 0;
          const curRow = rowExists ? existing[0] : {};

          const dbPayload = {
            summary: JSON.stringify(processFieldUpdate(JSON.parse(curRow.summary || "null"), shiftData.summary)),
            confirmed_summary: JSON.stringify(processFieldUpdate(JSON.parse(curRow.confirmed_summary || "null"), shiftData.confirmedSummary)),
            confirmed_by_admin: shiftData.confirmedByAdmin !== undefined ? shiftData.confirmedByAdmin : curRow.confirmed_by_admin,
            confirmed_at_admin: shiftData.confirmedAtAdmin !== undefined ? shiftData.confirmedAtAdmin : curRow.confirmed_at_admin,
            confirmed_by_canteen: shiftData.confirmedByCanteen !== undefined ? shiftData.confirmedByCanteen : curRow.confirmed_by_canteen,
            confirmed_at_canteen: shiftData.confirmedAtCanteen !== undefined ? shiftData.confirmedAtCanteen : curRow.confirmed_at_canteen,
            reports: JSON.stringify(processFieldUpdate(JSON.parse(curRow.reports || "null"), shiftData.reports)),
            overtime_fulfilled: JSON.stringify(processFieldUpdate(JSON.parse(curRow.overtime_fulfilled || "null"), shiftData.overtimeFulfilled)),
            last_report_at: shiftData.lastReportAt !== undefined ? shiftData.lastReportAt : curRow.last_report_at,
            history: JSON.stringify(processFieldUpdate(JSON.parse(curRow.history || "[]"), payload.history)),
            last_history_at: payload.lastHistoryAt !== undefined ? payload.lastHistoryAt : curRow.last_history_at
          };

          if (rowExists) {
            const setClauses = Object.keys(dbPayload).map(k => `${k} = ?`).join(", ");
            const values = [...Object.values(dbPayload), id, shift];
            await pool.query(`UPDATE meal_reports SET ${setClauses} WHERE date_key = ? AND shift_key = ?`, values);
          } else {
            const columns = ["date_key", "shift_key", ...Object.keys(dbPayload)].join(", ");
            const placeholders = ["?", "?", ...Object.keys(dbPayload).map(() => "?")].join(", ");
            const values = [id, shift, ...Object.values(dbPayload)];
            await pool.query(`INSERT INTO meal_reports (${columns}) VALUES (${placeholders})`, values);
          }
        }
      }
      await triggerBroadcasts(collection, id);
      return res.status(200).json({ success: true });
    }

    const [existing] = await pool.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
    const rowExists = existing.length > 0;
    const curRow = rowExists ? existing[0] : {};

    const dbPayload = {};
    for (const key of Object.keys(payload)) {
      let curVal = curRow[key];
      if (isJsonCol(cfg.table, key)) {
        try {
          curVal = typeof curVal === "string" ? JSON.parse(curVal) : curVal;
        } catch (e) {}
      }
      const processed = processFieldUpdate(curVal, payload[key]);
      dbPayload[key] = isJsonCol(cfg.table, key) ? JSON.stringify(processed) : processed;
    }

    if (rowExists) {
      const setClauses = Object.keys(dbPayload).map(k => `\`${k}\` = ?`).join(", ");
      const values = [...Object.values(dbPayload), id];
      await pool.query(`UPDATE ${cfg.table} SET ${setClauses} WHERE ${cfg.key} = ?`, values);
    } else {
      dbPayload[cfg.key] = id;
      if (cfg.filter) {
        const [[k, v]] = Object.entries(cfg.filter);
        dbPayload[k] = v;
      }
      const columns = Object.keys(dbPayload).map(k => `\`${k}\``).join(", ");
      const placeholders = Object.keys(dbPayload).map(() => "?").join(", ");
      const values = Object.values(dbPayload);
      await pool.query(`INSERT INTO ${cfg.table} (${columns}) VALUES (${placeholders})`, values);
    }

    await triggerBroadcasts(collection, id);
    const [finalRow] = await pool.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
    res.status(200).json(formatRow(cfg.table, finalRow[0]));
  } catch (error) {
    console.error(`Update document ${collection}/${id} error:`, error);
    res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
  }
}

// 4. POST add a new document (with auto ID)
router.post("/:collection", authenticateToken, async (req, res) => {
  const { collection } = req.params;
  const cfg = TABLE_MAPPING[collection];
  const payload = mapPayloadKeys(collection, req.body);
  const id = "doc-" + Date.now() + Math.random().toString(36).substr(2, 9);

  const policy = COLLECTION_POLICY[collection];
  if (policy && policy.denyCreate) {
    return res.status(403).json({ error: "Không được phép tạo bản ghi trong collection này" });
  }
  if (cfg) {
    const bad = unsafeColumns(Object.keys(payload));
    if (bad.length) {
      return res.status(400).json({ error: `Tên trường không hợp lệ: ${bad.join(", ")}` });
    }
  }

  if (!cfg) {
    try {
      const serializedData = JSON.stringify(payload);
      await pool.query(
        "INSERT INTO firestore_mock (collection, id, data) VALUES (?, ?, ?)",
        [collection, id, serializedData]
      );
      await triggerBroadcasts(collection, id);
      return res.status(200).json({ id, ...payload });
    } catch (error) {
      console.error(`Add generic document to ${collection} error:`, error);
      return res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
    }
  }

  try {
    const dbPayload = {};
    for (const key of Object.keys(payload)) {
      const processed = processFieldUpdate(null, payload[key]);
      dbPayload[key] = isJsonCol(cfg.table, key) ? JSON.stringify(processed) : processed;
    }

    const isAutoIncrementId = cfg.key === "id" && ["notifications", "role_requests", "chat_messages"].includes(collection);
    if (!isAutoIncrementId) {
      dbPayload[cfg.key] = id;
    }

    if (cfg.filter) {
      const [[k, v]] = Object.entries(cfg.filter);
      dbPayload[k] = v;
    }

    const columns = Object.keys(dbPayload).map(k => `\`${k}\``).join(", ");
    const placeholders = Object.keys(dbPayload).map(() => "?").join(", ");
    const values = Object.values(dbPayload);

    const [result] = await pool.query(`INSERT INTO ${cfg.table} (${columns}) VALUES (${placeholders})`, values);
    const finalId = isAutoIncrementId ? result.insertId : id;
    await triggerBroadcasts(collection, finalId);
    res.status(200).json({ id: finalId });
  } catch (error) {
    console.error(`Add document to ${collection} error:`, error);
    res.status(500).json({ error: "Lỗi cơ sở dữ liệu" });
  }
});

// 5. DELETE generic document route (Corrected / New)
router.delete("/:collection/:id", authenticateToken, async (req, res) => {
  const { collection, id } = req.params;
  const cfg = TABLE_MAPPING[collection];

  const delCheck = checkMutationPolicy(collection, id, "DELETE", {}, req.user);
  if (!delCheck.ok) {
    return res.status(delCheck.status).json({ error: delCheck.error });
  }

  try {
    if (!cfg) {
      await pool.query(
        "DELETE FROM firestore_mock WHERE collection = ? AND id = ?",
        [collection, id]
      );
    } else {
      await pool.query(`DELETE FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
    }

    await triggerBroadcasts(collection, id);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Delete document ${collection}/${id} error:`, error);
    res.status(500).json({ error: "Xóa dữ liệu thất bại" });
  }
});

// 6. POST commit batch operations (using Transaction)
router.post("/batch", authenticateToken, async (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: "Thiếu danh sách thao tác batch" });
  }

  // Enforce access policy on every op up-front, before opening a transaction.
  for (const op of operations) {
    let collectionName, id, method, body;
    if (op.path) {
      const parts = op.path.split("/");
      collectionName = parts[3];
      id = parts[4];
      method = op.method;
      body = op.body || {};
    } else {
      collectionName = op.collection;
      id = op.id;
      method = op.type === "delete" ? "DELETE" : (op.type === "set" ? "POST" : "PATCH");
      body = op.data || {};
    }
    if (!collectionName) continue;
    const mapped = mapPayloadKeys(collectionName, body);
    const check = checkMutationPolicy(collectionName, id, method, mapped, req.user);
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error });
    }
    if (TABLE_MAPPING[collectionName] && (method === "POST" || method === "PATCH")) {
      const bad = unsafeColumns(Object.keys(mapped));
      if (bad.length) {
        return res.status(400).json({ error: `Tên trường không hợp lệ: ${bad.join(", ")}` });
      }
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const op of operations) {
      let collectionName, id, method, body;
      if (op.path) {
        const parts = op.path.split("/");
        collectionName = parts[3];
        id = parts[4];
        method = op.method;
        body = op.body || {};
      } else {
        collectionName = op.collection;
        id = op.id;
        method = op.type === "delete" ? "DELETE" : (op.type === "set" ? "POST" : "PATCH");
        body = op.data || {};
      }

      if (!collectionName) continue;

      const cfg = TABLE_MAPPING[collectionName];
      const mappedBody = mapPayloadKeys(collectionName, body);

      if (!cfg) {
        if (method === "POST" || method === "PATCH") {
          const [existing] = await connection.query(
            "SELECT data FROM firestore_mock WHERE collection = ? AND id = ?",
            [collectionName, id]
          );
          const rowExists = existing.length > 0;
          let currentData = {};
          if (rowExists) {
            try {
              currentData = typeof existing[0].data === "string" ? JSON.parse(existing[0].data) : existing[0].data;
            } catch (e) {}
          }
          for (const key of Object.keys(mappedBody)) {
            updateNestedField(currentData, key, mappedBody[key]);
          }
          const serializedData = JSON.stringify(currentData);
          if (rowExists) {
            await connection.query(
              "UPDATE firestore_mock SET data = ? WHERE collection = ? AND id = ?",
              [serializedData, collectionName, id]
            );
          } else {
            await connection.query(
              "INSERT INTO firestore_mock (collection, id, data) VALUES (?, ?, ?)",
              [collectionName, id, serializedData]
            );
          }
        } else if (method === "DELETE") {
          await connection.query(
            "DELETE FROM firestore_mock WHERE collection = ? AND id = ?",
            [collectionName, id]
          );
        }
        continue;
      }

      if (method === "POST" || method === "PATCH") {
        const [existing] = await connection.query(`SELECT * FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
        const rowExists = existing.length > 0;
        const curRow = rowExists ? existing[0] : {};

        const dbPayload = {};
        for (const key of Object.keys(mappedBody)) {
          let curVal = curRow[key];
          if (isJsonCol(cfg.table, key)) {
            try {
              curVal = typeof curVal === "string" ? JSON.parse(curVal) : curVal;
            } catch (e) {}
          }
          const processed = processFieldUpdate(curVal, mappedBody[key]);
          dbPayload[key] = isJsonCol(cfg.table, key) ? JSON.stringify(processed) : processed;
        }

        if (rowExists) {
          const setClauses = Object.keys(dbPayload).map(k => `\`${k}\` = ?`).join(", ");
          const values = [...Object.values(dbPayload), id];
          await connection.query(`UPDATE ${cfg.table} SET ${setClauses} WHERE ${cfg.key} = ?`, values);
        } else {
          const isAutoIncrementId = cfg.key === "id" && ["notifications", "role_requests", "chat_messages"].includes(collectionName);
          if (!isAutoIncrementId) {
            dbPayload[cfg.key] = id;
          }
          if (cfg.filter) {
            const [[k, v]] = Object.entries(cfg.filter);
            dbPayload[k] = v;
          }
          const columns = Object.keys(dbPayload).map(k => `\`${k}\``).join(", ");
          const placeholders = Object.keys(dbPayload).map(() => "?").join(", ");
          const values = Object.values(dbPayload);
          await connection.query(`INSERT INTO ${cfg.table} (${columns}) VALUES (${placeholders})`, values);
        }
      } else if (method === "DELETE") {
        await connection.query(`DELETE FROM ${cfg.table} WHERE ${cfg.key} = ?`, [id]);
      }
    }

    await connection.commit();

    // Trigger broadcasts after transaction commits
    for (const op of operations) {
      let collectionName, id;
      if (op.path) {
        const parts = op.path.split("/");
        collectionName = parts[3];
        id = parts[4];
      } else {
        collectionName = op.collection;
        id = op.id;
      }
      if (collectionName && id) {
        await triggerBroadcasts(collectionName, id);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    await connection.rollback();
    console.error("Batch commit transaction error:", error);
    res.status(500).json({ error: "Batch commit thất bại" });
  } finally {
    connection.release();
  }
});

export default router;
