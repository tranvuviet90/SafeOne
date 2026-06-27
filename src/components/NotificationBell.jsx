import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { colors } from "../theme";
import { useToast } from "./LightboxSwipeOnly";
import { DEPARTMENT_ROLES } from "../constants/roles";
import { getWeekNumber, formatRelativeTime, normalizeRole } from "../utils/string";
import originalDbService from "../services/dbService";
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

const NOTIFICATION_TYPES_CONFIG = [
  {
    type: "new_gemba_error",
    label: "🚨 Báo cáo sự cố EHS Audit",
    desc: "Nhận thông báo khi có sự cố EHS Audit mới phát sinh cần kiểm tra.",
    roles: ["admin", "ehs"]
  },
  {
    type: "new_tu_gemba_error",
    label: "💡 Báo cáo sự cố Gemba",
    desc: "Nhận thông báo khi có báo cáo sự cố Gemba mới được ghi nhận.",
    roles: ["admin", "ehs", ...DEPARTMENT_ROLES]
  },
  {
    type: "bodam_assign",
    label: "📻 Giao nhận Bộ đàm",
    desc: "Thông báo khi bạn được bàn giao hoặc thu hồi bộ đàm nhiệm vụ.",
    roles: ["admin", "ehs", "Bảo Vệ"]
  },
  {
    type: "shift_reminder",
    label: "🗓️ Phân ca & Nhắc nhở ca",
    desc: "Nhận nhắc nhở đăng ký ca làm việc tuần mới và lịch phân ca.",
    roles: ["admin", "ehs", "ehs committee"]
  },
  {
    type: "role_request",
    label: "👤 Yêu cầu thay đổi vai trò",
    desc: "Nhận thông báo khi thành viên gửi yêu cầu xin thay đổi vai trò.",
    roles: ["admin"]
  },
  {
    type: "meal_registration",
    label: "🍽️ Báo cơm & Suất ăn",
    desc: "Nhận thông báo khi có thay đổi, điều chỉnh cơm hoặc Nhà Ăn đã phát mì/sữa.",
    roles: ["admin", "ehs", "Nhà Ăn", ...DEPARTMENT_ROLES]
  },
  {
    type: "locker_management",
    label: "🗄️ Quản lý Tủ cá nhân",
    desc: "Nhận thông báo khi có yêu cầu đăng ký, di dời hoặc báo hư hỏng tủ cá nhân.",
    roles: ["admin", "ehs"]
  },
  {
    type: "operation_cert_eval",
    label: "📋 Đánh giá Chứng nhận vận hành",
    desc: "Nhận thông báo yêu cầu đánh giá hoặc tái đánh giá chứng nhận vận hành thiết bị.",
    roles: ["admin", "ehs"]
  }
];

const getNotificationIcon = (type) => {
  switch (type) {
    case "new_gemba_error": return "🚨";
    case "new_tu_gemba_error": return "💡";
    case "new_gemba_comment":
    case "new_ehs_audit_comment": return "💬";
    case "new_error": return "🚨"; // fallback
    case "bodam_assign": return "📻";
    case "shift_assign": return "🗓️";
    case "shift_note": return "📝";
    case "shift_reminder": return "⏳";
    case "role_request": return "👤";
    case "role_response": return "🔑";
    case "meal_registration": return "🍽️";
    case "locker_management": return "🗄️";
    case "operation_cert_eval": return "📋";
    default: return "🔔";
  }
};

const getTabForNotification = (type) => {
  switch (type) {
    case "new_gemba_error":    return { main: 0 };
    case "new_tu_gemba_error": return { main: 1 };
    case "new_gemba_comment": return { main: 1 };
    case "new_ehs_audit_comment": return { main: 0 };
    case "new_error":          return { main: 0 };
    case "bodam_assign":       return { main: 2, sub: "bodam" };
    case "shift_assign":       return { main: 2, sub: "calamviec" };
    case "shift_note":         return { main: 2, sub: "calamviec" };
    case "shift_reminder":     return { main: 2, sub: "calamviec" };
    case "role_request":       return { main: 4 };
    case "role_response":      return { main: 0 };
    case "meal_registration":  return { main: 3 };
    case "locker_management":  return { main: 2, sub: "locker" };
    case "operation_cert_eval": return { main: 5, sub: "license" };
    default: return null;
  }
};

