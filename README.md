# SafeOne 🛡️

**SafeOne** là nền tảng số hóa vận hành nhà xưởng, lấy **An toàn – Sức khỏe – Môi trường (EHS)** làm trung tâm. Hệ thống hợp nhất việc giám sát EHS, đánh giá Gemba, Hội đồng EHS và một loạt quy trình hành chính (báo cơm, lịch làm việc, bộ đàm, tủ đồ, dao cắt, chứng nhận vận hành…) vào một giao diện thời gian thực, kèm **Trợ lý ảo AI EHS** trả lời dựa trên tài liệu nội bộ (RAG).

Giao diện hỗ trợ song ngữ **Tiếng Việt 🇻🇳 / English 🇬🇧** và đồng bộ tức thì giữa nhiều người dùng, nhiều thiết bị.

> ℹ️ **Kiến trúc hiện tại:** Dự án đã **tách hoàn toàn khỏi Firebase**. Toàn bộ dữ liệu, xác thực và lưu trữ chạy trên **Node.js + Express + MySQL**, realtime qua **Socket.IO**. Không dùng Docker, không phụ thuộc bất kỳ dịch vụ đám mây bên ngoài nào. Mọi tài liệu/cấu hình Firebase cũ không còn áp dụng.

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
| AI Chatbot | Gemini qua `@google/generative-ai`, endpoint backend `/api/functions/askAI` |
| i18n | Provider tự xây (`src/i18n/`), từ điển EN-VI |

Khi chạy, frontend được build vào `backend/public/` và backend phục vụ **cả giao diện lẫn API** trên **một cổng `5000` duy nhất** — nên chỉ cần mở 1 địa chỉ, chạy 1 tiến trình.

> **Đăng nhập bằng email.** Database khởi tạo rỗng, **không gieo sẵn tài khoản admin**: lần đầu mở app, DB trống nên giao diện tự hiện form **"Khởi Tạo Hệ Thống"** để tạo admin đầu tiên.

---

## 📂 Cấu trúc thư mục

```
SafeOne/
├── src/                  # Frontend React
│   ├── components/       # Các module UI (EHSAudit, Gemba, BaoCom, Chatbot, …)
│   ├── services/         # apiClient (baseURL "/"), authService, dbService, realtimeService
│   ├── i18n/             # Provider & từ điển song ngữ
│   ├── constants/        # Vai trò, bộ phận, cấu hình ca
│   └── utils/            # Hàm tiện ích
├── backend/              # Backend Express
│   ├── routes/           # auth, db, functions (AI), notifications, storage
│   ├── middleware/       # Xác thực JWT, …
│   ├── config/           # Kết nối DB (config/db.js)
│   ├── socket/           # Socket.IO
│   ├── uploads/          # Ảnh/tài liệu tải lên (tạo tự động, cần quyền ghi)
│   ├── public/           # Frontend đã build (sinh ra bởi `npm run build`)
│   ├── schema.sql        # Khởi tạo bảng (tự chạy khi DB trống)
│   ├── .env.example      # Mẫu cấu hình — copy thành backend/.env
│   └── server.js         # Điểm vào
├── vite.config.js
└── README.md
```

---

## 🖥️ A. Chạy thử trên máy local (Windows / dev)

> Mục tiêu: cài **một lần**, sau đó mở app trên **một địa chỉ** `http://localhost:5000`.

### Chuẩn bị (cài một lần)
- **Node.js 18+ (khuyến nghị 20 LTS)** — <https://nodejs.org>
- **MySQL 8** — <https://dev.mysql.com/downloads/installer/>, nhớ **mật khẩu root** khi cài.

### Các lệnh (PowerShell tại thư mục dự án)

```powershell
# 1) Tạo database rỗng (nhập mật khẩu MySQL khi được hỏi)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS safeone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) Cài thư viện (một lần)
npm install
cd backend; npm install; cd ..

# 3) Tạo file cấu hình từ mẫu (một lần)
copy backend\.env.example backend\.env

# 4) Tạo chuỗi bí mật JWT_SECRET — copy kết quả in ra
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**5) Mở `backend\.env` bằng Notepad**, điền đúng **2 dòng** bắt buộc:
```
DB_PASSWORD=<mật khẩu MySQL của bạn>
JWT_SECRET=<dán chuỗi vừa tạo ở bước 4>
```
(Phần còn lại đã để sẵn, không cần sửa.)

```powershell
# 6) Build giao diện (chạy lại mỗi khi code frontend thay đổi)
npm run build

