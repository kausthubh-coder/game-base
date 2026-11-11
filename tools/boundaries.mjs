// The one structural rule: a file that ends in .sim.ts is game rules, and must run on a server one day.
// It may import only other .sim.ts files, src/content and src/engine/types, events and world-query.
// It may not touch Three.js, the page or Web Audio.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if (e.name.endsWith('.sim.ts')) files.push(join(dir, e.name));
  }
})(join(root, 'src'));

const problems = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const where = relative(root, file);
  for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^'"]*['"]([^'"]+)['"]/gm)) {
    const from = m[2];
    const ok = from.endsWith('.sim.ts') || from.includes('/content/') || /engine\/(types|events|world-query)\.ts$/.test(from);
    if (!ok) problems.push(`${where}: imports ${from}. A .sim.ts file may import only .sim.ts files, src/content and engine/types, events or world-query.`);
  }
  for (const m of text.matchAll(/\b(document|window|AudioContext|requestAnimationFrame|THREE)\b/g)) {
    problems.push(`${where}: uses ${m[1]}. Move that code to a .view.ts or .ui.ts file.`);
  }
}

// The world server's rule: server/ and src/engine/net/ run on Cloudflare, where there is no page. They never
// import Three.js, a .view.ts or a .ui.ts file, and never touch the page. The server itself imports only its
// own files, src/engine/net and what a .sim.ts file may import, so nothing else can ride in behind those.
// src/engine/net/ is read by the browser too, so it imports only itself, with no Bun and no Workers calls.
// server/test/ holds tests and scripts that run in Bun: they keep the first rule only.
const serverFiles = [];
for (const dir of ['server', 'src/engine/net']) {
  (function walk(at) {
    for (const e of readdirSync(at, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(at, e.name));
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) serverFiles.push(join(at, e.name));
    }
  })(join(root, dir));
}
for (const file of serverFiles) {
  const text = readFileSync(file, 'utf8');
  const where = relative(root, file);
  const isTest = where.startsWith('server/test/') || where.endsWith('.test.ts');
  const isNet = where.startsWith('src/engine/net/');
  // `import ... from 'x'`, `import 'x'` and `export ... from 'x'`. Nothing in between may end a statement.
  for (const m of text.matchAll(/^\s*(?:import\s+[^'";]*|export\s+[^'";]*\bfrom\s*)['"]([^'"]+)['"]/gm)) {
    const from = m[1];
    if (from === 'three' || from.startsWith('three/') || from.endsWith('.view.ts') || from.endsWith('.ui.ts')) {
      problems.push(`${where}: imports ${from}. The world server and src/engine/net never import Three.js, a .view.ts or a .ui.ts file.`);
      continue;
    }
    if (isTest) continue;
    const to = from.startsWith('.') ? relative(root, resolve(file, '..', from)) : from;
    const ok = isNet
      ? to.startsWith('src/engine/net/')
      : to === 'cloudflare:workers' || (to.startsWith('server/') && !to.startsWith('server/test/')) || to.startsWith('src/engine/net/')
        || to.endsWith('.sim.ts') || to.includes('/content/') || /^src\/engine\/(types|events|world-query)\.ts$/.test(to);
    if (!ok) {
      problems.push(isNet
        ? `${where}: imports ${from}. A file in src/engine/net may import only other files in src/engine/net.`
        : `${where}: imports ${from}. The world server may import only its own files, src/engine/net, .sim.ts files, src/content and engine/types, events or world-query.`);
    }
  }
  for (const m of text.matchAll(/\b(document|window|AudioContext|requestAnimationFrame|THREE)\b/g)) {
    problems.push(`${where}: uses ${m[1]}. The world server has no page.`);
  }
  if (isNet && !isTest) {
    for (const m of text.matchAll(/\b(Bun|process)\.|['"](bun|node|cloudflare):/g)) {
      problems.push(`${where}: uses ${m[1] ?? m[2]}. A file in src/engine/net runs in the browser and on the server, so it calls neither Bun nor Workers.`);
    }
  }
}
console.log(problems.length ? problems.join('\n') : `boundaries: ${files.length} .sim.ts files and ${serverFiles.length} world server files, no problems`);
process.exit(problems.length ? 1 : 0);
