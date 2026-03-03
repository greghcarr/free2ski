import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    target: 'chrome126', // Electron 33 ships Chromium ~126
    rollupOptions: {
      input: { main: 'electron.html' },
      external: ['electron'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    '__PLATFORM__': JSON.stringify('electron'),
    '__STEAM_ENABLED__': true,
  },
});
