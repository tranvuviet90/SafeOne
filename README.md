# SafeOne 🛡️

**SafeOne** là hệ thống quản lý vận hành số hóa nhà xưởng toàn diện, tập trung vào công tác Giám sát An toàn, Sức khỏe, Môi trường (EHS), đánh giá Gemba, và quản lý quy trình hành chính (Báo cơm, Lịch làm việc) theo thời gian thực. Dự án được tối ưu hóa giao diện trực quan cao cấp, hiệu ứng mượt mà và tích hợp Trợ lý ảo AI EHS thông minh.

---

## 🇻🇳 TIẾNG VIỆT - HƯỚNG DẪN DỰ ÁN

### 🌟 Tính năng chính
1. **Gemba Checklist & Tự Gemba**: Ghi nhận và chấm điểm lỗi trực quan, chụp ảnh báo cáo vi phạm/cải tiến an toàn, xuất báo cáo CAP (Corrective Action Plan) theo khoảng ngày linh hoạt.
2. **Bộ đàm & Chat Giải lao (Bodam & GiaiLaoChat)**: Kênh truyền thông tin liên lạc và trao đổi nội bộ thời gian thực cho nhân viên và ban giám sát.
3. **Báo cơm (BaoCom)**: Luồng kiểm duyệt 2 chiều chặt chẽ giữa **Bộ phận (gửi)** ➡️ **EHS (duyệt & chuyển tiếp)** ➡️ **Nhà ăn (xác nhận chốt suất)**.
4. **Giám sát chuyên biệt**: Theo dõi vi phạm hút thuốc ngoài khu vực quy định (`HutThuocToilet`) và quản lý vệ sinh khu vực rác thải sản xuất (`GiamSatNhaRac`).
5. **Trợ lý ảo EHS AI Chatbot**: Sử dụng mô hình **Gemini 2.5 Flash** tiên tiến, được huấn luyện bằng tài liệu kiến thức EHS chuẩn chỉnh của nhà máy và hướng dẫn sử dụng website.

### 🛠️ Công nghệ cốt lõi
* **Frontend**: React 19 (Vite), CSS Custom Theme (Harmonious Palette), React Icons, `@hello-pangea/dnd` (Kéo thả), `exceljs` & `xlsx` (Xuất báo cáo Excel chuyên nghiệp).
* **Backend & Cơ sở dữ liệu**: Firebase v11 (Authentication, Firestore Database, Cloud Storage để lưu trữ hình ảnh).
* **AI Backend**: Firebase Cloud Functions (Node.js) kết nối trực tiếp với Gemini API thông qua `@google/generative-ai`.

### 🚀 Hướng dẫn khởi chạy & triển khai

#### 1. Yêu cầu chuẩn bị
* **Node.js**: Phiên bản 18 trở lên (khuyến nghị v22).
* Tài khoản Firebase (để kết nối Firestore & Storage).

#### 2. Cài đặt các gói phụ thuộc
Di chuyển vào thư mục dự án và cài đặt:
```bash
npm install
```

Đối với thư mục Cloud Functions (nếu cần triển khai chatbot AI):
```bash
cd functions
npm install
cd ..
```

#### 3. Cấu hình biến môi trường
Tạo file `.env` ở thư mục gốc của dự án với các cấu hình sau:
```env
VITE_ASKAI_URL=https://<region>-<project-id>.cloudfunctions.net/askAI
```

Cấu hình API Key của Gemini AI cho Cloud Functions:
* Chạy lệnh cấu hình secret của Firebase:
```bash
firebase functions:secrets:set GOOGLE_APIKEY="API_KEY_GEMINI_CUA_BAN"
```

#### 4. Khởi chạy cục bộ (Development)
Để chạy dự án ở môi trường phát triển cục bộ:
```bash
npm run dev
```
Trình duyệt sẽ tự động mở hoặc bạn có thể truy cập qua: `http://localhost:5173`.

#### 5. Đóng gói sản phẩm (Build)
Để build phiên bản Production tối ưu hóa:
```bash
npm run build
```

---

## 🇬🇧 ENGLISH - PROJECT GUIDE

### 🌟 Key Features
1. **Gemba & Self-Gemba Checklists**: Real-time safety/quality observation logger with dynamic scoring, photo attachments, and selective date-range CAP (Corrective Action Plan) Excel exports.
2. **Walkie-Talkie & Break Chat (Bodam & GiaiLaoChat)**: Instant interior communication channels for field coordinators and staff.
3. **Meal Registration (BaoCom)**: Structured 2-way approval pipeline: **Department (Request)** ➡️ **EHS (Approve & Forward)** ➡️ **Canteen (Confirm)**.
4. **Targeted Safety Compliance**: Monitoring illegal smoking zones (`HutThuocToilet`) and factory waste station cleanliness (`GiamSatNhaRac`).
5. **AI Chatbot EHS Assistant**: Powered by **Gemini 2.5 Flash**, natively fine-tuned with rigorous factory EHS handbooks and software layout guides.

### 🛠️ Technology Stack
* **Frontend**: React 19, Vite 7, Tailored CSS Design Tokens, React Icons, `@hello-pangea/dnd`, `exceljs` & `xlsx` (Excel export engines).
* **Backend / DB**: Firebase v11 (Authentication, Firestore, Cloud Storage).
* **Serverless Backend (AI)**: Firebase Cloud Functions running on Node 22, linked with `@google/generative-ai`.

### 🚀 Step-by-Step Setup

#### 1. Prerequisites
* **Node.js**: v18+ (v22 recommended).
* A Firebase account and project initialized.

#### 2. Install Dependencies
Run in the root folder:
```bash
npm install
```
Install functions dependencies (optional, for AI assistant backend):
```bash
cd functions
npm install
cd ..
```

#### 3. Configure Environment Variables
Create a `.env` file in the root folder:
```env
VITE_ASKAI_URL=https://<region>-<project-id>.cloudfunctions.net/askAI
```
Configure your Gemini API key secret for Cloud Functions:
```bash
firebase functions:secrets:set GOOGLE_APIKEY="YOUR_GEMINI_API_KEY"
```

#### 4. Run Locally
Start the development server:
```bash
npm run dev
```
Open your browser and visit: `http://localhost:5173`.

#### 5. Build for Production
To bundle and optimize the project for deployment:
```bash
npm run build
```

---

## 📝 Nhật ký đổi tên (Migration Log)
Dự án được đổi tên từ **ACP360** sang **SafeOne** vào tháng 05/2026. 
* Toàn bộ nhãn UI, tiêu đề trang HTML, bản quyền chân trang và dữ liệu chỉ dẫn đào tạo AI Chatbot đều được đồng bộ hóa thống nhất dưới tên thương hiệu **SafeOne**.
* Các liên kết kỹ thuật và cơ sở dữ liệu Firebase Firestore vẫn tiếp tục kế thừa từ hạ tầng hiện tại để bảo toàn tính toàn vẹn của dữ liệu cũ mà không gây gián đoạn hệ thống.
