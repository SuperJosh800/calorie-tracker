import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The GitHub Pages workflow builds with `--base=/<repo-name>/`; locally the app is served from `/`.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Calorie Tracker',
        short_name: 'Calories',
        description: 'Track calories and nutrients, with a barcode scanner.',
        theme_color: '#16a34a',
        background_color: '#f3f5f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the barcode reader's WebAssembly and the UK food database so they work offline once installed.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
})
