# SafeOne 🛡️

**SafeOne** là hệ thống quản lý vận hành số hóa nhà xưởng toàn diện, tập trung vào công tác Giám sát An toàn, Sức khỏe, Môi trường (EHS), đánh giá Gemba, và quản lý quy trình hành chính (Báo cơm, Lịch làm việc) theo thời gian thực. Dự án được tối ưu hóa giao diện trực quan cao cấp, hiệu ứng mượt mà và tích hợp Trợ lý ảo AI EHS thông minh.

---

## TIẾNG VIỆT - HƯỚNG DẪN DỰ ÁN

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

### 🚀 Hướng dẫn khởi chạy cục bộ & Triển khai đám mây (Local & Cloud Deployment)

#### 1. Hướng dẫn khởi chạy dự án trên máy Local khác

Nếu bạn muốn sao chép toàn bộ dự án này sang một máy tính local mới để tiếp tục chạy và chỉnh sửa:

* **Bước 1: Chuẩn bị môi trường**
  * Tải và cài đặt **Node.js** phiên bản LTS mới nhất từ trang chủ: [https://nodejs.org](https://nodejs.org). Công cụ quản lý gói `npm` sẽ tự động được cài đặt đi kèm.
* **Bước 2: Giải nén mã nguồn**
  * Sao chép tệp nén `acp360_local.zip` sang máy tính mới và giải nén ra một thư mục làm việc bất kỳ (ví dụ: `D:\SafeOne`).
* **Bước 3: Cài đặt các gói phụ thuộc (Dependencies)**
  * Mở terminal (PowerShell / Command Prompt) tại thư mục vừa giải nén và chạy lệnh sau để tự động tải toàn bộ thư viện:
    ```bash
    npm install
    ```
* **Bước 4: Khởi chạy Development Server**
  * Chạy lệnh sau để kích hoạt server local thời gian thực:
    ```bash
    npm run dev
    ```
  * Mở trình duyệt và truy cập theo đường dẫn hiển thị trên terminal: `http://localhost:5173`.

---

#### 2. Hướng dẫn đẩy bản cập nhật lên trang web (Firebase Hosting & Cloud Functions)

Hệ thống được thiết kế để triển khai trực tuyến vô cùng đơn giản lên nền t sản **Firebase Cloud Platform**:

* **Bước 1: Cài đặt Firebase CLI (Nếu chưa có)**
  * Chạy lệnh sau ở dòng lệnh máy tính để cài đặt bộ công cụ Firebase toàn cầu:
    ```bash
    npm install -g firebase-tools
    ```
* **Bước 2: Đăng nhập & Chọn Project**
  * Đăng nhập tài khoản Firebase của bạn:
    ```bash
    firebase login
    ```
  * Chọn đúng dự án của bạn bằng cách liên kết hoặc kiểm tra tên dự án trong tệp `.firebaserc`.
* **Bước 3: Biên dịch sản phẩm tối ưu (Build)**
  * Tạo bản build production tối ưu hóa dung lượng:
    ```bash
    npm run build
    ```
* **Bước 4: Cấu hình biến môi trường & API Key cho Chatbot AI**
  * Tạo tệp cấu hình `.env` ở thư mục gốc nếu bạn dùng Cloud Functions để chạy fallback chatbot:
    ```env
    VITE_ASKAI_URL=https://<region>-<project-id>.cloudfunctions.net/askAI
    ```
  * Cấu hình khóa bí mật (Secret API Key) cho Cloud Functions gọi đến Gemini API:
    ```bash
    firebase functions:secrets:set GOOGLE_APIKEY="API_KEY_GEMINI_CUA_BAN"
    ```
* **Bước 5: Triển khai trực tuyến (Deploy)**
  * Triển khai tất cả lên cloud chỉ với một câu lệnh:
    ```bash
    firebase deploy
    ```
  * Hoặc nếu bạn chỉ muốn deploy phần Hosting:
    ```bash
    firebase deploy --only hosting
    ```
  * Sau khi hoàn tất, hệ thống sẽ cấp cho bạn một đường dẫn trực tuyến (ví dụ: `https://acp360.web.app`).

---

#### 3. Cấu hình Luật bảo mật trên Firebase (Security Rules)

Để đảm bảo hệ thống có thể kết nối và ghi nhận dữ liệu chính xác trên máy chủ đám mây mới hoặc tên miền khác, bạn cần sao chép các cấu hình luật bảo mật dưới đây và dán vào tab **Rules** trên bảng điều khiển Firebase:

##### 🔒 Luật bảo mật Cơ sở dữ liệu (Firestore Security Rules)
Truy cập **Firebase Console ➔ Firestore Database ➔ tab Rules** và cấu hình như sau để cho phép tất cả các tài khoản đã xác thực có quyền đọc và ghi dữ liệu:
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }
    function existingUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function incomingUserData() {
      return request.resource.data;
    }
    function getUserRole() {
      let r = existingUserData().role;
      return r is list ? r : [r]; 
    }
    function getUserName() {
      return existingUserData().name;
    }
    function getUserMealDept() {
      return existingUserData().mealDept;
    }
    function isOwner(doc) {
      return request.auth.uid == doc.userId;
    }
    
    function isManagerLevel() {
      return isAuth() && getUserRole().hasAny(['admin', 'ehs', 'manager']);
    }
    function isAllowedUser() {
      return isAuth() && getUserRole().hasAny(['admin', 'ehs', 'ehs committee', 'manager']);
    }
    function isAdminOrEHS() {
      return isAuth() && getUserRole().hasAny(['admin', 'ehs']);
    }
    function isEhsTeam() {
      return isAuth() && getUserRole().hasAny(['admin', 'ehs', 'ehs committee']);
    }

    function allowedBaoComRoles() {
      return [
        'admin', 'ehs', 'Nhà Ăn', 'G_Cutting', 'G_Rolling', 'G_Finishing',
        'G_Dipping', 'G_Buffing', 'G_Graphics', 'G_QC', 'A_QC',
        'QC_Management', 'Kayak', 'A_Rolling', 'A_Cosmetics', 'Planning',
        'Kho VW', 'WH_SK', 'WH_FG', 'WH_EM', 'WH_AG', 'Apple', 'MTN',
        'Paint Blending', 'Engineering', 'MFG', 'Bảo Vệ', 'Tạp Vụ', 'Office',
        'ehs committee'
      ];
    }

    function canAccessBaoCom() {
      return isAuth() && getUserRole().hasAny(allowedBaoComRoles());
    }

    function deptRoles() {
      return [
        'G_Cutting','G_Rolling','G_Finishing','G_Dipping','G_Buffing','G_Graphics',
        'G_QC','A_QC','QC_Management','Kayak','A_Rolling','A_Cosmetics','Planning',
        'Kho VW','WH_SK','WH_FG','WH_EM','WH_AG','Apple','MTN','Paint Blending',
        'Engineering','MFG','Bảo Vệ','Tạp Vụ','Office'
      ];
    }

    function hasDeptRole() {
      return isAuth() && getUserRole().hasAny(deptRoles());
    }

    function isProxyForDept() {
      return isAuth()
        && getUserRole().hasAny(['ehs committee'])
        && existingUserData().mealDept in deptRoles();
    }

    match /notifications/{notifId} {
      allow read, create, update: if isAuth();
      allow delete: if isAuth();
    }

    match /weekly_shifts/{weekId} {
      allow read: if isAuth();
      allow create: if isEhsTeam() || (
        isAuth() && request.resource.data.keys().hasOnly(getUserName())
      );
      allow update: if isEhsTeam() || (
        isAuth() &&
        request.resource.data.keys().hasAll(resource.data.keys()) &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([getUserName()]) &&
        request.resource.data.diff(resource.data).changedKeys().hasOnly([getUserName()])
      );
    }

    match /weekly_assignments_v6/{weekId} {
      allow read: if isAuth();
      allow write: if isAdminOrEHS();
    }

    match /meal_reports/{date} {
      allow read: if canAccessBaoCom();
      allow write: if
        isAdminOrEHS() ||
        (isAuth() && 'Nhà Ăn' in getUserRole()) ||
        (isAuth() && getUserRole().hasAny(deptRoles())) ||
        (isAuth() && getUserRole().hasAny(['ehs committee'])
          && existingUserData().mealDept in deptRoles()
        );
    }

    match /bodam/status {
      allow read, write: if isEhsTeam() || isManagerLevel();
    }

    // ── MỚI THÊM ──
    match /bodam/config {
      allow read, write: if isEhsTeam() || isManagerLevel();
    }

    match /gialaokv/{docId} {
      allow read: if isEhsTeam() || isManagerLevel();
      allow create: if (isEhsTeam() || isManagerLevel()) && isOwner(incomingUserData());
      allow update, delete: if isEhsTeam() || isManagerLevel();
    }

    match /giamsatnharac/{docId} {
      allow read: if isEhsTeam() || isManagerLevel();
      allow create: if (isEhsTeam() || isManagerLevel()) && isOwner(incomingUserData());
      allow update, delete: if isEhsTeam() || isManagerLevel();
    }

    match /hutthuoc_history/{logId} {
      allow read: if isEhsTeam() || isManagerLevel();
      allow create: if (isEhsTeam() || isManagerLevel()) && isOwner(incomingUserData());
      allow delete, update: if isEhsTeam() || isManagerLevel();
    }

    match /tu_gemba_logs/{logId} {
      allow read: if isAllowedUser();
      allow create: if isAllowedUser() && isOwner(incomingUserData());
      allow update, delete: if isAllowedUser() && (isAdminOrEHS() || isOwner(resource.data));
    }

    match /gemba_scores/{department} {
      allow read, write: if isAllowedUser();
    }

    match /gemba_events/{document=**} {
      allow read, write: if isAllowedUser();
    }

    match /notification_state/{docId} {
      allow read, write: if isAuth();
    }

    match /users/{userId} {
      allow get: if isAuth() && (request.auth.uid == userId || isAdminOrEHS());
      allow list: if isAllowedUser();
      allow update: if isAuth() && request.auth.uid == userId &&
        incomingUserData().role == existingUserData().role;
      allow create, delete: if isAdminOrEHS();
    }

    match /user_prefs/{userId} {
      allow read, write: if isAuth() && request.auth.uid == userId;
    }

    match /role_requests/{requestId} {
      allow read: if isAdminOrEHS();
      allow create: if isAuth();
      allow update, delete: if isAdminOrEHS();
    }

    match /settings/{docId} {
      allow read: if isAuth() && getUserRole().hasAny(['admin']);
      allow write: if isAuth() && getUserRole().hasAny(['admin']);
    }

  }
}
```

##### 📂 Luật bảo mật Lưu trữ Hình ảnh (Firebase Storage Security Rules)
Truy cập **Firebase Console ➔ Storage ➔ tab Rules** và cấu hình như sau để cho phép lưu trữ và hiển thị ảnh cải tiến Gemba:
```javascript
rules_version = '2';

