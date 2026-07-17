// Tệp đã sửa lỗi: App.jsx
// Đã thêm logic để không fetch-count nếu là vai trò 'Bộ phận' hoặc 'Nhà Ăn'
import React, { useState, useEffect, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./components/Login";
import UserSettings from "./components/UserSettings";
import NotificationBell from "./components/NotificationBell";
import LanguageSwitcher from "./components/LanguageSwitcher";
import { lazyWithRetry } from "./utils/lazyWithRetry";

const EHSAudit = lazyWithRetry(() => import("./components/EHSAudit"));
const Gemba = lazyWithRetry(() => import("./components/Gemba"));
const EhsCommittee = lazyWithRetry(() => import("./components/EhsCommittee"));
const BaoCom = lazyWithRetry(() => import("./components/BaoCom"));
const UserManager = lazyWithRetry(() => import("./components/UserManager"));
const DocumentManager = lazyWithRetry(() => import("./components/DocumentManager"));
import logo from "./assets/logo.png";
import authService from "./services/authService";
import dbService from "./services/dbService";
import "./App.css";

import MagicMenu from "./components/MagicMenu";
import Chatbot from "./components/Chatbot";
import { colors, alpha } from "./theme";
import { ToastProvider, ConfirmProvider, useToast } from "./components/LightboxSwipeOnly";
import PublicLockerView from "./components/PublicLockerView";
import ResetPassword from "./components/ResetPassword";

import { useI18n } from "./i18n/I18nProvider";
import { DEPARTMENT_NAMES, DEPARTMENT_ROLES, SHIFT_START_HOURS } from "./constants/roles";
import { normalizeRole, getWeekNumber, getWeekDates, formatDateToId } from "./utils/string";

// Dùng shared constants thay vì khai báo lại
const departments = DEPARTMENT_NAMES.map(name => ({ name }));
const deptRolesNormalized = new Set(DEPARTMENT_ROLES.map(normalizeRole));
const CANTEEN_NORMALIZED = normalizeRole("Nhà Ăn");


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

function useWindowSize() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth !== windowWidth) {
        setWindowWidth(window.innerWidth);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [windowWidth]);
  return { width: windowWidth };
}

function ToastBridge() {
  const { pushToast } = useToast();
  useEffect(() => {
    const prevAlert = window.alert;
    window.__pushToast = (msg, type = "info", ttlMs = 4000) => pushToast(String(msg), type, ttlMs);
    window.alert = (msg) => pushToast(String(msg), "error");
    return () => {
      window.alert = prevAlert;
      delete window.__pushToast;
    };
  }, [pushToast]);
  return null;
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const lockerId = params.get("locker");
  const resetToken = params.get("reset");

  if (resetToken) {
    return (
      <ToastProvider>
        <ConfirmProvider>
          <ResetPassword token={resetToken} />
        </ConfirmProvider>
      </ToastProvider>
    );
  }

  if (lockerId) {
    return (
      <ToastProvider>
        <ConfirmProvider>
          <PublicLockerView lockerId={lockerId} />
        </ConfirmProvider>
      </ToastProvider>
    );
  }

  return <MainApp />;
}

