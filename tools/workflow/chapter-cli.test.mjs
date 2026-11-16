import { test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('the chapter command rejects incomplete acceptance and records a completed adapter run', () => {
  const root = mkdtempSync(join(tmpdir(), 'chapter-cli-'));
  const cli = resolve(import.meta.dirname, '../chapter.mjs');
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init', '-q'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'baseline');
    const module = join(root, 'chapter.mjs');
    const evidence = join(root, 'result.json'); writeFileSync(evidence, '{"earned":true}');
    writeFileSync(module, 'export const id="gallery"; export const requirements=[]; export async function play(run) {}');
    const incomplete = spawnSync('bun', [cli, module], { cwd: root, encoding: 'utf8' });
    expect(incomplete.status).toBe(1); expect(incomplete.stderr).toContain('did not complete acceptance');
    writeFileSync(module, `export const id='gallery'; export const requirements=[];
      export async function play(run) {
        await run.preflight(['rules','presentation','budgets'].map(name=>({name,run:async()=>true})));
        await run.step('earn',async()=>2,value=>value===2);
        for(const name of ['earned-save','state','continue','inventory','desktop-high','desktop-low','phone-high','phone-low']) run.evidence(name,${JSON.stringify(evidence)});
        run.accept();
      }`);
    const completed = spawnSync('bun', [cli, module], { cwd: root, encoding: 'utf8' });
    expect(completed.status).toBe(0); expect(completed.stdout).toContain('accepted gallery');
    const reports = readdirSync(join(root, '.artifacts/chapters')).map(file => JSON.parse(readFileSync(join(root, '.artifacts/chapters', file), 'utf8')));
    expect(reports.map(report => report.status).sort()).toEqual(['accepted', 'failed']);
  } finally { rmSync(root, { recursive: true }); }
});
