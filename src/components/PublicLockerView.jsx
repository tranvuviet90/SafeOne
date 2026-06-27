import React, { useState, useEffect } from "react";
import originalDbService from "../services/dbService";
import apiClient from "../services/apiClient";
import realtimeService from "../services/realtimeService";

let globalRefreshCallback = null;
const dbService = {
  getDoc: (col, id) => originalDbService.getDoc(col, id),
  getDocs: (col) => originalDbService.getDocs(col),
  createDoc: async (col, data) => {
    const res = await originalDbService.createDoc(col, data);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  updateDoc: async (col, id, data) => {
    const res = await originalDbService.updateDoc(col, id, data);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  deleteDoc: async (col, id) => {
    const res = await originalDbService.deleteDoc(col, id);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  },
  commitBatch: async (ops) => {
    const res = await originalDbService.commitBatch(ops);
    if (globalRefreshCallback) globalRefreshCallback();
    return res;
  }
};
import imageCompression from "browser-image-compression";
import { useToast } from "./LightboxSwipeOnly";

const DEPARTMENTS = [
  "Cutting", "Rolling", "Finishing", "Dipping", "Graphics", "QC", "Warehouse",
  "A_Blank", "A_Cosmetic", "MTN", "ENG", "Office", "Bảo Vệ", "Tạp Vụ", "Khác"
];

function getId(prefix, num) {
  return prefix + String(num).padStart(2, '0');
}

const LOCKER_LAYOUTS = {
  A: {
    name: "Khu A (A01 - A126)",
    groups: [
      {
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("A", 0 * 18 + r * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("A", 1 * 18 + r * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("A", 2 * 18 + r * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("A", 3 * 18 + r * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("A", 4 * 18 + r * 3 + c + 1) },
          { name: "Block 6", idPattern: (r, c) => getId("A", 5 * 18 + r * 3 + c + 1) },
          { name: "Block 7", idPattern: (r, c) => getId("A", 6 * 18 + r * 3 + c + 1) },
        ]
      }
    ]
  },
  B: {
    name: "Khu B (B01 - B123)",
    groups: [
      {
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("B", r * 21 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("B", r * 21 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("B", r * 21 + 2 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("B", r * 21 + 3 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("B", r * 21 + 4 * 3 + c + 1) },
          { name: "Block 6", idPattern: (r, c) => getId("B", r * 21 + 5 * 3 + c + 1) },
        ]
      }
    ]
  },
  R: {
    name: "Khu R (R01 - R210)",
    groups: [
      {
        title: "R Phía Trên",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("R", r * 15 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("R", r * 15 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("R", r * 15 + 2 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("R", r * 15 + 3 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("R", r * 15 + 4 * 3 + c + 1) },
          { name: "Block 6", cols: 2, idPattern: (r, c) => getId("R", 199 + r * 2 + c) },
        ]
      },
      {
        title: "R Phía Dưới",
        blocks: [
          { name: "Block 91-126", cols: 6, idPattern: (r, c) => getId("R", 91 + r * 6 + c) },
          { name: "Block 3", idPattern: (r, c) => getId("R", 127 + r * 3 + c) },
          { name: "Block 4", idPattern: (r, c) => getId("R", 145 + r * 3 + c) },
          { name: "Block 5", idPattern: (r, c) => getId("R", 163 + r * 3 + c) },
          { name: "Block 6", idPattern: (r, c) => getId("R", 181 + r * 3 + c) },
        ]
      }
    ]
  },
  D: {
    name: "Khu D (D01 - D234)",
    groups: [
      {
        title: "D Phía Trên",
        blocks: [
          { name: "Block 1-2", cols: 6, idPattern: (r, c) => getId("D", 1 + r * 6 + c) },
          { name: "Block 3-4", cols: 6, idPattern: (r, c) => getId("D", 37 + r * 6 + c) },
          { name: "Block 5-6", cols: 6, idPattern: (r, c) => getId("D", 127 + r * 6 + c) },
        ]
      },
      {
        title: "D Phía Dưới",
        blocks: [
          { name: "Block 7", idPattern: (r, c) => getId("D", 163 + r * 3 + c) },
          { name: "Block 8", idPattern: (r, c) => getId("D", 181 + r * 3 + c) },
          { name: "Block 9-11", cols: 9, idPattern: (r, c) => getId("D", 73 + r * 9 + c) },
          { name: "Block 12", idPattern: (r, c) => getId("D", 199 + r * 3 + c) },
          { name: "Block 13", idPattern: (r, c) => getId("D", 217 + r * 3 + c) },
        ]
      }
    ]
  },
  Q: {
    name: "Khu Q (Q01 - Q144)",
    groups: [
      {
        title: "Q Hàng Ngang",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("Q", r * 9 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("Q", r * 9 + 1 * 3 + c + 1) },
          { name: "Block 4", idPattern: (r, c) => getId("Q", 55 + r * 3 + c) },
          { name: "Block 5-8", cols: 12, idPattern: (r, c) => getId("Q", 73 + r * 12 + c) },
        ]
      },
      {
        title: "Khối Q Rời (Isolated Q07 - Q54)",
        blocks: [
          { name: "Block 3", idPattern: (r, c) => getId("Q", r * 9 + 2 * 3 + c + 1) }
        ]
      }
    ]
  },
  F: {
    name: "Khu F (F01 - F90)",
    groups: [
      {
        title: "F Phía Trên",
        blocks: [
          { name: "Block 1", idPattern: (r, c) => getId("F", r * 15 + 0 * 3 + c + 1) },
          { name: "Block 2", idPattern: (r, c) => getId("F", r * 15 + 1 * 3 + c + 1) },
          { name: "Block 3", idPattern: (r, c) => getId("F", r * 15 + 2 * 3 + c + 1) },
        ]
      },
      {
        title: "F Phía Dưới",
        blocks: [
          { name: "Block 4", idPattern: (r, c) => getId("F", r * 15 + 9 + 0 * 3 + c + 1) },
          { name: "Block 5", idPattern: (r, c) => getId("F", r * 15 + 9 + 1 * 3 + c + 1) },
        ]
      }
    ]
  }
};

// Helper che giấu số điện thoại bảo mật
function maskPhoneNumber(phone) {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  if (cleaned.length < 6) return "****";
  return cleaned.substring(0, 3) + "****" + cleaned.substring(cleaned.length - 3);
}

export default function PublicLockerView({ lockerId: initialLockerId }) {
  const [currentLockerId, setCurrentLockerId] = useState(initialLockerId);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [lockerData, setLockerData] = useState(null);
  const [otherLockers, setOtherLockers] = useState([]);
  
  // Form đăng ký tủ trống
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [msnv, setMsnv] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  
  // Thành công đăng ký & cài đặt toàn cục
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [globalSettings, setGlobalSettings] = useState(null);

  // Sơ đồ chọn tủ trống công cộng
  const [showVacantMap, setShowVacantMap] = useState(false);
  const [allLockersData, setAllLockersData] = useState({});
  const [loadingMap, setLoadingMap] = useState(false);
  const [activeZone, setActiveZone] = useState("A");

  // Báo hư hỏng tủ đồ
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageDesc, setDamageDesc] = useState("");
  const [damageFile, setDamageFile] = useState(null);
  const [isReportingDamage, setIsReportingDamage] = useState(false);

  useEffect(() => {
    fetchLockerData();
    fetchGlobalSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tải lại khi đổi tủ
  }, [currentLockerId]);

  // Kiểm tra thời gian thực khi nhập MSNV để xem có dùng tủ khác không
  useEffect(() => {
    if (msnv.trim().length >= 3) {
      const delayDebounce = setTimeout(() => {
        checkCrossOwnership(msnv.trim());
      }, 500);
      return () => clearTimeout(delayDebounce);
    } else {
      setOtherLockers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy lại khi MSNV đổi
  }, [msnv]);

  const fetchLockers = async () => {
    try {
      const snap = await dbService.getDocs("lockers");
      const data = {};
      snap.forEach(d => {
        data[d.id || d.uid] = d;
      });
      setAllLockersData(data);
    } catch (err) {
      console.error("Lỗi lấy danh sách lockers:", err);
    }
  };

  useEffect(() => {
    globalRefreshCallback = fetchLockers;
    return () => {
      globalRefreshCallback = null;
    };
  }, []);

  // Lắng nghe trạng thái toàn bộ tủ đồ để vẽ sơ đồ chọn tủ trống
  useEffect(() => {
    if (!showVacantMap) return;
    setLoadingMap(true);
    fetchLockers().finally(() => setLoadingMap(false));

    const unsub = realtimeService.subscribeToPath("lockers", () => { fetchLockers(); });

    const interval = setInterval(fetchLockers, 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [showVacantMap]);

  const getSortedBlocks = (group, groupIndex) => {
    const customOrder = globalSettings?.blockOrder?.[`${activeZone}_${groupIndex}`] || [];
    if (customOrder.length === 0) return group.blocks;
    
    return [...group.blocks].sort((a, b) => {
      const idxA = customOrder.indexOf(a.name);
      const idxB = customOrder.indexOf(b.name);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  };

  async function fetchLockerData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const data = await dbService.getDoc("lockers", currentLockerId);
      if (data && data._exists !== false) {
        setLockerData(data);
      } else {
        setLockerData({ id: currentLockerId, currentUser: null });
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu tủ:", error);
      toast.show("Không thể tải thông tin tủ đồ. Vui lòng thử lại sau.", "error");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function fetchGlobalSettings() {
    try {
      const data = await dbService.getDoc("lockers", "settings");
      if (data && data._exists !== false) {
        setGlobalSettings(data);
      }
    } catch (e) {
      console.warn("Lỗi tải cài đặt EHS:", e);
    }
  }

  const handleDamageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true };
      const compressed = file.size > options.maxSizeMB * 1024 * 1024 ? await imageCompression(file, options) : file;
      setDamageFile(compressed);
    } catch (err) {
      console.warn("Lỗi nén ảnh, sử dụng ảnh gốc:", err);
      setDamageFile(file);
    }
  };
  const handleReportDamage = async (e) => {
    e.preventDefault();
    if (!damageDesc.trim()) return;
    setIsReportingDamage(true);
    let downloadUrl = "";
    try {
      if (damageFile) {
        const formData = new FormData();
        formData.append("file", damageFile);
        formData.append("path", `locker_damage_images/${Date.now()}_${damageFile.name}`);
        const res = await apiClient.post("/api/storage/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
        downloadUrl = res.data.url;
      }

      await dbService.updateDoc("lockers", currentLockerId, {
        damageReport: {
          description: damageDesc.trim(),
          imageUrl: downloadUrl,
          status: "reported",
          reportedAt: new Date().toISOString()
        }
      });

      try {
        await dbService.createDoc("notifications", {
          type: "locker_management",
          message: `Tủ cá nhân ${currentLockerId} được báo hư hỏng: "${damageDesc.trim()}"`,
          targetRoles: ["admin", "ehs"],
          createdBy: "system",
          timestamp: { type: "serverTimestamp" }
        });
      } catch (notifErr) {
        console.error("Lỗi gửi thông báo báo hỏng:", notifErr);
      }

      toast.show("Gửi báo cáo hư hỏng thành công!", "success");
      setDamageDesc("");
      setDamageFile(null);
      setShowDamageModal(false);
      fetchLockerData(false);
    } catch (err) {
      console.error("Lỗi báo cáo hư hỏng:", err);
      toast.show("Báo cáo hư hỏng thất bại: " + err.message, "error");
    } finally {
      setIsReportingDamage(false);
    }
  };

  async function checkCrossOwnership(employeeId) {
    if (!employeeId) return;
    try {
      const normalizedMsnv = employeeId.trim().toUpperCase();
      const list = await dbService.getDocs("lockers");
      const assigned = [];
      list.forEach(d => {
        const id = d.id || d.uid;
        if (id !== currentLockerId && id !== "settings") {
          const u = d.currentUser;
          if (u && u.msnv === normalizedMsnv && (u.status === "approved" || u.status === "pending")) {
            assigned.push(id);
          }
        }
      });
      setOtherLockers(assigned);
    } catch (e) {
      console.warn("Lỗi kiểm tra sở hữu tủ khác:", e);
    }
  }

  async function handleRegister(e) {
    if (e) e.preventDefault();
    if (!name.trim() || !msnv.trim() || !phone.trim()) {
      toast.show("Vui lòng điền đầy đủ các trường thông tin.", "warning");
      return;
    }

    // Nếu nhân viên đang dùng tủ khác, hiện cảnh báo di dời
    if (otherLockers.length > 0 && !showTransferConfirm) {
      setShowTransferConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const newRegistration = {
        name: name.trim(),
        department,
        msnv: msnv.trim().toUpperCase(),
        phone: phone.trim(),
        assignedAt: nowStr,
        status: "pending"
      };

      await dbService.updateDoc("lockers", currentLockerId, {
        id: currentLockerId,
        currentUser: newRegistration,
        history: {
          type: "arrayUnion",
          elements: [{
            ...newRegistration,
            action: "registered_pending",
            timestamp: nowStr
          }]
        }
      });

      try {
        await dbService.createDoc("notifications", {
          type: "locker_management",
          message: `Yêu cầu đăng ký tủ cá nhân ${currentLockerId} từ nhân viên ${name.trim()} (${msnv.trim().toUpperCase()}) đang chờ duyệt.`,
          targetRoles: ["admin", "ehs"],
          createdBy: "system",
          timestamp: { type: "serverTimestamp" }
        });
      } catch (notifErr) {
        console.error("Lỗi gửi thông báo đăng ký:", notifErr);
      }

      toast.show(`Gửi yêu cầu đăng ký tủ ${currentLockerId} thành công!`, "success");
      setShowTransferConfirm(false);
      setName("");
      setMsnv("");
      setPhone("");
      setOtherLockers([]);
      setRegistrationSuccess(true);
      await fetchLockerData(false);
    } catch (error) {
      console.error("Lỗi đăng ký tủ đồ:", error);
      toast.show("Không thể hoàn tất đăng ký tủ đồ.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransfer() {
    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const normalizedMsnv = msnv.trim().toUpperCase();
      const operations = [];

      for (const oldId of otherLockers) {
        let oldData = null;
        try {
          oldData = await dbService.getDoc("lockers", oldId);
        } catch { /* ignore missing locker */ }
        if (oldData && oldData._exists !== false) {
          const oldUser = oldData.currentUser;
          if (oldUser) {
            operations.push({
              method: "PATCH",
              path: `/api/db/lockers/${oldId}`,
              body: {
                currentUser: null,
                history: {
                  type: "arrayUnion",
                  elements: [{
                    ...oldUser,
                    action: "transferred_out",
                    timestamp: nowStr,
                    detail: `Di dời sang tủ ${currentLockerId}`
                  }]
                }
              }
            });
          }
        }
      }

      const newRegistration = {
        name: name.trim(),
        department,
        msnv: normalizedMsnv,
        phone: phone.trim(),
        assignedAt: nowStr,
        status: "pending"
      };

      operations.push({
        method: "PATCH",
        path: `/api/db/lockers/${currentLockerId}`,
        body: {
          id: currentLockerId,
          currentUser: newRegistration,
          history: {
            type: "arrayUnion",
            elements: [{
              ...newRegistration,
              action: "registered_pending_transfer",
              timestamp: nowStr,
              detail: `Di dời từ tủ ${otherLockers.join(", ")}`
            }]
          }
        }
      });

      await dbService.commitBatch(operations);

      try {
        await dbService.createDoc("notifications", {
          type: "locker_management",
          message: `Yêu cầu di dời từ tủ ${otherLockers.join(", ")} sang tủ cá nhân ${currentLockerId} của nhân viên ${name.trim()} (${normalizedMsnv}) đang chờ duyệt.`,
          targetRoles: ["admin", "ehs"],
          createdBy: "system",
          timestamp: { type: "serverTimestamp" }
        });
      } catch (notifErr) {
        console.error("Lỗi gửi thông báo di dời:", notifErr);
      }

      toast.show(`Di dời tủ đồ và đăng ký tủ ${currentLockerId} thành công!`, "success");
      setShowTransferConfirm(false);
      setName("");
      setMsnv("");
      setPhone("");
      setOtherLockers([]);
      setRegistrationSuccess(true);
      await fetchLockerData(false);
    } catch (error) {
      console.error("Lỗi di dời tủ đồ:", error);
      toast.show("Không thể hoàn tất di dời tủ đồ.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f3f6fa", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ border: "4px solid rgba(0,0,0,0.1)", borderLeft: "4px solid #1a5c68", borderRadius: "50%", width: 40, height: 40, animation: "spin 1s linear infinite" }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p style={{ marginTop: 12, color: "#666", fontWeight: "600" }}>Đang kiểm tra thông tin tủ đồ...</p>
        </div>
      </div>
    );
  }

  const user = lockerData?.currentUser;
  const isPending = !!user && user.status === "pending";
  const isOccupied = !!user && user.status !== "pending";
  
  // Xác định phân khu để lấy mô tả khu vực
  const zoneId = currentLockerId ? currentLockerId.charAt(0).toUpperCase() : "";
  const zoneDescription = globalSettings?.zoneDescriptions?.[zoneId] || "";

  return (
    <div className="public-locker-container" style={{ minHeight: "100vh", background: "var(--pl-bg-grad)", display: "flex", justifyContent: "center", alignItems: "center", padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .public-locker-container {
          --pl-bg-grad: linear-gradient(135deg, #eef2f7 0%, #dbe4ee 100%);
          --pl-card-bg: #ffffff;
          --pl-text-primary: #1a202c;
          --pl-text-secondary: #4a5568;
          --pl-text-muted: #718096;
          --pl-border: rgba(0, 0, 0, 0.08);
          --pl-input-bg: #ffffff;
          --pl-input-border: #cbd5e0;
          --pl-input-text: #1a202c;
          --pl-info-bg: #f8fafc;
          --pl-info-border: #e2e8f0;
          --pl-success-bg: #e8f5e9;
          --pl-success-text: #2e7d32;
        }
        @media (prefers-color-scheme: dark) {
          .public-locker-container {
            --pl-bg-grad: linear-gradient(135deg, #0f172a 0%, #020617 100%);
            --pl-card-bg: #1e293b;
            --pl-text-primary: #f8fafc;
            --pl-text-secondary: #cbd5e1;
            --pl-text-muted: #94a3b8;
            --pl-border: rgba(255, 255, 255, 0.08);
            --pl-input-bg: #0f172a;
            --pl-input-border: #334155;
            --pl-input-text: #f8fafc;
            --pl-info-bg: #0f172a;
            --pl-info-border: #334155;
            --pl-success-bg: rgba(46, 125, 50, 0.15);
            --pl-success-text: #81c784;
          }
        }
        @keyframes blink-dot {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .pl-blink-dot {
          animation: blink-dot 1.5s infinite;
        }
        .public-map-overlay {
          position: fixed;
          inset: 0;
          background: rgba(8, 16, 36, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 3000;
          padding: 16px;
        }
        .public-map-content {
          background: var(--pl-card-bg);
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
          display: flex;
          flex-direction: column;
          border: 1px solid var(--pl-border);
          overflow: hidden;
          animation: mapFadeIn 0.3s ease-out;
        }
        @keyframes mapFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .public-map-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--pl-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .public-map-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .public-map-zones {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .public-map-zone-btn {
          padding: 8px 18px;
          border-radius: 8px;
          border: none;
          background: var(--pl-info-bg);
          color: var(--pl-text-secondary);
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid var(--pl-border);
        }
        .public-map-zone-btn.active {
          background: linear-gradient(135deg, #1a5c68 0%, #10414a 100%);
          color: #fff;
          border: 1px solid transparent;
        }
        .public-map-grid-container {
          background: var(--pl-info-bg);
          border: 1px solid var(--pl-info-border);
          border-radius: 16px;
          padding: 20px;
        }
        @media (max-width: 480px) {
          .pl-vacant-btn {
            position: static !important;
            margin-top: 12px !important;
            display: inline-flex !important;
          }
          .pl-header-container {
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .public-map-content {
            height: 95vh;
            max-height: 95vh;
          }
          .public-map-body {
            padding: 16px;
          }
          .public-map-grid-container {
            padding: 12px;
          }
        }
      `}} />
      
      <div style={{ background: "var(--pl-card-bg)", borderRadius: "24px", width: "100%", maxWidth: "480px", boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)", overflow: "hidden", border: "1px solid var(--pl-border)" }}>
        
        {/* Top header (Symmetrical Flex layout, no absolute overlap) */}
        <div style={{ background: "linear-gradient(135deg, #1a5c68 0%, #10414a 100%)", padding: "20px 24px 24px", color: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          {/* Top row for badge & button */}
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", minHeight: "32px", gap: "10px" }}>
            <div style={{ background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", letterSpacing: "1px" }}>
              LOCKER QR
            </div>
            {(isOccupied || isPending) && (
              <button 
                onClick={() => setShowVacantMap(true)}
                style={{ background: "#f59e0b", border: "none", color: "#fff", padding: "6px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "4px" }}
                onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                🔍 Xem tủ trống
              </button>
            )}
          </div>
          
          {/* Locker ID */}
          <div style={{ fontSize: "56px", fontWeight: "900", textShadow: "0 4px 12px rgba(0,0,0,0.15)", lineHeight: 1, margin: "4px 0" }}>
            {currentLockerId}
          </div>
          
          {/* Title */}
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            HỆ THỐNG QUẢN LÝ TỦ CÁ NHÂN
          </div>
        </div>

        {/* Card content */}
        <div className="pl-card-body">
          {isOccupied ? (
            // LOCKER OCCUPIED VIEW
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", background: "var(--pl-success-bg)", color: "var(--pl-success-text)", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>
                <span style={{ fontSize: "18px" }}>🔒</span>
                Tủ này đang có người sử dụng
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--pl-info-bg)", padding: "20px", borderRadius: "16px", border: "1px solid var(--pl-info-border)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Họ và tên</div>
                  <div style={{ fontSize: "17px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.name}</div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bộ phận</div>
                    <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.department}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mã số NV (MSNV)</div>
                    <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.msnv}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Số điện thoại</div>
                  <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{maskPhoneNumber(user.phone)}</span>
                    <span style={{ fontSize: "11px", color: "var(--pl-text-muted)", fontStyle: "italic", fontWeight: "normal" }}>(đã che ẩn)</span>
                  </div>
                </div>

                {user.assignedAt && (
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ngày nhận tủ</div>
                    <div style={{ fontSize: "14px", color: "var(--pl-text-secondary)", fontWeight: "600", marginTop: "2px" }}>
                      {new Date(user.assignedAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : isPending ? (
            // LOCKER PENDING APPROVAL VIEW (PREVENTS OTHER SIGNUPS)
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", background: "rgba(237, 137, 54, 0.15)", color: "#dd6b20", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>
                <span className="pl-blink-dot" style={{ width: "10px", height: "10px", background: "#dd6b20", borderRadius: "50%", display: "inline-block" }}></span>
                Tủ đang ở trạng thái chờ xác nhận duyệt
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--pl-info-bg)", padding: "20px", borderRadius: "16px", border: "1px solid var(--pl-info-border)" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Họ và tên</div>
                  <div style={{ fontSize: "17px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.name}</div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Bộ phận</div>
                    <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.department}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Mã số NV (MSNV)</div>
                    <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px" }}>{user.msnv}</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Số điện thoại</div>
                  <div style={{ fontSize: "15px", color: "var(--pl-text-primary)", fontWeight: "700", marginTop: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{maskPhoneNumber(user.phone)}</span>
                    <span style={{ fontSize: "11px", color: "var(--pl-text-muted)", fontStyle: "italic", fontWeight: "normal" }}>(đã che ẩn)</span>
                  </div>
                </div>

                {user.assignedAt && (
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--pl-text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ngày đăng ký</div>
                    <div style={{ fontSize: "14px", color: "var(--pl-text-secondary)", fontWeight: "600", marginTop: "2px" }}>
                      {new Date(user.assignedAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "10px", fontSize: "13px", color: "var(--pl-text-secondary)", fontStyle: "italic", borderTop: "1.5px solid var(--pl-border)", paddingTop: "12px", lineHeight: "1.4" }}>
                  ⚠️ Tủ đồ này đã được đăng ký và đang ở trạng thái chờ duyệt. Bạn không thể đăng ký sử dụng cho đến khi EHS xử lý yêu cầu này.
                </div>
              </div>
            </div>
          ) : (
            // LOCKER VACANT REGISTRATION FORM
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", background: "rgba(26, 92, 104, 0.1)", color: "#1a5c68", padding: "12px 16px", borderRadius: "12px", fontSize: "14px", fontWeight: "700" }}>
                <span style={{ fontSize: "18px" }}>🔓</span>
                Tủ trống - Đăng ký sử dụng tủ này
              </div>

              {zoneDescription && (
                <div style={{ fontSize: "14px", color: "var(--pl-text-secondary)", fontStyle: "italic", background: "var(--pl-info-bg)", border: "1px solid var(--pl-info-border)", padding: "12px 16px", borderRadius: "12px", marginBottom: "16px", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                  ℹ️ <b>Thông tin khu vực:</b><br />{zoneDescription}
                </div>
              )}

              <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "5px" }}>Họ và tên nhân viên *</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="Nhập đầy đủ họ và tên" 
                    required
                    style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid var(--pl-input-border)", background: "var(--pl-input-bg)", color: "var(--pl-input-text)", fontSize: "15px", boxSizing: "border-box", height: "45px" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "5px" }}>Bộ phận *</label>
                    <select 
                      value={department} 
                      onChange={e => setDepartment(e.target.value)}
                      style={{ 
                        width: "100%", 
                        padding: "11px 32px 11px 14px", 
                        borderRadius: "10px", 
                        border: "1.5px solid var(--pl-input-border)", 
                        background: "var(--pl-input-bg)", 
                        color: "var(--pl-input-text)", 
                        fontSize: "15px", 
                        height: "45px", 
                        boxSizing: "border-box",
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='292.4' height='292.4'%3E%3Cpath fill='%23718096' d='M287 69.4a17.6 17.6 0 0 0-13-5.4H18.4c-5 0-9.3 1.8-12.9 5.4A17.6 17.6 0 0 0 0 82.2c0 5 1.8 9.3 5.4 12.9l128 127.9c3.6 3.6 7.8 5.4 12.8 5.4s9.2-1.8 12.8-5.4L287 95c3.5-3.5 5.4-7.8 5.4-12.8 0-5-1.9-9.2-5.5-12.8z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 14px center",
                        backgroundSize: "12px auto"
                      }}
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "5px" }}>MSNV *</label>
                    <input 
                      type="text" 
                      value={msnv} 
                      onChange={e => setMsnv(e.target.value)} 
                      placeholder="Nhập mã nhân viên" 
                      required
                      style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid var(--pl-input-border)", background: "var(--pl-input-bg)", color: "var(--pl-input-text)", fontSize: "15px", boxSizing: "border-box", height: "45px" }}
                    />
                  </div>
                </div>

                {otherLockers.length > 0 && (
                  <div style={{ background: "rgba(237, 137, 54, 0.1)", border: "1px solid rgba(237, 137, 54, 0.3)", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", color: "var(--pl-text-primary)", fontWeight: "600" }}>
                    ⚠️ Nhân viên này đang sử dụng tủ: {otherLockers.join(", ")}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "5px" }}>Số điện thoại *</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="Nhập số điện thoại liên lạc" 
                    required
                    style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid var(--pl-input-border)", background: "var(--pl-input-bg)", color: "var(--pl-input-text)", fontSize: "15px", boxSizing: "border-box", height: "45px" }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ width: "100%", padding: "12px", border: "none", borderRadius: "10px", background: "#1a5c68", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer", transition: "background 0.2s", marginTop: "8px", boxShadow: "0 4px 10px rgba(26, 92, 104, 0.2)" }}
                >
                  {isSubmitting ? "Đang xử lý đăng ký..." : "Gửi thông tin đăng ký"}
                </button>
              </form>
            </div>
          )}

          {/* Nút báo hư tủ (luôn hiển thị nếu chưa có báo cáo hư hỏng) */}
          {!lockerData?.damageReport ? (
            <button
              onClick={() => setShowDamageModal(true)}
              style={{
                marginTop: "20px",
                width: "100%",
                padding: "11px",
                background: "rgba(229, 62, 62, 0.06)",
                color: "#e53e3e",
                border: "1.5px dashed rgba(229, 62, 62, 0.3)",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "700",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = "rgba(229, 62, 62, 0.12)";
                e.currentTarget.style.borderColor = "rgba(229, 62, 62, 0.5)";
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "rgba(229, 62, 62, 0.06)";
                e.currentTarget.style.borderColor = "rgba(229, 62, 62, 0.3)";
              }}
            >
              🛠️ Báo hỏng tủ / Báo hư tủ
            </button>
          ) : (
            <div style={{
              marginTop: "20px",
              padding: "14px 16px",
              background: lockerData.damageReport.status === "received" ? "rgba(237, 137, 54, 0.08)" : "rgba(229, 62, 62, 0.08)",
              border: `1px solid ${lockerData.damageReport.status === "received" ? "rgba(237, 137, 54, 0.25)" : "rgba(229, 62, 62, 0.25)"}`,
              borderRadius: "12px",
              fontSize: "13px",
              color: "var(--pl-text-primary)"
            }}>
              <div style={{ fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", color: lockerData.damageReport.status === "received" ? "#dd6b20" : "#e53e3e" }}>
                <span>{lockerData.damageReport.status === "received" ? "🔧 Thiết bị đang được sửa chữa" : "⚠️ Đã ghi nhận báo hỏng"}</span>
              </div>
              <div style={{ marginTop: "6px", color: "var(--pl-text-secondary)", lineHeight: "1.4" }}>
                <b>Mô tả:</b> {lockerData.damageReport.description}
              </div>
              {lockerData.damageReport.imageUrl && (
                <div style={{ marginTop: "10px" }}>
                  <a href={lockerData.damageReport.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#1a5c68", fontWeight: "800", textDecoration: "underline" }}>
                    📷 Xem ảnh hiện trạng
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* POPUP XÁC NHẬN ĐĂNG KÝ THÀNH CÔNG */}
      {registrationSuccess && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8, 16, 36, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px" }}>
          <div style={{ background: "var(--pl-card-bg)", width: "100%", maxWidth: "400px", borderRadius: "20px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "28px 24px", border: "1.5px solid var(--pl-border)", color: "var(--pl-text-primary)", textAlign: "center" }}>
            <div style={{ width: "72px", height: "72px", background: "var(--pl-success-bg)", color: "var(--pl-success-text)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "40px", fontWeight: "bold" }}>
              ✓
            </div>
            
            <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--pl-text-primary)", margin: "0 0 12px 0" }}>
              Gửi yêu cầu thành công!
            </h3>
            
            <div style={{ 
              background: "var(--pl-info-bg)", 
              border: "1px solid var(--pl-info-border)", 
              padding: "16px 20px", 
              borderRadius: "16px", 
              color: "var(--pl-text-secondary)", 
              fontSize: "14px", 
              lineHeight: "1.6",
              textAlign: "left",
              whiteSpace: "pre-wrap",
              marginBottom: "24px"
            }}>
              {globalSettings?.successNotificationText || "Đăng ký tủ đồ thành công! Yêu cầu của bạn đang chờ EHS duyệt."}
            </div>
            
            <button 
              onClick={() => {
                setRegistrationSuccess(false);
                fetchLockerData();
              }}
              style={{ width: "100%", padding: "12px", border: "none", borderRadius: "10px", background: "#1a5c68", color: "#fff", fontSize: "16px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(26, 92, 104, 0.2)" }}
            >
              Xác nhận & Đóng
            </button>
          </div>
        </div>
      )}

      {/* POPUP CẢNH BÁO TỦ CHÉO & DI DỜI TỦ ĐỒ */}
      {showTransferConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8, 16, 36, 0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--pl-card-bg)", width: "100%", maxWidth: "440px", borderRadius: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "32px 28px", border: "1.5px solid var(--pl-border)", color: "var(--pl-text-primary)", textAlign: "center" }}>
            <div style={{ width: "72px", height: "72px", background: "rgba(237, 137, 54, 0.15)", color: "#dd6b20", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: "40px" }}>
              ⚠️
            </div>
            
            <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--pl-text-primary)", margin: "0 0 12px 0" }}>
              Nhân Viên Đã Có Tủ Đồ
            </h3>
            
            <p style={{ fontSize: "14px", color: "var(--pl-text-secondary)", lineHeight: "1.6", margin: "0 0 24px 0", textAlign: "left" }}>
              Mã số nhân viên <b>{msnv.trim().toUpperCase()}</b> đã có đăng ký sử dụng tủ cá nhân khác rồi (Mã tủ: <b>{otherLockers.join(", ")}</b>).
              <br /><br />
              Bạn có muốn <b>di dời tủ đồ cũ</b> sang tủ mới <b>{currentLockerId}</b> không? (Hành động này sẽ giải phóng tủ cũ và gửi yêu cầu đăng ký mới cho tủ {currentLockerId}).
            </p>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => {
                  setShowTransferConfirm(false);
                  setOtherLockers([]);
                }}
                disabled={isSubmitting}
                style={{ flex: 1, padding: "12px", border: "1.5px solid var(--pl-input-border)", borderRadius: "10px", background: "var(--pl-card-bg)", color: "var(--pl-text-secondary)", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleTransfer}
                disabled={isSubmitting}
                style={{ flex: 1, padding: "12px", border: "none", borderRadius: "10px", background: "#1a5c68", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(26, 92, 104, 0.2)" }}
              >
                {isSubmitting ? "Đang xử lý..." : "Di dời tủ đồ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SƠ ĐỒ CHỌN TỦ TRỐNG */}
      {showVacantMap && (
        <div className="public-map-overlay">
          <div className="public-map-content">
            <div className="public-map-header">
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--pl-text-primary)" }}>
                🗺️ Sơ đồ Chọn Tủ Trống
              </h3>
              <button 
                onClick={() => setShowVacantMap(false)}
                style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--pl-text-muted)" }}
              >
                ✕
              </button>
            </div>
            
            <div className="public-map-body">
              {/* Chọn khu vực (Zone Selector) */}
              <div className="public-map-zones">
                {Object.keys(LOCKER_LAYOUTS).map(zone => (
                  <button
                    key={zone}
                    onClick={() => setActiveZone(zone)}
                    className={`public-map-zone-btn ${activeZone === zone ? "active" : ""}`}
                  >
                    Khu {zone}
                  </button>
                ))}
              </div>

              {/* Chú giải trạng thái (Legend) */}
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px", fontSize: "12px", color: "var(--pl-text-secondary)", fontWeight: "600", background: "var(--pl-info-bg)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--pl-info-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "12px", background: "rgba(16, 185, 129, 0.15)", border: "1px dashed rgba(16, 185, 129, 0.5)", borderRadius: "3px" }} />
                  <span>🔓 Trống (Bấm để chọn)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "12px", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.25)", borderRadius: "3px" }} />
                  <span>⏳ Chờ xác nhận</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "12px", height: "12px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "3px" }} />
                  <span>🔒 Đang sử dụng</span>
                </div>
              </div>

              {/* Mô tả khu vực */}
              {globalSettings?.zoneDescriptions?.[activeZone] && (
                <div style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--pl-text-secondary)", fontStyle: "italic", background: "var(--pl-info-bg)", border: "1px solid var(--pl-info-border)", padding: "10px 14px", borderRadius: "10px" }}>
                  ℹ️ {globalSettings.zoneDescriptions[activeZone]}
                </div>
              )}

              {loadingMap ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0" }}>
                  <div style={{ border: "3px solid rgba(0,0,0,0.1)", borderLeft: "3px solid #1a5c68", borderRadius: "50%", width: 24, height: 24, animation: "spin 1s linear infinite" }} />
                  <p style={{ marginTop: 8, fontSize: "13px", color: "var(--pl-text-muted)" }}>Đang tải sơ đồ tủ đồ...</p>
                </div>
              ) : (
                <div className="public-map-grid-container">
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {LOCKER_LAYOUTS[activeZone].groups.map((group, gIdx) => (
                      <div key={gIdx}>
                        {group.title && (
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--pl-text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                            {group.title}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          {getSortedBlocks(group, gIdx).map((block) => {
                            const cols = block.cols || 3;
                            const blockLockers = [];
                            for (let r = 0; r < 6; r++) {
                              for (let c = 0; c < cols; c++) {
                                blockLockers.push(block.idPattern(r, c));
                              }
                            }

                            return (
                              <div 
                                key={block.name}
                                style={{ 
                                  background: "var(--pl-card-bg)", 
                                  padding: "10px", 
                                  borderRadius: "12px", 
                                  border: "1px solid var(--pl-border)",
                                  minWidth: `${cols * 40 + 20}px`
                                }}
                              >
                                <div style={{ fontSize: "10px", fontWeight: "800", color: "var(--pl-text-muted)", marginBottom: "6px", textAlign: "center" }}>
                                  {block.name}
                                </div>
                                <div 
                                  style={{ 
                                    display: "grid", 
                                    gridTemplateColumns: `repeat(${cols}, 40px)`, 
                                    gap: "5px",
                                    justifyContent: "center"
                                  }}
                                >
                                  {blockLockers.map(id => {
                                    const lockerInfo = allLockersData[id]?.currentUser;
                                    const isLockerOccupied = !!lockerInfo && lockerInfo.status !== "pending";
                                    const isLockerPending = !!lockerInfo && lockerInfo.status === "pending";
                                    
                                    let bg = "rgba(16, 185, 129, 0.08)";
                                    let border = "1.5px dashed rgba(16, 185, 129, 0.4)";
                                    let color = "#10b981";
                                    let cursor = "pointer";
                                    let titleText = `Tủ ${id}: Trống (Nhấp để đăng ký)`;

                                    if (isLockerOccupied) {
                                      bg = "rgba(239, 68, 68, 0.08)";
                                      border = "1.5px solid rgba(239, 68, 68, 0.15)";
                                      color = "var(--pl-text-muted)";
                                      cursor = "not-allowed";
                                      titleText = `Tủ ${id}: Đang sử dụng (Khóa)`;
                                    } else if (isLockerPending) {
                                      bg = "rgba(245, 158, 11, 0.08)";
                                      border = "1.5px solid rgba(245, 158, 11, 0.15)";
                                      color = "#f59e0b";
                                      cursor = "not-allowed";
                                      titleText = `Tủ ${id}: Chờ xác nhận duyệt`;
                                    }

                                    return (
                                      <div
                                        key={id}
                                        onClick={() => {
                                          if (!isLockerOccupied && !isLockerPending) {
                                            setCurrentLockerId(id);
                                            setShowVacantMap(false);
                                            toast.show(`Đã chuyển sang đăng ký tủ ${id}!`, "success");
                                          } else {
                                            toast.show(`Tủ ${id} không trống, vui lòng chọn tủ khác.`, "warning");
                                          }
                                        }}
                                        title={titleText}
                                        style={{
                                          height: "36px",
                                          background: bg,
                                          border: border,
                                          borderRadius: "6px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: cursor,
                                          fontSize: "11px",
                                          fontWeight: "700",
                                          color: color,
                                          transition: "all 0.15s"
                                        }}
                                      >
                                        {id.substring(1)}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL NHẬP BÁO CÁO HƯ HỎNG */}
      {showDamageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8, 16, 36, 0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "16px", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
          <div style={{ background: "var(--pl-card-bg)", width: "100%", maxWidth: "440px", borderRadius: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", padding: "28px 24px", border: "1.5px solid var(--pl-border)", color: "var(--pl-text-primary)" }}>
            
            {/* Header */}
            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--pl-text-primary)", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              🛠️ Báo cáo hư hỏng tủ {currentLockerId}
            </h3>
            
            <form onSubmit={handleReportDamage} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "6px" }}>
                  Mô tả tình trạng hư hỏng *
                </label>
                <textarea
                  required
                  rows={4}
                  value={damageDesc}
                  onChange={e => setDamageDesc(e.target.value)}
                  placeholder="Mô tả chi tiết hư hỏng (ví dụ: hỏng khóa, kẹt cánh cửa, mất chìa...)"
                  style={{ 
                    width: "100%", 
                    padding: "10px 12px", 
                    borderRadius: "10px", 
                    border: "1.5px solid var(--pl-input-border)", 
                    background: "var(--pl-input-bg)", 
                    color: "var(--pl-input-text)", 
                    fontSize: "14px", 
                    boxSizing: "border-box",
                    resize: "vertical"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--pl-text-secondary)", display: "block", marginBottom: "6px" }}>
                  Ảnh hiện trạng hư hỏng (Tùy chọn)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDamageFileChange}
                  style={{ 
                    width: "100%", 
                    padding: "8px", 
                    borderRadius: "10px", 
                    border: "1.5px solid var(--pl-input-border)", 
                    background: "var(--pl-input-bg)", 
                    color: "var(--pl-input-text)", 
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                />
                <span style={{ fontSize: "11px", color: "var(--pl-text-muted)", display: "block", marginTop: "4px" }}>
                  Hỗ trợ tải lên định dạng hình ảnh. Dung lượng sẽ được tự động nén tối ưu.
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button 
                  type="button"
                  onClick={() => {
                    setShowDamageModal(false);
                    setDamageDesc("");
                    setDamageFile(null);
                  }}
                  disabled={isReportingDamage}
                  style={{ flex: 1, padding: "12px", border: "1.5px solid var(--pl-input-border)", borderRadius: "10px", background: "var(--pl-card-bg)", color: "var(--pl-text-secondary)", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={isReportingDamage || !damageDesc.trim()}
                  style={{ flex: 1, padding: "12px", border: "none", borderRadius: "10px", background: "#e53e3e", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 12px rgba(229, 62, 62, 0.2)" }}
                >
                  {isReportingDamage ? "Đang gửi báo cáo..." : "Gửi báo cáo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
