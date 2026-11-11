// Builds the game and sends it, with the world server, to Cloudflare as one unit.
//
//   bun run deploy --dry-run    builds and packages, sends nothing
//   bun run deploy              the real thing. Only from the ship-game skill, or from GitHub on a push to main.
//
// The browser build and the world server get the same version, the commit's short hash, so the server can
// tell an older browser to reload. A tree with uncommitted changes is refused: the hash would lie.
//
// The live copy's settings come from the environment (GitHub Actions) or from .env.live.local on the Mac
// mini. They are never the dev values in .env.local, so a test build here can never point at the live database.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const NEEDED = ['VITE_CONVEX_URL', 'VITE_CONVEX_SITE_URL', 'VITE_CLERK_PUBLISHABLE_KEY'];
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

// A publishable key is `pk_test_` or `pk_live_` and then the Clerk instance's address in base64, ending in `$`.
const clerkIssuer = `https://${atob(setting('VITE_CLERK_PUBLISHABLE_KEY').split('_')[2]).replace(/\$$/, '')}`;

const viteEnv = Object.fromEntries(NEEDED.map((name) => [name, setting(name)]));
run(['bunx', 'vite', 'build', '--mode', 'live'], { ...viteEnv, BUILD: build });

const vars = {
  CLERK_ISSUER: clerkIssuer,
  // The browser shows the world server the same token it shows Convex, and Clerk marks that one for Convex.
  CLERK_AUDIENCE: 'convex',
  CONVEX_URL: setting('VITE_CONVEX_URL'),
  CONVEX_SITE_URL: setting('VITE_CONVEX_SITE_URL'),
};
const args = ['bunx', 'wrangler', 'deploy', '--define', `__BUILD__:"${build}"`, '--message', `main ${build}`];
for (const [name, value] of Object.entries(vars)) args.push('--var', `${name}:${value}`);

// The one secret. Secrets stay on the Worker between deploys, so GitHub does not need to hold it.
const scratch = resolve(ROOT, '.artifacts/deploy');
const secretsFile = resolve(scratch, 'secrets.json');
if (setting('WORLD_SERVER_SECRET')) {
  mkdirSync(scratch, { recursive: true });
  writeFileSync(secretsFile, JSON.stringify({ WORLD_SERVER_SECRET: setting('WORLD_SERVER_SECRET') }), { mode: 0o600 });
  args.push('--secrets-file', secretsFile);
}
if (dryRun) args.push('--dry-run');
try {
  run(args, { CLOUDFLARE_API_TOKEN: cloudflareToken });
} finally {
  rmSync(secretsFile, { force: true });
}
