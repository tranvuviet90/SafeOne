// Cấu hình PM2 cho SafeOne (chạy được cả Linux VPS lẫn Windows Server).
//
// Cách dùng (từ thư mục gốc dự án trên VPS):
//   npm install -g pm2
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save            # ghi nhớ danh sách app
//   pm2 startup         # in ra lệnh đăng ký chạy cùng hệ điều hành -> chạy lệnh đó
//
// Xem log:   pm2 logs safeone
// Khởi động lại sau khi build/pull code mới:  pm2 restart safeone

module.exports = {
  apps: [
    {
      name: "safeone",
      cwd: __dirname + "/../backend",
      script: "server.js",
      // Backend giữ trạng thái trong RAM (rate-limit, cache, socket rooms)
      // => chỉ chạy 1 instance, KHÔNG bật cluster mode.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production"
      },
      // Log xoay vòng: cài thêm module (một lần):  pm2 install pm2-logrotate
      // rồi:  pm2 set pm2-logrotate:max_size 20M ; pm2 set pm2-logrotate:retain 14
      out_file: "../logs/safeone-out.log",
      error_file: "../logs/safeone-err.log",
      merge_logs: true,
      time: true
    }
  ]
};
