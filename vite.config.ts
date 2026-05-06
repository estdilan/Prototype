import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  optimizeDeps: {
    include: ['@babylonjs/core', '@babylonjs/loaders', 'cannon-es'],
  },
});
