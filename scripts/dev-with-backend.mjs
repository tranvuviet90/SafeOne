// scripts/dev-with-backend.mjs
//
// Chạy ĐỒNG THỜI backend (Express :5000) và frontend (Vite :5173) bằng MỘT lệnh:
//   npm run dev:all
//
// Vite đã proxy /api, /uploads, /socket.io sang :5000, nên chỉ cần mở
// http://localhost:5173 là dùng được đầy đủ (không còn bẫy "npm run dev chỉ
// chạy frontend nên mọi API lỗi").
//
// Spawn `node` trực tiếp (không gọi npm/.cmd) để chạy ổn định trên cả
// Windows lẫn Linux. Nhấn Ctrl+C để dừng cả hai.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const backendDir = path.join(root, "backend");
const backendNodemon = path.join(backendDir, "node_modules", "nodemon", "bin", "nodemon.js");

const procs = [];
let shuttingDown = false;

function run(name, args, cwd, color, env = process.env) {
  const child = spawn(process.execPath, args, { cwd, env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;

  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code) => {
    process.stdout.write(prefix + `đã thoát (code ${code ?? 0}).\n`);
    shutdown(code ?? 0);
  });
  procs.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try { p.kill(); } catch { /* đã thoát */ }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Backend: ưu tiên nodemon (tự reload khi sửa .js); nếu không có thì chạy node server.js.
// Xóa PORT khỏi env của backend: biến này (nếu có) là cổng cấp cho VITE — server.js
// cũng đọc process.env.PORT nên nếu để lan sang, hai tiến trình con bind cùng một cổng.
// Backend luôn ở :5000 vì proxy trong vite.config.js trỏ cứng tới đó.
const backendEnv = { ...process.env };
delete backendEnv.PORT;
if (fs.existsSync(backendNodemon)) {
  run("backend", [backendNodemon, "server.js"], backendDir, "36", backendEnv); // cyan
} else {
  run("backend", ["server.js"], backendDir, "36", backendEnv);
}

// Frontend: Vite dev server (HMR).
run("vite", [viteBin], root, "35"); // magenta
