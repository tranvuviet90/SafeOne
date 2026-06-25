import { Server } from "socket.io";
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
