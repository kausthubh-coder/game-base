import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

export const BETA_STAGES = [
  ['grant', 'grantday', 'earned-landing', 'dist-grantday'],
  ['night', 'firstnight', 'earned-morning', 'dist-firstnight'],
  ['home', 'homestead', 'earned-homestead', 'dist-homestead'],
  ['greywood', 'greywood', 'earned-greywood', 'dist-greywood'],
  ['copper', 'bench-copper', 'earned-copper', 'dist-bench-copper', 'bench-copper'],
  ['gold', 'gold-arches', 'earned-gold', 'dist-bench-copper', 'gold-arches'],
  ['echo', 'echo', 'earned-echo', 'dist-bench-copper', 'echo'],
  ['pump', 'pump', 'earned-pump', 'dist-pump-beta', 'pump'],
  ['uphill', 'uphill', 'earned-uphill', 'dist-uphill-input', 'uphill'],
  ['gallery', 'gallery', 'earned-gallery', 'dist-gallery-resume-beta', 'gallery'],
].map(([id, runner, save, dist, audit], index) => ({ id, runner, save, dist, audit, index }));
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const fileEvidence = path => ({ path: resolve(path), sha256: digest(readFileSync(path)) });
export function readEvidence(entry) {
  if (!entry?.path || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')) throw Error('missing hashed beta evidence');
  const raw = readFileSync(entry.path);
  if (digest(raw) !== entry.sha256) throw Error('changed beta evidence: ' + entry.path);
  return raw;
}

// Every link is checked back to the fresh Begin report, including the actual raw saves.
export function verifyPredecessor(entry, expected, seen = new Set()) {
  if (seen.has(entry?.path)) throw Error('cyclic beta chain');
  seen.add(entry?.path);
  const record = JSON.parse(readEvidence(entry));
  const stage = BETA_STAGES.find(s => s.id === expected);
  if (!stage || record.id !== expected || record.status !== 'PASS' || record.index !== stage.index) throw Error('wrong or incomplete beta predecessor');
  if (!record.runId || !record.revision || !record.runtimeSha256) throw Error('missing beta source identity');
  const replay = JSON.parse(readEvidence(record.replay));
  if (replay.status !== 'PASS' || replay.failure || replay.interrupted || !Array.isArray(replay.errors) || replay.errors.length) throw Error('beta predecessor replay did not pass');
  if (record.revision !== replay.sha || (replay.runnerSha256 && replay.runnerSha256 !== record.runner?.sha256)) throw Error('beta runner/source identity mismatch');
  readEvidence(record.output);
  if (!record.checkpoints?.length) throw Error('missing beta raw checkpoints');
  for (const checkpoint of record.checkpoints) readEvidence(checkpoint);
  readEvidence(record.runner);
  if (!record.dependencies?.length) throw Error('missing beta runner dependency hashes');
  for (const dependency of record.dependencies) readEvidence(dependency);
  if (!record.output.path.endsWith('/' + stage.save + '.save.json')) throw Error('wrong beta output checkpoint');
  if (stage.audit) {
    readEvidence(record.audit);
    if (!record.auditResults?.length) throw Error('missing beta audit results');
    for (const result of record.auditResults) readEvidence(result);
  }
  if (stage.index) {
    const previous = verifyPredecessor(record.predecessor, BETA_STAGES[stage.index - 1].id, seen);
    if (previous.runId !== record.runId || previous.runtimeSha256 !== record.runtimeSha256) throw Error('mixed beta attempts or runtimes');
    if (record.inputHash !== previous.output.sha256 || replay.inputHash !== previous.output.sha256) throw Error('beta predecessor input does not match earned output');
  } else if (record.predecessor || record.inputHash || replay.inputHash) throw Error('beta must start at fresh Begin');
  return record;
}

export function requireBetaHash(actualHash, historicalHash, previous, env = process.env) {
  if (!env.BETA_PREDECESSOR && !env.BETA_PREDECESSOR_SHA256) {
    if (actualHash !== historicalHash) throw Error('requires exact historical earned boundary');
    return true;
  }
  const prior = verifyPredecessor({ path: env.BETA_PREDECESSOR, sha256: env.BETA_PREDECESSOR_SHA256 }, previous);
  if (actualHash !== prior.output.sha256) throw Error('input is not the preceding beta earned output');
  return true;
}

export function runtimeHashes(dir) {
  const files = {};
  function visit(relative = '') {
    for (const entry of readdirSync(resolve(dir, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const path = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files[path] = digest(readFileSync(resolve(dir, path)));
      else throw Error('runtime contains a non-file entry: ' + path);
    }
  }
  visit();
  return files;
}
export const RUNTIME_PATHS = ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'bun.lock'];
export function verifyRuntime(dist, manifestPath, cwd) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(manifest.source ?? '') || !manifest.build || !Object.keys(manifest.build).length) throw Error('missing beta runtime provenance');
  const diff = execFileSync('git', ['diff', manifest.source, '--', ...RUNTIME_PATHS], { encoding: 'utf8', cwd });
  if (diff) throw Error('beta runtime source differs from current product');
  const entries = value => JSON.stringify(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)));
  if (entries(runtimeHashes(dist)) !== entries(manifest.build)) throw Error('beta runtime files changed');
  return manifest;
}

