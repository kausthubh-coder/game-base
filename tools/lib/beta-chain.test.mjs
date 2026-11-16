import { test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BETA_STAGES, digest, fileEvidence, verifyPredecessor, requireBetaHash, runtimeHashes, verifyRuntime, verifyBetaPreflight, verifyBetaReport, verifyBetaResume, runnerDependencies, runBetaCommand } from './beta-chain.mjs';

const directories = [];
afterEach(() => { for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = mkdtempSync(resolve(tmpdir(), 'game-beta-chain-')); directories.push(dir);
  const put = (path, data) => { path = resolve(dir, path); writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data)); return fileEvidence(path); };
  mkdirSync(resolve(dir, 'src')); writeFileSync(resolve(dir, 'src/test.ts'), 'export const value = 1;');
  const git = args => execFileSync('git', args, { cwd: dir, stdio: 'pipe' }).toString().trim();
  git(['init', '-q']); git(['add', 'src']); git(['-c', 'user.name=Beta test', '-c', 'user.email=beta@example.invalid', 'commit', '-qm', 'Create runtime fixture']);
  const revision = git(['rev-parse', 'HEAD']);
  const runtime = resolve(dir, 'runtime'); mkdirSync(runtime); writeFileSync(resolve(runtime, 'index.html'), '<p>fixture</p>');
  const manifest = put('runtime.json', { source: revision, build: runtimeHashes(runtime) });
  const measurement = put('measurement.json', { status: 'PASS', actual: 1 });
  const image = put('reviewed.png', 'image fixture');
  const preflight = put('preflight.json', { status: 'PASS', runtimeSha256: manifest.sha256, checks: Object.fromEntries(['rules', 'presentation', 'budgets'].map(name => [name, { pass: true, evidence: [measurement] }])), imageReview: { pass: true, images: [image] } });
  const report = { status: 'PASS', runId: 'attempt-a', revision, runtime: manifest, runtimeDirectory: runtime, runtimeSha256: manifest.sha256, preflight, stages: [] };
  let previous = null;
  for (const stage of BETA_STAGES) {
    const stageDir = resolve(dir, stage.id); mkdirSync(stageDir);
    const output = put(stage.id + '/' + stage.save + '.save.json', { game: { flags: [['quest.grantday.done', true], ['keystone.1', true], ['keystone.2', true], ['quest.gallery.done', true]], systems: { ruins: { deepest: 0, machines: [false] } } } });
    const prior = previous && JSON.parse(readFileSync(previous.path));
    const replay = put(stage.id + '/replay.json', { status: 'PASS', sha: revision, errors: [], ...(prior ? { inputHash: prior.output.sha256 } : {}) });
    const runner = put(stage.id + '/runner.mjs', '/* actual runner fixture */');
    const audit = put(stage.id + '/audit.log', 'PASS audited actual bytes');
    const auditResult = put(stage.id + '/audit.json', { status: 'PASS' });
    const entry = put(stage.id + '/passed.json', { id: stage.id, index: stage.index, status: 'PASS', revision, runId: report.runId, runtimeSha256: manifest.sha256, runner, dependencies: [runner], replay, output, checkpoints: [output], inputHash: prior?.output.sha256 ?? null, predecessor: previous, ...(stage.audit ? { audit, auditResults: [auditResult] } : {}) });
    report.stages.push(entry); previous = entry;
  }
  report.earnedSave = JSON.parse(readFileSync(previous.path)).output;
  const reportFile = put('report.json', report);
  return { dir, put, report, reportFile, runtime, manifest, preflight };
}

