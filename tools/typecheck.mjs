// Type-checks the shared code plus one feature, so one agent's unfinished work cannot fail another's check.
//   bun tools/typecheck.mjs <feature>      (no name checks the whole repo)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
const root = resolve(import.meta.dirname, '..');
let project = resolve(root, 'tsconfig.json');
if (name) {
  const dir = resolve(root, 'node_modules/.tmp');
  mkdirSync(dir, { recursive: true });
  project = resolve(dir, `tsconfig.${name}.json`);
  writeFileSync(project, JSON.stringify({
    extends: resolve(root, 'tsconfig.json'),
    include: ['src/engine', 'src/content', `src/features/${name}`, `demos/${name}`].map((p) => resolve(root, p)),
  }));
}
const run = spawnSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', project], { stdio: 'inherit' });
process.exit(run.status ?? 1);
