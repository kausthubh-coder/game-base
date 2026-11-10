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
console.log(problems.length ? problems.join('\n') : `boundaries: ${files.length} .sim.ts files, no problems`);
process.exit(problems.length ? 1 : 0);
