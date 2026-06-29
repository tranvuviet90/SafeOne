# SafeOne 🛡️

**SafeOne** là nền tảng số hóa vận hành nhà xưởng, lấy **An toàn – Sức khỏe – Môi trường (EHS)** làm trung tâm. Hệ thống hợp nhất việc giám sát EHS, đánh giá Gemba, Hội đồng EHS và một loạt quy trình hành chính (báo cơm, lịch làm việc, bộ đàm, tủ đồ, dao cắt, chứng nhận vận hành…) vào một giao diện thời gian thực, kèm **Trợ lý ảo AI EHS** trả lời dựa trên tài liệu nội bộ (RAG).

Giao diện hỗ trợ song ngữ **Tiếng Việt 🇻🇳 / English 🇬🇧** và đồng bộ tức thì giữa nhiều người dùng, nhiều thiết bị.

> ℹ️ **Kiến trúc hiện tại:** Dự án đã **tách hoàn toàn khỏi Firebase**. Toàn bộ dữ liệu, xác thực và lưu trữ chạy trên **Node.js + Express + MySQL**, realtime qua **Socket.IO**. Mọi tài liệu/cấu hình Firebase cũ không còn áp dụng.

---

## ✨ Tính năng chính

| Module | Mô tả |
|--------|-------|
| 🧾 **EHS Audit** | Ghi nhận & chấm điểm audit an toàn theo bộ phận, đính kèm ảnh hiện trường. |
| 👣 **Gemba** | Checklist Gemba vòng ngoài / tại bộ phận, phân loại nhóm lỗi và mức độ nghiêm trọng. |
| 🏛️ **Hội đồng EHS** | Quản lý cuộc họp, hành động khắc phục và theo dõi tiến độ của hội đồng EHS. |
| 🍱 **Báo cơm** | Đăng ký suất ăn theo ca/bộ phận, tổng hợp số liệu cho bếp ăn. |
| 📅 **Lịch làm việc** | Phân ca, theo dõi công việc Gemba theo tuần. |
| 📻 **Bộ đàm** | Theo dõi tình trạng cấp phát / trả / bảo trì bộ đàm theo thời gian thực. |
| 🔑 **Tủ đồ (Locker)** | Quản lý tủ đồ, có chế độ xem công khai (public link). |
| 🔪 **Dao cắt (Knife)** | Theo dõi cấp phát và kiểm soát dao cắt trong xưởng. |
| 📜 **Chứng nhận vận hành** | Tổng hợp tình trạng & hạn chứng nhận vận hành thiết bị/nhân sự. |
| 🚭 **Giám sát chuyên đề** | Giám sát hút thuốc, giờ giải lao, nhà rác. |
| 📁 **Tài liệu** | Kho tài liệu nội bộ, là nguồn tri thức cho trợ lý AI. |
| 🤖 **Trợ lý AI EHS** | Chatbot Gemini trả lời dựa trên tài liệu nội bộ (RAG) + tự chỉnh sửa văn bản. |
| 🔔 **Thông báo realtime** | Chuông thông báo đẩy tức thì qua Socket.IO. |
| 👤 **Quản trị** | Quản lý người dùng, phân quyền theo bộ phận/vai trò, thiết lập cá nhân, đổi/đặt lại mật khẩu. |

---

## 🧱 Kiến trúc & công nghệ

| Tầng | Công nghệ |
|------|-----------|
| Frontend | React 19, Vite 7, React Icons, `@hello-pangea/dnd`, `xlsx`/`exceljs` (xuất Excel) |
| Backend | Node.js + Express 5 (`backend/`), JWT auth (mật khẩu băm bằng bcrypt) |
| Cơ sở dữ liệu | MySQL (qua `mysql2`) |
| Realtime | Socket.IO (đồng bộ đa tab/đa người dùng) |
| AI Chatbot | Gemini 2.5 Flash qua `@google/generative-ai`, endpoint backend `/api/functions/askAI` |
| i18n | Provider tự xây (`src/i18n/`), từ điển EN-VI |

