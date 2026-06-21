# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS builder
WORKDIR /usr/src/app

# Sao chép package.json của root và cài đặt dependencies cho frontend
COPY package*.json ./
RUN npm ci

# Sao chép mã nguồn frontend và tiến hành biên dịch
COPY . .
RUN npm run build

# --- Stage 2: Run Backend ---
FROM node:22-alpine
WORKDIR /usr/src/app

# Sao chép package.json của backend và cài đặt dependencies sản xuất
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Sao chép mã nguồn backend
COPY backend/ ./backend/

# Sao chép thư mục dist đã biên dịch ở Stage 1 sang Stage 2
COPY --from=builder /usr/src/app/dist ./dist

# Thiết lập các biến môi trường
ENV NODE_ENV=production
ENV PORT=5000

# Mở cổng 5000
EXPOSE 5000

# Lệnh khởi chạy ứng dụng
CMD ["node", "backend/server.js"]
