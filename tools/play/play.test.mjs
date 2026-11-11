import { describe, expect, test } from 'bun:test';
import { changes, clockText, heading, now } from './diff.mjs';
import { cellDifference, jumps, pick, sheetLayout } from './film.mjs';
import { formatLook } from './format.mjs';
import { parseInputs } from './inputs.mjs';
import { findWrong, order } from './screen.mjs';

const base = () => ({
  started: true, paused: false,
  player: { x: 0, y: 20, z: 0, busy: false, inWater: false },
  clock: { day: 1, timeOfDay: 0.25, seconds: 0 },
  quests: [
    { id: 'plot', state: 'active', steps: [{ id: 'meet', done: false, have: 0, need: 1 }, { id: 'wood', done: false, have: 0, need: 5 }] },
    { id: 'roof', state: 'hidden', steps: [{ id: 'ask', done: false, have: 0, need: 1 }] },
  ],
  tracked: 'plot', bag: [], held: null, talk: null, prompt: null, failed: {}, viewErrors: [],
});

describe('changes', () => {
  test('nothing changed says nothing', () => {
    expect(changes(base(), base())).toEqual([]);
  });

  test('the first look says so', () => {
    expect(changes(null, base())).toEqual(['first look of this session']);
  });

  test('says how far and which way the hero went, north being -z', () => {
    const after = base(); after.player = { ...after.player, x: 3, z: -4 };
    expect(changes(base(), after)).toEqual(['hero moved 5 m north-east']);
  });

  test('prompt, talk, quest steps, bag, held item, time, pause, errors and failed systems', () => {
    const before = base();
    before.bag = [{ id: 'seed', count: 3 }, { id: 'stone', count: 2 }];
    const after = base();
    after.paused = true;
    after.prompt = 'Talk to Tamsin';
    after.talk = { npc: 'tamsin', name: 'Tamsin', text: 'Morning.', choices: ['Hello', 'Bye'] };
    after.quests[0].steps[0].done = true;
    after.quests[0].steps[1].have = 2;
    after.bag = [{ id: 'seed', count: 1 }, { id: 'axe', count: 1 }];
    after.held = 'axe';
    after.clock = { day: 1, timeOfDay: 0.25 + 30 / 1440, seconds: 1 };
    after.viewErrors = ['grass: shader failed'];
    after.failed = { crops: 'TypeError: x is undefined' };
    expect(changes(before, after)).toEqual([
      'paused',
      'prompt: "Talk to Tamsin"',
      'talk: Tamsin: "Morning." [Hello | Bye]',
      'quest plot: step meet done',
      'quest plot: wood 2/5',
      'bag +axe x1',
      'bag -seed x2, stone x2',
      'holding axe',
      '30 min of game time passed, now 06:30',
      'view error: grass: shader failed',
      'system failed: crops: TypeError: x is undefined',
    ]);
  });

  test('a hidden quest is news only when it shows', () => {
    const shown = base(); shown.quests[1].state = 'active';
    expect(changes(base(), shown)).toEqual(['new quest roof (active)']);
  });

  test('talk ended and prompt gone', () => {
    const before = base(); before.talk = { npc: 'tamsin', name: 'Tamsin', text: 'Bye.', choices: [] }; before.prompt = 'Talk';
    expect(changes(before, base())).toEqual(['prompt gone', 'talk ended']);
  });
});

describe('now', () => {
  test('the HUD facts', () => {
    const s = base(); s.prompt = 'Talk to Tamsin'; s.held = 'axe';
    expect(now(s)).toEqual(['hero at x 0, z 0 (y 20)', 'day 1, 06:00', 'prompt: "Talk to Tamsin"', 'quest plot: meet', 'holding axe']);
  });
  test('at the title', () => {
    expect(now({ ...base(), started: false })).toEqual(['at the title']);
  });
  test('headings and clock', () => {
    expect([heading(1, 0), heading(0, -1), heading(-1, 1)]).toEqual(['east', 'north', 'south-west']);
    expect(clockText(0.27)).toBe('06:28');
  });
});

const viewport = { w: 960, h: 540 };
const button = (text, x, y, w = 100, h = 40, more = {}) => ({ text, kind: 'button', press: true, disabled: false, box: { x, y, w, h }, clip: { clips: false, sw: w, cw: w, sh: h, ch: h }, ...more });
const label = (text, x, y, w, h, clip) => ({ text, kind: 'text', press: false, disabled: false, box: { x, y, w, h }, clip });