// Main authenticated app. Split out from App() so every hook below runs
// unconditionally — the param-based routing in App() may return early.
function MainApp() {
  const [tab, setTab] = useState(0);
  const [ehsActiveSubTab, setEhsActiveSubTab] = useState("calamviec");

  const handleSetActiveTab = (mainTab, subTab = null) => {
    setTab(mainTab);
    if (subTab) {
      setEhsActiveSubTab(subTab);
    }
  };
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [gembaNotifCounts, setGembaNotifCounts] = useState({});
  const [tuGembaNotifCounts, setTuGembaNotifCounts] = useState({});

  const totalGembaNotifications = Object.values(gembaNotifCounts).reduce((a, b) => a + b, 0);
  const totalTuGembaNotifications = Object.values(tuGembaNotifCounts).reduce((a, b) => a + b, 0);

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const { t } = useI18n();

  // --- THÊM: ĐƯA BIẾN KIỂM TRA ROLE RA NGOÀI ĐỂ DÙNG CHUNG (Chống Ghost Mount) ---
  const roleRawList = user?.role ? (Array.isArray(user.role) ? user.role : String(user.role).split(',').map(r => r.trim())) : [];
  const rolesNormalized = roleRawList.map(normalizeRole);
  const hasEhsAccess = rolesNormalized.some(r => ['admin', 'ehs', 'ehs committee', 'manager'].includes(r));
  const hasDeptRole = rolesNormalized.some(r => deptRolesNormalized.has(r));
  const hasCanteenRole = rolesNormalized.some(r => r === CANTEEN_NORMALIZED);
  const isRestrictedRole = (hasDeptRole || hasCanteenRole) && !hasEhsAccess;
  // ---------------------------------------------------------------------------------

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem("safeone_jwt_token") || sessionStorage.getItem("safeone_jwt_token");
        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        const data = await authService.getMe();
        // /me returns the user wrapped as { user } (matching login); tolerate a flat shape too.
        const userData = data?.user || data;
        if (userData && userData.uid) {
          const rawRole = userData.role;
          const parsedRoles = rawRole ? (Array.isArray(rawRole) ? rawRole : [String(rawRole)]).flatMap(r => String(r).split(',')).map(r => r.trim()).filter(Boolean) : [];
          setUser({ ...userData, role: parsedRoles });

          const currentIsDept = parsedRoles.some(r => deptRolesNormalized.has(normalizeRole(r)));
          const currentIsCanteen = parsedRoles.some(r => normalizeRole(r) === CANTEEN_NORMALIZED);
          const currentHasEhs = parsedRoles.some(r => ['admin', 'ehs', 'ehs committee', 'manager'].includes(normalizeRole(r)));
          const currentHasTrainer = parsedRoles.some(r => normalizeRole(r) === 'trainer');
          const forceMealTab = (currentIsDept || currentIsCanteen) && !currentHasEhs && !currentHasTrainer;
          setTab(forceMealTab ? 3 : 0);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin người dùng đăng nhập:", err);
        // If the token was rejected (401 no-token / 403 invalid or stale signature),
        // evict it so we don't get stuck logging out on every refresh. Network/500
        // errors are left alone so a transient outage doesn't force a re-login.
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem("safeone_jwt_token");
          sessionStorage.removeItem("safeone_jwt_token");
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Listen to custom authorization failure events (silent redirect)
    const handleAuthFailed = () => {
      setUser(null);
    };
    window.addEventListener("safeone-auth-failed", handleAuthFailed);
    return () => {
      window.removeEventListener("safeone-auth-failed", handleAuthFailed);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    if (isRestrictedRole) {
      setGembaNotifCounts({});
      setTuGembaNotifCounts({});
      return;
    }

    const checkNotifications = async () => {
      try {
        let lastSeenTimestampsEvents = {};
        let lastSeenTimestampsLogs = {};

        // 1. Fetch user_prefs
        const prefSnap = await dbService.getDoc("user_prefs", user.uid);
        if (prefSnap && prefSnap._exists !== false) {
          lastSeenTimestampsEvents = prefSnap["gembaLastSeenTimestamps"] || {};
          lastSeenTimestampsLogs = prefSnap["tuGembaLastSeenTimestamps"] || {};
        }

        // Fallback to localStorage if empty
        if (Object.keys(lastSeenTimestampsEvents).length === 0) {
          lastSeenTimestampsEvents = JSON.parse(localStorage.getItem("gembaLastSeenTimestamps") || "{}");
        }
        if (Object.keys(lastSeenTimestampsLogs).length === 0) {
          lastSeenTimestampsLogs = JSON.parse(localStorage.getItem("tuGembaLastSeenTimestamps") || "{}");
        }

        // Find oldest seen date as query threshold/filtering date
        const getMinDate = (timestamps) => {
          const dates = departments.map((d) => {
            return timestamps[d.name] ? new Date(timestamps[d.name]) : new Date(0);
          });
          return new Date(Math.min(...dates.map(d => d.getTime())));
        };

        const minEventsSeen = getMinDate(lastSeenTimestampsEvents);
        const minLogsSeen = getMinDate(lastSeenTimestampsLogs);

        // 2. Fetch gemba_events
        const eventsList = await dbService.getDocs("gemba_events");
        const countsEvents = {};
        departments.forEach((d) => { countsEvents[d.name] = 0; });
        if (Array.isArray(eventsList)) {
          eventsList.forEach((item) => {
            const dept = item.department;
            if (dept && countsEvents[dept] !== undefined) {
              const ts = item.timestamp ? new Date(item.timestamp) : null;
              if (ts && ts > minEventsSeen) {
                const lastSeen = lastSeenTimestampsEvents[dept] ? new Date(lastSeenTimestampsEvents[dept]) : new Date(0);
                if (ts > lastSeen) {
                  countsEvents[dept] += 1;
                }
              }
            }
          });
        }
        setGembaNotifCounts(countsEvents);

        // 3. Fetch tu_gemba_logs
        const logsList = await dbService.getDocs("tu_gemba_logs");
        const countsLogs = {};
        departments.forEach((d) => { countsLogs[d.name] = 0; });
        if (Array.isArray(logsList)) {
          logsList.forEach((item) => {
            const dept = item.department;
            if (dept && countsLogs[dept] !== undefined) {
              const ts = item.timestamp ? new Date(item.timestamp) : null;
              if (ts && ts > minLogsSeen) {
                const lastSeen = lastSeenTimestampsLogs[dept] ? new Date(lastSeenTimestampsLogs[dept]) : new Date(0);
                if (ts > lastSeen) {
                  countsLogs[dept] += 1;
                }
              }
            }
          });
        }
        setTuGembaNotifCounts(countsLogs);

      } catch (err) {
        console.error("Lỗi lấy thông tin thông báo (gemba/tu_gemba):", err);
      }
    };

    checkNotifications();
    const intervalId = setInterval(checkNotifications, 30 * 1000);
    return () => clearInterval(intervalId);
  }, [user, isRestrictedRole]);

  // Automatic shift start and walkie-talkie reminders
  useEffect(() => {
    const userRolesList = user?.role ? (Array.isArray(user.role) ? user.role.map(normalizeRole) : String(user.role).split(',').map(r => normalizeRole(r))) : [];
    if (!user || !userRolesList.includes("ehs committee")) return;

    const checkReminders = async () => {
      try {
        const today = new Date();
        const todayDateId = formatDateToId(today);
        const weekDates = getWeekDates(today);
        const weekId = `${weekDates[0].getFullYear()}-${getWeekNumber(weekDates[0])}`;

        // 1. Fetch weekly shift assignments
        const shiftSnap = await dbService.getDoc("weekly_shifts", weekId);
        if (!shiftSnap || shiftSnap._exists === false) return;

        const myShifts = shiftSnap[user.name];
        const todayShift = myShifts ? myShifts[todayDateId] : null;

        if (!todayShift || todayShift === "Off") return;

        // SHIFT_START_HOURS đã được import từ constants/roles.js
        const startHour = SHIFT_START_HOURS[todayShift];
        if (startHour === undefined) return;

        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();
        const nowMinutes = currentHour * 60 + currentMinute;
        const shiftStartMinutes = startHour * 60;

        const notifs = await dbService.getDocs("notifications");
        const todayStr = today.toDateString();

        const hasShiftRemind = notifs.some(n => 
          n.type === "shift_start_remind" && 
          n.target_user_id === user.uid && 
          new Date(n.timestamp).toDateString() === todayStr
        );

        // A. Shift Start Reminder: within 1 hour after shift start
        if (nowMinutes >= shiftStartMinutes && nowMinutes < shiftStartMinutes + 60) {
          if (!hasShiftRemind) {
            await dbService.createDoc("notifications", {
              type: "shift_start_remind",
              message: `Ca trực ${todayShift} của bạn đã bắt đầu. Hãy nhớ thực hiện các nhiệm vụ EHS nhé!`,
              target_user_id: user.uid,
              createdBy: "system",
              read_by: [],
              timestamp: new Date().toISOString()
            });
          }
        }

        // B. Walkie-Talkie Reminder: within 15 mins to 1h15m after shift start
        if (nowMinutes >= shiftStartMinutes + 15 && nowMinutes < shiftStartMinutes + 75) {
          const bodamSnap = await dbService.getDoc("bodam", "status");
          if (bodamSnap && bodamSnap._exists !== false && bodamSnap.status) {
            const statusList = bodamSnap.status;
            let assignedBodamIdx = -1;
            let isCheckedIn = false;

            statusList.forEach((cur, idx) => {
              const assigned = getAssignedShifts(cur.assignedTo);
              if (assigned[todayShift]?.uid === user.uid) {
                assignedBodamIdx = idx;
                if (cur.checked && cur.name === user.name) {
                  isCheckedIn = true;
                }
              }
            });

            const hasBodamRemind = notifs.some(n => 
              n.type === "bodam_unreturned_remind" && 
              n.target_user_id === user.uid && 
              new Date(n.timestamp).toDateString() === todayStr
            );

            if (assignedBodamIdx !== -1 && !isCheckedIn) {
              if (!hasBodamRemind) {
                await dbService.createDoc("notifications", {
                  type: "bodam_unreturned_remind",
                  message: `Bạn đã bắt đầu ca trực ${todayShift} nhưng chưa nhận/check-in Bộ đàm ${assignedBodamIdx + 1}. Hãy check-in ngay nhé!`,
                  target_user_id: user.uid,
                  createdBy: "system",
                  read_by: [],
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Lỗi kiểm tra nhắc nhở ca trực/bộ đàm:", err);
      }
    };

    // Run check immediately on mount, and then every 2 minutes
    checkReminders();
    const intervalId = setInterval(checkReminders, 2 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [user]);

  const handleLogout = async () => {
    try {
      authService.logout();
      setUser(null);
    } catch (e) {
      console.error("Lỗi đăng xuất:", e);
    }
  };

  if (loading) return <div className="loading-container"><p>{t("common.loading")}</p></div>;
  if (!user) return <Login setUser={setUser} />;

  // Keep-alive: mọi tab luôn được render, chỉ ẩn/hiện bằng CSS display để giữ trạng thái.
  const tabStyle = (i) => ({ display: tab === i ? "block" : "none", width: "100%" });

  return (
    <ToastProvider>
      <ConfirmProvider>
        <ToastBridge />
      <div style={{
        minHeight: "100vh",
        background: colors.backgroundLight,
        color: colors.textPrimary,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        {/* Top Branding Bar */}
        <div style={{
          background: colors.surface,
          width: "100vw",
          padding: isMobile ? "10px 16px" : "12px 24px",
          boxSizing: "border-box",
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <img src={logo} alt="logo" className="app-header-logo" />

          <div className="app-header-right" style={{ color: colors.textPrimary }}>
            <span style={{ whiteSpace: "nowrap", fontWeight: 600, color: colors.textPrimary }}>
              {user?.name} {!isMobile && `(${user?.role})`}
            </span>

            <LanguageSwitcher />
            <NotificationBell user={user} setActiveTab={handleSetActiveTab} />
            <UserSettings user={user} onLogout={handleLogout} />
          </div>
        </div>

        {/* Sticky Navigation Bar (The Teal Banner) */}
        <div style={{
          position: "sticky",
          top: 0,
          background: colors.primary,
          width: "100vw",
          boxShadow: `0 3px 14px ${alpha("primary", 0.2)}`,
          zIndex: 10,
          padding: "4px 0",
          boxSizing: "border-box"
        }}>
          <MagicMenu
            user={user}
            activeTab={tab}
            setActiveTab={handleSetActiveTab}
            gembaNotifCount={totalGembaNotifications}
            tuGembaNotifCount={totalTuGembaNotifications}
          />
        </div>

        {/* Content */}
        <div style={{
          maxWidth: 1100,
          width: "100%",
          margin: isMobile ? "0" : "38px auto",
          background: colors.surface,
          borderRadius: isMobile ? 0 : 22,
          minHeight: 460,
          boxShadow: `0 6px 32px ${alpha("primary", 0.13)}, 0 1.5px 10px #0001`,
          padding: isMobile ? "24px 16px" : "38px 32px",
          display: "flex",
          color: colors.textPrimary,
          flexGrow: 1,
          boxSizing: "border-box"
        }}>
          <div style={{ width: "100%" }}>
            <Suspense fallback={
              <div style={{ padding: "60px 0", textAlign: "center", color: colors.textSecondary }}>
                <div className="loading-spinner"></div>
                <div>Đang tải tính năng...</div>
              </div>
            }>
              {/* THÊM BỌC ĐIỀU KIỆN CHO TAB 0 VÀ 1 */}
              {!isRestrictedRole && (
                <div style={tabStyle(0)}>{tab === 0 && <ErrorBoundary fallbackTitle="Lỗi tải EHS Audit"><EHSAudit user={user} isMobile={isMobile} newErrorCounts={gembaNotifCounts} setGembaNotifCounts={setGembaNotifCounts} /></ErrorBoundary>}</div>
              )}
              {!isRestrictedRole && (
                <div style={tabStyle(1)}>{tab === 1 && <ErrorBoundary fallbackTitle="Lỗi tải Tự Gemba"><Gemba user={user} isMobile={isMobile} newLogCounts={tuGembaNotifCounts} setTuGembaNotifCounts={setTuGembaNotifCounts} /></ErrorBoundary>}</div>
              )}
              
              {/* EHS Committee Tab */}
              <div style={tabStyle(2)}>{tab === 2 && <ErrorBoundary fallbackTitle="Lỗi tải EHS Committee"><EhsCommittee user={user} isMobile={isMobile} activeSubTab={ehsActiveSubTab} setActiveSubTab={setEhsActiveSubTab} /></ErrorBoundary>}</div>
              
              <div style={tabStyle(3)}>{tab === 3 && <ErrorBoundary fallbackTitle="Lỗi tải Báo cơm"><BaoCom user={user} isMobile={isMobile} /></ErrorBoundary>}</div>
              <div style={tabStyle(4)}>{tab === 4 && <ErrorBoundary fallbackTitle="Lỗi tải Quản lý người dùng">{rolesNormalized.includes("admin") ? <UserManager user={user} isMobile={isMobile} /> : <div style={{padding:20}}>Access Denied</div>}</ErrorBoundary>}</div>
              <div style={tabStyle(5)}>{tab === 5 && <ErrorBoundary fallbackTitle="Lỗi tải Tài liệu"><DocumentManager user={user} isMobile={isMobile} /></ErrorBoundary>}</div>
            </Suspense>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center",
          color: colors.primary,
          fontSize: 14,
          fontWeight: 600,
          padding: "16px 0 22px 0",
          width: "100%"
        }}>
          SafeOne | ACP
        </div>

        <Chatbot user={user} />
      </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}