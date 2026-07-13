-- backend/schema.sql
-- LƯU Ý: KHÔNG đặt lệnh `CREATE DATABASE` / `USE` ở đây.
-- Database `safeone` phải được tạo sẵn trước (xem README), và backend đã kết nối
-- trực tiếp vào nó qua config/db.js. Đặt lệnh quản trị cấp server ở đây sẽ gây lỗi
-- "Access denied" khi chạy dưới một MySQL user chỉ có quyền trên `safeone.*`.

-- 1. Bảng Người dùng (Tích hợp Auth + User Profile)
CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(255) NOT NULL, -- phân tách bằng dấu phẩy
  meal_dept VARCHAR(100) DEFAULT NULL,
  disabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Bảng Báo cơm (BaoCom)
CREATE TABLE IF NOT EXISTS meal_reports (
  date_key VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  shift_key VARCHAR(5) NOT NULL, -- HC, S1, S2, S3, S8
  summary JSON DEFAULT NULL,
  confirmed_summary JSON DEFAULT NULL,
  confirmed_by_admin VARCHAR(100) DEFAULT NULL,
  confirmed_at_admin TIMESTAMP NULL DEFAULT NULL,
  confirmed_by_canteen VARCHAR(100) DEFAULT NULL,
  confirmed_at_canteen TIMESTAMP NULL DEFAULT NULL,
  reports JSON DEFAULT NULL,
  overtime_fulfilled JSON DEFAULT NULL,
  history JSON DEFAULT NULL,
  last_report_at TIMESTAMP NULL DEFAULT NULL,
  last_history_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (date_key, shift_key)
) ENGINE=InnoDB;

-- 3. Bảng Thông báo (NotificationBell)
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  target_roles JSON DEFAULT NULL, -- Mảng các role nhận thông báo
  target_user_id VARCHAR(128) DEFAULT NULL,
  read_by JSON DEFAULT NULL, -- Mảng các UID đã đọc thông báo này
  created_by VARCHAR(128) DEFAULT NULL,
  related_id VARCHAR(255) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Bảng Yêu cầu thay đổi quyền (Role Request)
CREATE TABLE IF NOT EXISTS role_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  `current_role` VARCHAR(100) DEFAULT NULL,
  requested_role VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5. Bảng Tin nhắn Chat (GiaiLaoChat)
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. Bảng Sự cố Gemba (Gemba & Tự Gemba)
CREATE TABLE IF NOT EXISTS gemba_reports (
  id VARCHAR(128) PRIMARY KEY,
  type VARCHAR(20) NOT NULL, -- 'gemba' hoặc 'tu_gemba'
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT DEFAULT NULL,
  reporter_name VARCHAR(100) NOT NULL,
  score INT DEFAULT 0,
  resolved_status VARCHAR(20) DEFAULT 'pending', -- pending, resolved
  created_by VARCHAR(128) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 7. Bảng Vi phạm Hút thuốc (HutThuocToilet & GiamSatNhaRac)
CREATE TABLE IF NOT EXISTS smoking_violations (
  id VARCHAR(128) PRIMARY KEY,
  location VARCHAR(100) NOT NULL,
  shift VARCHAR(10) NOT NULL,
  description TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  reporter_name VARCHAR(100) NOT NULL,
  created_by VARCHAR(128) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. Bảng Đăng ký Ca làm việc hàng tuần (Calamviec)
CREATE TABLE IF NOT EXISTS weekly_shifts (
  week_id VARCHAR(50) PRIMARY KEY, -- Ví dụ: 2026-W22
  data JSON DEFAULT NULL,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 9. Bảng Danh mục hóa chất & Tồn kho MSDS (msds & storage)
CREATE TABLE IF NOT EXISTS msds_chemicals (
  chemical_code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  pictograms VARCHAR(255) DEFAULT NULL, -- GHS02, GHS06...
  quantity INT DEFAULT 0,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. Bảng lưu các đoạn (chunk) tài liệu đã huấn luyện + vector embedding (RAG)
CREATE TABLE IF NOT EXISTS doc_chunks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doc_id VARCHAR(191) NOT NULL,       -- ID tài liệu nguồn (documents.id hoặc "trained:<id>")
  doc_title VARCHAR(255) DEFAULT NULL,
  doc_type VARCHAR(50) DEFAULT NULL,  -- msds, sop, quytrinh, bieumau... hoặc "global"
  chunk_index INT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  embedding JSON NOT NULL,            -- mảng float (vector embedding)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doc (doc_id)
) ENGINE=InnoDB;

-- 11. Bảng generic-collection (kiểu Firestore): chứa documents, settings, lockers,
-- licenses, knife, gemba_scores... — mọi collection KHÔNG có bảng riêng ở trên.
-- routes/db.js phụ thuộc hoàn toàn vào bảng này.
CREATE TABLE IF NOT EXISTS firestore_mock (
  collection VARCHAR(128) NOT NULL,
  id VARCHAR(191) NOT NULL,
  data LONGTEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (collection, id)
) ENGINE=InnoDB;

-- 12. Token đặt lại mật khẩu dùng một lần (quên mật khẩu qua email)
CREATE TABLE IF NOT EXISTS password_resets (
  token VARCHAR(255) NOT NULL PRIMARY KEY,
  uid VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at BIGINT NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 13. Sổ theo dõi file upload: ai upload file nào (kiểm quyền khi xóa file)
CREATE TABLE IF NOT EXISTS uploads (
  filename VARCHAR(255) NOT NULL PRIMARY KEY,
  uid VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Không gieo sẵn tài khoản admin. Khi bảng users trống, ứng dụng hiện form khởi tạo
-- để người dùng tự tạo tài khoản admin đầu tiên (qua endpoint /api/auth/init-admin).
