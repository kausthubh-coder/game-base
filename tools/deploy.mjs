// Builds the game and sends it, with the world server, to Cloudflare as one unit.
//
//   bun run deploy --dry-run    builds and packages, sends nothing
//   bun run deploy              the real thing. Only from the ship-game skill, when Kausthubh says ship.
//
// The browser build and the world server get the same version, the commit's short hash, so the server can
// tell an older browser to reload. A tree with uncommitted changes is refused: the hash would lie.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function run(cmd, env = {}) {
  console.log(`$ ${cmd.join(' ')}`);
  const done = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
  if (done.status !== 0) process.exit(done.status ?? 1);
}
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout.trim();

if (git('status', '--porcelain') !== '') {
  console.error('Uncommitted changes. Commit or stash them first, so the version names what is deployed.');
  process.exit(1);
}
const build = git('rev-parse', '--short', 'HEAD');
console.log(`version ${build}${dryRun ? ' (dry run: nothing is sent)' : ''}`);

run(['bun', 'run', 'build'], { BUILD: build });
run(['bunx', 'wrangler', 'deploy', '--define', `__BUILD__:"${build}"`, ...(dryRun ? ['--dry-run'] : [])]);
