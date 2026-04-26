import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'https://ai-scientist-hacknation-production.up.railway.app'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // SSE endpoint — must come before the /generate-plan catch-all.
      // Strip Accept-Encoding so the backend returns plain text/event-stream
      // without gzip, which would prevent Vite from forwarding chunks in real-time.
      '/generate-plan/stream': {
        target: BACKEND,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Accept-Encoding')
          })
        },
      },
      '/literature-qc':   { target: BACKEND, changeOrigin: true },
      '/generate-plan':   { target: BACKEND, changeOrigin: true },
      '/feedback':        { target: BACKEND, changeOrigin: true },
      '/email-quote':     { target: BACKEND, changeOrigin: true },
      '/compare-material':{ target: BACKEND, changeOrigin: true },
      '/chat':            { target: BACKEND, changeOrigin: true },
      '/voice-session':   { target: BACKEND, changeOrigin: true },
      '/api/chat': {
        target: BACKEND,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chat/, '/chat'),
      },
    },
  },
})
