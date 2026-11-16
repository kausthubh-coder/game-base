import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { auditLightsConservation } from '../audit-lights.mjs';
import { assertLightsBoundary, LIGHTS_START_SHA, sha256 } from './lights-contract.mjs';
export function lightsResume(directory, root) {
  const dir = resolve(directory),
    read = (name) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
  const result = read('result.json');
  if (result.diagnostic !== false) throw Error('diagnostic cannot authorize earned resume');
  const origin = read('replay-source.json');
  if (origin.root !== LIGHTS_START_SHA) throw Error('unrelated resume root');
  const previous = origin.previous ? lightsResume(origin.previous, root) : null;
  const scopes = read('transactions.json');
  if (!scopes.length) throw Error('missing resume transactions');
  const first = previous?.raw ?? root;
  if (scopes[0].input !== first) throw Error('resume chain input differs');
  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];
    if (i && scope.input !== scopes[i - 1].final) throw Error('Continue chain differs');
    auditLightsConservation(JSON.parse(scope.input), JSON.parse(scope.final), scope.rows);
  }
  const raw = readFileSync(resolve(dir, 'last-earned-checkpoint.save.json'), 'utf8');
  if (scopes.at(-1).final !== raw) throw Error('nearest checkpoint differs from audited boundary');
  assertLightsBoundary(JSON.parse(root), JSON.parse(raw), false);
  const report = JSON.parse(readFileSync(origin.report, 'utf8'));
  if (report.input.sha256 !== LIGHTS_START_SHA || !['failed', 'accepted'].includes(report.status))
    throw Error('unbound chapter report');
  const completed = new Map(previous?.completed ?? []);
  for (const step of report.steps)
    if (step.pass && !step.name.startsWith('preserved-'))
      completed.set(step.name, {
        dir,
        sha256: sha256(readFileSync(resolve(dir, step.name + '.save.json'))),
      });
  return { dir, raw, completed, previous, sha256: sha256(raw) };
}
