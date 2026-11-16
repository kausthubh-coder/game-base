import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createChapterRun } from './workflow/chapter.mjs';

const file = process.argv[2];
if (!file || file === '--help') {
  console.log('bun tools/chapter.mjs <chapter-module.mjs> [starting-save]\nThe module exports id, requirements, and async play(run). See the verify-chapter skill.');
  process.exit(file ? 0 : 2);
}
let run;
try {
  const chapter = await import(pathToFileURL(resolve(file)));
  run = createChapterRun({
    id: chapter.id,
    requirements: chapter.requirements,
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    out: resolve('.artifacts/chapters'),
    checkpoint: process.argv[3],
  });
  console.log(`Chapter attempt: ${run.path}`);
  await chapter.play(run);
  if (JSON.parse(readFileSync(run.path, 'utf8')).status !== 'accepted') throw new Error('chapter did not complete acceptance');
  console.log(`accepted ${chapter.id}: ${run.path}`);
} catch (error) {
  if (run) { try { run.abort(error); } catch {} }
  console.error(`FAIL chapter: ${error.message}`);
  process.exitCode = 1;
}
