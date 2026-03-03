import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './',
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
    port: 8080,
    hmr: true,
  },
});
