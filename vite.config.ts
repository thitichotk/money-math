import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-mark.svg', 'logo.svg', 'logo-inverse.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Money-Math',
        short_name: 'Money-Math',
        description: 'Thai loan, savings and deposit calculators',
        lang: 'th',
        start_url: '/',
        display: 'standalone',
        background_color: '#F7F7F5',
        theme_color: '#F7F7F5',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // Client-side routes (/loan, /savings, ...) are served by the app shell when offline.
      workbox: { navigateFallback: '/index.html' },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    poolOptions: { forks: { execArgv: ['--no-experimental-webstorage'] } },
  },
});
