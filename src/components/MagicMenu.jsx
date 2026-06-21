import React, {
  useMemo,
  useRef,
  useLayoutEffect,
  useEffect,
  useState,
  useCallback,
} from "react";
import "./MagicMenu.css";
import { useI18n } from "../i18n/I18nProvider";
import { BsClipboard2Check } from "react-icons/bs";
import {
  IoFootsteps,
  IoCalendarClearOutline,
  IoCafeOutline,
  IoTrash,
  IoRestaurantOutline,
  IoDocumentsOutline,
} from "react-icons/io5";
import { MdSmokingRooms } from "react-icons/md";
import { FaWalkieTalkie, FaUserShield, FaHelmetSafety } from "react-icons/fa6";
import { FiUsers, FiSettings } from "react-icons/fi";

const ALL_ITEMS = [
  { key: "menu.gemba", Icon: BsClipboard2Check, countProp: "gembaNotifCount" },
  { key: "menu.tugemba", Icon: IoFootsteps, countProp: "tuGembaNotifCount" },
  {
    key: "menu.ehsCommittee",
    Icon: FaHelmetSafety,
    roles: ["admin", "ehs", "ehs committee", "manager"],
  },
  { key: "menu.meal", Icon: IoRestaurantOutline },
  { key: "manager.title", Icon: FiSettings, roles: ["admin"] },
  {
    key: "menu.documents",
    Icon: IoDocumentsOutline,
    roles: ["admin", "ehs", "ehs committee", "trainer", "manager"],
  },
];

import { DEPARTMENT_ROLES } from "../constants/roles";
import { normalizeRole } from "../utils/string";

const deptSet = new Set(DEPARTMENT_ROLES.map(normalizeRole));
const CANTEEN = normalizeRole("Nhà Ăn");

const rafThrottle = (fn) => {
  let ticking = false;
  return (...args) => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        fn(...args);
      });
    }
  };
};

