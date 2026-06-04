# SafeOne 🛡️ — Bộ Giải Pháp Quản Lý Vận Hành Số Hóa Nhà Xưởng (Phiên bản Cục bộ / Offline)

**SafeOne** (tiền thân là dự án ACP360) là hệ thống quản lý vận hành số hóa nhà xưởng toàn diện. Dự án tập trung vào công tác Giám sát An toàn, Sức khỏe, Môi trường (EHS), đánh giá Gemba, liên lạc nội bộ và quản lý quy trình hành chính (Báo cơm, Ca làm việc) theo thời gian thực. 

Phiên bản này (`SafeOne`) được tối ưu hóa đặc biệt để **chạy cục bộ (Offline/Local)** sử dụng cơ sở dữ liệu **MySQL (XAMPP)** và máy chủ **Node.js Backend**, giúp nhà xưởng vận hành độc lập không phụ thuộc vào kết nối Internet ra bên ngoài.

---

## 🇻🇳 TIẾNG VIỆT - HƯỚNG DẪN DỰ ÁN

### 🌟 Tính năng chính & Cập nhật mới nhất

1. **Gemba Checklist & Tự Gemba**: Ghi nhận, chấm điểm lỗi trực quan, chụp ảnh báo cáo vi phạm an toàn, xuất báo cáo CAP (Corrective Action Plan) ra Excel.
2. **Bộ đàm & Chat Giải lao (Bodam & GiaiLaoChat)**: Kênh truyền thông tin liên lạc và trao đổi nội bộ thời gian thực cho nhân viên và ban giám sát.
3. **Báo cơm (BaoCom) & Suất ăn (Cập nhật logic mới)**: 
   * Luồng kiểm duyệt chặt chẽ giữa **Bộ phận** ➡️ **EHS** ➡️ **Nhà ăn**.
   * **Logic Mì & Sữa Tăng Ca nâng cao:** Số lượng Mì và Sữa tăng ca chỉ chính thức được cộng vào báo cáo Excel xuất ra sau khi Nhà ăn đã phát thực tế và đại diện Bộ phận đã nhấn nút **"Xác nhận đã nhận đủ"**.
4. **Giám sát chuyên biệt**: Theo dõi vi phạm hút thuốc (`HutThuocToilet`) và quản lý vệ sinh khu vực rác thải sản xuất (`GiamSatNhaRac`).
5. **Thông báo Real-time dạng Facebook (Cập nhật mới nhất)**: 
   * Tích hợp bong bóng Toast thông báo thời gian thực tự động ẩn (Facebook-style) hiển thị ở góc dưới bên phải màn hình.
   * Đồng bộ hóa luồng thông báo tập trung qua `NotificationBell` để tránh lặp và nâng cao trải nghiệm người dùng.
6. **Bộ lọc lịch sử chuyên biệt cho Nhà Ăn (Canteen - Cập nhật mới nhất)**: 
   * Nhà ăn chỉ theo dõi các hoạt động liên quan đến EHS/Admin hoặc hoạt động phát/nhận tăng ca của các bộ phận thường.
   * Các lịch sử sửa đổi cơm thường (Cơm mặn, Cơm chay, Sữa GS...) của bộ phận thường sẽ tự động ẩn đi, đồng thời ẩn hoàn toàn thông tin liên quan đến `Sữa (cơm) (GS)` để tránh nhiễu thông tin.

---

### 🛠️ Kiến trúc hệ thống cục bộ (Local Architecture)

* **Frontend**: React 19, Vite, CSS Custom Theme. 
  * Dự án sử dụng bộ thư viện giả lập **`src/firebase-mock.js`** để chuyển hướng toàn bộ các lệnh gọi Firebase SDK gốc thành các yêu cầu HTTP API gửi đến Node.js Server cục bộ.
* **Backend (Node.js)**: Express Server chạy tại cổng `5000` (`http://localhost:5000`), chịu trách nhiệm xác thực JWT và xử lý nghiệp vụ API.
* **Cơ sở dữ liệu (MySQL)**: Chạy trên cổng `3306` (`127.0.0.1:3306`) thông qua **XAMPP**, lưu trữ tất cả thông tin tài khoản, báo cơm, gemba, lịch sử hoạt động.

---

### 🚀 Hướng dẫn khởi chạy cục bộ (Setup Local)

