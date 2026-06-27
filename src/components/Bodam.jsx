import React, { useEffect, useState } from "react";
import dbService from "../services/dbService";
import { useI18n } from "../i18n/I18nProvider";
import { useConfirm } from "./LightboxSwipeOnly";
import realtimeService from "../services/realtimeService";

const DEFAULT_COUNT = 15;
const MIN_COUNT = 1;
const orange = "#466E73";
const orangeLight = "#A9D9D4";
const dark = "#222";
const red = "#d9534f";

const SHIFTS = ["S1", "S2", "S3", "HC", "S8"];

function getAssignedShifts(assignedTo) {
  const shifts = { S1: null, S2: null, S3: null, HC: null, S8: null };
  if (!assignedTo) return shifts;
  
  if (Array.isArray(assignedTo)) {
    const keys = ["HC", "S1", "S2", "S3", "S8"];
    assignedTo.forEach((u, i) => {
      if (i < keys.length && u) {
        shifts[keys[i]] = { uid: u.uid, name: u.name };
      }
    });
    return shifts;
  }
  
  const hasShiftKeys = ["S1", "S2", "S3", "HC", "S8"].some(k => k in assignedTo);
  if (hasShiftKeys) {
    return {
      S1: assignedTo.S1 || null,
      S2: assignedTo.S2 || null,
      S3: assignedTo.S3 || null,
      HC: assignedTo.HC || null,
      S8: assignedTo.S8 || null,
    };
  }
  
  if (assignedTo.uid && assignedTo.name) {
    shifts.HC = { uid: assignedTo.uid, name: assignedTo.name };
  }
  return shifts;
}

