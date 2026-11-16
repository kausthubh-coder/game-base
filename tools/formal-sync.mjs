import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkFormalSync } from './workflow/formal-sync.mjs';
const root = resolve(import.meta.dirname, '..');
try {
  const coverage = JSON.parse(readFileSync(resolve(root, '.agents/skills/verify-build-stroke/coverage.json'), 'utf8'));
  checkFormalSync(root, coverage);
  console.log(`in sync: build-stroke code matches reviewed commit ${coverage.commit}`);
} catch (error) { console.error(`FAIL formal sync: ${error.message}`); process.exitCode = 1; }