Khi chạy, frontend được build vào `backend/public/` và backend phục vụ **cả giao diện lẫn API** trên **một cổng `5000` duy nhất** — nên chỉ cần mở 1 địa chỉ, chạy 1 tiến trình.

---

## 📂 Cấu trúc thư mục

```
SafeOne/
├── src/                  # Frontend React
│   ├── components/       # Các module UI (EHSAudit, Gemba, BaoCom, Chatbot, …)
│   ├── services/         # apiClient, authService, dbService, realtimeService
│   ├── i18n/             # Provider & từ điển song ngữ
│   ├── constants/        # Vai trò, bộ phận, cấu hình ca
│   └── utils/            # Hàm tiện ích
├── backend/              # Backend Express
│   ├── routes/           # auth, db, functions (AI), notifications, storage
│   ├── middleware/       # Xác thực JWT, …
│   ├── config/           # Kết nối DB
│   ├── socket/           # Socket.IO
│   ├── schema.sql        # Khởi tạo bảng
│   └── server.js         # Điểm vào
└── README.md
```

---

## 🖥️ A. Chạy thử trên máy local (Windows)

> Mục tiêu: cài **một lần**, sau đó mở app bằng **một lệnh**, trên **một địa chỉ** `http://localhost:5000`.

### Chuẩn bị (cài một lần)
- **Node.js 18+** — tải tại <https://nodejs.org> (bản LTS).
- **MySQL 8** — tải tại <https://dev.mysql.com/downloads/installer/>, nhớ **mật khẩu root** khi cài.

### Các lệnh chạy (mở **PowerShell** tại thư mục dự án)

```powershell
# 1) Tạo database (nhập mật khẩu MySQL khi được hỏi)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS safeone CHARACTER SET utf8mb4;"

# 2) Cài thư viện (một lần)
npm install
cd backend; npm install; cd ..

# 3) Tạo file cấu hình từ mẫu (một lần)
copy backend\.env.example backend\.env

# 4) Tạo chuỗi bí mật cho JWT_SECRET — copy kết quả in ra
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**5) Mở file `backend\.env` bằng Notepad** và điền đúng **2 dòng**:
```
DB_PASSWORD=<mật khẩu MySQL của bạn>
JWT_SECRET=<dán chuỗi vừa tạo ở bước 4>
```
(Phần còn lại đã để sẵn, không cần sửa.)

```powershell
# 6) Build giao diện (chạy lại bước này mỗi khi code có thay đổi)
npm run build

# 7) Chạy app
npm start
```

→ Mở trình duyệt: **`http://localhost:5000`**
Lần đầu database trống nên app sẽ **tự hiện form "Khởi Tạo Hệ Thống"** để tạo tài khoản admin đầu tiên (tên, email, mật khẩu). Tạo xong là đăng nhập được.

> Muốn dừng app: bấm **Ctrl + C** trong cửa sổ PowerShell đang chạy.

---

## ☁️ B. Đưa lên VPS (Windows Server) — lần đầu

Làm gần giống chạy local, thêm Git và PM2 để app **chạy nền 24/7**.

