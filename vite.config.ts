import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/**
 * `/lab` is a page of its own rather than a route inside the game: the lab imports the sprite
 * definitions and the shading, and none of that should end up in the bundle a player downloads.
 * Two entries keep them apart. This only rewrites the pretty URL onto the real file.
 */
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
