// Holds the build system to its model. docs/verify/build-stroke/Stroke.tla is the design of a stroke, and a
// checker has walked every order of its events. That says the design keeps its rules. It says nothing about
// this code. So this test plays thousands of random runs of the same events on the real systems, and after
// every event it compares them with `Model` below, which is Stroke.tla's actions written again in
// TypeScript, and checks Stroke.tla's rules on the real bag and the real blocks.
//
// When you change how a stroke starts, ends, is applied or is undone, change Stroke.tla and `Model` with it.
// `.agents/skills/verify-build-stroke` has the steps.
import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { createRandom } from '../kernel.sim.ts';
import { makeBuildStage, type BuildStage } from './stage.ts';

const GRASS = blockId('grass'), TILLED = blockId('tilled_soil'), STONE = blockId('stone');
const SEEDS = 'wheat_seeds';
/** The cells of the test: one row, in reach of the player and outside the stage's town. */
const XS = [3, 4, 5, 6], Z = 3;
const START_SEEDS = 2;

type Cell = 'grass' | 'tilled' | 'crop' | 'grown' | 'rock';
type Hand = 'hoe' | 'seeds' | 'none';

/** Stroke.tla, action by action. The variable names are the model's. */
class Model {
  active = false;
  busy = false;
  slot: 'hoe' | 'seeds' = 'hoe';
  bag = START_SEEDS;
  cell = new Map<number, Cell>(XS.map((x) => [x, 'grass']));
  primary = false;
  stroke = { on: false, item: 'none' as Hand, x0: 0, x1: 0 };
  journal = new Map<number, 'till' | 'plant'>();
  gained = 0;
  lost = 0;
  commits = 0;
  /** How often each thing worth testing happened, so the test can say that its runs reached it. */
  seen = { applied: 0, planted: 0, short: 0, dropped: 0, undone: 0, undoLeftACell: 0 };

  get held(): Hand { return this.slot === 'seeds' && this.bag <= 0 ? 'none' : this.slot; }
  get crops(): number { return [...this.cell.values()].filter((c) => c === 'crop' || c === 'grown').length; }
  /** The cells the stroke covers, nearest the press first, as strokeCells lists a row. */
  cover(): number[] {
    const { x0, x1 } = this.stroke, step = Math.sign(x1 - x0) || 1, out: number[] = [];
    for (let x = x0; x !== x1 + step; x += step) out.push(x);
    return out;
  }

  buttonDown(x: number): void {
    this.primary = true;
    this.commits = 0;
    if (this.stroke.on) { this.stroke.x1 = x; return; }
    if (this.active && !this.busy && this.held !== 'none') this.stroke = { on: true, item: this.held, x0: x, x1: x };
  }
  drag(x: number): void { if (this.stroke.on) this.stroke.x1 = x; }
  release(): void {
    if (!this.stroke.on) return;
    const { item } = this.stroke;
    if (this.active && !this.busy && this.held === item) {
      this.journal.clear();
      let applied = 0;
      for (const x of this.cover()) {
        if (item === 'hoe' && this.cell.get(x) === 'grass') { this.cell.set(x, 'tilled'); this.journal.set(x, 'till'); applied++; }
        if (item === 'seeds' && this.cell.get(x) === 'tilled') {
          if (this.bag > 0) { this.cell.set(x, 'crop'); this.bag--; this.journal.set(x, 'plant'); applied++; this.seen.planted++; }
          else this.seen.short++;
        }
      }
      if (applied > 0) { this.commits++; this.seen.applied++; }
    } else this.seen.dropped++;
    this.stroke.on = false;
  }
  buttonUp(): void { if (this.primary) { this.primary = false; this.release(); } }
  buttonLost(): void { if (this.primary) { this.primary = false; this.stroke.on = false; } }
  rightPress(): void { this.stroke.on = false; }
  switchHand(): void { this.slot = this.slot === 'hoe' ? 'seeds' : 'hoe'; }
  toggleMode(): void {
    const next = !this.active && !this.busy;
    if (next === this.active) return;
    this.active = next;
    this.stroke.on = false;
  }
  step(): void {
    this.active = this.active && !this.busy;
    if (this.stroke.on && (!this.active || this.held !== this.stroke.item)) this.stroke.on = false;
  }
  undo(): void {
    if (!this.active || this.busy || this.stroke.on || this.journal.size === 0) return;
    for (const [x, did] of this.journal) {
      if (did === 'till' && this.cell.get(x) === 'tilled') { this.cell.set(x, 'grass'); this.seen.undone++; }
      else if (did === 'plant' && this.cell.get(x) === 'crop') { this.cell.set(x, 'tilled'); this.bag++; this.seen.undone++; }
      else this.seen.undoLeftACell++;
    }
    this.journal.clear();
  }
}

