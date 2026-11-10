// A tiny static server for built pages: `bun tools/serve.mjs <folder> <port>`. It prints its pid. Stop it by that pid.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const [folder, port] = process.argv.slice(2);
if (!folder || !port) { console.error('usage: bun tools/serve.mjs <folder> <port>'); process.exit(2); }
const base = resolve(folder);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.wav': 'audio/wav', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    let path = join(base, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(base)) throw new Error('outside');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${base} on http://127.0.0.1:${port}/  pid ${process.pid}`));
