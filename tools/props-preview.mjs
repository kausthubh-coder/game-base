// Looks at one prop, in one command: builds the props demo, serves it on a free port, takes the pictures and stops.
//   bun tools/props-preview.mjs <kind>
// It writes, into .artifacts/props/:
//   only-<kind>.png         every variant on the turntable by day, each with its triangle count and budget
//   only-<kind>-night.png   the same at night, to see what glows
//   sheet-<group>.png       the contact sheet of the kind's group, to see it beside its neighbors at one scale
// Exits 1 when the build fails or the page logged an error, such as a kind that is not in src/content/props.ts.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const kind = process.argv[2];
if (!kind) { console.error('usage: bun tools/props-preview.mjs <kind>'); process.exit(2); }
const root = resolve(import.meta.dirname, '..');
const run = (...command) => spawnSync('bun', command, { cwd: root, stdio: 'inherit' }).status ?? 1;

if (run('tools/demo.mjs', 'build', 'props') !== 0) process.exit(1);

const base = resolve(root, 'dist/demos/props');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  try {
    let path = join(base, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(base)) throw new Error('outside');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end('not found');
  }
});
// Port 0 asks for any free port, so this never meets another agent's server.
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const shots = spawn('bun', ['tools/props-shots.mjs', '--only', kind, '--url', `http://127.0.0.1:${server.address().port}/`], { cwd: root, stdio: 'inherit' });
const status = await new Promise((done) => shots.on('exit', (code) => done(code ?? 1)));
server.close();
process.exit(status);