test('accepts the ten-stage raw-save chain and verifies the retained result', () => {
  const f = fixture();
  expect(verifyBetaReport(f.reportFile.path, { cwd: f.dir }).earnedSave).toEqual(f.report.earnedSave);
  const predecessor = f.report.stages[8], record = verifyPredecessor(predecessor, 'uphill');
  expect(requireBetaHash(record.output.sha256, 'historical', 'uphill', { BETA_PREDECESSOR: predecessor.path, BETA_PREDECESSOR_SHA256: predecessor.sha256 })).toBe(true);
});
test('keeps exact historical gates when no beta chain is supplied', () => {
  expect(requireBetaHash('historical', 'historical', 'pump', {})).toBe(true);
  expect(() => requireBetaHash('new-unproven-save', 'historical', 'pump', {})).toThrow();
});
test('rejects an arbitrary save, a missing predecessor hash and the wrong chapter', () => {
  const f = fixture(), predecessor = f.report.stages[8];
  const env = { BETA_PREDECESSOR: predecessor.path, BETA_PREDECESSOR_SHA256: predecessor.sha256 };
  expect(() => requireBetaHash(digest('arbitrary'), null, 'uphill', env)).toThrow();
  expect(() => requireBetaHash('x', null, 'uphill', { BETA_PREDECESSOR: predecessor.path })).toThrow();
  expect(() => verifyPredecessor(predecessor, 'pump')).toThrow();
});
test('rejects a changed earned save anywhere in the chain', () => {
  const f = fixture();
  const first = JSON.parse(readFileSync(f.report.stages[0].path)); writeFileSync(first.output.path, 'changed');
  expect(() => verifyBetaReport(f.reportFile.path, { cwd: f.dir })).toThrow();
});
test('rejects a failed actual replay even when its new hash is recorded', () => {
  const f = fixture(), entry = f.report.stages[0], record = JSON.parse(readFileSync(entry.path));
  record.replay = f.put('grant/replay.json', { status: 'BLOCKED', errors: [] });
  const updated = f.put('grant/passed.json', record);
  expect(() => verifyPredecessor(updated, 'grant')).toThrow();
});
test('rejects a truncated beta report and an altered audit result', () => {
  const f = fixture();
  f.put('partial.json', { ...f.report, stages: f.report.stages.slice(0, 9) });
  expect(() => verifyBetaReport(resolve(f.dir, 'partial.json'), { cwd: f.dir })).toThrow();
  const copper = JSON.parse(readFileSync(f.report.stages[4].path)); writeFileSync(copper.auditResults[0].path, '{}');
  expect(() => verifyBetaReport(f.reportFile.path, { cwd: f.dir })).toThrow();
});
test('rejects completing a later keystone, even with an updated output hash', () => {
  const f = fixture(), entry = f.report.stages[9], record = JSON.parse(readFileSync(entry.path));
  const ending = JSON.parse(readFileSync(record.output.path)); ending.game.flags.push(['keystone.3', true]);
  record.output = f.put('gallery/earned-gallery.save.json', ending); record.checkpoints = [record.output];
  f.report.stages[9] = f.put('gallery/passed.json', record); f.report.earnedSave = record.output;
  const report = f.put('report.json', f.report);
  expect(() => verifyBetaReport(report.path, { cwd: f.dir })).toThrow(/Lamp Gallery boundary/);
});
test('rejects missing preflight checks, unreviewed images and changed runtime bytes/source', () => {
  const f = fixture(), preflight = JSON.parse(readFileSync(f.preflight.path));
  expect(verifyBetaPreflight(f.preflight.path, f.manifest.sha256).status).toBe('PASS');
  delete preflight.checks.budgets; f.put('bad-preflight.json', preflight);
  expect(() => verifyBetaPreflight(resolve(f.dir, 'bad-preflight.json'), f.manifest.sha256)).toThrow();
  preflight.imageReview.pass = false; f.put('bad-review.json', preflight);
  expect(() => verifyBetaPreflight(resolve(f.dir, 'bad-review.json'), f.manifest.sha256)).toThrow();
  expect(verifyRuntime(f.runtime, f.manifest.path, f.dir).source).toBe(f.report.revision);
  writeFileSync(resolve(f.runtime, 'index.html'), 'changed runtime');
  expect(() => verifyRuntime(f.runtime, f.manifest.path, f.dir)).toThrow();
  writeFileSync(resolve(f.runtime, 'index.html'), '<p>fixture</p>'); writeFileSync(resolve(f.dir, 'src/test.ts'), 'changed product');
  expect(() => verifyRuntime(f.runtime, f.manifest.path, f.dir)).toThrow();
});

