import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLightsStart } from './lights-contract.mjs';
import {
  runLightsPresentation,
  bindLightsPresentation,
  validateLightsPresentation,
} from './lights-preflight.mjs';
import { runtimeHashes, checkBudgets } from './gallery.mjs';
import { earnLights } from './lights-route.mjs';
export const id = 'lights';
export const requirements = [
  'preflight',
  'image-review',
  'transactions',
  'runtime',
  'middle-continue',
];
export async function play(run) {
  validateLightsStart(run.startingSave);
  const out = resolve('.artifacts/lights-chapter/chapter-' + Date.now());
  mkdirSync(out, { recursive: true });
  const dist = process.env.LIGHTS_DIST ?? '.artifacts/lights-chapter/runtime-phone-f1780eb9';
  const runtimePath =
    process.env.LIGHTS_RUNTIME_MANIFEST ??
    '.artifacts/lights-chapter/runtime-build-02/runtime-manifest.json';
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
  for (const key of ['src', 'public'])
    if (
      runtime[key] !==
      execFileSync('git', ['rev-parse', 'HEAD:' + key], { encoding: 'utf8' }).trim()
    )
      throw Error('runtime source changed: ' + key);
  if (execFileSync('git', ['diff', 'HEAD', '--', 'src', 'public'], { encoding: 'utf8' }).trim())
    throw Error('dirty runtime source');
  if (JSON.stringify(runtime.files) !== JSON.stringify(runtimeHashes(dist)))
    throw Error('full emitted runtime mismatch');
  writeFileSync(resolve(out, 'runtime.json'), JSON.stringify(runtime, null, 2));
  let presentation;
  async function command(args, name) {
    const child = spawn('bun', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    for (const stream of [child.stdout, child.stderr])
      stream.on('data', (data) => {
        log += String(data);
        writeFileSync(resolve(out, name + '.log'), log);
      });
    const code = await new Promise((done, fail) => {
      child.on('error', fail);
      child.on('exit', done);
    });
    if (code !== 0) throw Error(name + ' failed');
    return true;
  }
  await run.preflight([
    {
      name: 'rules',
      run: async () => {
        await command(
          [
            'test',
            'tools/chapters/lights.test.mjs',
            'tools/workflow',
            'src/game/farms',
            'src/game/machines',
            'src/game/settlement',
            'src/game/goods',
          ],
          'rules',
        );
        return true;
      },
    },
    {
      name: 'presentation',
      run: async () => {
        const reuse = process.env.LIGHTS_PREFLIGHT;
        if (reuse) presentation = validateLightsPresentation(reuse, dist);
        else {
          const dir = resolve(out, 'presentation');
          mkdirSync(dir);
          const views = await runLightsPresentation({ raw: run.startingSave, out: dir, dist });
          presentation = bindLightsPresentation(dir, dist, views);
          console.log('Inspect complete full-size view set and bind image-review.json at ' + dir);
          if (!existsSync(resolve(dir, 'image-review.json')))
            throw Error('image review required: ' + dir);
          presentation = validateLightsPresentation(dir, dist);
        }
        writeFileSync(resolve(out, 'preflight.json'), JSON.stringify(presentation, null, 2));
        return true;
      },
    },
    { name: 'budgets', run: () => checkBudgets(presentation.views) },
  ]);
  const earned = resolve(out, 'earned');
  await earnLights(run, {
    raw: run.startingSave,
    out: earned,
    dist,
    resume: process.env.LIGHTS_RESUME,
  });
  for (const [name, file] of Object.entries({
    'earned-save': 'earned/earned-lights.save.json',
    state: 'earned/home.json',
    continue: 'earned/final-home-continued.save.json',
    inventory: 'earned/independent-audit.json',
    transactions: 'earned/transactions.json',
    runtime: 'runtime.json',
    preflight: 'preflight.json',
    'middle-continue': 'earned/middle-farm-continued.save.json',
  }))
    run.evidence(name, resolve(out, file));
  const reviewPath = resolve(
    process.env.LIGHTS_PREFLIGHT ?? resolve(out, 'presentation'),
    'image-review.json',
  );
  run.evidence('image-review', reviewPath);
  for (const { dir, quality } of presentation.views) {
    const name = dir.includes('desktop') ? 'desktop' : 'phone';
    run.evidence(name + '-' + quality, resolve(dir, 'cleanup.png'));
  }
  run.accept();
}
