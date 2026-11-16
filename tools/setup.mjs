import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, copyFileSync, symlinkSync, writeFileSync, statSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { checkoutPaths, claimPort, devEnvIsSafe, devEnvForCheckout } from './lib/checkout.mjs';

const root = resolve(import.meta.dirname, '..');
try {
  const paths = checkoutPaths(root);
  const lock = join(root, 'bun.lock');
  const stamp = join(root, 'node_modules/.game-lock');
  const digest = readFileSync(lock, 'utf8');
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== digest) {
    execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: root, stdio: 'inherit' });
    writeFileSync(stamp, digest);
  }
  const env = join(root, '.env.local');
  const source = existsSync(env) ? env : join(paths.main, '.env.local');
  if (existsSync(source)) {
    const text = readFileSync(source, 'utf8');
    const clean = devEnvForCheckout(text);
    if (existsSync(env) && root !== paths.main && text !== clean) {
      writeFileSync(join(root, `.env.before-workflow-${Date.now()}.local`), text, { mode: 0o600, flag: 'wx' });
      writeFileSync(env, clean, { mode: 0o600 });
      console.log('fixed env: saved the original in an ignored .env.before-workflow-*.local file and removed deployment credentials from dev env');
    }
    if (!existsSync(env)) writeFileSync(env, clean, { mode: 0o600 });
  }
  const port = await claimPort(root, paths);
  mkdirSync(join(root, '.artifacts'), { recursive: true });
  writeFileSync(join(root, '.artifacts/checkout.json'), JSON.stringify({ root, port }, null, 2) + '\n');
  mkdirSync(join(root, '.claude'), { recursive: true });
  const link = join(root, '.claude/skills');
  if (!existsSync(link)) symlinkSync(join(root, '.agents/skills'), link, process.platform === 'win32' ? 'junction' : 'dir');
  if (realpathSync(link) !== realpathSync(join(root, '.agents/skills'))) throw new Error('.claude/skills points elsewhere; repair that link');
  execFileSync('bun', ['tools/doctor.mjs', '--quick'], { cwd: root, stdio: 'inherit' });
  console.log(`ready: port ${port}; bun tools/dev.mjs; local saves isolated by origin; no backend is started or deployed`);
} catch (error) { console.error(`FAIL setup: ${error.message}`); process.exitCode = 1; }