// Hiển thị Web Notification của trình duyệt (chỉ gọi khi tab đang ẩn + đã cấp quyền)
function showBrowserNotification(notif) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const icon = getNotificationIcon(notif.type);
    const n = new Notification(`${icon} SafeOne — Thông báo mới`, {
      body: notif.message || "Bạn có thông báo mới",
      icon: "/favicon.png",
      tag: `safeone-notif-${notif.id}`, // gộp trùng cùng một thông báo
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Bỏ qua nếu trình duyệt chặn/không hỗ trợ
  }
}

/* ===== TOAST POPUP COMPONENT (Facebook-style) ===== */
function ToastPopup({ toast, onDismiss, onNavigate }) {
  const [visible, setVisible] = useState(false);   
  const [hiding, setHiding] = useState(false);      

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 20);
    const t2 = setTimeout(() => {
      setHiding(true);
      setTimeout(() => onDismiss(toast.toastId), 400); 
    }, 5000);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast.toastId, onDismiss]);

  const handleClick = () => {
    setHiding(true);
    setTimeout(() => onNavigate(toast), 400);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setHiding(true);
    setTimeout(() => onDismiss(toast.toastId), 400);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 320,
        background: "white",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        cursor: "pointer",
        zIndex: 9999,
        borderLeft: "4px solid #E88E2E",
        opacity: visible && !hiding ? 1 : 0,
        transform: visible && !hiding ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        pointerEvents: visible && !hiding ? "auto" : "none",
        userSelect: "none",
      }}
    >
      <div style={{ fontSize: 26, flexShrink: 0, marginTop: 1 }}>
        {getNotificationIcon(toast.type)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 3, lineHeight: 1.4 }}>
          Thông báo mới
        </div>
        <div style={{
          fontSize: 13,
          color: "#444",
          lineHeight: 1.45,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {toast.message}
        </div>
        <div style={{ fontSize: 11, color: "#E88E2E", marginTop: 5, fontWeight: 500 }}>
          {formatRelativeTime(toast.timestamp)}
        </div>
      </div>

      <button
        onClick={handleClose}
        style={{
          background: "#f0f0f0",
          border: "none",
          borderRadius: "50%",
          width: 22,
          height: 22,
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: "#666",
          marginTop: 1,
        }}
      >
        ✕
      </button>

      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        height: 3,
        borderRadius: "0 0 0 12px",
        background: "#E88E2E",
        width: visible && !hiding ? "0%" : "100%",
        transition: visible && !hiding ? "width 5s linear" : "none",
      }} />
    </div>
  );
}

