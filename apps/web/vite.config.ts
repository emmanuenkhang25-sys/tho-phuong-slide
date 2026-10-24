/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GHI CHÚ (theo brief): workbox runtimeCaching cho Supabase REST được bỏ qua
// vì cache API có xác thực rất dễ gây rò rỉ/dữ liệu cũ sai. Offline thật sự
// do Dexie (drafts/sync_queue) đảm nhiệm ở tầng ứng dụng.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Thờ Phượng Slide',
        short_name: 'Thờ Phượng',
        description: 'Tạo slide thờ phượng cho Hội thánh — nhanh, đẹp, ngoại tuyến một phần',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1e40af',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Chỉ precache shell ứng dụng; không cache Supabase REST (xem ghi chú trên).
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