function BoDam({ user, isMobile }) {
  const { t } = useI18n();
  const { askConfirm } = useConfirm();
  const [status, setStatus] = useState([]);
  const [bodamCount, setBodamCount] = useState(DEFAULT_COUNT);
  const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(r => String(r).toLowerCase()) : String(user.role).split(',').map(r => r.trim().toLowerCase())) : [];
  const isAdmin = userRolesList.some(r => r === "admin" || r === "ehs");

  const fetchConfig = async () => {
    try {
      const snap = await dbService.getDoc("bodam", "config");
      if (snap && snap._exists !== false && snap.count) {
        setBodamCount(snap.count);
      } else {
        setBodamCount(DEFAULT_COUNT);
      }
    } catch (e) {
      console.error("Lỗi lấy cấu hình bộ đàm:", e);
    }
  };

  const fetchStatus = async () => {
    try {
      const docSnap = await dbService.getDoc("bodam", "status");
      if (docSnap && docSnap._exists !== false && docSnap.status) {
        setStatus(docSnap.status);
      }
    } catch (e) {
      console.error("Lỗi lấy trạng thái bộ đàm:", e);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchStatus();

    const unsubConfig = realtimeService.subscribeToPath("bodam/config", (data) => {
      if (data && data.count) {
        setBodamCount(data.count);
      } else {
        setBodamCount(DEFAULT_COUNT);
      }
    });

    const unsubStatus = realtimeService.subscribeToPath("bodam/status", (data) => {
      if (data && data.status) {
        setStatus(data.status);
      }
    });

    // Fallback polling interval (30 seconds)
    const intervalId = setInterval(() => {
      fetchConfig();
      fetchStatus();
    }, 30000);

    return () => {
      unsubConfig();
      unsubStatus();
      clearInterval(intervalId);
    };
  }, []);

  const [committeeUsers, setCommitteeUsers] = useState([]);
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersList = await dbService.getDocs("users");
        if (Array.isArray(usersList)) {
          const committee = usersList.filter(u => {
            const roles = Array.isArray(u.role) ? u.role : String(u.role).split(",").map(r => r.trim());
            return roles.map(r => r.toLowerCase()).includes("ehs committee");
          });
          setCommitteeUsers(committee);
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách committee:", err);
      }
    };
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  function getItem(idx) {
    return status[idx] || { checked: false, name: "", unavailable: false };
  }

  function getBodamName(idx) {
    return `Bộ đàm ${idx + 1}`;
  }

  async function handleAddBodam() {
    const newCount = bodamCount + 1;
    await dbService.updateDoc("bodam", "config", { count: newCount });
    fetchConfig();
  }

  async function handleRemoveBodam() {
    if (bodamCount <= MIN_COUNT) {
      await askConfirm(
        `Không thể giảm xuống dưới ${MIN_COUNT} bộ đàm.`,
        "Không thể xóa"
      );
      return;
    }
    const lastIdx = bodamCount - 1;
    const lastItem = getItem(lastIdx);
    if (lastItem.checked || lastItem.assignedTo) {
      await askConfirm(
        `Bộ đàm ${lastIdx + 1} đang được sử dụng hoặc đã chỉ định. Vui lòng thu hồi trước khi xóa.`,
        "Không thể xóa"
      );
      return;
    }
    if (!(await askConfirm(`Bạn có chắc muốn xóa Bộ đàm ${lastIdx + 1} không?`, "Xác nhận xóa bộ đàm"))) return;
    const newCount = bodamCount - 1;
    await dbService.updateDoc("bodam", "config", { count: newCount });
    fetchConfig();

    const newStatus = [...status];
    if (newStatus.length > newCount) {
      newStatus.splice(newCount);
      await dbService.updateDoc("bodam", "status", { status: newStatus });
      fetchStatus();
    }
  }

  async function handleAssign(idx, shiftKey, targetUserId, targetUserName) {
    const newStatus = [...status];
    while (newStatus.length <= idx) newStatus.push({ checked: false, name: "", unavailable: false });
    const cur = { ...newStatus[idx] };
    const currentShifts = getAssignedShifts(cur.assignedTo);
    
    currentShifts[shiftKey] = { uid: targetUserId, name: targetUserName };
    newStatus[idx] = { ...cur, assignedTo: currentShifts };
    await dbService.updateDoc("bodam", "status", { status: newStatus });
    fetchStatus();

    try {
      await dbService.createDoc("notifications", {
        type: "bodam_assign",
        message: `Bạn được chỉ định sử dụng ${getBodamName(idx)} ở ca ${shiftKey}. Hãy vào tab Bộ đàm để chấp nhận.`,
        target_user_id: targetUserId,
        createdBy: user.uid,
        read_by: [],
        relatedId: `bodam-${idx}-${shiftKey}-${targetUserId}`,
        timestamp: new Date().toISOString()
      });
    } catch (e) { console.error(e); }
  }

  async function handleCancelAssign(idx, shiftKey, targetUserId) {
    if (!(await askConfirm(`Bạn có chắc muốn hủy chỉ định ca ${shiftKey} cho người dùng này không?`, "Hủy chỉ định bộ đàm"))) return;
    const newStatus = [...status];
    while (newStatus.length <= idx) newStatus.push({ checked: false, name: "", unavailable: false });
    const cur = { ...newStatus[idx] };
    const currentShifts = getAssignedShifts(cur.assignedTo);
    currentShifts[shiftKey] = null;
    
    const hasAssignments = Object.values(currentShifts).some(u => u !== null);
    newStatus[idx] = { ...cur, assignedTo: hasAssignments ? currentShifts : null };
    await dbService.updateDoc("bodam", "status", { status: newStatus });
    fetchStatus();

    try {
      const notifs = await dbService.getDocs("notifications");
      const relatedId = `bodam-${idx}-${shiftKey}-${targetUserId}`;
      const matchedNotifs = notifs.filter(n => n.relatedId === relatedId);
      if (matchedNotifs.length > 0) {
        const operations = matchedNotifs.map(n => ({
          method: "DELETE",
          path: `/api/db/notifications/${n.id}`
        }));
        await dbService.commitBatch(operations);
      }
    } catch (err) { console.error("Lỗi xóa thông báo chỉ định:", err); }
  }

  async function handleAccept(idx) {
    const newStatus = [...status];
    while (newStatus.length <= idx) newStatus.push({ checked: false, name: "", unavailable: false });
    newStatus[idx] = { ...newStatus[idx], checked: true, name: user.name };
    await dbService.updateDoc("bodam", "status", { status: newStatus });
    fetchStatus();

    try {
      const notifs = await dbService.getDocs("notifications");
      const matchedNotifs = notifs.filter(n => 
        n.target_user_id === user.uid && 
        n.type === "bodam_assign" && 
        n.relatedId && 
        n.relatedId.startsWith(`bodam-${idx}-`)
      );
      if (matchedNotifs.length > 0) {
        const operations = matchedNotifs.map(n => ({
          method: "DELETE",
          path: `/api/db/notifications/${n.id}`
        }));
        await dbService.commitBatch(operations);
      }
    } catch (err) { console.error("Lỗi tự dọn dẹp thông báo:", err); }
  }

  async function handleCheck(idx) {
    const item = getItem(idx);
    if (item.unavailable) return;
    const newStatus = [...status];
    while (newStatus.length <= idx) newStatus.push({ checked: false, name: "", unavailable: false });
    const cur = newStatus[idx];
    newStatus[idx] = cur.checked ? { ...cur, checked: false, name: "" } : { ...cur, checked: true, name: user.name };
    await dbService.updateDoc("bodam", "status", { status: newStatus });
    fetchStatus();
  }

  async function handleToggleUnavailable(idx) {
    const newStatus = [...status];
    while (newStatus.length <= idx) newStatus.push({ checked: false, name: "", unavailable: false });
    const cur = newStatus[idx];
    newStatus[idx] = { ...cur, unavailable: !cur.unavailable, checked: false, name: '' };
    await dbService.updateDoc("bodam", "status", { status: newStatus });
    fetchStatus();
  }

  const indices = Array.from({ length: bodamCount }, (_, i) => i);

  return (
    <div>
      {/* Header với nút thêm/bớt cho Admin */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontWeight: 700, color: orange, letterSpacing: 0.5, margin: 0 }}>{t("bodam.title")}</h2>
        {isAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>
              Tổng: <b style={{ color: orange }}>{bodamCount}</b> bộ đàm
            </span>
            <button
              onClick={handleAddBodam}
              title="Thêm bộ đàm"
              style={{ background: orange, color: 'white', border: 'none', borderRadius: 7, width: 34, height: 34, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
            >+</button>
            <button
              onClick={handleRemoveBodam}
              title={bodamCount <= MIN_COUNT ? `Tối thiểu ${MIN_COUNT} bộ đàm` : "Bớt bộ đàm cuối"}
              style={{ background: bodamCount <= MIN_COUNT ? '#ccc' : red, color: 'white', border: 'none', borderRadius: 7, width: 34, height: 34, fontSize: 22, cursor: bodamCount <= MIN_COUNT ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
              disabled={bodamCount <= MIN_COUNT}
            >−</button>
          </div>
        )}
      </div>

      {isMobile ? (
        <div>
          {indices.map((idx) => {
            const item = getItem(idx);
            const assignedShifts = getAssignedShifts(item.assignedTo);
            const isUserAssigned = Object.values(assignedShifts).some(u => u && u.uid === user.uid);
            const hasAssignments = Object.values(assignedShifts).some(u => u !== null);
            const canCheck = !item.unavailable && (!hasAssignments || isUserAssigned);
            return (
              <div key={idx} style={{ background: idx % 2 ? "#F4FAF9" : "#fff", opacity: item.unavailable ? 0.5 : 1, padding: '15px', border: `1.2px solid ${orangeLight}`, borderRadius: 12, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontWeight: 600, color: dark, fontSize: 18, marginBottom: 12 }}>{getBodamName(idx)}</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: (!canCheck) ? 'not-allowed' : 'pointer' }}>
                    <input type="checkbox" checked={item.checked || false} disabled={!canCheck} style={{ width: 22, height: 22, accentColor: orange, marginRight: 14 }} onChange={() => handleCheck(idx)} />
                    <div>
                      {item.unavailable ? (
                        <span style={{ color: red, fontWeight: 700 }}>{t("bodam.unavailable")}</span>
                      ) : item.checked ? (
                        <span style={{ color: orange, fontWeight: 700 }}>{item.name} — {t("bodam.inuse")}</span>
                      ) : hasAssignments ? (
                        <span style={{ color: "#d9534f", fontWeight: 700 }}>
                          Chỉ định: {Object.entries(assignedShifts)
                            .filter(([_, u]) => u !== null)
                            .map(([sh, u]) => `${sh}: ${u.name}`)
                            .join(", ")}
                        </span>
                      ) : (
                        <span style={{ color: "#b0b0b0", fontWeight: 600 }}>{t("bodam.returned")}</span>
                      )}
                    </div>
                  </label>
                </div>
                {!item.checked && isUserAssigned && (
                  <button onClick={() => handleAccept(idx)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: '8px' }}>Chấp nhận sử dụng</button>
                )}
                {isAdmin && (
                  <>
                    <button onClick={() => handleToggleUnavailable(idx)} style={{ background: item.unavailable ? '#f0ad4e' : '#6c757d', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: '8px', marginBottom: '8px' }}>
                      {item.unavailable ? t("bodam.reopen") : t("bodam.disable")}
                    </button>
                    {!item.unavailable && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6 }}>Phân chia theo ca trực (S1, S2, S3, HC, S8):</div>
                        {SHIFTS.map(sh => {
                          const val = assignedShifts[sh];
                          return (
                            <div key={sh} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, width: 30 }}>{sh}:</span>
                              {val ? (
                                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between', background: '#f1f1f1', padding: '4px 8px', borderRadius: 4, fontSize: 13 }}>
                                  <span>{val.name}</span>
                                  <button onClick={() => handleCancelAssign(idx, sh, val.uid)} style={{ background: 'none', border: 'none', color: red, cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                                </div>
                              ) : (
                                <select style={{ flex: 1, padding: 4, borderRadius: 4, border: `1px solid ${orangeLight}`, fontSize: 12 }} onChange={(e) => {
                                  if (e.target.value) {
                                    const sel = committeeUsers.find(u => u.uid === e.target.value);
                                    handleAssign(idx, sh, sel.uid, sel.name);
                                    e.target.value = "";
                                  }
                                }}>
                                  <option value="">Chỉ định ca {sh}...</option>
                                  {committeeUsers.map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", maxWidth: 820, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1.5px 9px #E88E2E11", border: `1.2px solid ${orangeLight}` }}>
          <thead>
            <tr style={{ background: orangeLight }}>
              <th style={{ padding: "10px 14px", fontSize: 15, color: dark, textAlign: "left", whiteSpace: "nowrap", width: 110 }}>{t("bodam.col.name")}</th>
              <th style={{ padding: "10px 14px", fontSize: 15, color: dark, textAlign: "left" }}>{t("bodam.col.status")}</th>
              {isAdmin && (
                <th style={{ padding: "10px 14px", fontSize: 15, color: dark, textAlign: "left" }}>{t("bodam.col.action")}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {indices.map((idx) => {
              const item = getItem(idx);
              const assignedShifts = getAssignedShifts(item.assignedTo);
              const isUserAssigned = Object.values(assignedShifts).some(u => u && u.uid === user.uid);
              const hasAssignments = Object.values(assignedShifts).some(u => u !== null);
              const canCheck = !item.unavailable && (!hasAssignments || isUserAssigned);
              return (
                <tr key={idx} style={{ background: idx % 2 ? "#F4FAF9" : "#fff", opacity: item.unavailable ? 0.5 : 1 }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: dark, whiteSpace: "nowrap" }}>{getBodamName(idx)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={item.checked || false} disabled={!canCheck} style={{ width: 20, height: 20, accentColor: orange, marginRight: 6, cursor: (!canCheck) ? 'not-allowed' : 'pointer', verticalAlign: 'middle' }} onChange={() => handleCheck(idx)} />
                      {item.unavailable ? (
                        <span style={{ color: red, fontWeight: 700 }}>{t("bodam.unavailable")}</span>
                      ) : item.checked ? (
                        <span style={{ color: orange, fontWeight: 700 }}>{item.name} — {t("bodam.inuse")}</span>
                      ) : hasAssignments ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: "#d9534f", fontWeight: 700 }}>
                            Chỉ định: {Object.entries(assignedShifts).filter(([_, u]) => u !== null).map(([sh, u]) => `${sh}: ${u.name}`).join(", ")}
                          </span>
                          {!item.checked && isUserAssigned && (
                            <button onClick={() => handleAccept(idx)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}>Chấp nhận</button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#b0b0b0", fontWeight: 600 }}>{t("bodam.returned")}</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                      <button onClick={() => handleToggleUnavailable(idx)} style={{ background: item.unavailable ? '#f0ad4e' : '#6c757d', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                        {item.unavailable ? t("bodam.reopen") : t("bodam.markUnavailable")}
                      </button>
                      {!item.unavailable && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', maxWidth: 360 }}>
                          {SHIFTS.map(sh => {
                            const val = assignedShifts[sh];
                            return (
                              <div key={sh} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: val ? '#E5F4F2' : '#f5f5f5',
                                padding: '2px 6px',
                                borderRadius: 6,
                                border: `1px solid ${val ? orange : orangeLight}`,
                                fontSize: 12,
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ fontWeight: 'bold', marginRight: 4, color: val ? orange : '#555' }}>{sh}:</span>
                                {val ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontWeight: 500, maxWidth: 65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val.name}>{val.name}</span>
                                    <button 
                                      onClick={() => handleCancelAssign(idx, sh, val.uid)} 
                                      style={{ background: 'none', border: 'none', color: red, cursor: 'pointer', fontWeight: 'bold', padding: '0 2px', fontSize: 12, display: 'inline-flex', alignItems: 'center' }}
                                      title="Hủy chỉ định"
                                    >✕</button>
                                  </span>
                                ) : (
                                  <select 
                                    style={{ padding: 0, borderRadius: 4, border: 'none', background: 'transparent', fontSize: 11, outline: 'none', cursor: 'pointer', color: '#666', fontWeight: 'bold' }} 
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const sel = committeeUsers.find(u => u.uid === e.target.value);
                                        handleAssign(idx, sh, sel.uid, sel.name);
                                        e.target.value = "";
                                      }
                                    }}
                                  >
                                    <option value="">+</option>
                                    {committeeUsers.map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 13, color: orange, marginTop: 15 }}>{t("bodam.note")}</div>
      <div style={{ fontSize: 14, color: red, marginTop: 10, fontWeight: 'bold' }}>{t("bodam.emergency")}</div>
    </div>
  );
}

export default BoDam;