export default function MagicMenu({ user, activeTab, setActiveTab, ...props }) {
  const { t } = useI18n();
  const userRolesList = useMemo(() => {
    const raw = user?.role;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [String(raw)];
    return arr.flatMap(r => String(r).split(',')).map(r => normalizeRole(r)).filter(Boolean);
  }, [user?.role]);

  const visible = useMemo(() => {
    const hasEhsAccess = userRolesList.some(r => ["admin", "ehs", "ehs committee", "manager"].includes(r));
    const hasTrainerAccess = userRolesList.some(r => ["trainer"].includes(r));
    const hasDeptRole = userRolesList.some(r => deptSet.has(r));
    const isCanteen = userRolesList.includes(CANTEEN);
    
    // Default/guest user with no roles
    if (userRolesList.length === 0) {
      return ALL_ITEMS.filter(i => i.key === "menu.meal" || i.key === "menu.gemba" || i.key === "menu.tugemba");
    }

    return ALL_ITEMS.filter(item => {
      // 1. Admin/EHS/Manager/EHS Committee can see everything they have role matching for
      if (hasEhsAccess) {
        // EHS Committee proxy check
        if (item.key === "menu.meal" && userRolesList.includes(normalizeRole("ehs committee"))) {
          const hasValidProxy = user?.mealDept && deptSet.has(normalizeRole(user.mealDept));
          const hasDirectDept = userRolesList.some(r => deptSet.has(r));
          if (!hasValidProxy && !hasDirectDept) return false;
        }
        // Check if item has specific roles restriction
        if (item.roles) {
          return item.roles.map(normalizeRole).some(r => userRolesList.includes(r));
        }
        return true;
      }
      
      // 2. Union of allowed items for restricted/special roles
      const allowedKeys = new Set();
      if (isCanteen) {
        allowedKeys.add("menu.meal");
      }
      if (hasDeptRole) {
        allowedKeys.add("menu.meal");
        allowedKeys.add("menu.gemba");
        allowedKeys.add("menu.tugemba");
      }
      if (hasTrainerAccess) {
        allowedKeys.add("menu.meal");
        allowedKeys.add("menu.documents");
      }
      
      // Fallback for custom roles or items with roles matching
      if (item.roles) {
        if (item.roles.map(normalizeRole).some(r => userRolesList.includes(r))) {
          return true;
        }
      }
      
      return allowedKeys.has(item.key);
    });
  }, [userRolesList, user]); // Phụ thuộc vào `user` đảm bảo re-render khi user data thay đổi.

  const navRef = useRef(null);
  const mountedRef = useRef(false);
  const [indicator, setIndicator] = useState({
    show: false,
    left: 0,
    top: 0,
    size: 80,
    border: 8,
  });
  const prevGoodRect = useRef(null);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;

    const ul = nav.querySelector("ul");
    if (!ul) return;

    let li =
      ul.querySelector(`li[data-index="${activeTab}"]`) ||
      ul.querySelector("li.active");

    if (!li) {
      if (prevGoodRect.current) {
        setIndicator((s) => ({ ...s, show: true }));
      }
      return;
    }

    const liRect = li.getBoundingClientRect();
    const ulRect = ul.getBoundingClientRect();

    if (!liRect || !ulRect || liRect.width === 0 || liRect.height === 0) {
      if (prevGoodRect.current) setIndicator((s) => ({ ...s, show: true }));
      return;
    }

    const base = Math.min(liRect.width, liRect.height);
    const size = Math.max(64, Math.min(92, Math.floor(base * 1.2)));
    const border = Math.round(size * 0.1);
    const left = liRect.left - ulRect.left + liRect.width / 2 - size / 2;
    const top = liRect.top - ulRect.top - size * 0.35;

    prevGoodRect.current = { left, top, size, border };
    setIndicator({ show: true, left, top, size, border });
  }, [activeTab]);

  const measureRaf = useRef(rafThrottle(measure)).current;

  useLayoutEffect(() => {
    if (!mountedRef.current) {
      measure();
      mountedRef.current = true;
    } else {
      measureRaf();
    }
  }, [activeTab, visible.length, measure, measureRaf]);

  useEffect(() => {
    const reflow = measureRaf;
    window.addEventListener("resize", reflow);
    window.addEventListener("orientationchange", reflow);
    window.addEventListener("scroll", reflow, true);

    const ro = new ResizeObserver(reflow);
    if (navRef.current) ro.observe(navRef.current);

    if (document?.fonts?.ready) {
      document.fonts.ready.then(() => reflow());
    }

    return () => {
      window.removeEventListener("resize", reflow);
      window.removeEventListener("orientationchange", reflow);
      window.removeEventListener("scroll", reflow, true);
      ro.disconnect();
    };
  }, [measureRaf]);

  return (
    <div className="magic-navigation" ref={navRef} data-skip-auto-fix>
      <ul>
        {visible.map((item) => {
          const originalIndex = ALL_ITEMS.findIndex((o) => o.key === item.key);
          const isActive = activeTab === originalIndex;
          const hasEhsAccess = userRolesList.some(r => ["admin", "ehs", "ehs committee", "manager"].includes(r));
          const hasTrainerAccess = userRolesList.some(r => ["trainer"].includes(r));
          
          let isDisabled = false;
          if (item.key === "menu.gemba" || item.key === "menu.tugemba") {
            const isDeptRole = userRolesList.some(r => deptSet.has(r));
            isDisabled = isDeptRole && !hasEhsAccess;
          } else if (item.key === "menu.ehsCommittee") {
            isDisabled = !hasEhsAccess;
          } else if (item.key === "manager.title") {
            isDisabled = !userRolesList.includes("admin");
          } else if (item.key === "menu.documents") {
            isDisabled = !hasEhsAccess && !hasTrainerAccess;
          }
          const count = item.countProp ? props[item.countProp] || 0 : 0;

          return (
            <li
              key={item.key}
              data-index={originalIndex}
              className={`list ${isActive ? "active" : ""} ${
                isDisabled ? "disabled" : ""
              }`}
              onClick={() => {
                if (!isDisabled && typeof setActiveTab === "function") {
                  setActiveTab(originalIndex);
                }
              }}
            >
              <a>
                <span className="icon">
                  <item.Icon />
                  {count > 0 && (
                    <span
                      className="notification-badge-magic"
                      aria-label="unread"
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                <span className="text">{t(item.key)}</span>
              </a>
            </li>
          );
        })}
        <div
          className={`indicator ${mountedRef.current ? "animated" : "no-anim"}`}
          style={{
            display: indicator.show ? "block" : "none",
            position: "absolute",
            left: indicator.left,
            top: indicator.top,
            width: indicator.size,
            height: indicator.size,
            borderWidth: indicator.border,
            willChange: "left, top",
          }}
        />
      </ul>
    </div>
  );
}