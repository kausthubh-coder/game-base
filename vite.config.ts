import { defineConfig } from 'vite';

// The game is the index.html at the root. Each demo is its own small page, built by tools/demo.mjs.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { port: Number(process.env.PORT) || 5300, strictPort: true },
});
