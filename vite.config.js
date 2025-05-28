import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [
    react()
  ],
  base: '/sdk',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          lemon: ['littleLemon.js'],
        },
      },
    },
    chunkSizeWarningLimit: 1500
  },
})