#### Bước 1: Thiết lập Cơ sở dữ liệu MySQL (XAMPP)
1. Tải và cài đặt **XAMPP** từ trang chủ.
2. Khởi động bảng điều khiển **XAMPP Control Panel** và nhấn nút **Start** ở dịch vụ **MySQL** (và Apache nếu cần).
3. Truy cập vào trang quản trị cơ sở dữ liệu `http://localhost/phpmyadmin`.
4. Tạo một cơ sở dữ liệu mới tên là `safeone`.
5. Import file cấu trúc dữ liệu từ tệp mã nguồn: [backend/schema.sql](file:///C:/Users/tranv/SafeOne/backend/schema.sql) để tạo đầy đủ các bảng dữ liệu cần thiết.

#### Bước 2: Cài đặt và cấu hình Node.js Backend
1. Mở cửa sổ Terminal/PowerShell tại thư mục Backend: `C:\Users\tranv\SafeOne\backend`
2. Cài đặt các thư viện bổ trợ:
   ```bash
   npm install
   ```
3. Tạo/Kiểm tra tệp tin cấu hình môi trường `.env` tại thư mục `backend/` với nội dung:
   ```env
   PORT=5000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=safeone
   JWT_SECRET=safeone_super_secret_key_2026
   ```
4. Khởi chạy máy chủ Backend:
   * Chạy môi trường phát triển (tự động restart khi sửa file): `npm run dev`
   * Chạy môi trường sản phẩm: `npm start`
   * *Đảm bảo hiển thị thông báo kết nối MySQL thành công tại terminal.*

#### Bước 3: Cài đặt và chạy Frontend
1. Mở một cửa sổ Terminal/PowerShell mới tại thư mục gốc: `C:\Users\tranv\SafeOne`
2. Cài đặt các thư viện frontend:
   ```bash
   npm install
   ```
3. Khởi chạy máy chủ phát triển thời gian thực:
   ```bash
   npm run dev
   ```
4. Mở trình duyệt và truy cập: `http://localhost:5173`. Bạn đã có thể đăng ký tài khoản, đăng nhập và sử dụng toàn bộ tính năng offline.

---

### 🌐 Hướng dẫn triển khai lên máy chủ thuê (Ví dụ: Viettel Cloud)

Nếu bạn đưa dự án này lên máy chủ VPS Viettel:
1. **Nếu chạy chung database & backend trên VPS:** Giữ nguyên `DB_HOST=127.0.0.1` trong file `.env` của Backend. Chỉ cần mở cổng tường lửa (Firewall) của VPS cho cổng API Node.js (ví dụ: `5000`) để máy trạm của nhân viên kết nối tới.
2. **Nếu kết nối database từ xa:** Cần đổi `DB_HOST` trong `.env` của Backend thành IP tĩnh công khai của VPS chứa database. Cần cấu hình MySQL trên VPS cho phép kết nối Remote và mở cổng `3306`.
3. **Cập nhật URL API ở Frontend:** Đổi đường dẫn API gốc từ `http://localhost:5000` thành IP công khai hoặc tên miền của VPS Viettel trong tệp `src/firebase-mock.js` trước khi biên dịch (`npm run build`).

---

### 📝 Chính sách Đồng bộ & Phát triển mã nguồn (Development Rules)

Để tránh xung đột dữ liệu và cấu hình giữa hai môi trường:
* **Môi trường Cloud trực tuyến (`acp360`):** Mọi việc chỉnh sửa tính năng, nâng cấp giao diện sẽ được thực hiện trước tại thư mục `C:\Users\tranv\acp360` và đẩy trực tuyến lên Firebase Hosting (`acp360.web.app`).
* **Môi trường Local offline (`SafeOne`):** Chỉ sau khi các tính năng trên trang trực tuyến hoạt động ổn định và được nghiệm thu, bạn mới yêu cầu đồng bộ mã nguồn sang thư mục `C:\Users\tranv\SafeOne` để chuyển đổi luồng dữ liệu sang MySQL + Node.js phục vụ chạy Offline.

---

## 🇬🇧 ENGLISH - PROJECT GUIDE

### 🌟 Key Features
1. **Gemba & Self-Gemba Checklists**: Real-time safety/quality observation logger with dynamic scoring, photo attachments, and selective date-range CAP Excel exports.
2. **Walkie-Talkie & Break Chat (Bodam & GiaiLaoChat)**: Instant interior communication channels for field coordinators and staff.
3. **Meal Registration (BaoCom) with Overtime verification**: 
   * Structured department ➡️ EHS ➡️ Canteen approval pipeline.
   * **Overtime Verification:** Overtime noodles and milk numbers are only accumulated in the Excel export once the department explicitly clicks **"Confirm receipt"** (deptAck).
4. **Targeted Safety Compliance**: Monitoring illegal smoking zones (`HutThuocToilet`) and factory waste station cleanliness (`GiamSatNhaRac`).
5. **Facebook-style Real-time Toast Notifications**: Instant, auto-dismissing notifications sliding from the bottom-right corner of the screen.
6. **Specialized Canteen History Filter**: Suppresses general food logs and `Milk (Meal) (GS)` updates for the Canteen role, showing only EHS/Canteen actions and overtime details.

---

### 🛠️ Architecture
* **Frontend**: React 19, Vite, custom CSS. Uses a custom alias system inside `src/firebase-mock.js` to redirect all Firebase SDK calls into local Node.js REST API requests.
* **Backend**: Node.js Express server running on port `5000`.
* **Database**: MySQL database running on port `3306` via XAMPP.

---

### 🚀 Setup & Launch (Local)
1. **MySQL Setup**: Install XAMPP. Start MySQL. Go to `http://localhost/phpmyadmin` and create a database named `safeone`. Import [backend/schema.sql](file:///C:/Users/tranv/SafeOne/backend/schema.sql).
2. **Backend**:
   * Navigate to `backend/` and run `npm install`.
   * Configure `backend/.env` with your DB credentials.
   * Start the server using `npm run dev` or `npm start`.
3. **Frontend**:
   * Navigate to the root directory and run `npm install`.
   * Launch the dev server: `npm run dev`.
   * Open `http://localhost:5173` in your browser.
