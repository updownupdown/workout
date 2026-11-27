import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

// Served from https://<user>.github.io/workout/
const base = process.env.BASE_PATH ?? '/workout/'

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      // Separate prototype page for the realistic 3D figure; it is not part of the app shell.
      input: { main: resolve(__dirname, 'index.html'), realistic: resolve(__dirname, 'realistic.html') },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flow — guided workouts',
        short_name: 'Flow',
        description: 'Auto-built follow-along sessions: yoga, strength, pilates, stretching and breathwork.',
        theme_color: '#0e1014',
        background_color: '#0e1014',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/realistic*', '**/realistic/**'],
        navigateFallbackDenylist: [/realistic/],
      },
    }),
  ],
})
