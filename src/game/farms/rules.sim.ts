// The rules of the three farms you engineer, on a small grid: the gearling pit, the bait field and the terrace.
// Each takes a layout, plays one day of it, and says the rate, what is wrong (the symptom) and how to put it
// right (the fix). They are ported from the playthrough site's Build tab (`playthrough/tinker.js`), whose toy
// layouts are the tests' expected values, and the farms system runs them on the real ground round each farm.
//
// A grid is rows of cells, `grid[y][x]`. The pit's grid is drawn with the wheel at the left: gearlings come in
// at the right-hand column and walk left. The farms system turns the world round a wheel into that frame.

import { LIT_FIX } from '../content/farms.ts';

/** What stands on one cell of a farm's grid. `null` is open ground. */
export type FarmCell = 'fence' | 'pit' | 'pusher' | 'lamp' | 'carrot' | 'field' | 'sprinkler' | 'shaft' | 'wheel' | null;
export type FarmGrid = FarmCell[][];

/** One cell, as x, y on the grid. */
export type At = readonly [number, number];

const key = (x: number, y: number): string => `${x},${y}`;
const near = (a: At, b: At): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const STEPS4: readonly At[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function cellsOf(grid: FarmGrid, type: FarmCell): At[] {
  const out: At[] = [];
  grid.forEach((row, y) => row.forEach((c, x) => { if (c === type) out.push([x, y]); }));
  return out;
}

/** The cells a lamp lights in the Build tab: itself and the eight round it. The real game reads the world's light. */
export function lampLight(grid: FarmGrid, extra: readonly At[] = []): Set<string> {
  const lit = new Set<string>();
  for (const [lx, ly] of [...cellsOf(grid, 'lamp'), ...extra]) {
    for (let y = ly - 1; y <= ly + 1; y++) for (let x = lx - 1; x <= lx + 1; x++) lit.add(key(x, y));
  }
  return lit;
}

/** What the tag over a farm says. `rate` is goods a day on Give; on Take it is the goods taken now. */
export interface FarmScore {
  rate: number;
  tag: string;
  sub: string;
  symptom: string;
  fix: string;
}

// ------------------------------------------------------------------------------------------ the gearling pit

export interface PitLayout {
  grid: FarmGrid;
  /** The wheel's row. The wheel stands in column 0 of it. */
  wheelRow: number;
  /** Cells light reaches, as `x,y`. */
  lit: ReadonlySet<string>;
  /** The power the wheel makes: 4 on flat water, 6 where it drops. */
  power: number;
  /** Ticks of one day's walk. The Build tab plays 44. */
  ticks?: number;
  /** Gearlings that come today. Six, one a row, when there are six rows. */
  count?: number;
}

export type GearlingState = 'waiting' | 'walking' | 'stopped' | 'gone' | 'jam';

export interface Gearling {
  row: number;
  /** The tick it walks in at the right-hand edge. */
  enter: number;
  at: At | null;
  state: GearlingState;
  since: number;
  /** Where it was and what it was doing at each tick, from the tick it came in. */
  path: ({ at: At; state: GearlingState } | undefined)[];
  /** The tick it stopped in a pit, or -1. */
  stoppedAt: number;
}

export interface PitRun {
  g: Gearling[];
  springs: number;
  jammed: boolean;
  /** The tick the wheel jammed, or -1. */
  jamAt: number;
  /** Gearlings that walked across a lit pit. */
  litPass: number;
  pushers: number;
}

/** The rows in the order their gearlings come: the wheel's row first, then in from the edges. */
function arrivalOrder(rows: number, wheelRow: number): number[] {
  const out = [wheelRow];
  for (let lo = 0, hi = rows - 1; lo <= hi; lo++, hi--) {
    if (lo !== wheelRow) out.push(lo);
    if (hi !== lo && hi !== wheelRow) out.push(hi);
  }
  return out;
}

/**
 * One day at the pit. Gearlings walk left toward the running wheel, one a row. A fence (or a lamp, or a pusher)
 * in the way turns them toward the wheel's row. A pit that is dark stops one, and it drops a spring. A pusher
 * right beside the pit, in line with it, shoves it on so the next can come. A gearling that reaches the wheel
 * jams it, and every pusher on it stops. On Take a stopped gearling is broken where it stands for 4 springs.
 */
export function runPit(layout: PitLayout, taking: boolean): PitRun {
  const { grid, lit, wheelRow } = layout;
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  const wheel: At = [0, wheelRow];
  const pushers = cellsOf(grid, 'pusher');
  const delay = Math.max(1, Math.ceil(pushers.length / Math.max(1, layout.power)));
  const order = arrivalOrder(rows, wheelRow).slice(0, layout.count ?? rows);
  const g: Gearling[] = order.map((row, i) => ({ row, at: null, enter: i * 2, path: [], state: 'waiting', since: 0, stoppedAt: -1 }));
  let springs = 0, jammed = false, jamAt = -1, litPass = 0;
  const wall = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= cols || y >= rows || grid[y][x] === 'fence' || grid[y][x] === 'lamp' || grid[y][x] === 'pusher';
  const busy = (x: number, y: number, me: Gearling): boolean =>
    g.some((o) => o !== me && o.at !== null && o.at[0] === x && o.at[1] === y && o.state !== 'gone');
  const pushedBy = (x: number, y: number): boolean => !jammed && pushers.some((p) => near(p, [x, y]) === 1 && (p[0] === x || p[1] === y));
  const jam = (m: Gearling, t: number): void => {
    jammed = true;
    if (jamAt < 0) jamAt = t;
    m.state = 'jam';
  };
  for (let t = 0; t < (layout.ticks ?? 44); t++) {
    for (const m of g) {
      if (m.state === 'waiting' && t >= m.enter && !busy(cols - 1, m.row, m)) {
        m.at = [cols - 1, m.row];
        m.state = 'walking';
      } else if (m.state === 'walking' && m.at) {
        const [x, y] = m.at;
        if (grid[y][x] === 'pit' && !lit.has(key(x, y))) {
          m.state = 'stopped';
          m.since = t;
          m.stoppedAt = t;
          springs += taking ? 4 : 1;
        } else {
          if (grid[y][x] === 'pit') litPass++;
          const toward = Math.sign(wheel[1] - y);
          let next: At | null = x > 1 ? [x - 1, y] : [x, y + toward];
          if (x > 1 && wall(x - 1, y)) next = toward ? [x, y + toward] : null;
          if (next && next[0] === wheel[0] && next[1] === wheel[1]) { jam(m, t); next = null; }
          else if (next && x === 1 && y === wheel[1]) { jam(m, t); next = null; }
          if (next && !wall(next[0], next[1]) && !busy(next[0], next[1], m)) m.at = next;
        }
      } else if (m.state === 'stopped' && m.at) {
        // Taking breaks it where it stands. Giving needs a pusher to shove it on.
        if (taking || (pushedBy(m.at[0], m.at[1]) && t - m.since >= delay)) m.state = 'gone';
      }
      if (m.at) m.path[t] = { at: [m.at[0], m.at[1]], state: m.state };
    }
  }
  return { g, springs, jammed, jamAt, litPass, pushers: pushers.length };
}

export function scorePit(layout: PitLayout, taking: boolean): FarmScore & { run: PitRun } {
  const r = runPit(layout, taking);
  const queued = r.g.filter((m) => m.state === 'walking').length;
  const stopped = r.g.filter((m) => m.state === 'stopped').length;
  const pits = cellsOf(layout.grid, 'pit');
  const power = layout.power;
  let symptom: string, fix: string;
  if (r.jammed) {
    symptom = r.litPass
      ? 'A gearling walked straight across the pit and into the wheel. The wheel has stopped.'
      : `${r.g.filter((m) => m.state === 'jam').length ? 'A gearling reached the wheel and jammed it.' : ''} The wheel has stopped, and every pusher with it.`;
    fix = r.litPass ? 'A gearling only stops where it is dark. Move the lamp so its light does not reach the pit.'
      : !pits.length ? 'Dig a pit in their way, between where they come in and the wheel.'
      : 'Gearlings in other rows walk round the pit. Fences turn them toward the wheel\'s row, so a line of fences can send every row into one pit.';
  } else if (!pits.length) {
    symptom = 'Nothing is stopping them.'; fix = 'Dig a pit in their way.';
  } else if (r.springs === 0) {
    symptom = 'No gearling reaches a pit.'; fix = 'Gearlings walk left along their row. Put the pit where a row runs into it, or fence them toward it.';
  } else if (!taking && queued + stopped > 1 && stopped) {
    symptom = `The pit is full. ${plural(queued, 'gearling is', 'gearlings are')} waiting behind the one in it.`;
    fix = 'A stopped gearling stays in the pit. A pusher right beside the pit, in line with it, shoves it on so the next one can come.';
  } else if (r.pushers > power) {
    symptom = `Short of power: the wheel makes ${power}, and ${r.pushers} pushers ask for ${r.pushers}. They push slower.`;
    fix = 'One pusher can empty a pit. Take the extra ones out, or wait for the second wheel.';
  } else if (queued) {
    symptom = `${plural(queued, 'gearling never got', 'gearlings never got')} to a pit.`; fix = 'Something is in their way. Look for a fence or a lamp that leaves them nowhere to step.';
  } else {
    symptom = taking ? 'Every gearling is broken for its springs.' : 'Every gearling goes through the pit, and walks home.';
    fix = taking ? 'None of these come back tomorrow, and the Custodian will not speak to you today. Switch to Give to keep them coming.' : 'Nothing is holding it back. Six a day is all that live near this wheel. A second running machine draws more.';
  }
  const tag = `${r.springs} ${r.springs === 1 ? 'spring' : 'springs'} ${taking ? 'today' : 'a day'}`;
  const sub = taking ? `Tomorrow: ${plural(r.g.filter((m) => m.state === 'gone').length, 'gearling', 'gearlings')} fewer` : `Power: ${power} made, ${r.jammed ? 0 : r.pushers} used`;
  return { rate: r.springs, tag, sub, symptom: symptom.trim(), fix, run: r };
}

// ------------------------------------------------------------------------------------------ the bait field

export interface BaitLayout {
  grid: FarmGrid;
  /** The gaps they tunnel in through, one burrower a gap a night. */
  doors: readonly At[];
  /** Wild roots on the patch: they draw burrowers too. */
  roots: readonly At[];
  /** Cells light reaches. */
  lit: ReadonlySet<string>;
}

export interface Burrower {
  door: At;
  /** The tunnel from the door to where it came up. */
  path: At[];
  end: 'carrot' | 'root' | 'turned' | 'hungry';
}

export interface BaitRun {
  out: Burrower[];
  carrots: At[];
}

/** One night at the bait field. Each burrower tunnels from its gap through dark ground to the nearest dark food. */
export function runBait(layout: BaitLayout): BaitRun {
  const { grid, lit } = layout;
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  const food: [number, number, 'carrot' | 'root'][] = [
    ...cellsOf(grid, 'carrot').map(([x, y]) => [x, y, 'carrot'] as [number, number, 'carrot']),
    ...layout.roots.map(([x, y]) => [x, y, 'root'] as [number, number, 'root']),
  ];
  const taken = new Set<string>();
  const out: Burrower[] = [];
  for (const d of layout.doors) {
    if (lit.has(key(d[0], d[1]))) { out.push({ door: d, path: [d], end: 'turned' }); continue; }
    // The nearest dark food by tunnel, through dark ground only.
    const seen = new Map<string, At | null>([[key(d[0], d[1]), null]]);
    const queue: At[] = [d];
    let found: [number, number, 'carrot' | 'root'] | null = null;
    while (queue.length && !found) {
      const c = queue.shift() as At;
      const f = food.find(([x, y]) => x === c[0] && y === c[1]);
      if (f && !taken.has(key(c[0], c[1]))) { found = f; break; }
      for (const [dx, dy] of STEPS4) {
        const n: At = [c[0] + dx, c[1] + dy];
        if (n[0] < 0 || n[1] < 0 || n[0] >= cols || n[1] >= rows || seen.has(key(n[0], n[1])) || lit.has(key(n[0], n[1]))) continue;
        seen.set(key(n[0], n[1]), c);
        queue.push(n);
      }
    }
    if (!found) { out.push({ door: d, path: [d], end: seen.size > 1 ? 'hungry' : 'turned' }); continue; }
    taken.add(key(found[0], found[1]));
    const path: At[] = [];
    for (let c: At | null | undefined = [found[0], found[1]]; c; c = seen.get(key(c[0], c[1]))) path.unshift(c);
    out.push({ door: d, path, end: found[2] });
  }
  return { out, carrots: cellsOf(grid, 'carrot') };
}

export function scoreBait(layout: BaitLayout, taking: boolean): FarmScore & { run: BaitRun; fed: number } {
  const r = runBait(layout);
  const fed = r.out.filter((b) => b.end === 'carrot').length;
  const roots = r.out.filter((b) => b.end === 'root').length;
  const turned = r.out.filter((b) => b.end === 'turned').length;
  const hungry = r.out.filter((b) => b.end === 'hungry').length;
  const litCarrots = r.carrots.filter((c) => layout.lit.has(key(c[0], c[1]))).length;
  const comes = layout.doors.length;
  let symptom: string, fix: string;
  if (!r.carrots.length) { symptom = 'Nothing here for them to come up for.'; fix = 'Plant carrots. Each block feeds one burrower a night.'; }
  else if (litCarrots === r.carrots.length) { symptom = 'Every carrot is in the light. Nothing comes up.'; fix = LIT_FIX.all; }
  else if (litCarrots) { symptom = `${plural(litCarrots, 'carrot block is', 'carrot blocks are')} in the light. Nothing comes up there.`; fix = LIT_FIX.some; }
  else if (roots >= 2) { symptom = `${plural(roots, 'burrower went', 'burrowers went')} to the wild roots instead.`; fix = 'They go to the nearest dark food. A lamp beside the wild roots puts them in the light, so the burrowers come on to yours.'; }
  else if (turned >= 2) { symptom = `${plural(turned, 'burrower turned', 'burrowers turned')} back at the fence.`; fix = 'A lamp that lights a gap in the fence keeps that burrower out. Lamps belong round the food you want them away from, not across their way in.'; }
  else if (hungry + roots) { symptom = `${plural(hungry + roots, 'burrower found', 'burrowers found')} nothing of yours.`; fix = `${comes === 8 ? 'Eight' : comes} come a night and you have ${plural(r.carrots.length - litCarrots, 'dark block', 'dark blocks')}. Plant ${hungry + roots} more, where they can reach.`; }
  else { symptom = 'Every burrower comes up in your carrots.'; fix = 'Nothing is holding it back. The same lamps keep night visitors off this field, so you built the safe farm too.'; }
  const tag = taking ? `${fed * 4} copper now` : `${fed / 2} copper a day`;
  const sub = taking ? 'Then nothing comes up here for three days' : `${plural(fed, 'burrower', 'burrowers')} on your carrots, ${roots} on the wild roots`;
  return { rate: taking ? fed * 4 : fed / 2, tag, sub, symptom, fix, run: r, fed };
}

// ------------------------------------------------------------------------------------------ the terrace

export interface TerraceLayout {
  grid: FarmGrid;
  /** True for a field the ditch wets: the row beside the stream. */
  ditch(x: number, y: number): boolean;
  /** The power a wheel at this cell makes: 6 where the water drops, 4 on flat water. */
  wheelPower(x: number, y: number): number;
}

export interface TerraceRun {
  power: number;
  /** Sprinklers joined to a wheel by shafts, as `x,y`. */
  live: Set<string>;
  sprinklers: number;
  turning: number;
  /** How fast every sprinkler runs, 0 to 1. */
  speed: number;
  wet: Set<string>;
  dry: number;
  fields: number;
}

/** Which fields are wet, and how fast the sprinklers turn. Power runs from a wheel along shafts and sprinklers. */
export function runTerrace(layout: TerraceLayout): TerraceRun {
  const { grid } = layout;
  const wheels = cellsOf(grid, 'wheel'), sprinklers = cellsOf(grid, 'sprinkler'), fields = cellsOf(grid, 'field');
  const power = wheels.reduce((n, [x, y]) => n + layout.wheelPower(x, y), 0);
  const live = new Set(wheels.map(([x, y]) => key(x, y)));
  const queue: At[] = [...wheels];
  while (queue.length) {
    const [x, y] = queue.pop() as At;
    for (const [dx, dy] of STEPS4) {
      const nx = x + dx, ny = y + dy, c = grid[ny]?.[nx];
      if ((c === 'shaft' || c === 'sprinkler') && !live.has(key(nx, ny))) { live.add(key(nx, ny)); queue.push([nx, ny]); }
    }
  }
  const on = sprinklers.filter(([x, y]) => live.has(key(x, y)));
  const speed = on.length ? Math.min(1, power / on.length) : 1;
  const wet = new Set<string>();
  let dry = 0;
  for (const f of fields) {
    if (layout.ditch(f[0], f[1]) || on.some((s) => near(s, f) === 1)) wet.add(key(f[0], f[1]));
    else dry++;
  }
  return { power, live, sprinklers: sprinklers.length, turning: on.length, speed, wet, dry, fields: fields.length };
}

export function scoreTerrace(layout: TerraceLayout): FarmScore & { run: TerraceRun } {
  const r = runTerrace(layout);
  let rate = 0;
  const on = cellsOf(layout.grid, 'sprinkler').filter(([x, y]) => r.live.has(key(x, y)));
  for (const f of cellsOf(layout.grid, 'field')) {
    const ditch = layout.ditch(f[0], f[1]), wet = on.some((s) => near(s, f) === 1);
    rate += ditch ? 2 : wet ? 2 * r.speed : 0;
  }
  let symptom: string, fix: string;
  if (!r.fields) { symptom = 'Nothing is planted.'; fix = 'Till some ground beside the stream.'; }
  else if (r.sprinklers > r.turning) { symptom = `${plural(r.sprinklers - r.turning, 'sprinkler is', 'sprinklers are')} not turning.`; fix = 'Power only runs along shafts. Join it to a wheel.'; }
  else if (r.speed < 1) { symptom = `Short of power: ${r.power} made, ${r.turning} asked for. Everything runs at ${Math.round(r.speed * 100)}%.`; fix = 'Add a second wheel, or move one to the top, where the water drops and a wheel makes 6.'; }
  else if (r.dry) { symptom = `${plural(r.dry, 'field is', 'fields are')} dry.`; fix = 'A ditch reaches only the row beside the stream. Past that, a sprinkler wets the eight blocks round it.'; }
  else if (!r.turning) { symptom = 'Every field is on the ditch.'; fix = 'The ditch reaches one row. To go further: a wheel in the stream, a shaft, a sprinkler.'; }
  else { symptom = 'Every field is wet and every sprinkler turns.'; fix = 'The blocks under the shafts grow nothing. Where you run a shaft is where the field is not.'; }
  const rounded = Math.round(rate);
  return { rate: rounded, tag: `${rounded} wheat a day`, sub: r.power ? `Power: ${r.power} made, ${r.turning} used` : 'No wheel yet', symptom, fix, run: r };
}