/** The real game, driven by the same events. */
class Real {
  s: BuildStage = makeBuildStage();
  primary = false;
  /** Strokes that changed something since the button last went down. */
  commits = 0;
  /** The cells the plan called `ok` just before the last release, and the cells that release changed. */
  promised = 0;
  changed = 0;

  constructor() {
    const { inventory, build } = this.s.kernel.game.systems;
    inventory.add('hoe', 1);
    inventory.add(SEEDS, START_SEEDS);
    inventory.selected = 0;
    build.setActive(false);
    this.s.kernel.game.events.on('build.applied', (e) => { if (!e.undone) this.commits++; });
  }
  get game() { return this.s.kernel.game; }
  get build() { return this.s.build; }
  get bag(): number { return this.game.systems.inventory.count(SEEDS); }
  cell(x: number): Cell {
    const id = this.s.world.getBlock(x, this.s.floor, Z);
    const crop = this.game.systems.crops.at(x, this.s.floor, Z);
    if (crop) return crop.stage === 0 ? 'crop' : 'grown';
    return id === GRASS ? 'grass' : id === TILLED ? 'tilled' : 'rock';
  }
  buttonDown(x: number): void { this.primary = true; this.commits = 0; this.s.point(x, Z); this.build.press(); }
  drag(x: number): void { if (this.build.dragging) this.s.point(x, Z); }
  release(): void {
    const plan = this.build.plan();
    this.promised = plan?.dragging ? plan.ok : 0;
    this.changed = this.build.release();
  }
  buttonUp(): void { if (this.primary) { this.primary = false; this.release(); } }
  buttonLost(): void { if (this.primary) { this.primary = false; this.build.cancel(); } }
}

/** One event, on both. Each returns the words for a failing run, or null when the event cannot happen now. */
type Event = (m: Model, r: Real, pick: (n: number) => number) => string | null;

/** How often each event of EVENTS is picked, in the same order: the button and the pointer most, a panel least. */
const WEIGHTS = [8, 6, 8, 1, 1, 1, 4, 3, 1, 6, 3, 5, 3, 1, 2, 1, 1, 3, 1, 2];

const EVENTS: Event[] = [
  (m, r, pick) => { const x = XS[pick(XS.length)]; m.buttonDown(x); r.buttonDown(x); return `the left button goes down on cell ${x}`; },
  (m, r, pick) => { const x = XS[pick(XS.length)]; m.drag(x); r.drag(x); return `the pointer moves to cell ${x}`; },
  (m, r) => { m.buttonUp(); r.buttonUp(); return 'the left button comes up'; },
  (m, r) => { m.release(); r.release(); return 'release runs again'; },
  (m, r) => { m.buttonLost(); r.buttonLost(); return 'the window loses the button'; },
  (m, r) => { m.rightPress(); r.build.cancel(); return 'the right button goes down'; },
  (m, r) => { m.switchHand(); const bag = r.game.systems.inventory; bag.selected = 1 - bag.selected; return 'another item is picked'; },
  (m, r) => { m.toggleMode(); r.build.setActive(!r.build.active); return 'G is pressed'; },
  (m, r) => { if (m.busy) return null; m.busy = true; r.game.player.busy = true; return 'a panel opens'; },
  (m, r) => { if (!m.busy) return null; m.busy = false; r.game.player.busy = false; return 'the panel closes'; },
  (m, r) => { m.step(); r.s.kernel.step(); return 'the rules take a step'; },
  (m, r) => { m.undo(); r.build.undo(); return 'Z is pressed'; },
  // The rest of the game changes a cell or the bag.
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'grass') return null;
    m.cell.set(x, 'tilled');
    r.game.systems.crops.till(x, r.s.floor, Z);
    return `something else tills cell ${x}`;
  },
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'tilled' || m.bag <= 0) return null;
    m.cell.set(x, 'crop');
    m.bag--;
    r.game.systems.crops.plant(x, r.s.floor, Z, SEEDS);
    r.game.systems.inventory.remove(SEEDS, 1);
    return `something else plants cell ${x}`;
  },
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'crop') return null;
    m.cell.set(x, 'grown');
    // The crops system hands out its live record, and time is what moves its stage. The test moves it by hand
    // so that one cell grows and the clock stays where it is.
    r.game.systems.crops.at(x, r.s.floor, Z)!.stage = 1;
    return `the crop on cell ${x} grows`;
  },
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'crop' && m.cell.get(x) !== 'grown') return null;
    m.cell.set(x, 'tilled');
    m.bag++;
    r.game.systems.crops.pull!(x, r.s.floor, Z);
    return `the crop on cell ${x} is pulled up`;
  },
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'grass' && m.cell.get(x) !== 'tilled') return null;
    m.cell.set(x, 'rock');
    r.s.world.setBlock(x, r.s.floor, Z, STONE);
    return `cell ${x} turns to stone`;
  },
  (m, r, pick) => {
    const x = XS[pick(XS.length)];
    if (m.cell.get(x) !== 'rock' && m.cell.get(x) !== 'tilled') return null;
    m.cell.set(x, 'grass');
    r.s.world.setBlock(x, r.s.floor, Z, GRASS);
    return `cell ${x} grows over with grass`;
  },
  (m, r) => { m.bag++; m.gained++; r.game.systems.inventory.add(SEEDS, 1); return 'the bag gains a seed'; },
  (m, r) => { if (m.bag <= 0) return null; m.bag--; m.lost++; r.game.systems.inventory.remove(SEEDS, 1); return 'the bag loses a seed'; },
];

