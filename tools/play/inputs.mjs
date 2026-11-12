// The inputs `do`, `act`, `film` and recordings play, one at a time, as a person or through the debug door.

import { findWrong, order } from './screen.mjs';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const DOOR = ['newGame', 'teleport', 'give', 'skipTo', 'advance', 'setTime', 'setCamera', 'look', 'interact', 'talkThrough', 'manual', 'turn'];

// A serializable state predicate. Human mode only reads the debug door.
function checkState(s) {
  const value = s.path.split('.').reduce((v, k) => v?.[k], window.__game.state());
  if ('equals' in s) return JSON.stringify(value) === JSON.stringify(s.equals);
  if ('min' in s) return value >= s.min;
  if ('max' in s) return value <= s.max;
  return Boolean(value);
}

// Runs in the page: is this text in a piece of interface a player can read now? A piece mostly scrolled out
// of its box, or with something on top of it, is on the page and not on the screen. (0.6 is READABLE in screen.mjs.)
function textShown({ text, want }) {
  const found = window.__playScreen().items.some((item) => item.text.includes(text) && (item.shown ?? 1) >= 0.6 && !item.coveredBy);
  return found === want;
}

// Runs in the page: the middle of the pressable thing the screen list names so, or null.
function pressableAt(text) {
  const item = window.__playScreen().items.find((it) => it.press && !it.disabled && it.text === text);
  return item ? { x: item.box.x + item.box.w / 2, y: item.box.y + item.box.h / 2 } : null;
}

/** Clicks what the screen list calls `text`: a button by its accessible name, or any pressable thing (a tab, a link) by the name `look` printed. */
async function clickNamed(page, text, timeout = 10000) {
  const button = page.getByRole('button', { name: text, exact: true });
  const until = Date.now() + timeout;
  for (;;) {
    if (await button.count() > 0) return button.first().click({ timeout: Math.max(1000, until - Date.now()) });
    const at = await page.evaluate(pressableAt, text);
    if (at) return page.mouse.click(at.x, at.y);
    if (Date.now() > until) throw new Error(`nothing to press named "${text}" was on the screen within ${timeout} ms`);
    await delay(100);
  }
}

/** `act KeyE` is short for a press; anything else is one JSON input or a JSON list of them. */
export function parseInputs(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('no input given');
  if (!/^[[{]/.test(trimmed)) return [{ type: 'press', key: trimmed }];
  const value = JSON.parse(trimmed);
  return Array.isArray(value) ? value : [value];
}

/** Where a tap or a swipe lands: its x and y, or the middle of the button with that text. */
async function point(page, step) {
  if (step.text === undefined) return { x: step.x, y: step.y };
  const box = await page.getByRole('button', { name: step.text, exact: true }).boundingBox();
  if (!box) throw new Error(`no button "${step.text}" on screen to tap`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Plays one input. `mode` is door or human; `blind` forbids reading the state (`check`, `hold` with `until`)
 * unless `replaying`; `touch` allows `tap` and `swipe`.
 */
export async function play(page, step, { mode, blind = false, replaying = false, touch = false, cdp }) {
  const timeout = step.timeout || 10000;
  if (blind && !replaying && (step.type === 'check' || (step.type === 'hold' && step.until))) {
    throw new Error('a blind session cannot read the state: use {"type":"see"} or {"type":"gone"} instead');
  }
  if (step.type === 'door') {
    if (mode !== 'door') throw new Error('human mode forbids door writes');
    if (!DOOR.includes(step.method)) throw new Error('unknown door command');
    await page.evaluate(async (s) => { await window.__game[s.method](...(s.args || [])); }, step);
  } else if (step.type === 'press') await page.keyboard.press(step.key);
  else if (step.type === 'hold') {
    await page.keyboard.down(step.key);
    try { if (step.until) await page.waitForFunction(checkState, step.until, { timeout: step.timeout || 15000 }); else await delay(step.ms ?? 250); }
    finally { await page.keyboard.up(step.key); }
  } else if (step.type === 'click') {
    if (step.text) await clickNamed(page, step.text, step.timeout);
    else await page.mouse.click(step.x, step.y, { button: step.button || 'left' });
  } else if (step.type === 'mouseDown') await page.mouse.down({ button: step.button || 'left' });
  else if (step.type === 'mouseUp') await page.mouse.up({ button: step.button || 'left' });
  else if (step.type === 'wheel') await page.mouse.wheel(step.x || 0, step.y || 0);
  else if (step.type === 'move') await page.mouse.move(step.x, step.y);
  else if (step.type === 'wait') await delay(step.ms ?? 250);
  else if (step.type === 'check') await page.waitForFunction(checkState, step, { timeout });
  else if (step.type === 'see' || step.type === 'gone') {
    try { await page.waitForFunction(textShown, { text: step.text, want: step.type === 'see' }, { timeout, polling: 100 }); }
    catch (error) {
      if (!/Timeout/i.test(String(error))) throw error;
      throw new Error(step.type === 'see' ? `"${step.text}" was not on the screen within ${timeout} ms` : `"${step.text}" was still on the screen after ${timeout} ms`);
    }
  } else if (step.type === 'clean') {
    // Nothing a machine can tell looks wrong: no piece cut, off the screen, covered or too small. `allow` lets kinds through.
    const screen = await page.evaluate(() => window.__playScreen());
    const wrong = findWrong(order(screen.items), screen.viewport).filter((w) => !(step.allow ?? []).includes(w.kind));
    if (wrong.length) throw new Error(`the screen is not clean: ${wrong.slice(0, 4).map((w) => `${w.kind} "${w.what}" (${w.why})`).join('; ')}${wrong.length > 4 ? `; and ${wrong.length - 4} more` : ''}`);
  } else if (step.type === 'type') await page.keyboard.type(String(step.text), { delay: step.delay ?? 20 });
  else if (step.type === 'tap' || step.type === 'swipe') {
    if (!touch) throw new Error(`${step.type} needs a touch session: start --touch`);
    const at = await point(page, step);
    if (step.type === 'tap') await page.touchscreen.tap(at.x, at.y);
    else {
      // One finger down, slid by dx, dy over the first half of ms, held, then lifted: how a thumb works the move stick.
      const ms = step.ms ?? 600, moves = 8, to = { x: at.x + (step.dx || 0), y: at.y + (step.dy || 0) };
      const touchAt = (p) => [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(at) });
      for (let i = 1; i <= moves; i++) {
        await delay(ms / 2 / moves);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchAt({ x: at.x + ((to.x - at.x) * i) / moves, y: at.y + ((to.y - at.y) * i) / moves }) });
      }
      await delay(ms / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  } else throw new Error(`unknown input type ${step.type}`);
}
