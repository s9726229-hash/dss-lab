import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-512.png'],
      manifest: {
        name: 'FinTrack AI',
        short_name: 'FinTrack',
        description: 'FinTrack AI 財務管家',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  // 關鍵設定：使用相對路徑 './'，這樣無論部署在 GitHub Pages 的哪一層目錄都能正常讀取資源
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: false
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    open: true
  }
});
