import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import JWT_SECRET from "../config/jwtSecret.js";
import { setIoInstance } from "../routes/db.js";

let ioInstance = null;

export function initSocket(server) {
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : "*",
      methods: ["GET", "POST"]
    }
  });

  // Bắt buộc JWT hợp lệ khi handshake. Không có bước này thì BẤT KỲ AI biết địa chỉ
  // server đều subscribe được mọi path (users, chat, settings...) và nhận toàn bộ
  // dữ liệu broadcast mà không cần đăng nhập.
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || "").split(" ")[1];
    if (!token) return next(new Error("unauthorized"));
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("unauthorized"));
      socket.user = decoded;
      next();
    });
  });

  setIoInstance(io);
  ioInstance = io;

  io.on("connection", (socket) => {
    console.log("WebSocket client connected:", socket.id);

    // Subscribe client to real-time updates of a collection or document path
    socket.on("subscribe", ({ path }) => {
      console.log(`Socket ${socket.id} subscribed to path: ${path}`);
      socket.join(path);
    });

    // Unsubscribe client from updates
    socket.on("unsubscribe", ({ path }) => {
      console.log(`Socket ${socket.id} unsubscribed from path: ${path}`);
      socket.leave(path);
    });

    socket.on("disconnect", () => {
      console.log("WebSocket client disconnected:", socket.id);
    });
  });

  return io;
}

export function broadcastChange(path, data) {
  if (ioInstance) {
    // Emit only to clients subscribed to this path (room), not to everyone.
    ioInstance.to(path).emit("db_change", { path, data });
  }
}
