import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const CHAPTER_EVIDENCE = ['earned-save', 'state', 'continue', 'inventory', 'desktop-high', 'desktop-low', 'phone-high', 'phone-low'];

/** One attempt owns its evidence. Existing checkpoints are immutable inputs. */
export function createChapterRun({ id, revision, out, checkpoint, requirements }) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !revision || !Array.isArray(requirements) || new Set(requirements).size !== requirements.length) {
    throw new Error('chapter needs an id, revision, and unique acceptance requirements');
  }
  requirements = [...new Set([...CHAPTER_EVIDENCE, ...requirements])];
  const input = checkpoint ? readFileSync(checkpoint) : null;
  mkdirSync(out, { recursive: true });
  const path = join(out, `${id}-${Date.now()}-${crypto.randomUUID()}.json`);
  const report = { id, revision, input: input ? { path: checkpoint, sha256: hash(input) } : null, status: 'preflight', checks: [], steps: [], evidence: {} };
  const persist = () => writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  const fail = (error) => { report.status = 'failed'; report.error = String(error.message ?? error); persist(); throw error; };
  persist();
  return {
    path,
    startingSave: input?.toString('utf8') ?? null,
    abort: fail,
    async preflight(checks) {
      if (report.status !== 'preflight' || !checks?.length) throw new Error('preflight requires checks and a new attempt');
      try {
        for (const name of ['rules', 'presentation', 'budgets']) {
          if (checks.filter((check) => check.name === name).length !== 1) throw new Error(`preflight requires exactly one ${name} check`);
        }
        for (const { name, run } of checks) {
          if (await run() !== true) throw new Error(`preflight failed: ${name}`);
          report.checks.push(name); persist();
        }
        report.status = 'ready'; persist();
      } catch (error) { fail(error); }
    },
    async step(name, run, verify) {
      if (!['ready', 'replaying'].includes(report.status)) throw new Error('pass preflight before replay');
      report.status = 'replaying'; persist();
      try {
        const value = await run();
        if (await verify(value) !== true) throw new Error(`step failed: ${name}`);
        report.steps.push({ name, pass: true }); persist();
        return value;
      } catch (error) { report.steps.push({ name, pass: false }); fail(error); }
    },
    evidence(name, file) {
      if (!['ready', 'replaying'].includes(report.status) || !requirements.includes(name)) throw new Error(`unexpected evidence: ${name}`);
      const bytes = readFileSync(file);
      if (name === 'earned-save' && checkpoint && realpathSync(file) === realpathSync(checkpoint)) throw new Error('write the earned save to a new checkpoint file');
      if (!bytes.length) throw new Error(`empty evidence: ${name}`);
      report.evidence[name] = { path: file, sha256: hash(bytes) }; persist();
    },
    accept() {
      if (report.status === 'accepted') return path;
      try {
        if (report.status !== 'replaying' || !report.steps.length) throw new Error('no successful earned replay');
        if (input && hash(readFileSync(checkpoint)) !== hash(input)) throw new Error('the starting checkpoint changed');
        for (const name of requirements) {
          const entry = report.evidence[name];
          if (!entry || hash(readFileSync(entry.path)) !== entry.sha256) throw new Error(`missing or changed evidence: ${name}`);
        }
        report.status = 'accepted'; persist();
        return path;
      } catch (error) { fail(error); }
    },
  };
}
