import { execFileSync } from 'node:child_process';

export function checkFormalSync(root, coverage) {
  execFileSync('git', ['cat-file', '-e', `${coverage.commit}^{commit}`], { cwd: root, stdio: 'pipe' });
  const changed = execFileSync('git', ['diff', '--name-only', coverage.commit, '--', ...coverage.paths], { cwd: root, encoding: 'utf8' }).trim();
  if (changed) throw new Error(`formal verification needs a sync review:\n${changed}\nRead maintain-formal-verification-skill and verify-build-stroke; update coverage.json only after checking the current code.`);
}
