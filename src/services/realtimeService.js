import { io } from "socket.io-client";

let socket = null;
const socketListeners = new Map(); // path -> Set of callbacks

function getSocket() {
  if (socket) return socket;
  try {
    socket = io(window.location.origin, { path: "/socket.io", autoConnect: true });
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
