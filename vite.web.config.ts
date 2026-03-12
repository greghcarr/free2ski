import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',   // we control when the update fires — don't interrupt an active game
      manifest: false,          // iOS meta tags in index.html already handle install icons/behaviour
      workbox: {
        // Precache all build output: JS bundles, CSS, HTML, fonts
        globPatterns: ['**/*.{js,css,html,otf,ttf,woff,woff2}'],
        // Fall back to index.html for any navigation request (SPA behaviour)
        navigateFallback: '/free2ski/index.html',
        // Never intercept Supabase API calls — always go to the network
        navigateFallbackDenylist: [/^\/free2ski\/api\//],
        runtimeCaching: [{
          // Supabase API: network-first so leaderboard data is always fresh
          urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
          handler: 'NetworkFirst',
          options: { cacheName: 'supabase-api', networkTimeoutSeconds: 10 },
        }],
      },
    }),
  ],
  root: '.',
  base: '/free2ski/',
  build: {
    outDir: 'dist/web',
    target: 'es2020',
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub out steamworks.js entirely in web builds — it uses native Node bindings
      'steamworks.js': path.resolve(__dirname, './src/platform/steamStub.ts'),
    },
  },
  define: {
    '__PLATFORM__': JSON.stringify('web'),
    '__STEAM_ENABLED__': false,
  },
  server: {
    host: true,
    port: 8080,
    hmr: true,
  },
});