# 7) Chạy app
npm start
```

→ Mở **`http://localhost:5000`**. DB trống nên app tự hiện form **"Khởi Tạo Hệ Thống"** để tạo admin đầu tiên.
> Dừng app: **Ctrl + C** trong cửa sổ PowerShell.
> Nếu PowerShell chặn `npm` (*running scripts is disabled*), dùng `npm.cmd install` / `npm.cmd run build`, hoặc chạy một lần: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

## ☁️ B. Triển khai lên VPS (Ubuntu/Linux + Nginx) — dành cho IT

**Mô hình:** Express (cổng `5000`) phục vụ cả API `/api/*` lẫn giao diện tĩnh `backend/public`. MySQL lưu toàn bộ dữ liệu. Nginx đứng trước làm reverse proxy + SSL. PM2 giữ tiến trình chạy nền.

### Bước 0 — Cài nền tảng (một lần)
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server nginx
sudo npm install -g pm2
```

### Bước 1 — Tạo database RỖNG + user MySQL riêng
> ⚠️ **KHÔNG import file SQL nào.** Lần khởi động đầu, `backend/server.js` tự phát hiện DB trống và chạy `backend/schema.sql` để tạo đủ bảng.
```bash
sudo mysql
```
```sql
CREATE DATABASE safeone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'safeone'@'localhost' IDENTIFIED BY 'ĐẶT_MẬT_KHẨU_MẠNH';
GRANT ALL PRIVILEGES ON safeone.* TO 'safeone'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Bước 2 — Lấy code & cấu hình `backend/.env`
```bash
cd /var/www
git clone <URL_REPO> safeone && cd safeone
cp backend/.env.example backend/.env
nano backend/.env
```
```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=safeone
DB_PASSWORD=ĐẶT_MẬT_KHẨU_MẠNH          # trùng mật khẩu tạo ở Bước 1
DB_NAME=safeone
JWT_SECRET=DÁN_CHUỖI_NGẪU_NHIÊN         # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
GOOGLE_APIKEY=API_KEY_GEMINI            # ⚠️ đúng tên GOOGLE_APIKEY, KHÔNG phải GEMINI_API_KEY. Để trống nếu chưa dùng AI
APP_BASE_URL=https://safeone.ten-mien.com
```

### Bước 3 — Build frontend **TRƯỚC** (bắt buộc đúng thứ tự)
> `server.js` chỉ kiểm tra thư mục `backend/public` **một lần lúc khởi động**. Phải build xong rồi mới start backend, nếu không server chạy "API-only", không hiện giao diện.
```bash
# tại thư mục gốc /var/www/safeone
npm install
npm run build     # sinh ra backend/public/
```

### Bước 4 — Cài & chạy backend bằng PM2
```bash
cd backend
npm install
pm2 start server.js --name safeone-app
pm2 save
pm2 startup       # ⚠️ chạy đúng dòng lệnh mà nó in ra → mới tự bật lại khi VPS reboot
```
Kiểm tra log lần đầu (phải thấy *"Khởi tạo database thành công"* + *"listening on port 5000"*):
```bash
pm2 logs safeone-app --lines 40
```

### Bước 5 — Nginx reverse proxy (bắt buộc có WebSocket + tăng giới hạn upload)
```bash
sudo nano /etc/nginx/sites-available/safeone
```
```nginx
server {
    listen 80;
    server_name safeone.ten-mien.com;

    # ⚠️ Bắt buộc: cho phép upload ảnh Gemba/Excel tới 25MB (mặc định Nginx chỉ 1MB → lỗi 413)
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        # ⚠️ Bắt buộc: nâng cấp WebSocket cho realtime (Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/safeone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Bước 6 — SSL/HTTPS (khuyến nghị)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d safeone.ten-mien.com
```

