import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      manifest: {
        name: 'Nightfeed',
        short_name: 'Nightfeed',
        description: 'Newborn feeding & care tracker',
        display: 'standalone',
        background_color: '#161826',
        theme_color: '#161826',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Start left feed', short_name: 'Left feed', url: '/?action=feed-left', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Start right feed', short_name: 'Right feed', url: '/?action=feed-right', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Log wet diaper', short_name: 'Wet diaper', url: '/?action=diaper-wet', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Start sleep', short_name: 'Sleep', url: '/?action=sleep', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] }
        ]
      }
    })
  ]
})