export default function NotificationBell({ user, setActiveTab }) {
  const [roleNotifications, setRoleNotifications] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  const [localNotifications, setLocalNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  const [toastQueue, setToastQueue] = useState([]); 

  const { pushToast } = useToast();

  const [isPageVisible, setIsPageVisible] = useState(true);

  // Monitor page visibility to pause connections when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(`notif_settings_${user?.uid}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);

  // Sync settings when user changes
  useEffect(() => {
    if (user?.uid) {
      try {
        const saved = localStorage.getItem(`notif_settings_${user.uid}`);
        setSettings(saved ? JSON.parse(saved) : {});
      } catch {
        setSettings({});
      }
    }
  }, [user]);

  const isNotifTypeEnabled = useCallback((type) => {
    let targetType = type;
    if (type === "shift_assign" || type === "shift_note") {
      targetType = "shift_reminder";
    }
    return settings[targetType] !== false;
  }, [settings]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  
  // Tích hợp 2 lớp khiên: Cuốn sổ lưu ID và Thẻ báo cáo initialLoad
  const seenIdsRef = useRef(new Set());
  const initialLoadUser = useRef(true);

  // === Xin quyền hiển thị Web Notification ngay khi user đăng nhập / vào trang ===
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [user]);

  // === Web Notification khi tab đang ẨN (luôn bật, không phụ thuộc isPageVisible) ===
  // Effect fetch chính bên dưới tự ngắt khi tab ẩn nên không bắt được thông báo lúc vắng mặt.
  // Effect riêng này lắng nghe socket realtime và bắn browser notification khi tab ẩn,
  // dùng chung seenIdsRef để không toast trùng lại khi user quay lại tab.
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const rawRolesList = user?.role
      ? (Array.isArray(user.role) ? user.role : String(user.role).split(',').map(r => r.trim()).filter(Boolean))
      : [];
    const rolesNormalizedSet = new Set(rawRolesList.map(r => normalizeRole(r)));

    const isTypeEnabled = (type) => {
      let t = type;
      if (type === "shift_assign" || type === "shift_note") t = "shift_reminder";
      return settingsRef.current[t] !== false;
    };

    const pushIfHidden = async () => {
      if (document.visibilityState !== "hidden") return;   // chỉ bắn khi tab đang ẩn
      if (Notification.permission !== "granted") return;   // phải được cấp quyền
      try {
        const list = await dbService.getDocs("notifications");
        if (!Array.isArray(list)) return;
        list.forEach(n => {
          const forMe = n.target_user_id === user.uid ||
            (Array.isArray(n.target_roles) && n.target_roles.some(role => rolesNormalizedSet.has(normalizeRole(role))));
          if (!forMe) return;
          if (seenIdsRef.current.has(n.id)) return;          // đã xử lý
          seenIdsRef.current.add(n.id);                      // đánh dấu để khỏi toast trùng khi quay lại
          if ((n.read_by || []).includes(user.uid)) return;  // đã đọc
          if (n.created_by === user.uid) return;             // do chính mình tạo
          if (!isTypeEnabled(n.type)) return;                // bị tắt trong cài đặt
          showBrowserNotification({ id: n.id, type: n.type, message: n.message });
        });
      } catch (e) {
        console.warn("Không thể kiểm tra thông báo nền:", e);
      }
    };

    const unsub = realtimeService.subscribeToPath("notifications", pushIfHidden);
    return () => unsub();
  }, [user]);

  const dbNotifications = useMemo(() => {
    const combinedMap = new Map();
    roleNotifications.forEach(n => combinedMap.set(n.id, n));
    userNotifications.forEach(n => combinedMap.set(n.id, n));
    return Array.from(combinedMap.values()).sort((a, b) => {
      const tA = a.timestamp?.seconds || 0;
      const tB = b.timestamp?.seconds || 0;
      return tB - tA;
    });
  }, [roleNotifications, userNotifications]);

  useEffect(() => {
    if (!user || !isPageVisible) {
      setRoleNotifications([]);
      setUserNotifications([]);
      setLocalNotifications([]);
      return;
    }

    const rawRolesList = user?.role ? (Array.isArray(user.role) ? user.role : String(user.role).split(',').map(r => r.trim()).filter(Boolean)) : [];
    const rolesNormalizedSet = new Set(rawRolesList.map(r => normalizeRole(r)));

    const fetchNotifications = async () => {
      try {
        const list = await dbService.getDocs("notifications");
        if (!Array.isArray(list)) return;

        // Filter and map notifications to camelCase for UI compatibility
        const filteredList = list.filter(n => {
          if (n.target_user_id === user.uid) return true;
          if (n.target_roles && Array.isArray(n.target_roles)) {
            return n.target_roles.some(role => rolesNormalizedSet.has(normalizeRole(role)));
          }
          return false;
        }).map(n => ({
          id: n.id,
          type: n.type,
          message: n.message,
          targetRoles: n.target_roles || [],
          targetUserId: n.target_user_id || null,
          readBy: n.read_by || [],
          createdBy: n.created_by || null,
          timestamp: n.timestamp ? { seconds: Math.floor(new Date(n.timestamp).getTime() / 1000) } : { seconds: 0 }
        }));

        // Split into role vs user notifications to maintain original state structure
        const roleNotifs = filteredList.filter(n => n.targetRoles.length > 0);
        const userNotifs = filteredList.filter(n => n.targetUserId === user.uid);

        setRoleNotifications(roleNotifs);
        setUserNotifications(userNotifs);

        // Toast notifications logic for newly loaded notifications
        const isNotifTypeEnabledRef = (type) => {
          let targetType = type;
          if (type === "shift_assign" || type === "shift_note") {
            targetType = "shift_reminder";
          }
          return settingsRef.current[targetType] !== false;
        };

        const freshNotifs = filteredList
          .filter(n => !seenIdsRef.current.has(n.id))
          .filter(n =>
            !(n.readBy || []).includes(user.uid) &&
            n.createdBy !== user.uid &&
            isNotifTypeEnabledRef(n.type)
          );

        if (initialLoadUser.current) {
          filteredList.forEach(n => seenIdsRef.current.add(n.id));
          initialLoadUser.current = false;
        } else {
          freshNotifs.forEach(n => {
            seenIdsRef.current.add(n.id);
            setToastQueue(prev => [...prev, { ...n, toastId: `${n.id}-${Date.now()}` }]);
          });
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách thông báo:", err);
      }
    };

    const checkLocalShiftReminder = async () => {
      if (!rolesNormalizedSet.has(normalizeRole("ehs committee"))) {
        setLocalNotifications([]);
        return;
      }

      const today = new Date();
      const dayOfWeek = today.getDay(); 
      const hour = today.getHours();
      
      if (dayOfWeek === 0 && hour >= 8) {
        const nextWeekDate = new Date();
        nextWeekDate.setDate(today.getDate() + 7);
        const nextWeekId = `${nextWeekDate.getFullYear()}-${getWeekNumber(nextWeekDate)}`;

        try {
          const snap = await dbService.getDoc("weekly_shifts", nextWeekId);
          let hasShift = false;
          if (snap && snap._exists !== false) {
            if (snap[user.name]) hasShift = true;
          }
          if (!hasShift) {
            setLocalNotifications([{
              id: 'local-shift-reminder',
              type: 'shift_reminder',
              message: 'Sang tuần mới rồi, bạn chưa chọn ca làm việc. Nhấn vào đây để chọn ngay!',
              timestamp: Date.now(),
              readBy: [],
              isLocal: true
            }]);
          } else {
            setLocalNotifications([]);
          }
        } catch (error) {
          console.warn("Không thể đọc weekly_shifts để nhắc nhở ca:", error);
          setLocalNotifications([]);
        }
      } else {
        setLocalNotifications([]);
      }
    };

    globalRefreshCallback = fetchNotifications;

    const runChecks = () => {
      fetchNotifications();
      checkLocalShiftReminder();
    };

    runChecks();

    const unsub = realtimeService.subscribeToPath("notifications", () => {
      fetchNotifications();
    });

    const intervalId = setInterval(runChecks, 30 * 1000);
    return () => {
      globalRefreshCallback = null;
      unsub();
      clearInterval(intervalId);
    };
  }, [user, isPageVisible]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lọc thông báo do chính mình tạo — không hiển thị trong dropdown lẫn toast
  const filteredNotifications = [...localNotifications, ...dbNotifications]
    .filter(n => !n.createdBy || n.createdBy !== user.uid)
    .filter(n => isNotifTypeEnabled(n.type))
    .sort((a, b) => {
      const tA = a.isLocal ? a.timestamp : (a.timestamp?.seconds * 1000 || 0);
      const tB = b.isLocal ? b.timestamp : (b.timestamp?.seconds * 1000 || 0);
      return tB - tA;
    });

  // Đếm số lượng thông báo chưa đọc từ danh sách đã lọc
  const unreadCount = filteredNotifications.filter(n => !(n.readBy || []).includes(user.uid)).length;

  // Hiển thị tối đa 20 thông báo gần nhất (bao gồm cả đã đọc và chưa đọc) để tránh dropdown quá dài
  const allNotifications = filteredNotifications.slice(0, 20);

  const markAsReadAndNavigate = async (notif) => {
    // Đánh dấu đã đọc
    if (!notif.isLocal && !(notif.readBy || []).includes(user.uid)) {
      try {
        await dbService.updateDoc("notifications", notif.id, {
          read_by: { type: "arrayUnion", elements: [user.uid] }
        });
      } catch (e) {
        console.error("Lỗi đánh dấu đã đọc", e);
      }
    }
    
    // Đóng dropdown và chuyển tab
    setIsOpen(false);
    const target = getTabForNotification(notif.type);
    if (target !== null && setActiveTab) {
      if (typeof target === "object" && target.main !== undefined) {
        setActiveTab(target.main, target.sub);
      } else {
        setActiveTab(target);
      }
    }
  };

  const dismissToast = useCallback((toastId) => {
    setToastQueue(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  const markAllAsRead = async () => {
    const unread = filteredNotifications.filter(n => !n.isLocal && !(n.readBy || []).includes(user.uid));
    if (unread.length === 0) return;

    // Optimistic update: thêm uid vào readBy ngay lập tức → badge unread về 0 tức thì
    const addSelfRead = (n) =>
      (n.readBy || []).includes(user.uid) ? n : { ...n, readBy: [...(n.readBy || []), user.uid] };
    setRoleNotifications(prev => prev.map(addSelfRead));
    setUserNotifications(prev => prev.map(addSelfRead));

    try {
      // 1 request gộp: PUT /api/notifications/read-all (cập nhật MySQL)
      await originalDbService.markAllNotificationsRead();
    } catch (e) {
      console.error("Lỗi đánh dấu tất cả đã đọc", e);
      // Thất bại → refetch để khôi phục trạng thái thực từ server
      if (globalRefreshCallback) globalRefreshCallback();
    }
  };

  const handleToggle = () => setIsOpen(!isOpen);

  return (
    <>
    <div style={{ position: "relative", marginRight: 15 }} ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 22,
          position: "relative",
          padding: 5
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "red",
            color: "white",
            fontSize: 11,
            fontWeight: "bold",
            borderRadius: "50%",
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          right: 0,
          background: "white",
          width: 320,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          borderRadius: 12,
          zIndex: 1000,
          padding: "10px 0",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{ padding: "5px 15px 10px", borderBottom: "1px solid #eee", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontWeight: "bold", fontSize: 18, color: colors.primary, marginBottom: 4 }}>Thông báo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                onClick={markAllAsRead}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13.5,
                  color: "#333",
                  background: "transparent",
                  border: "none",
                  padding: "6px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  fontWeight: 500,
                  transition: "all 0.15s"
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = colors.primary; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#333"; }}
              >
                <span style={{ fontSize: 15, fontWeight: "bold", color: colors.primary }}>✓</span> Đánh dấu tất cả là đã đọc
              </button>
              
              <button
                onClick={() => { setShowSettings(true); setIsOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13.5,
                  color: "#333",
                  background: "transparent",
                  border: "none",
                  padding: "6px 8px",
                  borderRadius: 6,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  fontWeight: 500,
                  transition: "all 0.15s"
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "#f5f5f5"; e.currentTarget.style.color = colors.primary; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#333"; }}
              >
                <span style={{ fontSize: 15, color: colors.primary }}>⚙️</span> Cài đặt thông báo
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {allNotifications.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#888" }}>Không có thông báo nào</div>
            ) : (
              allNotifications.map(n => {
                const isUnread = !(n.readBy || []).includes(user.uid);
                return (
                  <div 
                    key={n.id} 
                    onClick={() => markAsReadAndNavigate(n)}
                    style={{
                      padding: "12px 15px",
                      borderBottom: "1px solid #f5f5f5",
                      background: isUnread ? "#fff6ea" : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      transition: "background 0.2s"
                    }}
                    onMouseOver={(e) => { if (!isUnread) e.currentTarget.style.background = "#f9f9f9"; }}
                    onMouseOut={(e) => { if (!isUnread) e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>
                      {getNotificationIcon(n.type)}
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ 
                        fontSize: 14, 
                        color: isUnread ? "#222" : "#555", 
                        fontWeight: isUnread ? "600" : "400",
                        lineHeight: "1.4"
                      }}>
                        {n.message}
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: isUnread ? colors.primary : "#999", 
                        marginTop: 4,
                        fontWeight: isUnread ? "500" : "400" 
                      }}>
                        {formatRelativeTime(n.timestamp)}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.primary, flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div style={{ borderTop: "1px solid #eee", padding: "8px 15px 0", display: "flex", justifyContent: "center" }}>
            <button
              onClick={() => { setShowAllModal(true); setIsOpen(false); }}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "none",
                background: colors.primary + "12",
                color: colors.primary,
                fontWeight: "bold",
                fontSize: 13.5,
                borderRadius: 8,
                cursor: "pointer",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = colors.primary + "22"; }}
              onMouseOut={(e) => { e.currentTarget.style.background = colors.primary + "12"; }}
            >
              🌐 Xem tất cả thông báo
            </button>
          </div>
        </div>
      )}
    </div>

    {/* ===== FACEBOOK-STYLE TOAST POPUP ===== */}
    {toastQueue.map((toast) => (
      <ToastPopup
        key={toast.toastId}
        toast={toast}
        onDismiss={dismissToast}
        onNavigate={(notif) => {
          markAsReadAndNavigate(notif);
          dismissToast(toast.toastId);
        }}
      />
    ))}

    {/* ===== MODAL CÀI ĐẶT THÔNG BÁO ===== */}
    {showSettings && (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
      }}>
        <div style={{
          background: "#fff", padding: 24, borderRadius: 16,
          width: "min(460px, 95vw)", boxShadow: "0 10px 40px rgba(0,0,0,.2)",
          display: "flex", flexDirection: "column", gap: 18
        }}>
          <h3 style={{ margin: 0, color: colors.primary, display: "flex", alignItems: "center", gap: 8, borderBottom: "1.5px solid #eee", paddingBottom: 10 }}>
            <span>⚙️</span> Cài đặt thông báo
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "55vh", overflowY: "auto", paddingRight: 4 }}>
            {(() => {
              const userRoles = Array.isArray(user?.role) ? user.role : String(user?.role || "").split(',').map(r => r.trim()).filter(Boolean);
              const userRolesLower = userRoles.map(r => String(r).toLowerCase());
              
              const applicableTypes = NOTIFICATION_TYPES_CONFIG.filter(cfg => {
                return cfg.roles.some(r => userRolesLower.includes(r.toLowerCase()));
              });

              if (applicableTypes.length === 0) {
                return <p style={{ margin: 0, color: "#666", fontSize: 14 }}>Chức vụ của bạn không có cấu hình thông báo nào áp dụng.</p>;
              }

              return applicableTypes.map(cfg => {
                const isEnabled = settings[cfg.type] !== false;
                return (
                  <div
                    key={cfg.type}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "10px 12px", borderRadius: 8, background: "#f8fafc",
                      border: "1px solid #e2e8f0"
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`chk-${cfg.type}`}
                      checked={isEnabled}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setSettings(prev => ({ ...prev, [cfg.type]: val }));
                      }}
                      style={{ width: 18, height: 18, marginTop: 3, cursor: "pointer", accentColor: colors.primary }}
                    />
                    <label htmlFor={`chk-${cfg.type}`} style={{ cursor: "pointer", flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 2 }}>{cfg.label}</div>
                      <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.4 }}>{cfg.desc}</div>
                    </label>
                  </div>
                );
              });
            })()}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1.5px solid #eee", paddingTop: 14 }}>
            <button
              onClick={() => {
                // Hủy: khôi phục từ localStorage
                try {
                  const saved = localStorage.getItem(`notif_settings_${user?.uid}`);
                  setSettings(saved ? JSON.parse(saved) : {});
                } catch { /* ignore */ }
                setShowSettings(false);
              }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #ccc", background: "#eee", fontWeight: 600, cursor: "pointer" }}
            >
              Hủy
            </button>
            <button
              onClick={async () => {
                // Lưu
                try {
                  localStorage.setItem(`notif_settings_${user?.uid}`, JSON.stringify(settings));
                  
                  // Đồng bộ best-effort cài đặt vào hồ sơ người dùng qua REST API
                  try {
                    await dbService.updateDoc("users", user.uid, {
                      notificationSettings: settings
                    });
                  } catch (syncErr) {
                    console.warn("User settings sync warning:", syncErr);
                  }
                  
                  pushToast("Đã lưu cài đặt thông báo thành công!", "success");
                } catch (e) {
                  console.error(e);
                  pushToast("Lỗi khi lưu cài đặt.", "error");
                } finally {
                  setShowSettings(false);
                }
              }}
              style={{ padding: "8px 20px", background: colors.primary, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ===== MODAL XEM TẤT CẢ THÔNG BÁO ===== */}
    {showAllModal && (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
      }}>
        <div style={{
          background: "#fff", borderRadius: 16,
          width: "min(600px, 95vw)", maxHeight: "80vh",
          boxShadow: "0 10px 40px rgba(0,0,0,.25)",
          display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1.5px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fafafa"
          }}>
            <h3 style={{ margin: 0, color: colors.primary, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔔</span> Tất cả thông báo ({filteredNotifications.length})
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={markAllAsRead}
                style={{
                  fontSize: 13,
                  color: colors.primary,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                ✓ Đánh dấu tất cả đã đọc
              </button>
              <button
                onClick={() => setShowAllModal(false)}
                style={{
                  background: "#eee",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666"
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
            {filteredNotifications.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#888" }}>Không có thông báo nào</div>
            ) : (
              filteredNotifications.map(n => {
                const isUnread = !(n.readBy || []).includes(user.uid);
                return (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      markAsReadAndNavigate(n);
                      setShowAllModal(false);
                    }}
                    style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid #f0f0f0",
                      background: isUnread ? "#fff6ea" : "white",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      transition: "background 0.2s"
                    }}
                    onMouseOver={(e) => { if (!isUnread) e.currentTarget.style.background = "#f9f9f9"; }}
                    onMouseOut={(e) => { if (!isUnread) e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>
                      {getNotificationIcon(n.type)}
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ 
                        fontSize: 14.5, 
                        color: isUnread ? "#111" : "#444", 
                        fontWeight: isUnread ? "600" : "400",
                        lineHeight: "1.45"
                      }}>
                        {n.message}
                      </div>
                      <div style={{ 
                        fontSize: 12.5, 
                        color: isUnread ? colors.primary : "#888", 
                        marginTop: 6,
                        fontWeight: isUnread ? "500" : "400" 
                      }}>
                        {formatRelativeTime(n.timestamp)}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: colors.primary, flexShrink: 0, marginTop: 8 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "12px 20px",
            borderTop: "1.5px solid #eee",
            display: "flex",
            justifyContent: "flex-end",
            background: "#fafafa"
          }}>
            <button
              onClick={() => setShowAllModal(false)}
              style={{
                padding: "8px 20px",
                background: colors.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}