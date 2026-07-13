# Hướng dẫn triển khai SafeOne lên VPS (Giai đoạn 3)

Checklist đầy đủ để đưa app chạy production ổn định. Hướng dẫn chính cho **Ubuntu/Debian**; cuối file có ghi chú cho **Windows Server**.

## 0. Chuẩn bị trên VPS

```bash
# Node.js 20 LTS + MySQL + nginx
sudo apt update
sudo apt install -y nginx mysql-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Tạo database + user riêng (đừng dùng root):

```sql
CREATE DATABASE safeone DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'safeone_user'@'localhost' IDENTIFIED BY 'MAT_KHAU_MANH';
GRANT ALL PRIVILEGES ON safeone.* TO 'safeone_user'@'localhost';
FLUSH PRIVILEGES;
```

> Không cần chạy schema.sql thủ công — backend tự tạo bảng khi khởi động lần đầu
> (bao gồm cả `firestore_mock`, `uploads`, `doc_chunks`, `password_resets`).

## 1. Lấy code & cấu hình

```bash
git clone <repo> SafeOne && cd SafeOne
npm install
cd backend && npm install && cd ..

# Cấu hình môi trường
cp deploy/env.production.example backend/.env
nano backend/.env    # điền DB_PASSWORD, JWT_SECRET, CORS_ORIGIN, APP_BASE_URL, SMTP...
```

Sinh JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Build frontend & chạy bằng PM2

```bash
npm run build                              # sinh backend/public/assets
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup                                # chạy lệnh nó in ra để tự khởi động cùng máy
pm2 install pm2-logrotate                  # xoay vòng log
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
```

Kiểm tra:

```bash
curl http://localhost:5000/api/health      # {"ok":true,"db":true,...}
pm2 logs safeone --lines 30
```

## 3. Nginx + HTTPS

```bash
sudo cp deploy/nginx-safeone.conf /etc/nginx/sites-available/safeone
sudo nano /etc/nginx/sites-available/safeone    # đổi safeone.example.com -> tên miền thật
sudo ln -s /etc/nginx/sites-available/safeone /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS miễn phí (tự gia hạn)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d safeone.example.com
```

Sau khi có HTTPS, kiểm tra lại `backend/.env`:
- `APP_BASE_URL=https://safeone.example.com`
- `CORS_ORIGIN=https://safeone.example.com`

rồi `pm2 restart safeone`.

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Quan trọng: **không mở cổng 5000 và 3306 ra ngoài** — mọi truy cập đi qua nginx (80/443).

## 5. Backup tự động

```bash
chmod +x deploy/backup-safeone.sh
nano deploy/backup-safeone.sh        # sửa APP_DIR, BACKUP_DIR

# Lưu mật khẩu DB cho mysqldump (không lộ trong crontab)
cat > ~/.my.cnf <<'EOF'
[mysqldump]
user=safeone_user
password=MAT_KHAU_DB
EOF
chmod 600 ~/.my.cnf

# Chạy thử 1 lần
./deploy/backup-safeone.sh

# Cron 2h sáng hằng ngày
crontab -e
# thêm dòng:
# 0 2 * * * /home/ubuntu/SafeOne/deploy/backup-safeone.sh >> /var/log/safeone-backup.log 2>&1
```

> Nên đồng bộ thư mục backup ra ngoài VPS (rclone lên Google Drive/S3, hoặc rsync về máy khác).

## 6. Cập nhật phiên bản sau này

```bash
cd SafeOne
git pull
npm install && (cd backend && npm install)
npm run build
pm2 restart safeone
curl http://localhost:5000/api/health
```

## 7. Giám sát nhanh

- `pm2 status` / `pm2 logs safeone` — trạng thái & log.
- `GET /api/health` trả `{"ok":true,"db":true}` — có thể gắn vào UptimeRobot (miễn phí) để báo khi app sập.

---

## Phụ lục: VPS Windows Server

- PM2 chạy được trên Windows: `npm i -g pm2 pm2-windows-startup` rồi `pm2-startup install`, sau đó dùng y nguyên `pm2 start deploy/ecosystem.config.cjs`.
- Thay nginx bằng **Caddy** (tự động HTTPS, cấu hình 3 dòng) hoặc IIS ARR. Caddyfile mẫu:

  ```
  safeone.example.com {
      reverse_proxy 127.0.0.1:5000
  }
  ```

- Backup: dùng Task Scheduler chạy lệnh
  `mysqldump --single-transaction safeone > backup.sql` + nén thư mục `backend\uploads`.
