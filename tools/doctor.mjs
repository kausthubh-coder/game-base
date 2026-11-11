// Repairs a checkout and reports each result. Child output stays off stdout for --json.
import { copyFile, access, constants, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { availablePort, formatResults, portForFolder } from './lib/doctor.mjs';

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
  const present = existsSync(join(root, 'node_modules'));
  // Bun reconciles its installed package metadata with the lock, including removed packages.
  const output = await run('bun', ['install', '--frozen-lockfile']);
  const changed = !present || !output.includes('(no changes)');
  return { status: changed ? 'fixed' : 'ok', reason: changed ? 'bun install --frozen-lockfile reconciled node_modules with bun.lock' : 'node_modules matches bun.lock' };
});
let mainRoot;
await check('env', async () => {
  const worktrees = await run('git', ['worktree', 'list', '--porcelain']);
  const first = worktrees.split('\n')[0];
  if (!first.startsWith('worktree ')) throw new Error('git did not report a main checkout');
  mainRoot = await realpath(first.slice(9));
  if (existsSync(join(root, '.env.local'))) return { status: 'ok', reason: '.env.local present' };
  const source = join(mainRoot, '.env.local');
  if (existsSync(source)) {
    await copyFile(source, join(root, '.env.local'), constants.COPYFILE_EXCL);
    return { status: 'fixed', reason: 'copied .env.local from the main checkout' };
  }
  return { status: 'ok', reason: '.env.local absent in both checkouts; game runs without keys' };
});
await check('chrome', async () => {
  // Match tools/shot.mjs. Keep this path in sync when the shared launcher lands.
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  await access(executablePath, constants.X_OK);
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath, headless: true, timeout: 30000 });
  try {
    const page = await browser.newPage();
    await page.goto('data:text/html,<title>doctor</title>');
    if (await page.title() !== 'doctor') throw new Error('headless page did not start');
    return { status: 'ok', reason: `headless Chrome ${browser.version()} starts` };
  } finally { await browser.close(); }
});
await check('port', async () => {
  if (!mainRoot) throw new Error('main checkout could not be determined');
  const main = await realpath(root) === mainRoot;
  const start = portForFolder(root, main);
  const port = await availablePort(start, main);
  return { status: port === start ? 'ok' : 'fixed', reason: `PORT=${port}; export PORT=${port} PLAY_PORT=${port}`, port, env: `export PORT=${port} PLAY_PORT=${port}` };
});
if (!process.argv.includes('--quick')) await check('check', async () => {
  const output = await run('bun', ['run', 'check'], 300000);
  const summary = output.match(/\d+ pass[\s\S]*?Ran \d+ tests[^\n]*/)?.[0].replace(/\s+/g, ' ');
  return { status: 'ok', reason: summary || 'bun run check passed' };
});
if (json) console.log(formatResults(items, true));
process.exitCode = items.some(({ status }) => status === 'FAIL') ? 1 : 0;
