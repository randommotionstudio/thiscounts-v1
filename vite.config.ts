import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-*.png', 'brand/*.png', 'icons/*.svg', 'logos/*.png'],
      manifest: {
        name: 'thisCounts',
        short_name: 'thisCounts',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FBF5EE',
        background_color: '#FBF5EE',
        icons: [
          // Full-bleed square icon: the OS applies its own corner mask
          { src: '/brand/app-icon-v13-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/brand/app-icon-v13-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The whole app shell (code, fonts, icons, logos) is precached so the app starts without reception.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