### Bước 7 — Tạo admin đầu tiên
Mở `https://safeone.ten-mien.com`. DB trống nên app tự hiện màn hình **Khởi Tạo Hệ Thống** (endpoint `/api/auth/init-admin`) — đăng ký admin đầu tiên tại đây. **Đây là hành vi đúng, không phải lỗi.**

### ✅ Checklist nghiệm thu
| Kiểm tra | Cách |
|---|---|
| Backend online | `pm2 status` → `safeone-app` = online |
| DB đã tạo bảng | `mysql -u safeone -p safeone -e "SHOW TABLES;"` → thấy `users`, `firestore_mock`, `doc_chunks`… |
| Giao diện load | Mở domain → thấy màn hình khởi tạo admin/đăng nhập |
| Realtime | Mở 2 tab, thao tác 1 tab → tab kia tự cập nhật (không F5) |
| Upload ảnh | Tạo báo cáo Gemba có ảnh → ảnh hiện được |

### ⚠️ Lưu ý vận hành
- **Quyền ghi `backend/uploads`:** user chạy PM2 phải ghi được thư mục này. Nếu lỗi upload: `sudo chown -R $USER:$USER /var/www/safeone/backend/uploads`.
- **Firewall:** chỉ mở **80/443** ra internet. **KHÔNG** mở cổng `5000` và `3306` (chỉ dùng nội bộ qua Nginx/localhost).

---

## 🔄 C. Cập nhật code lên VPS sau này

**Trên máy dev** — sau khi sửa code: `git add . && git commit -m "..." && git push`

**Trên VPS** — kéo code mới về và khởi động lại:
```bash
cd /var/www/safeone && git pull
npm install && npm run build          # build lại frontend
cd backend && npm install
pm2 restart safeone-app               # restart để nhận public mới
```
→ Dữ liệu trong MySQL (tài khoản, báo cáo, ảnh) **vẫn giữ nguyên** sau khi cập nhật.

---

## 🔧 Khắc phục sự cố

### Mở app nhưng KHÔNG hiện form "Khởi Tạo Hệ Thống" (dù DB trống)
Form chỉ hiện khi **gọi được API và backend báo chưa có user**. Nếu không hiện:
1. **App có chạy không?** `pm2 status` → `safeone-app` phải `online` (`pm2 logs safeone-app` xem lỗi).
2. **F12 → Network → F5**, tìm request `check-init`:
   - **Đỏ / Failed / 500 / 502** ⇒ backend chưa chạy hoặc không nối được MySQL → kiểm tra `backend/.env`. Màn hình đăng nhập giờ **hiện banner đỏ cảnh báo** thay vì im lặng.
   - **200 nhưng `initialized: true`** ⇒ backend nối vào **database khác / DB đã có user** → kiểm tra `DB_NAME`; nếu trỏ nhầm DB cũ, `npm run clean-db` để reset.
3. **Lối thoát hiểm:** nếu vẫn không hiện form, tạo admin trực tiếp từ terminal:
   ```bash
   cd backend && npm run seed-admin -- admin@congty.com 'MatKhauManh#2026' "Super Admin"
   ```

### Upload ảnh báo lỗi 413 (Request Entity Too Large)
Thiếu `client_max_body_size 25M;` trong cấu hình Nginx (Bước 5). Thêm vào rồi `sudo systemctl reload nginx`.

### Reboot VPS xong app không tự lên
Thiếu `pm2 startup` (Bước 4). `pm2 save` chỉ lưu danh sách; phải chạy `pm2 startup` và thực thi dòng lệnh nó in ra để tạo service systemd.

### Backend tắt ngay khi khởi động (lỗi database)
Backend thoát nếu không nối được MySQL. Kiểm tra: MySQL đã chạy chưa, `DB_USER`/`DB_PASSWORD` đúng chưa, database `DB_NAME` đã tạo chưa.

### Đăng nhập báo lỗi token / 401
Thường do **thiếu `JWT_SECRET`** trong `backend/.env`. Điền chuỗi ngẫu nhiên dài rồi khởi động lại (`pm2 restart safeone-app`).

