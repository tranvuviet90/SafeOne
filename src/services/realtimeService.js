import { io } from "socket.io-client";

let socket = null;
const socketListeners = new Map(); // path -> Set of callbacks

function getSocket() {
  if (socket) return socket;
  try {
    socket = io(window.location.origin, {
      path: "/socket.io",
      autoConnect: true,
      // Server yêu cầu JWT khi handshake. Dùng callback để MỖI lần (re)connect
      // đều đọc token mới nhất từ storage (vd: vừa đăng nhập xong).
      auth: (cb) => cb({
        token:
          localStorage.getItem("safeone_jwt_token") ||
          sessionStorage.getItem("safeone_jwt_token") ||
          ""
      })
    });
    socket.on("connect_error", () => {
      // Bị server từ chối (chưa đăng nhập / token hết hạn). Lỗi từ middleware
      // không được socket.io tự retry, nên chủ động thử lại sau 5s — auth callback
      // sẽ gửi token mới nếu người dùng đã đăng nhập trong lúc chờ.
      setTimeout(() => {
        if (socket && !socket.connected) socket.connect();
      }, 5000);
    });
    socket.on("connect", () => {
      // Re-subscribe all active paths on connect/reconnect
      socketListeners.forEach((callbacks, path) => {
        socket.emit("subscribe", { path });
      });
    });
    socket.on("db_change", (event) => {
      const { path, data } = event;
      const callbacks = socketListeners.get(path);
      if (callbacks) {
        callbacks.forEach(cb => cb(data));
      }
    });
  } catch (e) {
    console.warn("WebSocket connection failed", e);
  }
  return socket;
}

export const realtimeService = {
  subscribeToPath(path, callback) {
    let callbacks = socketListeners.get(path);
    if (!callbacks) {
      callbacks = new Set();
      socketListeners.set(path, callbacks);
      const s = getSocket();
      if (s && s.connected) {
        s.emit("subscribe", { path });
      }
    }
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        socketListeners.delete(path);
        const s = getSocket();
        if (s && s.connected) {
          s.emit("unsubscribe", { path });
        }
      }
    };
  }
};

export default realtimeService;
