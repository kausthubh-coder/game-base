import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { availablePort, portForFolder, portIsFree } from './doctor.mjs';

export function checkoutPaths(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const common = resolve(root, git('rev-parse', '--git-common-dir'));
  const trees = git('worktree', 'list', '--porcelain').split('\n').filter((line) => line.startsWith('worktree ')).map((line) => line.slice(9));
  return { common, trees, main: trees[0] };
}

export async function claimPort(root, { common, trees, main }, isFree = portIsFree) {
  const lock = join(common, 'game-ports.lock');
  const registry = join(common, 'game-ports.json');
  try { mkdirSync(lock); } catch { throw new Error('port reservations are locked; retry setup, or inspect game-ports.lock in the common git directory'); }
  try {
    const ports = existsSync(registry) ? JSON.parse(readFileSync(registry, 'utf8')) : {};
    for (const path of Object.keys(ports)) if (!trees.includes(path)) delete ports[path];
    if (ports[root] !== undefined) {
      if (!await isFree(ports[root])) throw new Error(`reserved port ${ports[root]} is occupied; stop only your own process, then rerun setup`);
    } else {
      const used = new Set(Object.values(ports));
      ports[root] = await availablePort(portForFolder(root, root === main), root === main, async (port) => !used.has(port) && await isFree(port));
    }
    writeFileSync(registry + '.tmp', JSON.stringify(ports, null, 2) + '\n');
    renameSync(registry + '.tmp', registry);
    return ports[root];
  } finally { rmSync(lock, { recursive: true }); }
}

export function devEnvIsSafe(text) {
  return !/^\s*(?:export\s+)?(?:CONVEX_DEPLOY_KEY|CLOUDFLARE_API_TOKEN)\s*=/m.test(text)
    && !/^(?!\s*#).*\b(?:rare-lion-700|prod:[^\s"']*)/m.test(text);
}

export function devEnvForCheckout(text) {
  const clean = text.split('\n').filter((line) => !/^\s*(?:export\s+)?(?:CONVEX_DEPLOY_KEY|CLOUDFLARE_API_TOKEN)\s*=/.test(line)).join('\n');
  if (!devEnvIsSafe(clean)) throw new Error('dev env contains production settings; use dev-only .env.local');
  return clean;
}
