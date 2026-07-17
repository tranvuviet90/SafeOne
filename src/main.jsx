import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

import "./index.css";
import "./styles/typography.css";
import "./styles/ui.css";
import "./styles/global-responsive.css";
import "./auto-fix.js";

import { I18nProvider } from "./i18n/I18nProvider";
// Import này áp dụng theme đã lưu ngay lúc nạp module, trước khi React vẽ lần đầu,
// nên trang không loé sáng một nhịp rồi mới tối.
import { ThemeProvider } from "./ThemeProvider";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