// The coordinator supplies reviewed current-source preflight, never an old acceptance label.
export function verifyBetaPreflight(path, runtimeSha256) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (report.status !== 'PASS' || report.runtimeSha256 !== runtimeSha256) throw Error('beta preflight must match the immutable runtime');
  for (const name of ['rules', 'presentation', 'budgets']) {
    if (report.checks?.[name]?.pass !== true || !report.checks[name].evidence?.length) throw Error('missing beta preflight ' + name);
    for (const evidence of report.checks[name].evidence) readEvidence(evidence);
  }
  if (report.imageReview?.pass !== true || !report.imageReview.images?.length) throw Error('missing reviewed beta preflight images');
  for (const image of report.imageReview.images) readEvidence(image);
  return report;
}

export function verifyBetaEnding(raw) {
  const final = JSON.parse(raw);
  const flags = Object.fromEntries(final.game.flags);
  if (!flags['keystone.1'] || !flags['keystone.2'] || Object.entries(flags).some(([key, value]) => /^keystone\.\d+$/.test(key) && value && !['keystone.1', 'keystone.2'].includes(key)) || flags['vault.seedvault.cleared'] || !flags['quest.gallery.done'] || flags['quest.lights.done'] || flags['quest.seeds.done'] || final.game.systems.ruins.deepest !== 0 || final.game.systems.ruins.machines.some(Boolean)) throw Error('beta did not finish at the Lamp Gallery boundary');
  return true;
}
export function verifyBetaReport(path, { cwd } = {}) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (report.status !== 'PASS' || report.stages?.length !== BETA_STAGES.length) throw Error('requires a complete passing first-half beta replay');
  readEvidence(report.runtime); readEvidence(report.preflight);
  if (report.resumeFrom) readEvidence(report.resumeFrom);
  if (report.runtimeSha256 !== report.runtime.sha256) throw Error('beta runtime identity changed');
  verifyRuntime(report.runtimeDirectory, report.runtime.path, cwd);
  verifyBetaPreflight(report.preflight.path, report.runtimeSha256);
  let previous = null;
  for (const stage of BETA_STAGES) {
    const entry = report.stages[stage.index];
    const record = verifyPredecessor(entry, stage.id);
    if (record.runId !== report.runId || record.runtimeSha256 !== report.runtimeSha256 || JSON.stringify(record.predecessor) !== JSON.stringify(previous)) throw Error('beta report mixes stage chains');
    previous = entry;
  }
  const last = verifyPredecessor(previous, 'gallery');
  if (JSON.stringify(report.earnedSave) !== JSON.stringify(last.output)) throw Error('beta report ending is not the earned Gallery output');
  verifyBetaEnding(readEvidence(last.output));
  return report;
}

export function runnerDependencies(file, toolsRoot = resolve(import.meta.dirname, '..')) {
  const visited = new Set();
  function visit(path) {
    path = resolve(path);
    const rel = relative(toolsRoot, path);
    if (rel.startsWith('..') || visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    const imports = /(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) visit(resolve(dirname(path), match[1]));
  }
  visit(file);
  return [...visited].sort().map(fileEvidence);
}
export function verifyBetaResume(path, runtimeSha256, { cwd } = {}) {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (!['FAILED', 'RUNNING'].includes(report.status) || !Array.isArray(report.stages) || report.stages.length > BETA_STAGES.length) throw Error('resume requires a retained incomplete beta attempt');
  if (report.status === 'RUNNING' && report.ownerPID) {
    let alive = false;
    try { process.kill(report.ownerPID, 0); alive = true; } catch {}
    if (alive) throw Error('cannot resume a beta attempt whose owner is still alive');
  }
  if (!report.runId || report.runtimeSha256 !== runtimeSha256 || report.runtime?.sha256 !== runtimeSha256) throw Error('resume runtime differs from the original attempt');
  readEvidence(report.runtime); readEvidence(report.preflight);
  verifyRuntime(report.runtimeDirectory, report.runtime.path, cwd);
  verifyBetaPreflight(report.preflight.path, runtimeSha256);
  let previous = null;
  for (let index = 0; index < report.stages.length; index++) {
    const entry = report.stages[index], record = verifyPredecessor(entry, BETA_STAGES[index].id);
    if (record.runId !== report.runId || record.runtimeSha256 !== runtimeSha256 || JSON.stringify(record.predecessor) !== JSON.stringify(previous)) throw Error('resume has a mixed or noncontiguous stage prefix');
    previous = entry;
  }
  return report;
}
