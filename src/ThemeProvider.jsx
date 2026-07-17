import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "safeone_theme";

// Lưu theo thiết bị chứ không theo tài khoản: mỗi máy tự nhớ, không đụng backend.
const readStored = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    // Trình duyệt chặn storage (chế độ ẩn danh, cookie bị khoá) thì vẫn phải chạy được.
    return "system";
  }
};

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const resolve = (theme) => (theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme);

// Gán lên <html>. data-theme kích hoạt bảng màu tối trong index.css; colorScheme để
// thanh cuộn, checkbox, ô chọn ngày do trình duyệt vẽ cũng tối theo.
const applyTheme = (resolved) => {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
};

// Chạy ngay khi module được nạp (main.jsx import trước khi render) để trang không
// loé sáng một nhịp rồi mới tối.
applyTheme(resolve(readStored()));

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStored);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolve(readStored()));

  useEffect(() => {
    const next = resolve(theme);
    setResolvedTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Không lưu được thì vẫn đổi màu cho phiên hiện tại, chỉ là không nhớ sau khi tải lại.
    }
  }, [theme]);

  // Chỉ bám theo hệ điều hành khi người dùng chưa chọn tường minh.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemPrefersDark() ? "dark" : "light";
      setResolvedTheme(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  // Công tắc chỉ có 2 vị trí nhưng trạng thái có 3 giá trị: bấm là chốt tường minh,
  // tức là thoát khỏi "system" và từ đó không đổi theo hệ điều hành nữa.
  // Lật theo resolvedTheme (thứ đang hiện trên màn hình) chứ không đọc lại localStorage:
  // nếu trình duyệt chặn storage thì đọc lại luôn ra "system" và nút sẽ liệt.
  const toggleTheme = useCallback(() => {
    setThemeState(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải nằm trong <ThemeProvider>");
  return ctx;
}
