import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(() => {
  console.log("Building SafeOne Fullstack Web App (Native Node.js & MySQL)...");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: true,
      // Nhận cổng do môi trường cấp (vd. preview harness đặt PORT khi 5173 bận);
      // không có thì giữ 5173 quen thuộc. Backend vẫn cố định :5000 (xem dev-with-backend.mjs).
      port: Number(process.env.PORT) || 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: path.resolve(__dirname, './backend/public'),
      emptyOutDir: true
    }
  };
});
