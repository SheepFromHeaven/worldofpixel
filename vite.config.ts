import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const labRoute = (): Plugin => ({
  name: 'lab-route',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === '/lab' || request.url === '/lab/') request.url = '/lab.html';
      next();
    });
  },
});

export default defineConfig({
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
      },
    },
  },
  plugins: [react(), labRoute()],
});
