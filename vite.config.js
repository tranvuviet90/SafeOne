import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  console.log("Building with LOCAL MySQL Database (Firebase completely disabled)...");
  
  const alias = {
    'firebase/app': path.resolve(__dirname, './src/firebase-mock.js'),
    'firebase/auth': path.resolve(__dirname, './src/firebase-mock.js'),
    'firebase/firestore': path.resolve(__dirname, './src/firebase-mock.js'),
    'firebase/storage': path.resolve(__dirname, './src/firebase-mock.js'),
    'firebase/functions': path.resolve(__dirname, './src/firebase-mock.js')
  };

  return {
    plugins: [react()],
    resolve: {
      alias
    }
  };
});
