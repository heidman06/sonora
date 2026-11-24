import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const target = process.env.VITE_PROXY_TARGET || 'https://serveur-heid.tailfb8e87.ts.net:8451'

export default defineConfig({
  plugins: [react()],
  base: '/musique-next/',
  server: {
    port: 5174,
    proxy: {
      '/api': { target, changeOrigin: true, secure: false },
      '/musique/dl': { target, changeOrigin: true, secure: false },
      '/musique/hls': { target, changeOrigin: true, secure: false },
      '/subsonic': { target, changeOrigin: true, secure: false },
    },
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
})
