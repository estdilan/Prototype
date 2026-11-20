import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    alias: {
      'cannon-es': fileURLToPath(new URL('./node_modules/cannon-es/dist/cannon-es.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders'],
  },
});
