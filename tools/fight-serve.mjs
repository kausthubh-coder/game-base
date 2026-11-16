// Serves a built game for the fight lab and keeps what the lab sends: `bun tools/fight-serve.mjs <folder> <port>`.
// Like `tools/serve.mjs`, on 127.0.0.1, and it prints its pid. Stop it by that pid.
//
// A page opened with `?scene=fight&log=1` posts every fight that ends, and every answer to "Again?", to
// `fight-log` beside it. This server appends each one as a line to `.artifacts/fight/ratings.jsonl`.
//
//   bun run build --outDir .artifacts/fight/site --emptyOutDir
//   bun tools/fight-serve.mjs .artifacts/fight/site 5529
//   open http://127.0.0.1:5529/?scene=fight&log=1
import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';

const [folder, port] = process.argv.slice(2);
if (!folder || !port) { console.error('usage: bun tools/fight-serve.mjs <folder> <port>'); process.exit(2); }
const base = resolve(folder);
const ratings = resolve(import.meta.dirname, '..', '.artifacts/fight/ratings.jsonl');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon' };
/** A fight's record is a few hundred bytes. Anything far bigger is not one. */
const MOST = 64 * 1024;

/** Takes one posted fight and appends it as one line. */
async function keep(req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MOST) { res.writeHead(413).end('too large'); return; }
  }
  let fight;
  try { fight = JSON.parse(body); } catch { res.writeHead(400).end('not JSON'); return; }
  if (!fight || typeof fight !== 'object' || Array.isArray(fight)) { res.writeHead(400).end('not a fight'); return; }
  await mkdir(dirname(ratings), { recursive: true });
  // One line each, so the file stays a list of JSON lines whatever the page sent.
  await appendFile(ratings, JSON.stringify(fight) + '\n');
  res.writeHead(204).end();
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/fight-log') {
      if (req.method === 'POST') await keep(req, res);
      else res.writeHead(405, { allow: 'POST' }).end('POST only');
      return;
    }
    let path = join(base, normalize(decodeURIComponent(url.pathname)));
    if (!path.startsWith(base)) throw new Error('outside');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(path));
  } catch {
    if (!res.headersSent) res.writeHead(404).end('not found');
  }
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${base} on http://127.0.0.1:${port}/  pid ${process.pid}  fights go to ${ratings}`));
