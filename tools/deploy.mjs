// Builds the game and sends its files to Cloudflare.
//
//   bun run deploy --dry-run    builds and packages, sends nothing
//   bun run deploy              the real thing. Only from the ship-game skill, or from GitHub on a push to main.
//
// The deploy is named after the commit's short hash. A tree with uncommitted changes is refused: the hash would lie.
//
// The live copy's settings come from the environment (GitHub Actions) or from .env.live.local on the Mac
// mini. They are never the dev values in .env.local, so a test build here can never point at the live database.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function readEnvFile(name) {
  const path = resolve(ROOT, name), found = {};
  if (!existsSync(path)) return found;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) found[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return found;
}
const live = readEnvFile('.env.live.local');
const dev = readEnvFile('.env.local');
// The live file wins. Bun loads .env.local into this process by itself, so the environment here may hold
// the dev values; on GitHub there are no files and the environment holds the live ones.
const setting = (name) => live[name] || process.env[name] || '';

const NEEDED = ['VITE_CONVEX_URL', 'VITE_CLERK_PUBLISHABLE_KEY'];
const missing = NEEDED.filter((name) => !setting(name));
if (missing.length > 0) {
  console.error(`The live copy's settings are missing: ${missing.join(', ')}. Set them in the environment or in .env.live.local.`);
  process.exit(1);
}
if (dev.VITE_CONVEX_URL && setting('VITE_CONVEX_URL') === dev.VITE_CONVEX_URL) {
  console.error(`Refusing to deploy: the database would be the dev one, ${dev.VITE_CONVEX_URL}. The live settings belong in .env.live.local.`);
  process.exit(1);
}
// Wrangler reads its token from the environment. On the Mac mini it is kept in .env.local.
const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN || dev.CLOUDFLARE_API_TOKEN || '';
if (!dryRun && !cloudflareToken) {
  console.error('CLOUDFLARE_API_TOKEN is not set, in the environment or in .env.local.');
  process.exit(1);
}

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
console.log(`version ${build}, database ${setting('VITE_CONVEX_URL')}${dryRun ? ' (dry run: nothing is sent)' : ''}`);

const viteEnv = Object.fromEntries(NEEDED.map((name) => [name, setting(name)]));
run(['bunx', 'vite', 'build', '--mode', 'live'], viteEnv);

// The playtest copy: the branch `playtest`, built as a second game into dist/playtest and served at
// /playtest/. It is a build of its own, so a bug there cannot reach the game at /. See docs/playtest.md.
// With no such branch, here or on GitHub, there is no playtest copy and the step is skipped.
function playtestCommit() {
  const local = git('rev-parse', '--verify', '--quiet', 'refs/heads/playtest');
  if (local) return local;
  const fetched = spawnSync('git', ['fetch', '--depth', '1', 'origin', 'playtest'], { cwd: ROOT, encoding: 'utf8' });
  return fetched.status === 0 ? git('rev-parse', 'FETCH_HEAD') : '';
}
const playtest = playtestCommit();
if (playtest) {
  const checkout = resolve(ROOT, '.artifacts/deploy/playtest');
  const inCheckout = (cmd, env = {}) => {
    console.log(`playtest$ ${cmd.join(' ')}`);
    const done = spawnSync(cmd[0], cmd.slice(1), { cwd: checkout, stdio: 'inherit', env: { ...process.env, ...env } });
    if (done.status !== 0) process.exit(done.status ?? 1);
  };
  if (existsSync(resolve(checkout, '.git'))) inCheckout(['git', 'checkout', '--force', '--detach', playtest]);
  else run(['git', 'worktree', 'add', '--force', '--detach', checkout, playtest]);
  inCheckout(['bun', 'install', '--frozen-lockfile']);
  inCheckout(['bunx', 'vite', 'build', '--mode', 'live'], viteEnv);
  cpSync(resolve(checkout, 'dist'), resolve(ROOT, 'dist/playtest'), { recursive: true });
  console.log(`playtest copy ${playtest.slice(0, 7)} is in dist/playtest`);
} else {
  console.log('no playtest branch: the live copy has no /playtest/');
}

const args = ['bunx', 'wrangler', 'deploy', '--message', `main ${build}`];
if (dryRun) args.push('--dry-run');
run(args, { CLOUDFLARE_API_TOKEN: cloudflareToken });
