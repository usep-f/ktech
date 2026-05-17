import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        aboutus: resolve(__dirname, 'src/aboutus.html'),
        contact: resolve(__dirname, 'src/contact.html'),
        portfolio: resolve(__dirname, 'src/portfolio.html'),
        services: resolve(__dirname, 'src/services.html')
      }
    }
  }
});
