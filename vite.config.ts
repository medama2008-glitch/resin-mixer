import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages のサブパス。Actions からは VITE_BASE=/<repo名>/ が渡される。
// ローカル開発では '/' を使うと http://localhost:5173/ でそのまま開ける。
const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? '/resin-mixer/' : '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ResinMixer',
        short_name: 'ResinMixer',
        description: '自作UVレジンの配合計算・調合手順',
        lang: 'ja',
        theme_color: '#1f4d3a',
        background_color: '#0f1f18',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // recipes.json はプリキャッシュせず NetworkFirst で取得する。
        // オンライン時は常に最新を取り、オフライン時は前回取得分を返す。
        globIgnores: ['**/recipes.json'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/recipes.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'recipes',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
