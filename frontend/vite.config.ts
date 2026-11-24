import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

const target = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3011'

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  base: process.env.VITE_BASE || '/musique/',
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
