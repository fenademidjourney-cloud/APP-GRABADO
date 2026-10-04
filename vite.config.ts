import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The production build is a single self-contained HTML file that runs by
// double-click (file://) with no server and no network. Fonts, textures and
// workers are inlined: workers use `?worker&inline` and the classic (iife)
// format, because module workers from blob URLs are not reliable on file://.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  worker: { format: 'iife' },
  build: {
    assetsInlineLimit: 64 * 1024 * 1024,
    chunkSizeWarningLimit: 20000,
    cssCodeSplit: false,
    assetsDir: '.',
  },
})
