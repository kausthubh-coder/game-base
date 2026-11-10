// Builds or serves one demo page: `bun tools/demo.mjs build <name>` or `bun tools/demo.mjs dev <name> <port>`.
// A demo lives in demos/<name>/index.html. Its build goes to dist/demos/<name>, so agents never share an output folder.
import { build, createServer } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [mode, name, port] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const demoRoot = resolve(root, 'demos', name ?? '');
if (!['build', 'dev'].includes(mode) || !name || !existsSync(resolve(demoRoot, 'index.html'))) {
  console.error('usage: bun tools/demo.mjs build <name> | dev <name> <port>   (demos/<name>/index.html must exist)');
  process.exit(2);
}

const shared = {
  root: demoRoot,
  base: './',
  publicDir: resolve(root, 'public'),
  worker: { format: 'es' },
  configFile: false,
};

if (mode === 'build') {
  await build({ ...shared, build: { outDir: resolve(root, 'dist/demos', name), emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 1500 } });
} else {
  if (!port) { console.error('dev needs a port'); process.exit(2); }
  const server = await createServer({ ...shared, server: { port: Number(port), strictPort: true, host: '127.0.0.1', fs: { allow: [root] } } });
  await server.listen();
  console.log(`demo ${name} on http://127.0.0.1:${port}/  pid ${process.pid}`);
}
