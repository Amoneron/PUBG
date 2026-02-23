import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/projects/pubg/arena/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
});