// Firebase Storage Security Rules for ACP360
// Đồng bộ với Firestore rules để đảm bảo phân quyền nhất quán
service firebase.storage {
  match /b/{bucket}/o {
    
    // --- HELPER FUNCTIONS ---
    // Kiểm tra role của user từ Firestore database
    function getUserRole() {
      return firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Kiểm tra xem user có phải là allowed user (admin, ehs, ehs committee, manager)
    function isAllowedUser() {
      return request.auth != null && 
             getUserRole() in ['admin', 'ehs', 'ehs committee', 'manager'];
    }
    
    // Kiểm tra xem user có phải là EHS team (admin, ehs, ehs committee)
    function isEhsTeam() {
      return request.auth != null && 
             getUserRole() in ['admin', 'ehs', 'ehs committee'];
    }
    
    // Kiểm tra xem user có phải là Manager level (admin, ehs, manager)
    function isManagerLevel() {
      return request.auth != null && 
             getUserRole() in ['admin', 'ehs', 'manager'];
    }
    
    // --- STORAGE RULES ---
    
    // Tự Gemba images - Chỉ allowed users mới được upload
    match /tu_gemba_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isAllowedUser();
    }
    
    match /tu_gemba_improvement_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isAllowedUser();
    }
    
    // Gemba Checklist images - Chỉ allowed users mới được upload
    match /gemba_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isAllowedUser();
    }
    
    // Hút thuốc toilet images - EHS team hoặc Manager level
    match /hut_thuoc_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isEhsTeam() || isManagerLevel();
    }
    
    // Giám sát nhà rác images - EHS team hoặc Manager level
    match /nha_rac_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isEhsTeam() || isManagerLevel();
    }
    
    // Giải lao KV images - EHS team hoặc Manager level
    match /giai_lao_images/{imageId} {
      allow read: if true;  // Public read
      allow write: if isEhsTeam() || isManagerLevel();
    }
    
    // Fallback rule cho các file khác - Chỉ authenticated users
    match /{allPaths=**} {
      allow read: if true;  // Public read cho tất cả
      allow write: if request.auth != null;  // Cần đăng nhập để write
    }
  }
}

```

##### 🌐 Trỏ tên miền riêng tùy chỉnh (Custom Domain)
Nếu bạn muốn đổi từ tên miền mặc định của Firebase (`.web.app` / `.firebaseapp.com`) sang tên miền riêng của doanh nghiệp:
1. Truy cập **Firebase Console ➔ Hosting ➔ bấm nút "Add custom domain"**.
2. Nhập tên miền của bạn (ví dụ: `safeone.mycompany.com`).
3. Firebase sẽ cấp cho bạn bản ghi **TXT** để xác minh quyền sở hữu và bản ghi **A** (IP Address).
4. Bạn chỉ cần truy cập vào trang quản lý DNS tên miền của mình, thêm các bản ghi tương ứng và đợi khoảng 10 - 30 phút để Cloudflare/Firebase tự động kích hoạt chứng chỉ SSL (HTTPS) miễn phí.

---

## ENGLISH - PROJECT GUIDE

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
