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
