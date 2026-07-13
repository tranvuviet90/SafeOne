#!/usr/bin/env bash
# Backup hằng ngày cho SafeOne: dump MySQL + nén thư mục uploads.
# Giữ 14 bản gần nhất, tự xóa bản cũ hơn.
#
# Cài đặt (một lần):
#   1) Sửa các biến bên dưới cho đúng máy của bạn.
#   2) chmod +x deploy/backup-safeone.sh
#   3) Tạo file ~/.my.cnf (chmod 600) để không lộ mật khẩu trong crontab:
#        [mysqldump]
#        user=safeone_user
#        password=MAT_KHAU_DB
#   4) Thêm cron chạy 2h sáng mỗi ngày:
#        crontab -e
#        0 2 * * * /duong/dan/SafeOne/deploy/backup-safeone.sh >> /var/log/safeone-backup.log 2>&1
#
# KHUYẾN NGHỊ: đồng bộ thư mục BACKUP_DIR ra máy khác (rclone/rsync) —
# backup nằm cùng ổ đĩa VPS sẽ mất theo nếu VPS hỏng.

set -euo pipefail

# ================== SỬA CHO ĐÚNG MÁY CỦA BẠN ==================
APP_DIR="/home/ubuntu/SafeOne"        # thư mục gốc dự án trên VPS
BACKUP_DIR="/var/backups/safeone"     # nơi chứa backup
DB_NAME="safeone"
RETENTION=14                          # số bản giữ lại
# ==============================================================

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

# 1) Dump database (đọc user/password từ ~/.my.cnf)
mysqldump --single-transaction --quick --routines "$DB_NAME" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

# 2) Nén thư mục uploads (ảnh hiện trường, tài liệu)
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR/backend" uploads

# 3) Giữ lại RETENTION bản mới nhất cho mỗi loại
ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

echo "[$(date '+%F %T')] Backup OK: db-$STAMP.sql.gz + uploads-$STAMP.tar.gz"
