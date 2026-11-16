// Inspects a checkout and reports each result. Child output stays off stdout for --json.
import { access, constants, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { formatResults, portIsFree } from './lib/doctor.mjs';

import { checkoutPaths, devEnvIsSafe, devEnvForCheckout } from './lib/checkout.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = process.argv.includes('--json');
const items = [];
async function run(command, args, timeout = 120000) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolveRun(output.trim());
      else reject(new Error(`${command} ${args.join(' ')} exited ${code ?? 'after timeout'}\n${output.trim()}`));
    });
  });
}
async function check(item, task) {
  try { items.push({ item, ...await task() }); }
  catch (error) { items.push({ item, status: 'FAIL', reason: String(error.message).replace(/\s+/g, ' ') }); }
  if (!json) console.log(formatResults(items.slice(-1)));
}
await check('dependencies', async () => {
  await access(join(root, 'node_modules/.bin/vite'), constants.X_OK);
  if (!existsSync(join(root, 'node_modules/.game-lock')) || await readFile(join(root, 'node_modules/.game-lock'), 'utf8') !== await readFile(join(root, 'bun.lock'), 'utf8')) throw new Error('dependencies differ from lockfile; bun tools/setup.mjs');
  return { status: 'ok', reason: 'dependencies match bun.lock' };
});
await check('env', async () => {
  if (existsSync(join(root, '.env.local'))) {
    const text = await readFile(join(root, '.env.local'), 'utf8');
    if (!devEnvIsSafe(root === checkoutPaths(root).main ? devEnvForCheckout(text) : text)) throw new Error('dev env contains production settings or deployment credentials');
  }
  return { status: 'ok', reason: 'dev env checked; no backend started or deployed; signed-in cloud saves use the configured shared backend' };
});
await check('chrome', async () => {
  const { launchChrome } = await import('./lib/chrome.mjs');
  const browser = await launchChrome();
  try { return { status: 'ok', reason: `Chrome ${browser.version()} starts` }; }
  finally { await browser.close(); }
});
await check('port', async () => {
  const config = JSON.parse(await readFile(join(root, '.artifacts/checkout.json'), 'utf8'));
  if (config.root !== root || !Number.isInteger(config.port)) throw new Error('checkout config missing or copied; bun tools/setup.mjs');
  const paths = checkoutPaths(root);
  const reservations = JSON.parse(await readFile(join(paths.common, 'game-ports.json'), 'utf8'));
  if (reservations[root] !== config.port) throw new Error('port reservation missing; bun tools/setup.mjs');
  if (!await portIsFree(config.port)) throw new Error(`reserved port ${config.port} is occupied; stop only your own process by PID`);
  return { status: 'ok', reason: `PORT=${config.port}; export PORT=${config.port} PLAY_PORT=${config.port}`, port: config.port };
});
await check('main', async () => {
  const behind = await run('git', ['rev-list', '--count', 'HEAD..origin/main']);
  return { status: 'ok', reason: `${behind} commits behind origin/main` };
});
if (!process.argv.includes('--quick')) await check('check', async () => {
  const output = await run('bun', ['run', 'check'], 300000);
  const summary = output.match(/\d+ pass[\s\S]*?Ran \d+ tests[^\n]*/)?.[0].replace(/\s+/g, ' ');
  return { status: 'ok', reason: summary || 'bun run check passed' };
});
if (json) console.log(formatResults(items, true));
process.exitCode = items.some(({ status }) => status === 'FAIL') ? 1 : 0;