test('resumes only a contiguous verified passing prefix and preserves its attempt identity', () => {
  const f = fixture();
  const failed = f.put('failed.json', { ...f.report, status: 'FAILED', stages: f.report.stages.slice(0, 4) });
  const resumed = verifyBetaResume(failed.path, f.manifest.sha256, { cwd: f.dir });
  expect(resumed.runId).toBe('attempt-a');
  expect(resumed.stages).toEqual(f.report.stages.slice(0, 4));
  expect(() => verifyBetaResume(failed.path, digest('other runtime'), { cwd: f.dir })).toThrow();
  const skipped = f.put('skipped.json', { ...resumed, stages: [f.report.stages[0], f.report.stages[2]] });
  expect(() => verifyBetaResume(skipped.path, f.manifest.sha256, { cwd: f.dir })).toThrow();
  const running = f.put('running.json', { ...resumed, status: 'RUNNING', ownerPID: process.pid });
  expect(() => verifyBetaResume(running.path, f.manifest.sha256, { cwd: f.dir })).toThrow();
});
test('hashes transitive input helpers and rejects a helper changed after acceptance', () => {
  const f = fixture();
  f.put('grant/leaf.mjs', 'export const input = 1;');
  f.put('grant/middle.mjs', "export { input } from './leaf.mjs';");
  const runner = f.put('grant/runner.mjs', "import { input } from './middle.mjs';");
  const dependencies = runnerDependencies(runner.path, f.dir);
  expect(dependencies.map(e => e.path.split('/').at(-1))).toEqual(['leaf.mjs', 'middle.mjs', 'runner.mjs']);
  const record = JSON.parse(readFileSync(f.report.stages[0].path)); record.runner = runner; record.dependencies = dependencies;
  const entry = f.put('grant/passed.json', record);
  expect(verifyPredecessor(entry, 'grant').id).toBe('grant');
  f.put('grant/leaf.mjs', 'export const input = 2;');
  expect(() => verifyPredecessor(entry, 'grant')).toThrow();
});

test('rejects a passing stage grafted from another attempt', () => {
  const f = fixture(), entry = f.report.stages[1], record = JSON.parse(readFileSync(entry.path));
  record.runId = 'another-attempt';
  const graft = f.put('night/passed.json', record);
  expect(() => verifyPredecessor(graft, 'night')).toThrow();
});

test('the CLI runner receives a clean output directory while admission and live logs are retained outside it', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'game-beta-command-')); directories.push(dir);
  const stageOut = resolve(dir, '08-pump'); mkdirSync(stageOut);
  const input = resolve(dir, 'preceding.save.json'); writeFileSync(input, 'earned preceding bytes');
  const script = resolve(dir, 'strict-runner.mjs');
  writeFileSync(script, `
    import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
    const args = process.argv.slice(2);
    const out = args[args.indexOf('--out') + 1];
    const input = args[args.indexOf('--save') + 1];
    if (!args.includes('--no-build')) throw Error('unexpected build');
    console.log('runner imported');
    await new Promise(resolve => setTimeout(resolve, 30));
    if (readdirSync(out).length) throw Error('Choose an empty --out directory');
    if (readFileSync(input, 'utf8') !== 'earned preceding bytes') throw Error('wrong earned input');
    writeFileSync(out + '/replay.json', JSON.stringify({status:'PASS'}));
    console.log('PASS strict runner');
  `);
  const log = await runBetaCommand([script, '--no-build', '--out', stageOut, '--save', input], { chainOut: dir, stageOut, id: 'pump', admission: { admitted: true }, cwd: dir, onOutput: () => {} });
  expect(readdirSync(stageOut)).toEqual(['replay.json']);
  expect(JSON.parse(readFileSync(resolve(dir, 'pump-admission.json')))).toEqual({ admitted: true });
  expect(readFileSync(log.path, 'utf8')).toBe('runner imported\nPASS strict runner\n');
  expect(log.path).toBe(resolve(dir, 'pump-runner.log'));
});