### Chuẩn bị trên VPS (một lần)
- Cài **Node.js 18+**, **MySQL 8**, và **Git** (<https://git-scm.com>).

### Các lệnh (PowerShell trên VPS)

```powershell
# 1) Lấy code về (thay URL bằng repo GitHub của bạn)
git clone https://github.com/<tai-khoan>/<ten-repo>.git safeone
cd safeone

# 2) Tạo database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS safeone CHARACTER SET utf8mb4;"

# 3) Cài thư viện
npm install
cd backend; npm install; cd ..

# 4) Tạo cấu hình + chuỗi bí mật
copy backend\.env.example backend\.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**5) Sửa `backend\.env`** trên VPS:
```
DB_PASSWORD=<mật khẩu MySQL trên VPS>
JWT_SECRET=<dán chuỗi vừa tạo>
APP_BASE_URL=http://<địa-chỉ-IP-hoặc-tên-miền-VPS>
```

```powershell
# 6) Build giao diện
npm run build

# 7) Cài PM2 (trình giữ app chạy nền) — một lần
npm install -g pm2

# 8) Khởi chạy app chạy nền
pm2 start backend/server.js --name safeone
pm2 save
```

→ Mở trình duyệt tới `http://<địa-chỉ-VPS>:5000` và tạo admin đầu tiên.

> **Lưu ý mở cổng:** đảm bảo **Windows Firewall của VPS mở cổng 5000** (hoặc đặt sau IIS/reverse proxy nếu muốn chạy ở cổng 80).
> **Tự chạy lại sau khi VPS khởi động lại (tùy chọn):** `npm install -g pm2-windows-startup` rồi `pm2-startup install` và `pm2 save`.

---

## 🔄 C. Cập nhật code lên VPS sau này (đơn giản nhất)

Quy trình của bạn từ giờ chỉ gồm 2 nhịp:

**Trên máy bạn** — sau khi sửa code:
```powershell
git add .
git commit -m "Mô tả thay đổi"
git push
```

**Trên VPS** — kéo code mới về và khởi động lại:
```powershell
cd safeone
git pull
npm install                 # chỉ cần khi có thêm thư viện mới (chạy thừa cũng không sao)
cd backend; npm install; cd ..
npm run build
pm2 restart safeone
```

→ Dữ liệu trong MySQL (tài khoản, báo cáo, ảnh) **vẫn giữ nguyên** sau khi cập nhật.

---

## 🔧 Khắc phục sự cố

### Mở app nhưng KHÔNG hiện form "Khởi Tạo Hệ Thống" (dù database trống)
Form này **chỉ hiện khi gọi được API và backend báo chưa có user nào**. Nếu không hiện:
1. **App có đang chạy không?** Local: cửa sổ `npm start` phải còn mở. VPS: chạy `pm2 status` xem `safeone` có `online` không (`pm2 logs safeone` để xem lỗi).
2. Mở **F12 → tab Network → F5**, tìm request `check-init`:
   - **Đỏ / Failed / 500** ⇒ backend chưa chạy hoặc không kết nối được MySQL → kiểm tra `backend\.env`.
   - **200 nhưng `initialized: true`** ⇒ backend đang nối vào **database khác** → kiểm tra `DB_NAME` trong `backend\.env` cho khớp.

### Đã xóa hết user trong DB nhưng vẫn không hiện form
Thường do **xóa nhầm database** hoặc backend không chạy/không kết nối được DB (xem mục trên). Muốn reset an toàn về trạng thái "chưa có user", dùng lệnh có sẵn thay vì xóa tay trong DB:
```powershell
npm run clean-db      # xóa sạch bảng users đúng cách → lần mở app kế tiếp hiện lại form khởi tạo
```

### Backend tắt ngay khi khởi động (báo lỗi database)
Backend sẽ thoát nếu không kết nối được MySQL. Kiểm tra: MySQL đã chạy chưa, `DB_USER`/`DB_PASSWORD` đúng chưa, database trong `DB_NAME` đã được tạo chưa (lệnh `CREATE DATABASE` ở phần A/B).

### Đăng nhập báo lỗi token / 401
Thường do **thiếu `JWT_SECRET`** trong `backend\.env`. Điền chuỗi ngẫu nhiên dài rồi khởi động lại (`npm start` hoặc `pm2 restart safeone`).

### Quên mật khẩu admin
Dùng liên kết **"Quên mật khẩu"** trên màn hình đăng nhập. Nếu chưa cấu hình SMTP, backend sẽ **in liên kết đặt lại ngay ra console / `pm2 logs safeone`** để bạn dùng tạm.

---

## 🤖 Trợ lý AI & RAG

Chatbot dùng Gemini trả lời dựa trên tài liệu nội bộ trong module **Tài liệu** thông qua truy hồi embedding (RAG), kèm tính năng tự kiểm tra chính tả / chỉnh sửa văn bản. Cần điền `GOOGLE_APIKEY` trong `backend\.env` để bật.

> ⚠️ **Với dữ liệu cũ:** sau khi nạp/đổi tài liệu, cần chạy bước **"Đồng bộ embedding"** để chatbot truy hồi được nội dung mới. Tài liệu chưa được đồng bộ sẽ không xuất hiện trong câu trả lời.

---

## 📜 Lệnh tham khảo

| Lệnh | Tác dụng |
|---|---|
| `npm install` | Cài thư viện frontend (thư mục gốc) |
| `npm run build` | Build giao diện vào `backend/public` |
| `npm start` | Chạy app (giao diện + API) ở cổng 5000 |
| `npm run lint` | Kiểm tra code bằng ESLint |
| `npm run clean-db` | ⚠️ Xóa sạch bảng `users` (về trạng thái khởi tạo) |
| `pm2 restart safeone` | Khởi động lại app trên VPS (sau khi cập nhật) |
| `pm2 logs safeone` | Xem log app trên VPS |

---

## ⚙️ Biến môi trường (backend/.env)

| Biến | Cần điền? | Mô tả |
|---|---|---|
| `DB_PASSWORD` | 👉 Có | Mật khẩu MySQL |
| `JWT_SECRET` | 👉 Có | Khóa ký token đăng nhập (chuỗi ngẫu nhiên dài) |
| `GOOGLE_APIKEY` | Tùy chọn | API key Gemini (chỉ cần cho chatbot AI) |
| `APP_BASE_URL` | Khi lên VPS | URL public của app (dựng link đặt lại mật khẩu) |
| `PORT` / `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_NAME` | Đã để sẵn | Cấu hình cổng & kết nối MySQL |
| `SMTP_*` | Tùy chọn | Gửi email "Quên mật khẩu" (bỏ trống = in link ra console) |

---

## 🔐 Ghi chú bảo mật
- **Không commit** `backend/.env` (đã được `.gitignore`). Chỉ commit file `*.example`.
- Nếu secret cũ từng bị lộ, hãy **đổi lại** `JWT_SECRET` và mật khẩu MySQL.
- Trên VPS: đặt mật khẩu mạnh cho tài khoản admin đầu tiên; cân nhắc đặt app sau reverse proxy + HTTPS.

---

## 🇬🇧 English (summary)

**SafeOne** is a factory **EHS / operations management** platform unifying EHS monitoring, Gemba audits, the EHS committee, and administrative workflows (meal orders, work schedules, radios, lockers, knives, operation certifications…) into one real-time interface, with a bilingual UI (VI/EN) and an **AI EHS assistant** answering from internal documents (RAG).

**Stack:** React 19 + Vite (frontend), Node.js + Express + MySQL + Socket.IO (backend), Gemini via `@google/generative-ai`. Fully decoupled from Firebase. The frontend builds into `backend/public` and the backend serves both UI and API on a **single port `5000`**.

**Run (Windows, no Docker):** install Node 18+ and MySQL 8; create the `safeone` database; `npm install` (root) and `cd backend && npm install`; `copy backend\.env.example backend\.env` and fill `DB_PASSWORD` + `JWT_SECRET`; `npm run build` then `npm start`; open `http://localhost:5000`. On VPS, run it under PM2 (`pm2 start backend/server.js --name safeone`). To update later: `git pull && npm run build && pm2 restart safeone`. On first run the schema is auto-created and **no admin is seeded** — an empty DB shows a setup form to create the first admin. If that form doesn't appear, the frontend can't reach the backend (or it points at a different DB) — see "Khắc phục sự cố".
</content>
