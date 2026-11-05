import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'node:fs';

export default defineConfig({
  plugins: [{
    name: 'preserve-classic-portal-scripts',
    closeBundle() {
      for (const file of ['patient/icons.js', 'patient/app.js', 'patient/premium.js', 'admin/admin.js', 'admin/login.js']) {
        copyFileSync(resolve(import.meta.dirname, file), resolve(import.meta.dirname, 'dist', file));
      }
    }
  }],
  server: {
    host: '0.0.0.0',
    port: 5005,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        patient: resolve(import.meta.dirname, 'patient/index.html'),
        admin: resolve(import.meta.dirname, 'admin/admin.html'),
        login: resolve(import.meta.dirname, 'admin/login.html')
      }
    }
  }
});