/** Plays one random run and returns what went wrong, with the run in words, or null. */
function play(seed: number, length: number): string | null {
  const random = createRandom(seed);
  const pick = (n: number): number => Math.floor(random() * n);
  const m = new Model(), r = new Real();
  const told: string[] = [];
  // Three runs in four start in build mode, where most of the rules are.
  if (seed % 4 !== 0) told.push(EVENTS[G](m, r, pick) as string);
  for (let i = 0; i < length; i++) {
    let at = pick(TOTAL_WEIGHT), event = 0;
    while (at >= WEIGHTS[event]) at -= WEIGHTS[event++];
    const words = EVENTS[event](m, r, pick);
    if (words === null) continue;
    told.push(words);
    const real = {
      active: r.build.active, dragging: r.build.dragging, bag: r.bag, cells: XS.map((x) => r.cell(x)).join(' '), canUndo: r.build.canUndo,
    };
    const model = {
      active: m.active, dragging: m.stroke.on, bag: m.bag, cells: XS.map((x) => m.cell.get(x)).join(' '), canUndo: m.journal.size > 0,
    };
    const crops = XS.filter((x) => r.cell(x) === 'crop' || r.cell(x) === 'grown').length;
    // Stroke.tla's rules, on the real game.
    const broken =
      r.build.dragging && !r.primary ? 'NoStuckStroke: a stroke is in progress with the button up'
      : r.commits > 1 ? 'OneStrokePerPress: one press applied two strokes'
      : r.bag < 0 ? 'BagInBounds: the bag went below nothing'
      : r.bag + crops !== START_SEEDS + m.gained - m.lost ? `SeedsConserved: ${r.bag} in the bag and ${crops} in the ground, of ${START_SEEDS + m.gained - m.lost}`
      : r.changed > 0 && r.changed !== r.promised ? `the plan called ${r.promised} cells ok and the release changed ${r.changed}`
      : JSON.stringify(real) !== JSON.stringify(model) ? `the game and the model differ:\n  game  ${JSON.stringify(real)}\n  model ${JSON.stringify(model)}`
      : null;
    // The last events are the ones that matter. `play(seed, length)` plays the whole run again.
    if (broken) return `seed ${seed}, after ${told.length} events: ${broken}\nThe last events:\n${told.slice(-14).map((line, n) => `  ${Math.max(0, told.length - 14) + n + 1}. ${line}`).join('\n')}`;
  }
  for (const key of Object.keys(SEEN) as (keyof typeof SEEN)[]) SEEN[key] += m.seen[key];
  return null;
}
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, weight) => sum + weight, 0);
/** Where `G is pressed` is in EVENTS. */
const G = 7;
/** What all the runs reached, added up, and the least of each that the 1,500 runs must reach. */
const SEEN = { applied: 0, planted: 0, short: 0, dropped: 0, undone: 0, undoLeftACell: 0 };
const AT_LEAST: typeof SEEN = { applied: 1500, planted: 400, short: 25, dropped: 800, undone: 800, undoLeftACell: 200 };

test('the build system does what Stroke.tla says, event by event, and keeps its rules', () => {
  expect(WEIGHTS.length).toBe(EVENTS.length);
  for (let seed = 1; seed <= 1500; seed++) {
    const wrong = play(seed, 200);
    if (wrong) throw new Error(wrong);
  }
  // Random runs that never apply a stroke or never undo one would pass and prove nothing.
  console.log('[build] the runs reached:', JSON.stringify(SEEN));
  for (const [what, least] of Object.entries(AT_LEAST)) expect(SEEN[what as keyof typeof SEEN], what).toBeGreaterThanOrEqual(least);
});

test('a pressed stroke that the hand, a panel or the mode drops changes nothing when the button comes up', () => {
  // AppliedWithTheSameHand, by each way the checker found when the release did not ask.
  for (const drop of ['hand', 'panel', 'mode'] as const) {
    const r = new Real();
    r.build.setActive(true);
    r.buttonDown(3);
    r.drag(5);
    if (drop === 'hand') r.game.systems.inventory.selected = 1;
    if (drop === 'panel') r.game.player.busy = true;
    if (drop === 'mode') { r.build.setActive(false); r.build.setActive(true); }
    r.buttonUp();
    expect(XS.map((x) => r.cell(x)), drop).toEqual(['grass', 'grass', 'grass', 'grass']);
    expect(r.bag, drop).toBe(START_SEEDS);
  }
});