### Realtime không đồng bộ giữa các tab
Nginx thiếu 2 dòng `proxy_set_header Upgrade`/`Connection "upgrade"` (Bước 5) → Socket.IO không nâng cấp được WebSocket.

### Quên mật khẩu admin
Dùng liên kết **"Quên mật khẩu"** trên màn hình đăng nhập. Nếu chưa cấu hình SMTP, backend **in liên kết đặt lại ra console / `pm2 logs safeone-app`** để dùng tạm.

---

## 🤖 Trợ lý AI & RAG

Chatbot dùng Gemini trả lời dựa trên tài liệu nội bộ trong module **Tài liệu** thông qua truy hồi embedding (RAG), kèm tính năng tự kiểm tra chính tả / chỉnh sửa văn bản. Cần điền `GOOGLE_APIKEY` trong `backend/.env` để bật.

> ⚠️ **Với dữ liệu cũ:** sau khi nạp/đổi tài liệu, cần chạy bước **"Đồng bộ embedding"** để chatbot truy hồi được nội dung mới. Tài liệu chưa đồng bộ sẽ không xuất hiện trong câu trả lời.

---

## 📜 Lệnh tham khảo

| Lệnh | Tác dụng |
|---|---|
| `npm install` | Cài thư viện frontend (thư mục gốc) |
| `npm run build` | Build giao diện vào `backend/public` |
| `npm start` | Chạy app (giao diện + API) ở cổng 5000 |
| `npm run lint` | Kiểm tra code bằng ESLint |
| `npm run clean-db` | ⚠️ Xóa sạch bảng `users` (về trạng thái khởi tạo) |
| `cd backend && npm run seed-admin -- <email> <mật khẩu> [tên]` | Tạo admin đầu tiên từ terminal (lưới an toàn khi form UI không hiện) |
| `pm2 restart safeone-app` | Khởi động lại app trên VPS |
| `pm2 logs safeone-app` | Xem log app trên VPS |

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
- **Không commit** `backend/.env` (đã `.gitignore`). Chỉ commit file `*.example`.
- Nếu secret cũ từng bị lộ, hãy **đổi lại** `JWT_SECRET` và mật khẩu MySQL.
- Dùng **user MySQL riêng** (không dùng root) cho app.
- Đặt app sau **reverse proxy + HTTPS**; không phơi cổng 5000/3306 ra internet.

---

## 🇬🇧 English (summary)

**SafeOne** is a factory **EHS / operations management** platform unifying EHS monitoring, Gemba audits, the EHS committee, and administrative workflows (meal orders, work schedules, radios, lockers, knives, operation certifications…) into one real-time interface, with a bilingual UI (VI/EN) and an **AI EHS assistant** answering from internal documents (RAG).

**Stack:** React 19 + Vite (frontend), Node.js + Express + MySQL + Socket.IO (backend), Gemini via `@google/generative-ai`. Fully decoupled from Firebase, no Docker, no external cloud. The frontend builds into `backend/public` and the backend serves both UI and API on a **single port `5000`**.

**Deploy on a Linux VPS (Ubuntu + Nginx + PM2):**
1. Install Node 20, MySQL 8, Nginx, PM2.
2. Create an **empty** `safeone` database (schema auto-creates on first run — do **not** import any SQL) and a dedicated `safeone` MySQL user.
3. `cp backend/.env.example backend/.env` and fill `DB_PASSWORD`, `JWT_SECRET`, optional `GOOGLE_APIKEY` (note: the env var is `GOOGLE_APIKEY`, not `GEMINI_API_KEY`).
4. **Build the frontend first** (`npm install && npm run build`) — the server checks `backend/public` only once at startup — **then** start the backend (`cd backend && npm install && pm2 start server.js --name safeone-app && pm2 save && pm2 startup`).
5. Put Nginx in front with **`client_max_body_size 25M;`** (uploads) and the **`Upgrade`/`Connection "upgrade"` headers** (Socket.IO realtime); add SSL via certbot.
6. First visit shows a **setup form** to create the first admin (empty DB, no seeded account).

To update later: `git pull && npm run build && cd backend && npm install && pm2 restart safeone-app`. MySQL data is preserved across updates.
