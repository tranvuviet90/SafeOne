# SafeOne 🛡️

**SafeOne** là hệ thống quản lý vận hành số hóa nhà xưởng, tập trung vào Giám sát An toàn – Sức khỏe – Môi trường (EHS), đánh giá Gemba, và các quy trình hành chính (Báo cơm, Lịch làm việc, Bộ đàm, Tủ đồ, Dao, Chứng nhận vận hành…) theo thời gian thực, kèm Trợ lý ảo AI EHS.

> ℹ️ **Kiến trúc hiện tại:** Dự án đã **tách hoàn toàn khỏi Firebase**. Toàn bộ dữ liệu, xác thực và lưu trữ chạy trên **Node.js + Express + MySQL**, realtime qua **Socket.IO**. Mọi tài liệu Firebase cũ không còn áp dụng.

---

## 🧱 Kiến trúc & công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React 19, Vite, React Icons, `@hello-pangea/dnd`, `xlsx`/`exceljs` (xuất Excel) |
| Backend | Node.js + Express (`backend/`), JWT auth (mật khẩu băm bằng bcrypt) |
| Cơ sở dữ liệu | MySQL (qua `mysql2`) |
| Realtime | Socket.IO (đồng bộ đa tab/đa người dùng) |
| AI Chatbot | Gemini 2.5 Flash qua `@google/generative-ai`, endpoint backend `/api/functions/askAI` |

**Luồng:** Frontend (cổng `5173` khi dev) → proxy `/api`, `/uploads`, `/socket.io` → Backend Express (cổng `5000`) → MySQL. Khi build production, frontend được build vào `backend/public/` và backend phục vụ luôn cả giao diện lẫn API trên cổng `5000`.

---

## 🚀 Khởi chạy trên máy local

### 1. Yêu cầu
- **Node.js** v18+ (khuyến nghị v20/v22)
- **MySQL** 8.x đang chạy

### 2. Cài dependencies
```bash
npm install            # frontend (thư mục gốc)
cd backend && npm install && cd ..   # backend
```

### 3. Cấu hình biến môi trường
Sao chép các file mẫu rồi điền giá trị thật (các file `.env` thật **không** được commit):
```bash
cp .env.example .env                 # frontend (VITE_ASKAI_URL nếu dùng)
cp backend/.env.example backend/.env # backend (DB, JWT_SECRET, GOOGLE_APIKEY)
```
Tạo `JWT_SECRET` ngẫu nhiên mạnh:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Biến (backend/.env) | Mô tả |
|---|---|
| `PORT` | Cổng backend (mặc định 5000) |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Kết nối MySQL |
| `JWT_SECRET` | Khóa ký token JWT — **bắt buộc**, giữ bí mật |
| `GOOGLE_APIKEY` | API key Gemini (chỉ cần cho chatbot AI) |
| `CORS_ORIGIN` | (Production) danh sách origin cho phép, phân tách bằng dấu phẩy |

### 4. Khởi tạo cơ sở dữ liệu
Lần đầu chạy backend, server tự động chạy `backend/schema.sql` nếu bảng `users` chưa tồn tại. **Không có tài khoản admin được gieo sẵn** — khi chưa có user nào, giao diện đăng nhập sẽ hiện form **Khởi Tạo Hệ Thống** để bạn tự tạo tài khoản admin đầu tiên bằng email thật.

### 5. Chạy ở chế độ phát triển (2 terminal)
```bash
# Terminal 1 — backend (API + Socket.IO, cổng 5000)
cd backend && npm run dev

# Terminal 2 — frontend (Vite, cổng 5173, proxy sang 5000)
npm run dev
```
Mở trình duyệt: `http://localhost:5173`

### 6. Build & chạy production (1 cổng)
```bash
npm run build      # build frontend → backend/public
npm start          # node backend/server.js — phục vụ giao diện + API ở cổng 5000
```
Chạy nền trên VPS với PM2:
```bash
npm install -g pm2
pm2 start backend/server.js --name safeone
```

---

## 📜 Scripts

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy frontend Vite (dev) |
| `npm run build` | Build frontend vào `backend/public` |
| `npm run lint` | Chạy ESLint |
| `npm start` | Chạy backend (phục vụ cả giao diện đã build) |
| `npm run clean-db` | ⚠️ Xóa sạch bảng `users` (về trạng thái khởi tạo) |
| `cd backend && npm run dev` | Chạy backend với nodemon (auto-reload) |

---

## 🔐 Ghi chú bảo mật
- **Không commit** `.env` / `backend/.env` / `.env.production` (đã được `.gitignore`). Chỉ commit các file `*.example`.
- Nếu các secret cũ từng bị commit, hãy **xoay (rotate) lại** `JWT_SECRET` và mật khẩu DB, và cân nhắc làm sạch lịch sử git.
- Production: đặt `CORS_ORIGIN` để giới hạn origin; đổi mật khẩu `admin` mặc định.

---

## 🇬🇧 English (summary)
SafeOne is a factory EHS/operations management app. **Stack:** React 19 + Vite (frontend), Node.js + Express + MySQL + Socket.IO (backend), Gemini via `@google/generative-ai` (AI chatbot). It is fully decoupled from Firebase.

**Quick start:** `npm install` (root) and `cd backend && npm install`; copy `.env.example`→`.env` and `backend/.env.example`→`backend/.env` (set `JWT_SECRET` + MySQL creds); run backend `cd backend && npm run dev` (port 5000) and frontend `npm run dev` (port 5173). First run auto-creates the schema; no admin is seeded — when there are no users, the login screen shows a setup form to create the first admin with a real email. For production: `npm run build` then `npm start`.
