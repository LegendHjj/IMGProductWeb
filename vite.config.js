import { defineConfig } from 'vite';

export default defineConfig({
  base: '/IMGProductWeb/', // Required for GitHub Pages subdirectory deployment
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
