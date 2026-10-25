import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
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

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
};

const docsRoute = (): Plugin => ({
  name: 'docs-route',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = decodeURIComponent((request.url ?? '').split('?')[0]!);
      if (!path.startsWith('/docs/')) return next();
      let file = join(resolve(import.meta.dirname, 'docs'), path.slice('/docs/'.length));
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!file.startsWith(resolve(import.meta.dirname, 'docs')) || !existsSync(file)) return next();
      response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
      response.end(readFileSync(file));
    });
  },
  closeBundle() {
    cpSync(resolve(import.meta.dirname, 'docs'), resolve(import.meta.dirname, 'dist', 'docs'), { recursive: true });
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
  plugins: [react(), labRoute(), docsRoute()],
});
