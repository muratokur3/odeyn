import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase'i ayrı chunk'a al (~800KB)
          'firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
            'firebase/functions',
            'firebase/analytics'
          ],
          // React + Router ayrı chunk (~200KB)
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          // UI kütüphaneleri ayrı chunk
          'ui': [
            'framer-motion',
            'lucide-react',
            'react-icons',
            'clsx',
            'tailwind-merge'
          ]
        }
      }
    }
  }
})
