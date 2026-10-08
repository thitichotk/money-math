import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cloudflare Pages serves /loan from loan.html. With a 404.html present it stops treating the site as a single-page
// app, so unknown paths (and probes for files like /llms.txt) get a real 404 instead of the app with a 200.
// Keep in step with the routes in src/app/App.tsx; a route missing here still works, just with a 404 status.
const ROUTES = ['loan', 'savings', 'fixed', 'tiered', 'future-value', 'npv', 'about', '404'];

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    {
      name: 'route-pages',
      apply: 'build',
      closeBundle() {
        for (const route of ROUTES) copyFileSync('dist/index.html', `dist/${route}.html`);
      },
    },
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
      // Files such as /llms.txt and /robots.txt are left to the network.
      workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/\.\w+$/] },
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