describe('wrong', () => {
  test('a clean screen has nothing wrong', () => {
    expect(findWrong([button('New game', 10, 10), button('Settings', 10, 60), label('Day 1', 300, 10, 50, 20, { clips: false, sw: 50, cw: 50, sh: 20, ch: 20 })], viewport)).toEqual([]);
  });
  test('cut: text wider than its clipping box', () => {
    const wrong = findWrong([label('A very long quest name', 10, 10, 80, 20, { clips: true, sw: 160, cw: 80, sh: 20, ch: 20 })], viewport);
    expect(wrong).toEqual([{ kind: 'cut', what: 'A very long quest name', box: { x: 10, y: 10, w: 80, h: 20 }, why: 'text 160 px wide in 80' }]);
  });
  test('cut leaves a descender alone: 2 px taller than its box', () => {
    expect(findWrong([label('Bag', 150, 22, 57, 33, { clips: true, sw: 57, cw: 57, sh: 35, ch: 33 })], viewport)).toEqual([]);
    expect(findWrong([label('Bag', 150, 22, 57, 20, { clips: true, sw: 57, cw: 57, sh: 35, ch: 20 })], viewport).map((w) => w.why)).toEqual(['text 35 px tall in 20']);
  });
  test('cut needs a box that clips: overflowing visible text is not cut', () => {
    expect(findWrong([label('Spills', 10, 10, 40, 20, { clips: false, sw: 90, cw: 40, sh: 20, ch: 20 })], viewport)).toEqual([]);
  });
  test('off: partly outside the viewport', () => {
    const wrong = findWrong([button('Close', 930, 10, 60, 40)], viewport);
    expect(wrong.map((w) => w.kind)).toEqual(['off']);
  });
  test('over: covered at the centre, and two pressable things that overlap', () => {
    expect(findWrong([button('Buy', 10, 10, 100, 40, { coveredBy: 'div.toast "Saved"' })], viewport))
      .toEqual([{ kind: 'over', what: 'Buy', box: { x: 10, y: 10, w: 100, h: 40 }, why: 'covered at its centre by div.toast "Saved"' }]);
    const both = findWrong([button('A', 10, 10, 100, 40), button('B', 60, 20, 100, 40)], viewport);
    expect(both.map((w) => [w.kind, w.what])).toEqual([['over', 'A']]);
    expect(both[0].why).toBe('overlaps B at 60,20 100x40');
  });
  test('over: two pieces of text drawn over each other', () => {
    const clip = { clips: false, sw: 0, cw: 0, sh: 0, ch: 0 };
    const wrong = findWrong([label('Move with W, A, S and D', 54, 22, 352, 53, clip), label('A plot of your own', 331, 22, 240, 23, clip), label('Day 1', 583, 15, 39, 20, clip)], viewport);
    expect(wrong.map((w) => [w.kind, w.what, w.why])).toEqual([['over', 'Move with W, A, S and D', 'text over text: A plot of your own at 331,22 240x23']]);
  });
  test('a button nested inside another pressable box is not an overlap', () => {
    expect(findWrong([button('Card', 10, 10, 200, 100), button('x', 170, 15, 30, 30)], viewport)).toEqual([]);
  });
  test('small: a pressable thing under 24 px, unless it is disabled', () => {
    expect(findWrong([button('x', 10, 10, 20, 30)], viewport).map((w) => [w.kind, w.why])).toEqual([['small', '20x30, under 24 px']]);
    expect(findWrong([button('x', 10, 10, 20, 30, { disabled: true })], viewport)).toEqual([]);
  });
  test('reading order is top to bottom, then left to right, with duplicates gone', () => {
    const items = [button('C', 10, 100), button('B', 200, 12), button('A', 10, 10), button('A', 10, 10)];
    expect(order(items).map((i) => i.text)).toEqual(['A', 'B', 'C']);
  });
});

