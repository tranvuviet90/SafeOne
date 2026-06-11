CREATE DATABASE IF NOT EXISTS safeone DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE safeone;

-- ==============================================================================
-- 1. CÁC BẢNG CỐT LÕI (CORE TABLES)
-- ==============================================================================

-- Bảng Người dùng
CREATE TABLE IF NOT EXISTS users (
  uid VARCHAR(128) PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role JSON NOT NULL, -- Đổi thành JSON vì trong Rule: "return r is list ? r : [r];"
  meal_dept VARCHAR(100) DEFAULT NULL,
  disabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Sở thích/Cài đặt cá nhân của user (user_prefs)
CREATE TABLE IF NOT EXISTS user_prefs (
  uid VARCHAR(128) PRIMARY KEY,
  preferences JSON DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Yêu cầu thay đổi quyền (role_requests)
CREATE TABLE IF NOT EXISTS role_requests (
  id VARCHAR(128) PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  current_role JSON DEFAULT NULL,
  requested_role JSON NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================================================================
-- 2. QUẢN LÝ TÀI LIỆU & THÔNG BÁO (DOCUMENTS & NOTIFICATIONS)
-- ==============================================================================

-- Bảng Tài liệu (documents) - MSDS, SOP, Quy trình, Biểu mẫu
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(128) PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'msds', 'sop', 'quytrinh', 'bieumau'
  data JSON NOT NULL,        -- Chứa title, url, mô tả,...
  created_by VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(uid) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Bảng Thông báo (notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(128) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  target_roles JSON DEFAULT NULL,
  target_user_id VARCHAR(128) DEFAULT NULL,
  read_by JSON DEFAULT NULL,
  created_by VARCHAR(128) DEFAULT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Trạng thái thông báo cá nhân (notification_state)
CREATE TABLE IF NOT EXISTS notification_state (
  id VARCHAR(128) PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  state JSON DEFAULT NULL,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Tin nhắn Chat (GiaiLaoChat / chat_messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ==============================================================================
-- 3. BÁO CƠM & XẾP CA (MEALS & SHIFTS)
-- ==============================================================================

-- Bảng Báo cơm (meal_reports)
CREATE TABLE IF NOT EXISTS meal_reports (
  date_key VARCHAR(10) NOT NULL,
  shift_key VARCHAR(5) NOT NULL,
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

-- Bảng Ca trực tuần (weekly_shifts)
CREATE TABLE IF NOT EXISTS weekly_shifts (
  week_id VARCHAR(50) PRIMARY KEY,
  shift_data JSON NOT NULL, -- Chứa dữ liệu các key là tên người dùng (getUserName)
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Phân công tuần v6 (weekly_assignments_v6)
CREATE TABLE IF NOT EXISTS weekly_assignments_v6 (
  week_id VARCHAR(50) PRIMARY KEY,
  assignment_data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==============================================================================
-- 4. GIÁM SÁT & TUẦN TRA EHS (EHS AUDITS & LOGS)
-- ==============================================================================

-- Bảng Log khu vực giải lao (gialaokv)
CREATE TABLE IF NOT EXISTS gialaokv_logs (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Giám sát nhà rác (giamsatnharac)
CREATE TABLE IF NOT EXISTS giamsatnharac_logs (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Lịch sử hút thuốc (hutthuoc_history)
CREATE TABLE IF NOT EXISTS hutthuoc_history (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Nhật ký tuần tra Gemba (tu_gemba_logs)
CREATE TABLE IF NOT EXISTS tu_gemba_logs (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Bảng Điểm Gemba theo phòng ban (gemba_scores)
CREATE TABLE IF NOT EXISTS gemba_scores (
  department VARCHAR(100) PRIMARY KEY,
  score_data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Sự kiện Gemba (gemba_events)
CREATE TABLE IF NOT EXISTS gemba_events (
  id VARCHAR(128) PRIMARY KEY,
  event_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Đánh giá/Bình luận Audit (audit_comments)
CREATE TABLE IF NOT EXISTS audit_comments (
  id VARCHAR(128) PRIMARY KEY,
  comment_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==============================================================================
-- 5. CẤU HÌNH & THIẾT BỊ (SETTINGS & EQUIPMENTS)
-- ==============================================================================

-- Bảng Bộ đàm (bodam status & config)
CREATE TABLE IF NOT EXISTS bodam (
  type VARCHAR(50) PRIMARY KEY, -- 'status' hoặc 'config'
  data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bảng Cấu hình hệ thống (settings)
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(100) PRIMARY KEY,
  config_data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;