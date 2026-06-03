import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  resolve: {
    alias: {
      'cannon-es': new URL('./node_modules/cannon-es/dist/cannon-es.js', import.meta.url).pathname,
    },
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders'],
  },
});
