import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, rmSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { checkoutPaths } from './lib/checkout.mjs';
import { portIsFree } from './lib/doctor.mjs';

const root = resolve(import.meta.dirname, '..');
try {
  if (!process.argv[2]) throw new Error('bun tools/remove-worktree.mjs <merged-worktree>; check live T3 threads first');
  const target = resolve(process.argv[2]);
  const paths = checkoutPaths(root);
  if (!paths.trees.includes(target) || target === root || target === paths.main) throw new Error('choose another registered worktree, excluding main');
  execFileSync('git', ['merge-base', '--is-ancestor', execFileSync('git', ['-C', target, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), 'origin/main'], { cwd: root });
  if (execFileSync('git', ['-C', target, 'status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('worktree has uncommitted files');
  const config = join(target, '.artifacts/checkout.json');
  if (existsSync(config) && !await portIsFree(JSON.parse(readFileSync(config, 'utf8')).port)) throw new Error('stop this checkout\'s processes by their recorded PID first');
  const link = join(target, '.claude/skills');
  const junction = process.platform === 'win32' && existsSync(link) && lstatSync(link).isSymbolicLink();
  if (junction) rmSync(link);
  execFileSync('git', ['worktree', 'remove', ...(junction ? ['--force'] : []), target], { cwd: root, stdio: 'inherit' });
  console.log(`removed ${target}; setup prunes its port reservation on the next run`);
} catch (error) { console.error(`FAIL remove: ${error.message}`); process.exitCode = 1; }
