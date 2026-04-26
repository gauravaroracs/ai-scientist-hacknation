import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // SSE endpoint — must come before the /generate-plan catch-all.
      // Strip Accept-Encoding so the backend returns plain text/event-stream
      // without gzip, which would prevent Vite from forwarding chunks in real-time.
      '/generate-plan/stream': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Accept-Encoding')
          })
        },
      },
      '/literature-qc': 'http://localhost:8000',
      '/generate-plan': { target: 'http://localhost:8000', changeOrigin: true },
      '/feedback':      'http://localhost:8000',
    },
  },
})
