// The save follows a player between devices: two browsers with nothing shared but the account, signed in
// through Clerk's real box, the save going up from one and coming down on the other through Convex.
//
//   bun tools/play-cloud-save.mjs [--url https://...] [--no-build] [--port <n>]
//
// 1. The laptop signs in from the title, plays, and its save reaches the account.
// 2. The phone, with nothing saved, signs in from the title and gets that save: Continue opens it.
// 3. The phone plays on and sends it. The laptop, waiting in its menu, fetches it and starts again from it.
// 4. The phone goes offline and plays; the laptop plays and sends. Back online the phone is asked which save
//    to keep, keeps the account's, and its own is kept aside.
//
// It makes a fresh Clerk test user for the run and deletes it at the end. Its profile and save stay in the
// dev database. Needs `.env.local` with Clerk's development keys and the dev Convex address. Without --url
// it builds the game and serves it on PLAY_PORT. Pictures and each step's page text go to
// .artifacts/cloud-save/. Exit 1 when a step fails.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '.artifacts/cloud-save');
mkdirSync(out, { recursive: true });

const env = (() => {
  try {
    return Object.fromEntries(readFileSync(resolve(root, '.env.local'), 'utf8').split('\n').flatMap((line) => {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      return m ? [[m[1], m[2].replace(/^["']|["']$/g, '')]] : [];
    }));
  } catch {
    return {};
  }
})();
const secret = process.env.CLERK_SECRET_KEY || env.CLERK_SECRET_KEY || '';
if (!secret.startsWith('sk_test_') || !(env.VITE_CLERK_PUBLISHABLE_KEY && env.VITE_CONVEX_URL)) {
  console.log('skip: .env.local needs a Clerk development secret key, the publishable key and the Convex address');
  process.exit(2);
}

async function clerk(method, path, body) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Clerk ${method} ${path.split('?')[0]}: HTTP ${response.status}`);
  return response.json();
}

// ---- the game, built and served here unless --url names a deployed copy
let url = opt('url', null);
let serverPid = null;
if (!url) {
  const port = Number(opt('port', process.env.PLAY_PORT || 5577));
  if (!args.includes('--no-build')) {
    const build = spawnSync('bun', ['run', 'build'], { cwd: root, stdio: 'inherit' });
    if (build.status !== 0) { console.error('FAIL: bun run build'); process.exit(1); }
  }
  // The server prints its pid, and it is stopped by that pid, never by port.
  const server = spawn('bun', ['tools/serve.mjs', 'dist', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  serverPid = await new Promise((done, fail) => {
    let text = '';
    server.stdout.on('data', (chunk) => {
      text += chunk;
      const pid = /pid (\d+)/.exec(text);
      if (pid) done(Number(pid[1]));
    });
    server.on('exit', (code) => fail(new Error(`the server stopped with code ${code}. Is port ${port} taken?`)));
  });
  url = `http://localhost:${port}/`;
  console.log(`serving dist on ${url}  pid ${serverPid}`);
}

const email = `cloud.save.${Date.now().toString(36)}+clerk_test@example.com`;
const password = `Game-test-${crypto.randomUUID()}!`;
const user = await clerk('POST', '/users', { email_address: [email], password, skip_password_checks: true });
console.log(`test user ${email}`);

const browser = await launchChrome();
const errors = [];
const results = [];
const wait = (page, fn, arg, timeout = 60_000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });

async function device(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  // A device that is offline on purpose logs its failed connections. Those are not the game's errors.
  page.on('console', (message) => { if (message.type() === 'error' && !page.offline) errors.push(`${name}: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`${name}: ${error}`));
  page.name = name;
  page.offline = false;
  page.loads = 0;
  page.on('load', () => { page.loads++; });
  return page;
}

/** Runs `fn` in the page until it is true, across the page loading again. */
async function until(page, fn, arg, timeout = 120_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await page.evaluate(fn, arg)) return;
    } catch {
      // The page is loading again.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`timed out waiting for ${fn.toString().slice(0, 80)}`);
}

/** Waits for the page to load again after `before` loads, and for the game to be up in it. */
async function reloaded(page, before) {
  const end = Date.now() + 60_000;
  while (page.loads <= before && Date.now() < end) await new Promise((done) => setTimeout(done, 250));
  if (page.loads <= before) throw new Error(`${page.name} did not load again`);
  await until(page, () => '__game' in window && !document.querySelector('#loading'));
}

/** True once the save in the page matches the account's: the mark has this save's time. */
const synced = (page) => until(page, () => {
  try {
    const mark = JSON.parse(localStorage.getItem('greenhollow.save.synced') ?? 'null');
    const save = JSON.parse(localStorage.getItem('greenhollow.save') ?? 'null');
    return mark !== null && save !== null && mark.here === save.at;
  } catch {
    return false;
  }
}, undefined, 60_000);

async function evidence(page, label) {
  await page.screenshot({ path: resolve(out, `${label}.png`) }).catch(() => {});
  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  writeFileSync(resolve(out, `${label}.txt`), text);
}

async function step(n, title, pages, fn) {
  // A step stands on the ones before it.
  if (results.some((r) => !r.pass)) return false;
  try {
    const detail = await fn();
    results.push({ n, title, pass: true, detail });
    console.log(`PASS ${n} ${title}${detail ? `  ${detail}` : ''}`);
    for (const page of pages) await evidence(page, `${n}-${page.name}`);
    return true;
  } catch (error) {
    results.push({ n, title, pass: false, detail: String(error) });
    console.log(`FAIL ${n} ${title}: ${error}`);
    for (const page of pages) await evidence(page, `failure-${n}-${page.name}`);
    return false;
  }
}

/** Opens the game and waits for its title. */
async function open(page) {
  await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await titleUp(page);
}
const titleUp = (page) => wait(page, () => '__game' in window && !document.querySelector('#loading') && document.querySelector('[data-key="title:new"]') !== null, undefined, 120_000);

/** The Account panel, from the title or from the game. */
async function account(page) {
  if (await page.locator('.acct').isVisible()) return;
  const fromTitle = page.locator('[data-key="title:account"]');
  if (await fromTitle.isVisible()) {
    await fromTitle.click();
    await page.locator('.acct').waitFor();
    return;
  }
  // In a game: Escape opens the pause menu. Right after a new game the opening may take the first press,
  // and the menu draws itself again as it opens, so this tries a few times.
  const button = page.locator('[data-key="pause:account"]');
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await button.isVisible())) await page.keyboard.press('Escape');
    try {
      await button.click({ timeout: 3_000 });
      await page.locator('.acct').waitFor({ timeout: 3_000 });
      return;
    } catch {
      // Not there yet, or it moved: look again.
    }
  }
  throw new Error('the pause menu\'s Account button could not be clicked');
}

/** Clerk's own box: the email, the password, then the code Clerk asks a new device for. Test addresses take 424242. */
async function signIn(page) {
  await account(page);
  await page.locator('[data-key="sign-in"]:not([disabled])').click();
  const identifier = page.locator('input[name="identifier"]');
  await identifier.waitFor({ timeout: 60_000 });
  await identifier.fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const field = page.locator('input[name="password"]');
  await field.waitFor();
  await field.fill(password);
  // The code may be typed only once Clerk has sent it: its `prepare_..._factor` call has answered.
  const prepared = page.waitForResponse((r) => /prepare_(first|second)_factor/.test(r.url()) && r.request().method() === 'POST' && r.ok(), { timeout: 60_000 }).catch(() => null);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const signedIn = page.locator('[data-key="sign-out"]');
  const code = page.locator('input[autocomplete="one-time-code"]').first();
  await Promise.race([signedIn.waitFor({ timeout: 60_000 }), code.waitFor({ timeout: 60_000 })]);
  if (await code.isVisible()) {
    await prepared;
    await code.fill('424242');
    const more = page.getByRole('button', { name: 'Continue', exact: true });
    if (await more.isVisible().catch(() => false)) await more.click().catch(() => {});
    await signedIn.waitFor({ timeout: 60_000 });
  }
}

/** What the account panel says about the save, once it says something settled. */
const saveText = (page) => page.locator('[data-part="save"]').innerText();
async function panelSays(page, pattern) {
  await account(page);
  await wait(page, (source) => new RegExp(source).test(document.querySelector('[data-part="save"]')?.textContent ?? ''), pattern.source);
  return (await saveText(page)).split('\n').find((line) => pattern.test(line));
}

/** Closes every panel and waits for the game to run. */
async function play(page) {
  for (let i = 0; i < 4 && (await page.evaluate(() => document.querySelector('.gu-panel') !== null)); i++) await page.keyboard.press('Escape');
  await until(page, () => window.__game.started && !window.__game.state().paused);
}

/**
 * Puts a device down: its rules stop stepping, so it writes no save of its own until it is picked up. The
 * Account panel does not pause the game, and a device left playing writes every 60 seconds, which the
 * other device would rightly fetch, or ask about.
 */
const putDown = (page) => page.evaluate(() => window.__game.manual(true));

const logs = (page) => page.evaluate(() => window.__game.view.game.systems.inventory.count('oak_log'));
/** Changes the bag, so the save is told apart by what is in it, and writes the save. */
async function gather(page, count) {
  await page.evaluate((n) => { window.__game.give('oak_log', n); window.__game.save(); }, count);
  return logs(page);
}

let laptop, phone, laptopLogs, phoneLogs;
try {
  laptop = await device('laptop');
  phone = await device('phone');

  await step(1, 'the laptop signs in from the title, plays, and its save reaches the account', [laptop], async () => {
    await open(laptop);
    await signIn(laptop);
    await panelSays(laptop, /Your account has no save yet/);
    await laptop.keyboard.press('Escape');
    await laptop.locator('[data-key="title:new"]').click();
    await wait(laptop, () => window.__game.started);
    laptopLogs = await gather(laptop, 7);
    await putDown(laptop);
    // Opening the panel writes the game and looks for a change at once, so this does not wait for the timer.
    await account(laptop);
    await synced(laptop);
    return await panelSays(laptop, /In your account: day/);
  });

  await step(2, 'the phone, with nothing saved, signs in and gets the laptop\'s save', [phone], async () => {
    await open(phone);
    if (await phone.evaluate(() => window.__game.hasSave())) throw new Error('the phone had a save before it signed in');
    const loads = phone.loads;
    await signIn(phone);
    // The save comes down and the page comes back to the title, now with a save to continue.
    await reloaded(phone, loads);
    await titleUp(phone);
    if (!(await phone.evaluate(() => window.__game.hasSave()))) throw new Error('the phone has no save after the reload');
    await phone.locator('[data-key="title:continue"]').click();
    await wait(phone, () => window.__game.started);
    await putDown(phone);
    const got = await logs(phone);
    if (got !== laptopLogs) throw new Error(`the phone has ${got} logs, the laptop saved ${laptopLogs}`);
    return `${got} logs`;
  });

  await step(3, 'the phone plays on, and the laptop waiting in its menu picks it up', [phone, laptop], async () => {
    // The laptop sits in its Account panel, put down, writing nothing meanwhile.
    const loads = laptop.loads;
    phoneLogs = await gather(phone, 5);
    await account(phone);
    await synced(phone);
    await putDown(phone);
    // The phone's save reaches the laptop through the live query. The laptop fetches it and reloads into the game.
    // It may reload twice: the phone also sent the save it wrote as its game started, and the laptop follows
    // each save in turn. So this waits for the one with the phone's logs, across reloads.
    await reloaded(laptop, loads);
    await until(laptop, (n) => window.__game.started && window.__game.view.game.systems.inventory.count('oak_log') === n, phoneLogs, 60_000)
      .catch(async () => { throw new Error(`the laptop has ${await logs(laptop).catch(() => '?')} logs, the phone saved ${phoneLogs}`); });
    await synced(laptop);
    return `${phoneLogs} logs`;
  });

  await step(4, 'apart, both play; back online the phone is asked, and keeps the account\'s', [laptop, phone], async () => {
    // The phone stays put down: its only change is the one below.
    phone.offline = true;
    await phone.context().setOffline(true);
    await gather(phone, 1);
    // The laptop signs in again by itself after its reload. Its own change goes up once it has.
    await play(laptop);
    const laptopNow = await gather(laptop, 2);
    await account(laptop);
    await synced(laptop);
    await phone.context().setOffline(false);
    await account(phone);
    await phone.locator('[data-key="keep-there"]').waitFor({ timeout: 90_000 });
    phone.offline = false;
    const asked = (await saveText(phone)).split('\n').find((line) => /Which one/.test(line));
    await evidence(phone, '4-phone-asked');
    const loads = phone.loads;
    await phone.locator('[data-key="keep-there"]').click();
    await reloaded(phone, loads);
    await wait(phone, () => window.__game.started);
    const got = await logs(phone);
    if (got !== laptopNow) throw new Error(`the phone has ${got} logs, the account's save has ${laptopNow}`);
    const aside = await phone.evaluate(() => JSON.parse(localStorage.getItem('greenhollow.save.before-restore') ?? 'null'));
    if (!aside) throw new Error('the phone\'s own save was not kept aside');
    return `${got} logs; it asked: ${asked}`;
  });
} finally {
  await browser.close();
  if (serverPid) process.kill(serverPid);
  await clerk('DELETE', `/users/${user.id}`).catch((error) => console.log(`the test user was not deleted: ${error}`));
}

writeFileSync(resolve(out, 'results.json'), JSON.stringify({ url, results, errors }, null, 2));
const passed = results.filter((r) => r.pass).length;
if (errors.length) console.log(`console errors:\n  ${errors.join('\n  ')}`);
const ok = passed === 4 && errors.length === 0;
console.log(ok ? 'every step passed' : `${passed} of 4 steps passed, ${errors.length} console error(s)`);
process.exit(ok ? 0 : 1);