describe('film', () => {
  test('a one-frame flicker is a jump there and back', () => {
    const found = jumps([0, 2, 2.5, 2, 40, 41, 2, 2.2, 1.9]);
    expect(found.jumps).toEqual([{ frame: 4, diff: 40, back: true }, { frame: 5, diff: 41, back: false }]);
  });
  test('a still screen has no jumps, nor does steady motion', () => {
    expect(jumps([0, 0.2, 0.1, 0.3, 0, 0.2]).jumps).toEqual([]);
    expect(jumps([0, 9, 10, 11, 9.5, 10.5, 12]).jumps).toEqual([]);
  });
  test('the cell difference sees a small sprite change that the whole-frame mean would not', () => {
    const w = 192, h = 108;
    const a = new Uint8Array(w * h * 3).fill(100), b = new Uint8Array(a);
    // One 12x12 cell swaps brown for a red as bright: the grey picture would not change at all.
    for (let y = 48; y < 60; y++) for (let x = 96; x < 108; x++) { const i = (y * w + x) * 3; b[i] = 160; b[i + 1] = 70; }
    expect(cellDifference(a, a)).toBe(0);
    expect(cellDifference(a, b)).toBe(60);
    let mean = 0; for (let i = 0; i < a.length; i++) mean += Math.abs(a[i] - b[i]);
    expect(mean / a.length).toBeLessThan(1);
  });
  test('the sheet is at most 1600 px wide, in rows of five', () => {
    const layout = sheetLayout({ count: 16, frameW: 960, frameH: 540 });
    expect([layout.cols, layout.rows, layout.cellW, layout.imageH, layout.width, layout.height]).toEqual([5, 4, 320, 180, 1600, 4 * 198]);
    expect(layout.cells[6]).toEqual({ x: 320, y: 198, w: 320, h: 180 });
    const two = sheetLayout({ count: 2, frameW: 960, frameH: 540 });
    expect([two.cols, two.cellW, two.width]).toEqual([2, 800, 1600]);
    const wide = sheetLayout({ count: 3, frameW: 1366, frameH: 768 });
    expect(wide.width).toBeLessThanOrEqual(1600);
    expect(sheetLayout({ count: 1, frameW: 960, frameH: 540 }).width).toBe(960);
  });
  test('the frames on the sheet keep the first, the last and every jump', () => {
    const list = pick(200, { every: 6, keep: [77] });
    expect(list.length).toBeLessThanOrEqual(40);
    expect(list).toContain(0); expect(list).toContain(199); expect(list).toContain(77);
    expect(pick(10, { every: 3 })).toEqual([0, 3, 6, 9]);
  });
});

describe('inputs and the look block', () => {
  test('a bare key is a press; JSON is one input or a list', () => {
    expect(parseInputs('KeyE')).toEqual([{ type: 'press', key: 'KeyE' }]);
    expect(parseInputs('{"type":"wait","ms":5}')).toEqual([{ type: 'wait', ms: 5 }]);
    expect(parseInputs('[{"type":"press","key":"KeyE"},{"type":"see","text":"Hi"}]')).toHaveLength(2);
  });
  test('a full screen fits in about 40 lines', () => {
    const screen = [];
    for (let i = 0; i < 40; i++) screen.push({ text: `line ${i}`, kind: 'text', press: false, disabled: false, box: { x: 0, y: i * 13, w: 50, h: 12 } });
    for (let i = 0; i < 9; i++) screen.push({ text: String(i + 1), kind: 'button', press: true, disabled: false, box: { x: 200 + i * 60, y: 500, w: 54, h: 54 } });
    const text = formatLook({ title: 'look 001', picture: '/p.png', screen, wrong: [], changed: ['hero moved 1 m north'], now: ['day 1, 06:00'], problems: [] });
    expect(text.split('\n').length).toBeLessThanOrEqual(40);
    expect(text).toContain('… 17 more lines (look --json)');
  });
  test('a row of same-sized buttons is one line, its shared words said once', () => {
    const row = ['Quick slot 1: Axe, 1', 'Quick slot 2: empty', 'Quick slot 3: empty', 'Quick slot 4: empty']
      .map((text, i) => ({ text, kind: 'button', press: true, disabled: false, box: { x: 200 + i * 60, y: 500, w: 50, h: 60 } }));
    const text = formatLook({ title: 'look', picture: '/p.png', screen: row, wrong: [], problems: [] });
    expect(text).toContain('Quick slot [1: Axe, 1] [2: empty] [3: empty] [4: empty]  4x 50x60 from 200,500 to 380,500');
  });
  test('a blind look has no changed or now', () => {
    const text = formatLook({ title: 'look 001', picture: '/p.png', screen: [], wrong: [], problems: [] });
    expect(text).not.toContain('changed');
    expect(text).not.toContain('now:');
  });
});
