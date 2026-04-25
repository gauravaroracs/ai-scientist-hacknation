import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/literature-qc': 'http://localhost:8000',
      '/generate-plan': 'http://localhost:8000',
      '/feedback':      'http://localhost:8000',
    },
  },
})
