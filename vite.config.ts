import { defineConfig } from 'vite';
import { assetBuild } from './tools/asset-build.mjs';

// The game is the index.html at the root. Each demo is its own small page, built by tools/demo.mjs.
export default defineConfig({
  base: './',
  plugins: [assetBuild()],
  worker: { format: 'es' },
  build: { assetsDir: 'assets/fingerprinted', target: 'es2022', chunkSizeWarningLimit: 1500 },
  server: { port: Number(process.env.PORT) || 5300, strictPort: true },
});
