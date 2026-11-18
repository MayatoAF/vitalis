import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitalisPwa } from './pwa/vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [react(), vitalisPwa()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  server: {
    port: 5178,
    strictPort: true,
  },
});
