// Fresh Begin through Lamp Gallery, with exact earned bytes between existing runners.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BETA_STAGES, digest, fileEvidence, readEvidence, requireBetaHash, verifyPredecessor, verifyRuntime, verifyBetaPreflight, verifyBetaEnding, verifyBetaReport, verifyBetaResume, runnerDependencies, runBetaCommand } from './lib/beta-chain.mjs';
import { sample, canStartHeavy } from './resource-status.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const args = process.argv.slice(2);
if (args.includes('--verify-report')) {
  try {
    const path = args[args.indexOf('--verify-report') + 1];
    if (!path || path.startsWith('--')) throw Error('--verify-report requires the earned chain report');
    verifyBetaReport(resolve(path));
    console.log('PASS retained first-half beta replay: ' + path);
  } catch (error) { console.error(String(error.stack ?? error)); process.exitCode = 1; }
  process.exit(process.exitCode ?? 0);
}
if (args.includes('--help')) {
  console.log('bun tools/play-beta.mjs --out <new-directory> --runtime <immutable-dist> --runtime-manifest <json> --preflight <reviewed-json> --active-heavy-jobs 0 [--grant-output <fresh-passing-grant-directory>] [--resume-report <failed-chain-report>]\nSee docs/beta-replay.md. This ends after Lamp Gallery; full Act 1 remains unfinished.');
  process.exit(0);
}
function option(name, required = true) {
  const index = args.indexOf(name), value = args[index + 1];
  if (index < 0 && !required) return null;
  if (index < 0 || !value || value.startsWith('--')) throw Error(name + ' requires a value');
  return value;
}
let child;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; child?.kill('SIGTERM'); });
const out = resolve(option('--out'));
if (existsSync(out) && readdirSync(out).length) throw Error('beta needs a new empty output directory');
mkdirSync(out, { recursive: true });
const reportPath = resolve(out, 'report.json');
const report = { scope: 'fresh Begin through Lamp Gallery; later Act 1 unfinished', status: 'RUNNING', ownerPID: process.pid, runId: crypto.randomUUID(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), stages: [] };
const persist = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
persist();
try {
  if (option('--active-heavy-jobs') !== '0') throw Error('reserve the sole heavy-browser slot and supply --active-heavy-jobs 0');
  const runtime = resolve(option('--runtime'));
  const manifest = resolve(option('--runtime-manifest'));
  const preflight = resolve(option('--preflight'));
  report.runtime = fileEvidence(manifest);
  report.runtimeSha256 = report.runtime.sha256;
  report.runtimeDirectory = runtime;
  verifyRuntime(runtime, manifest);
  verifyBetaPreflight(preflight, report.runtimeSha256);
  report.preflight = fileEvidence(preflight);
  const grantOutput = option('--grant-output', false);
  const resumePath = option('--resume-report', false);
  if (resumePath) {
    if (grantOutput) throw Error('choose a retained beta prefix or the fresh Grantday adoption');
    const prior = verifyBetaResume(resolve(resumePath), report.runtimeSha256);
    report.runId = prior.runId;
    report.stages = [...prior.stages];
    report.resumeFrom = fileEvidence(resolve(resumePath));
  }
  // Never replace or delete another retained runtime directory.
  for (const dist of new Set(BETA_STAGES.map(s => s.dist))) {
    const target = resolve(root, dist);
    if (existsSync(target)) verifyRuntime(target, manifest);
    else symlinkSync(runtime, target, 'dir');
  }
  persist();
  async function command(commandArgs, stageOut, stage, label, env, admission) {
    if (interrupted) throw Error('beta interrupted');
    const result = await runBetaCommand(commandArgs, { chainOut: out, stageOut, id: stage.id, label, env, cwd: root, admission, onChild: value => { child = value; } });
    if (interrupted) throw Error('beta interrupted');
    return result;
  }
  let predecessor = report.stages.at(-1) ?? null;
  for (const stage of BETA_STAGES.slice(report.stages.length)) {
    readEvidence(report.runtime); readEvidence(report.preflight);
    verifyRuntime(runtime, manifest);
    const stageOut = stage.index === 0 && grantOutput ? resolve(grantOutput) : resolve(out, String(stage.index + 1).padStart(2, '0') + '-' + stage.id);
    if (!(stage.index === 0 && grantOutput)) mkdirSync(stageOut);
    report.current = stage.id; persist();
    const env = { ...process.env, BETA_RUNTIME_MANIFEST: manifest };
    delete env.BETA_PREDECESSOR; delete env.BETA_PREDECESSOR_SHA256;
    const prior = predecessor && verifyPredecessor(predecessor, BETA_STAGES[stage.index - 1].id);
    if (prior) {
      env.BETA_PREDECESSOR = predecessor.path;
      env.BETA_PREDECESSOR_SHA256 = predecessor.sha256;
    }
    const runner = resolve(root, 'tools/play-' + stage.runner + '.mjs');
    if (stage.index === 0 && grantOutput) {
      const replay = JSON.parse(readFileSync(resolve(stageOut, 'replay.json'), 'utf8'));
      const originalRunner = execFileSync('git', ['show', replay.sha + ':tools/play-grantday.mjs']);
      for (const dependency of runnerDependencies(runner)) {
        const path = dependency.path.slice(root.length + 1);
        const original = execFileSync('git', ['show', replay.sha + ':' + path]);
        if (digest(original) !== dependency.sha256) throw Error('adopted fresh Begin used different runner helpers: ' + path);
      }
      if (digest(originalRunner) !== digest(readFileSync(runner))) throw Error('adopted fresh Begin used different Grantday runner bytes');
      // Same product source is required even when only tool/doc commits followed the Begin.
      if (execFileSync('git', ['diff', replay.sha, '--', 'src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'bun.lock'], { encoding: 'utf8' })) throw Error('adopted fresh Begin used a different product');
    } else {
      const resources = await sample();
      if (!canStartHeavy(resources, 0)) throw Error('resource admission held before ' + stage.id);
      const commandArgs = ['tools/play-' + stage.runner + '.mjs', '--no-build', '--out', stageOut];
      if (prior) commandArgs.push('--save', prior.output.path);
      if (stage.index >= 7) commandArgs.push('--dist', stage.dist, '--active-heavy-jobs', '0');
      await command(commandArgs, stageOut, stage, 'runner', env, resources);
    }
    const replay = fileEvidence(resolve(stageOut, 'replay.json'));
    const replayData = JSON.parse(readEvidence(replay));
    if (replayData.status !== 'PASS' || replayData.failure || replayData.interrupted || !Array.isArray(replayData.errors) || replayData.errors.length) throw Error(stage.id + ' replay failed');
    if (prior) requireBetaHash(replayData.inputHash, null, BETA_STAGES[stage.index - 1].id, env);
    const output = fileEvidence(resolve(stageOut, stage.save + '.save.json'));
    const flags = Object.fromEntries(JSON.parse(readEvidence(output)).game.flags);
    if (!stage.index && !flags['quest.grantday.done']) throw Error('fresh Begin did not finish Grant day');
    let audit, auditResults;
    if (stage.audit) {
      audit = await command(['tools/audit-' + stage.audit + '.mjs', stageOut], stageOut, stage, 'audit', env);
      const files = stage.id === 'copper' ? ['audit.json'] : stage.id === 'uphill' ? ['transaction-audit.json'] : stage.id === 'gallery' ? ['independent-audit.json'] : ['raw-audit.json'];
      auditResults = files.map(file => fileEvidence(resolve(stageOut, file)));
    }
    const record = { id: stage.id, index: stage.index, status: 'PASS', runId: report.runId, revision: replayData.sha, runtimeSha256: report.runtimeSha256, runner: fileEvidence(runner), dependencies: [...runnerDependencies(runner), ...(stage.audit ? runnerDependencies(resolve(root, 'tools/audit-' + stage.audit + '.mjs')) : [])], replay, output, checkpoints: readdirSync(stageOut).filter(name => name.endsWith('.save.json')).map(name => fileEvidence(resolve(stageOut, name))), inputHash: prior?.output.sha256 ?? null, predecessor, ...(audit ? { audit, auditResults } : {}) };
    const recordPath = resolve(out, stage.id + '-passed.json');
    writeFileSync(recordPath, JSON.stringify(record, null, 2) + '\n');
    predecessor = fileEvidence(recordPath);
    verifyPredecessor(predecessor, stage.id);
    report.stages.push(predecessor); persist();
    console.log('PASS beta stage ' + stage.id + ': ' + output.path);
  }
  const last = verifyPredecessor(predecessor, 'gallery');
  verifyBetaEnding(readEvidence(last.output));
  readEvidence(report.runtime); readEvidence(report.preflight);
  verifyRuntime(runtime, manifest);
  verifyBetaPreflight(preflight, report.runtimeSha256);
  report.earnedSave = last.output;
  report.status = 'PASS'; persist();
  verifyBetaReport(reportPath);
  console.log('PASS first-half beta: ' + reportPath);
} catch (error) {
  report.status = 'FAILED'; report.error = String(error.stack ?? error); persist();
  console.error(report.error); process.exitCode = 1;
}
