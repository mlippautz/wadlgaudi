import { defineConfig } from 'vite';

export default defineConfig({
  base: '/wadlgaudi/',
  server: {
    allowedHosts: ['truck.local']
  }
});
