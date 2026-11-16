// Reads each farm off the real ground: which blocks, crops and parts make it, laid out as the grid its rule wants,
// and scores it. The three farms you engineer run the Build tab's rules (rules.sim.ts) on a frame cut from the
// world round them. The others are simpler: a count of what they need, by chapter 30.
//
// Nothing here changes the world. The farms system calls `readSites` every few seconds and plays what it finds.

import { AIR, BLOCKS, blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import type { Game, ItemId, MachinePart } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import type { FarmId, PersonId } from '../content/ids.ts';
import {
  type At, type BaitLayout, type BaitRun, type FarmCell, type FarmGrid, type FarmScore, type PitLayout, type PitRun,
  scoreBait, scorePit, scoreTerrace,
} from './rules.sim.ts';

/** Block light at or past this counts as lit for a creature that fears light, or stops only in the dark. */
export const LIT = 12;
/** A pumped field: the Order's pump triples a field of 12 by hand (12 wheat a day) to 36. The terrace must beat it. */
export const PUMPED_FIELD = 36;
/** How far from its wheel a gearling's frame reaches, and how wide it is: the Build tab's 8 by 6. */
const PIT_COLS = 8, PIT_ROWS = 6, WHEEL_ROW = 3;

const WATER = blockId('water');
const LAMP = blockId('lamp');
const LIGHT = blockId('lantern_light');
const BARRIER = blockId('barrier');
const GRASS = blockId('grass');
const TILLED = blockId('tilled_soil');
const STONES = new Set([blockId('mossy_stone'), blockId('stone'), blockId('cobble'), blockId('stone_brick')]);
const DIRS: readonly At[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** How the creatures of a farm are shown walking its rule. */
export type AgentPlan =
  | { kind: 'pit'; run: PitRun; cell: (c: number, r: number) => Vec3; wheel: string }
  | { kind: 'bait'; run: BaitRun; cell: (c: number, r: number) => Vec3 }
  /** Creatures that stay at their spots and wander a little. */
  | { kind: 'spots'; sprite: string; spots: readonly Vec3[]; fly?: boolean }
  /** A beast that walks a strip and back, at a run when `run`. */
  | { kind: 'strip'; sprite: string; from: Vec3; to: Vec3; run: boolean; stops: readonly Vec3[]; two?: boolean }
  | { kind: 'none' };

export interface Site {
  farm: FarmId;
  /** Built: everything the farm needs is there, whatever its rate. */
  built: boolean;
  /** Where the tag hangs, and where its goods fall. */
  center: Vec3;
  drop: Vec3;
  /** On Give. `rate` is goods a day. */
  score: FarmScore;
  /** What Take would give at once. */
  take: number;
  /** When its creatures come. */
  hours: 'day' | 'night' | 'all';
  /** The good it drops, and a second one shared with it (honey and wax). */
  item: ItemId;
  also?: ItemId;
  plan: AgentPlan;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const score = (rate: number, tag: string, sub: string, symptom: string, fix: string): FarmScore => ({ rate, tag, sub, symptom, fix });

/**
 * Every farm the ground holds now. `taking` says which farms are on Take. `lampBlocks` are the lamp blocks the
 * player set down, which the farms system keeps from the build events, so no farm scans the land for them.
 */
export function readSites(game: Game, taking: (farm: FarmId) => boolean, lampBlocks: readonly Vec3[]): Site[] {
  const { world } = game;
  const sys = game.systems;
  const machines = sys.machines;
  const parts = machines?.parts() ?? [];
  const placeables = sys.placeables;
  const crops = sys.crops?.all() ?? [];
  const sites: Site[] = [];
  /** Someone lives on the land and works this job (src/game/settlement sets `job.<who>`). */
  const working = (who: PersonId, job: string): boolean => game.flags.is(FLAG.settler(who)) && game.flags.get(FLAG.job(who)) === job;

  const lit = (x: number, y: number, z: number): boolean => world.blockLightAt(x, y, z) >= LIT;
  const solid = (id: number): boolean => id !== AIR && id !== WATER && id !== LIGHT && BLOCKS[id].solid;
  const center = (x: number, y: number, z: number): Vec3 => ({ x: x + 0.5, y, z: z + 0.5 });
  const partsOf = (kind: string): MachinePart[] => parts.filter((p) => p.kind === kind);
  const nearestFirst = <T extends { x: number; z: number }>(list: T[]): T[] => {
    const p = game.player.pos;
    return list.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  };

  // ------------------------------------------------------------------------------------ the gearling pit

  /** What stands on a cell where a creature walks at height y: open ground, a wall, a pit, a lamp or a pusher. */
  function walkCell(x: number, y: number, z: number): FarmCell {
    const hole = machines?.hole(x, y - 1, z);
    if (hole && !hole.wet) return 'pit';
    const below = world.getBlock(x, y - 1, z);
    if (below === WATER || below === AIR) return 'fence';
    const placed = placeables?.at(x, y, z);
    if (placed) {
      if (placed.kind !== 'pusher') return 'fence';
      return (machines?.part(placed.id)?.speed ?? 0) > 0 ? 'pusher' : 'fence';
    }
    const here = world.getBlock(x, y, z);
    if (here === LAMP) return 'lamp';
    if (here === LIGHT) return 'lamp';
    return solid(here) || here === BARRIER ? 'fence' : null;
  }

  // The pit is built at the wheel with a pit dug in its frame; with none dug yet, at the nearest wheel turning.
  let pitSite: Site | null = null, pitPits = -1;
  for (const wheel of nearestFirst(partsOf('waterwheel'))) {
    if (wheel.state !== 'working' && !machines?.jammed(wheel.id)) continue;
    // The frame runs from the wheel out over the land. The side with a pit dug in it, or else the most open side.
    let best: { d: At; grid: FarmGrid; pits: number; open: number } | null = null;
    for (const d of DIRS) {
      const p: At = [-d[1], d[0]];
      const grid: FarmGrid = [];
      let pits = 0, open = 0;
      for (let r = 0; r < PIT_ROWS; r++) {
        const row: FarmCell[] = [];
        for (let c = 0; c < PIT_COLS; c++) {
          const x = wheel.x + d[0] * c + p[0] * (r - WHEEL_ROW), z = wheel.z + d[1] * c + p[1] * (r - WHEEL_ROW);
          const cell = c === 0 ? (r === WHEEL_ROW ? 'wheel' : 'fence') : walkCell(x, wheel.y, z);
          if (cell === 'pit') pits++;
          if (cell === null) open++;
          row.push(cell === 'wheel' ? null : cell);
        }
        grid.push(row);
      }
      if (!best || pits > best.pits || (pits === best.pits && open > best.open)) best = { d, grid, pits, open };
    }
    if (!best || best.open + best.pits < 12) continue;
    const { d, grid } = best;
    const p: At = [-d[1], d[0]];
    const toWorld = (c: number, r: number): [number, number] => [wheel.x + d[0] * c + p[0] * (r - WHEEL_ROW), wheel.z + d[1] * c + p[1] * (r - WHEEL_ROW)];
    const litCells = new Set<string>();
    for (let r = 0; r < PIT_ROWS; r++) {
      for (let c = 0; c < PIT_COLS; c++) {
        const [x, z] = toWorld(c, r);
        if (lit(x, wheel.y, z) || lit(x, wheel.y - 1, z)) litCells.add(`${c},${r}`);
      }
    }
    const layout: PitLayout = { grid, wheelRow: WHEEL_ROW, lit: litCells, power: Math.max(1, machines?.wheelPower(wheel.x, wheel.y, wheel.z) ?? 4) };
    const give = scorePit(layout, false);
    const pitCell = grid.flatMap((row, r) => row.map((cell, c) => (cell === 'pit' ? [c, r] as At : null))).find((a) => a !== null);
    const [px, pz] = pitCell ? toWorld(pitCell[0], pitCell[1]) : toWorld(2, WHEEL_ROW);
    const [mx, mz] = toWorld(4, WHEEL_ROW);
    if (best.pits <= pitPits) continue;
    pitPits = best.pits;
    pitSite = {
      farm: 'spring', built: best.pits > 0, center: { x: mx + 0.5, y: wheel.y + 2.6, z: mz + 0.5 }, drop: center(px, wheel.y, pz),
      score: taking('spring') ? scorePit(layout, true) : give, take: scorePit(layout, true).rate, hours: 'day', item: 'gear_spring',
      plan: { kind: 'pit', run: give.run, cell: (c, r) => { const [x, z] = toWorld(c, r); return { x: x + 0.5, y: wheel.y, z: z + 0.5 }; }, wheel: wheel.id },
    };
  }
  if (pitSite) sites.push(pitSite);

  // ------------------------------------------------------------------------------------ the bait field

  const carrots = crops.filter((c) => c.state.crop === 'carrot');
  if (carrots.length) {
    // The patch: the carrots joined to the one nearest the hero.
    const byCell = new Map(carrots.map((c) => [`${c.x},${c.z}`, c]));
    const first = nearestFirst([...carrots])[0];
    const patch = new Set<string>([`${first.x},${first.z}`]);
    const queue = [first];
    while (queue.length) {
      const c = queue.pop() as (typeof carrots)[number];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const k = `${c.x + dx},${c.z + dz}`;
        const n = byCell.get(k);
        if (n && !patch.has(k)) { patch.add(k); queue.push(n); }
      }
    }
    const inPatch = carrots.filter((c) => patch.has(`${c.x},${c.z}`));
    const y = first.y;
    const x0 = Math.min(...inPatch.map((c) => c.x)) - 2, x1 = Math.max(...inPatch.map((c) => c.x)) + 2;
    const z0 = Math.min(...inPatch.map((c) => c.z)) - 2, z1 = Math.max(...inPatch.map((c) => c.z)) + 2;
    const cols = x1 - x0 + 1, rows = z1 - z0 + 1;
    const grid: FarmGrid = [];
    const roots: At[] = [];
    const litCells = new Set<string>();
    for (let r = 0; r < rows; r++) {
      const row: FarmCell[] = [];
      for (let c = 0; c < cols; c++) {
        const x = x0 + c, z = z0 + r;
        const carrot = byCell.get(`${x},${z}`);
        if (carrot && patch.has(`${x},${z}`)) row.push('carrot');
        else {
          if (carrot) roots.push([c, r]);
          const here = world.getBlock(x, y + 1, z);
          row.push(here === LAMP || here === LIGHT ? 'lamp' : placeables?.at(x, y + 1, z) || solid(here) ? 'fence' : null);
        }
        if (lit(x, y + 1, z)) litCells.add(`${c},${r}`);
      }
      grid.push(row);
    }
    // Eight burrowers tunnel in a night, one through each of eight gaps spaced round the edge.
    const ring: At[] = [];
    for (let c = 0; c < cols; c++) ring.push([c, 0]);
    for (let r = 1; r < rows; r++) ring.push([cols - 1, r]);
    for (let c = cols - 2; c >= 0; c--) ring.push([c, rows - 1]);
    for (let r = rows - 2; r > 0; r--) ring.push([0, r]);
    const doors: At[] = [];
    for (let i = 0; i < 8; i++) {
      let at = Math.floor((i * ring.length) / 8);
      for (let step = 0; step < ring.length && grid[ring[at][1]][ring[at][0]] !== null; step++) at = (at + 1) % ring.length;
      if (!doors.some((d) => d[0] === ring[at][0] && d[1] === ring[at][1])) doors.push(ring[at]);
    }
    const layout: BaitLayout = { grid, doors, roots, lit: litCells };
    const give = scoreBait(layout, false);
    const mid = inPatch[Math.floor(inPatch.length / 2)];
    sites.push({
      farm: 'copper', built: inPatch.length >= 2, center: { x: (x0 + x1 + 1) / 2, y: y + 3.2, z: (z0 + z1 + 1) / 2 }, drop: center(mid.x, y + 1, mid.z),
      score: taking('copper') ? scoreBait(layout, true) : give, take: scoreBait(layout, true).rate, hours: 'night', item: 'copper',
      plan: { kind: 'bait', run: give.run, cell: (c, r) => ({ x: x0 + c + 0.5, y: y + 1, z: z0 + r + 0.5 }) },
    });
  }

  // ------------------------------------------------------------------------------------ the wheat field, the terrace

  const wheat = crops.filter((c) => c.state.crop === 'wheat');
  if (wheat.length) {
    const x0 = Math.min(...wheat.map((c) => c.x)) - 2, x1 = Math.max(...wheat.map((c) => c.x)) + 2;
    const z0 = Math.min(...wheat.map((c) => c.z)) - 2, z1 = Math.max(...wheat.map((c) => c.z)) + 2;
    const grid: FarmGrid = [];
    const fieldAt = new Set(wheat.map((c) => `${c.x},${c.z}`));
    const byCol = new Map<string, MachinePart>();
    // The field's own machines: its sprinklers and whatever shares a shaft with them. Another farm's wheel nearby is not its.
    const own = new Set<number>();
    for (const part of parts) if (part.kind === 'sprinkler' && part.shaft >= 0 && part.x >= x0 && part.x <= x1 && part.z >= z0 && part.z <= z1) own.add(part.shaft);
    for (const part of parts) if (own.has(part.shaft) && part.x >= x0 - 2 && part.x <= x1 + 2 && part.z >= z0 - 2 && part.z <= z1 + 2) byCol.set(`${part.x},${part.z}`, part);
    // The wheels that turn the field's shafts may stand just outside it: the frame takes them in.
    const wx0 = Math.min(x0, ...[...byCol.values()].map((p) => p.x)), wx1 = Math.max(x1, ...[...byCol.values()].map((p) => p.x));
    const wz0 = Math.min(z0, ...[...byCol.values()].map((p) => p.z)), wz1 = Math.max(z1, ...[...byCol.values()].map((p) => p.z));
    for (let z = wz0; z <= wz1; z++) {
      const row: FarmCell[] = [];
      for (let x = wx0; x <= wx1; x++) {
        const part = byCol.get(`${x},${z}`);
        if (fieldAt.has(`${x},${z}`)) row.push('field');
        else if (part?.kind === 'waterwheel') row.push('wheel');
        else if (part?.kind === 'sprinkler') row.push('sprinkler');
        else if (part && part.shaft >= 0) row.push('shaft');
        else row.push(null);
      }
      grid.push(row);
    }
    const ySoil = wheat[0].y;
    const soilY = new Map(wheat.map((c) => [`${c.x},${c.z}`, c.y]));
    const ditch = (c: number, r: number): boolean => {
      const x = wx0 + c, z = wz0 + r, y = soilY.get(`${x},${z}`) ?? ySoil;
      return world.getBlock(x + 1, y, z) === WATER || world.getBlock(x - 1, y, z) === WATER || world.getBlock(x, y, z + 1) === WATER || world.getBlock(x, y, z - 1) === WATER;
    };
    const wheelPower = (c: number, r: number): number => byCol.get(`${wx0 + c},${wz0 + r}`)?.power ?? 0;
    const terrace = scoreTerrace({ grid, ditch, wheelPower });
    // The real rate: each block beside a ditch gives 2, and each under a working sprinkler 2 at the sprinkler's speed.
    let rate = 0;
    for (const c of wheat) rate += ditch(c.x - wx0, c.z - wz0) ? 2 : 2 * (machines?.sprinkled(c.x, c.y, c.z) ?? 0);
    rate = Math.round(rate);
    const terraceScore = { ...terrace, rate, tag: `${rate} wheat a day` };
    sites.push({
      farm: 'field', built: rate > 0, center: { x: (x0 + x1 + 1) / 2, y: ySoil + 3.4, z: (z0 + z1 + 1) / 2 }, drop: center(wheat[0].x, ySoil + 1, wheat[0].z),
      score: terraceScore, take: 0, hours: 'all', item: 'wheat', plan: { kind: 'none' },
    });
  }

  // ------------------------------------------------------------------------------------ the mossling pen

  const fences = placeables?.all().filter((p) => p.kind === 'fence') ?? [];
  if (fences.length) {
    // Good stone: a stone block with open air on top, in shade, and damp: water within two blocks.
    const good: { x: number; y: number; z: number; yours: boolean; pond: number }[] = [];
    const seen = new Set<string>();
    /** Stone set inside or beside a fence: a pen being built, good or not yet. */
    let stones = 0;
    const wet = (x: number, y: number, z: number): boolean => {
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 1; dy++) if (world.getBlock(x + dx, y + dy, z + dz) === WATER) return true;
      return false;
    };
    for (const f of fences) {
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          for (let dy = -2; dy <= 1; dy++) {
            const x = f.x + dx, y = f.y + dy, z = f.z + dz, k = `${x},${y},${z}`;
            if (seen.has(k)) continue;
            seen.add(k);
            if (!STONES.has(world.getBlock(x, y, z)) || world.getBlock(x, y + 1, z) !== AIR) continue;
            stones++;
            if (world.skyLightAt(x, y + 1, z) > 14 && world.openSky(x, y + 1, z)) continue;
            if (!wet(x, y, z)) continue;
            good.push({ x, y, z, yours: true, pond: 0 });
          }
        }
      }
    }
    // The wild stones by the pond, which take the first mosslings that wander in.
    let rivals = 0;
    const rocks = sys.region?.place('grant.rocks')?.at;
    if (rocks) {
      const pen = good[0];
      const penFar = pen ? Math.hypot(pen.x - rocks.x, pen.z - rocks.z) : Infinity;
      if (penFar > 12) rivals = 0;
      else rivals = penFar > 6 ? 1 : 0;
    }
    const come = Math.min(3, good.length + rivals);
    const settled = Math.max(0, Math.min(good.length, come - rivals));
    // A fed pair brings a third.
    const mosslings = settled === 2 && good.length >= 3 ? 3 : settled;
    const rate = mosslings * 10;
    const f = fences[0];
    let symptom: string, fix: string;
    if (!good.length) { symptom = 'No stone in your pen is damp and in shade.'; fix = 'A mossling settles on mossy stone with water within two blocks and something over it. Bring stone in, wet it, roof it.'; }
    else if (rivals) { symptom = `${plural(rivals, 'mossling stopped', 'mosslings stopped')} at the wild stones by the pond.`; fix = 'They stop at the first good stone they reach. Build the pen nearer the pond than the wild stones are.'; }
    else if (mosslings < 3) { symptom = `${plural(mosslings, 'mossling lives', 'mosslings live')} here.`; fix = 'A fed pair brings a third, if there is a third good stone for it.'; }
    else { symptom = 'Three mosslings, fed and settled.'; fix = 'Nothing is holding it back. Three is what one pond feeds.'; }
    const spots = good.slice(0, mosslings).map((s) => ({ x: s.x + 0.5, y: s.y + 1, z: s.z + 0.5 }));
    // A fence with no stone by it is just a fence.
    if (stones > 0) sites.push({
      farm: 'moss', built: good.length > 0, center: { x: (good[0]?.x ?? f.x) + 0.5, y: (good[0]?.y ?? f.y) + 3.2, z: (good[0]?.z ?? f.z) + 0.5 },
      drop: spots[0] ?? center(f.x, f.y, f.z),
      score: taking('moss') ? score(mosslings * 60, `${mosslings * 60} fiber till dusk`, 'Then they go grey, and are gone by dawn', 'The pen is shut.', 'Open it again, and the next mosslings settle in two days.') : score(rate, `${rate} fiber a day`, `${plural(mosslings, 'mossling', 'mosslings')} on ${plural(good.length, 'good stone', 'good stones')}`, symptom, fix),
      take: mosslings * 60, hours: 'all', item: 'moss_fiber', plan: { kind: 'spots', sprite: 'mossling', spots },
    });
  }

  // ------------------------------------------------------------------------------------ beast farms

  const posts = partsOf('post');
  const lone = posts.filter((p) => !posts.some((q) => q !== p && Math.abs(q.x - p.x) + Math.abs(q.z - p.z) <= 3));
  const strip = posts.filter((p) => !lone.includes(p));
  if (game.flags.is('fight.2.won') && strip.length) {
    // The thistle run: the hog walks between the two posts farthest apart, scratching on each one it passes.
    let a = strip[0], b = strip[0], far = -1;
    for (const p of strip) for (const q of strip) { const d = Math.abs(p.x - q.x) + Math.abs(p.z - q.z); if (d > far) { far = d; a = p; b = q; } }
    const clapper = partsOf('clapper').some((c) => Math.abs(c.x - a.x) + Math.abs(c.z - a.z) <= 2 || Math.abs(c.x - b.x) + Math.abs(c.z - b.z) <= 2);
    const counted = Math.min(strip.length, 6);
    // Wren at the beast yard: a second calmed beast shares the strip.
    const two = working('wren', 'beasts');
    const rate = counted * (clapper ? 3 : 1) * (two ? 2 : 1);
    sites.push({
      farm: 'quill', built: strip.length >= 2, center: { x: (a.x + b.x + 1) / 2, y: a.y + 2.8, z: (a.z + b.z + 1) / 2 }, drop: center(a.x, a.y, a.z),
      score: score(rate, `${rate} quills a day`, `${clapper ? 'At a run' : 'At a walk'}${two ? ', two of them' : ''}`,
        strip.length < 6 ? `It passes ${plural(strip.length, 'post', 'posts')} on its strip.` : clapper ? 'It runs past every post.' : 'It walks its strip and scratches as it goes.',
        strip.length < 6 ? 'Each post it passes is a quill. Six posts along its strip is a full run.' : clapper ? 'Nothing is holding it back.' : 'A clapper at one end of the strip sends it past every post at a run: three times the quills.'),
      take: 0, hours: 'day', item: 'quill',
      plan: { kind: 'strip', sprite: 'thistlehog-calmed', from: center(a.x, a.y, a.z), to: center(b.x, b.y, b.z), run: clapper, stops: strip.map((p) => center(p.x, p.y, p.z)), two },
    });
  }

  const hedge = crops.filter((c) => c.state.crop === 'berry_bush');
  const fox = sys.pets?.all().find((pet) => pet.kind === 'leaftail' && pet.bonded);
  if (hedge.length) {
    const ripe = hedge.some((c) => c.state.stage >= 1);
    const rate = fox && hedge.length >= 3 && ripe ? 3 : 0;
    const h = hedge[0];
    sites.push({
      farm: 'seed', built: hedge.length >= 3, center: { x: h.x + 0.5, y: h.y + 3, z: h.z + 0.5 }, drop: center(h.x, h.y + 1, h.z),
      score: score(rate, `${rate} seeds a day`, fox ? 'Your fox eats from the hedge' : 'No fox of yours yet',
        !fox ? 'No fox comes to the hedge.' : hedge.length < 3 ? `The hedge is ${plural(hedge.length, 'bush', 'bushes')} long.` : !ripe ? 'The hedge has not fruited yet.' : 'Your fox eats, and brings you what it buried.',
        !fox ? 'A fox you calmed and fed comes to a hedge by its den.' : hedge.length < 3 ? 'Plant three berries in a row, along a ditch.' : !ripe ? 'A hedge fruits two days after it is planted. Keep it wet.' : 'Carrot seeds first. Once you have grown a carrot, sunroot too.'),
      take: 0, hours: 'day', item: 'carrot_seeds', also: game.flags.is('harvested.carrot') ? 'sunroot_seeds' : undefined, plan: { kind: 'none' },
    });
  }

  if (game.flags.is('fight.8.won')) {
    for (const hatch of partsOf('hatch')) {
      const open = machines?.hatchOpen(hatch.id) ?? false;
      const t = game.clock.timeOfDay;
      const sun = t > 0.27 && t < 0.73;
      const rate = 2;
      const [dx, dz] = DIRS[(hatch.quarterTurns + 2) & 3];
      const spot = center(hatch.x + dx, hatch.y, hatch.z + dz);
      sites.push({
        farm: 'rope', built: true, center: { x: spot.x, y: hatch.y + 3, z: spot.z }, drop: spot,
        score: score(open && sun ? rate : 0, `${open ? rate : 0} rope a day`, open ? 'The hatch is open' : 'The hatch is shut',
          !open ? 'The hatch is shut. It sleeps in the dark and grows nothing.' : !sun ? 'Night. It grows vine only in the sun.' : 'It sleeps in the sun and grows vine.',
          !open ? 'Open the hatch: by hand, or with a lever on its shaft.' : 'Nothing is holding it back.'),
        take: 0, hours: 'day', item: 'vine_rope', plan: { kind: 'spots', sprite: 'rootsnare-calmed', spots: [spot] },
      });
      break;
    }
  }

  if (game.flags.is('fight.11.won') && lone.length) {
    const gate = lone[0];
    const [dx, dz] = DIRS[gate.quarterTurns & 3];
    const end = center(gate.x + dx * 8, gate.y, gate.z + dz * 8);
    sites.push({
      farm: 'plough', built: true, center: { x: gate.x + 0.5 + dx * 4, y: gate.y + 4, z: gate.z + 0.5 + dz * 4 }, drop: center(gate.x, gate.y, gate.z),
      score: score(1, '1 strip a day', 'And a tusk tip every three days', 'He roots up his strip each morning, with Wren.', 'His strip runs eight blocks from the gatepost the way it faces. Turn the post to move it.'),
      take: 0, hours: 'day', item: 'old_brass', plan: { kind: 'strip', sprite: 'boar-calmed', from: center(gate.x + dx, gate.y, gate.z + dz), to: end, run: false, stops: [] },
    });
  }

  // ------------------------------------------------------------------------------------ light and wings

  const lamps: Vec3[] = [];
  const lampAt = (x: number, y: number, z: number): void => void lamps.push({ x, y, z });
  for (const part of parts) if (part.kind === 'switch_lamp' && part.state === 'working') lampAt(part.x, part.y, part.z);
  for (const at of lampBlocks) if (world.getBlock(at.x, at.y, at.z) === LAMP) lampAt(at.x, at.y, at.z);
  const nearWater = (x: number, y: number, z: number, r: number): Vec3 | null => {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = -2; dy <= 0; dy++) if (world.getBlock(x + dx, y + dy, z + dz) === WATER) return { x: x + dx, y: y + dy, z: z + dz };
    return null;
  };
  /** The lanternflies of one place, ten a night, go to the lamps within twelve blocks in equal shares. */
  const share = (at: Vec3): number => 10 / Math.max(1, lamps.filter((l) => Math.abs(l.x - at.x) <= 12 && Math.abs(l.z - at.z) <= 12).length);

  // The lamp pond: a lamp at the water's edge, and frogs on the bank under it eat the flies it draws.
  const pondLamp = lamps.find((l) => nearWater(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z), 3));
  if (pondLamp) {
    const water = nearWater(Math.floor(pondLamp.x), Math.floor(pondLamp.y), Math.floor(pondLamp.z), 3) as Vec3;
    // Up to three frogs on the bank round the water, each within three of the lamp.
    const frogs: Vec3[] = [];
    for (let dx = -3; dx <= 3 && frogs.length < 3; dx++) {
      for (let dz = -3; dz <= 3 && frogs.length < 3; dz++) {
        const x = water.x + dx, z = water.z + dz, y = water.y + 1;
        if (world.getBlock(x, y - 1, z) === WATER || world.getBlock(x, y, z) !== AIR || world.getBlock(x, y - 1, z) === AIR) continue;
        if (Math.abs(x - pondLamp.x) > 3 || Math.abs(z - pondLamp.z) > 3) continue;
        if (frogs.some((f) => Math.abs(f.x - x - 0.5) + Math.abs(f.z - z - 0.5) < 2)) continue;
        frogs.push(center(x, y, z));
      }
    }
    const flies = share(pondLamp);
    const fed = Math.min(frogs.length, Math.floor(flies));
    const rate = fed * 2;
    const others = lamps.filter((l) => l !== pondLamp && Math.abs(l.x - pondLamp.x) <= 12 && Math.abs(l.z - pondLamp.z) <= 12).length;
    sites.push({
      farm: 'pond', built: true, center: { x: pondLamp.x + 0.5, y: pondLamp.y + 2.5, z: pondLamp.z + 0.5 }, drop: frogs[0] ?? center(water.x, water.y + 1, water.z),
      score: taking('pond') ? score(rate * 2, `${rate * 2} slick tonight`, 'Then the pond is empty three days', 'You netted the pond.', 'Switch to Give, and the frogs come back.') : score(rate, `${rate} slick a night`, `${plural(frogs.length, 'frog', 'frogs')}, ${Math.round(flies)} of 10 lanternflies`,
        !frogs.length ? 'No frog can sit near the lamp.' : others ? `${plural(others, 'other lamp takes', 'other lamps take')} a share of the lanternflies.` : fed < frogs.length ? 'Not every frog is fed.' : 'Every frog is fed.',
        !frogs.length ? 'Frogs sit on the bank within three blocks of the lamp. Leave them dry ground at the water\'s edge.' : others ? 'Lanternflies split between every lamp within twelve blocks. Fewer lamps nearby, more for the frogs.' : 'Nothing is holding it back.'),
      take: rate * 2, hours: 'night', item: 'frog_slick', plan: { kind: 'spots', sprite: 'frog', spots: frogs },
    });
  }

  // The lamp trap: a lamp over a collector chest, away from water.
  for (const chest of partsOf('collector_chest')) {
    const lamp = lamps.find((l) => Math.abs(l.x - chest.x) <= 1 && Math.abs(l.z - chest.z) <= 1 && l.y >= chest.y && l.y <= chest.y + 2);
    if (!lamp || nearWater(chest.x, chest.y, chest.z, 4)) continue;
    const flies = share(lamp);
    const full = chest.state === 'backed up';
    const rate = full ? 0 : Math.round(flies);
    sites.push({
      farm: 'dust', built: true, center: { x: chest.x + 0.5, y: chest.y + 3, z: chest.z + 0.5 }, drop: center(chest.x, chest.y, chest.z),
      score: taking('dust') ? score(rate * 2, `${rate * 2} dust tonight`, 'Then the flies stay away three days', 'You swept the trap clean.', 'Switch to Give, and they come back.') : score(rate, `${rate} glow dust a night`, `${Math.round(flies)} of the valley's 10 lanternflies`,
        full ? 'The chest is full.' : flies < 10 ? 'Other lamps take a share of the flies.' : 'Every lanternfly comes to this lamp.',
        full ? 'Empty the chest, or set a sensor to turn the lamp off when the chest has no room.' : flies < 10 ? 'Lanternflies split between every lamp within twelve blocks, your pond lamp too.' : 'Nothing is holding it back.'),
      take: rate * 2, hours: 'night', item: 'glow_dust', plan: { kind: 'spots', sprite: 'lanternfly-world', spots: [{ x: lamp.x + 0.5, y: lamp.y + 1.2, z: lamp.z + 0.5 }], fly: true },
    });
    break;
  }

  // Bee boxes: flowers within ten blocks, and no farm on Take near them.
  const boxes = partsOf('bee_box');
  if (boxes.length) {
    const box = boxes[0];
    let grass = 0, tilled = 0;
    for (let dx = -10; dx <= 10; dx++) {
      for (let dz = -10; dz <= 10; dz++) {
        const x = box.x + dx, z = box.z + dz;
        for (let dy = -2; dy <= 1; dy++) {
          const id = world.getBlock(x, box.y - 1 + dy, z);
          if (id === GRASS && world.getBlock(x, box.y + dy, z) === AIR) { grass++; break; }
          if (id === TILLED) { tilled++; break; }
        }
      }
    }
    // A field planted wall to wall: more tilled ground than flowers a box's way round. Gus on his own field rests
    // one row in four, so the bees stay.
    const wall = tilled > 0 && grass < tilled && !working('gus', 'field');
    const anyTake = (['moss', 'copper', 'spring', 'pond', 'dust'] as const).some((f) => taking(f));
    const living = !wall && !anyTake && grass >= 20;
    // Tansy at the hives: bees give half again.
    const tansy = working('tansy', 'bees');
    const rate = living ? Math.round(4 * boxes.length * (tansy ? 1.5 : 1)) : 0;
    const spots = boxes.slice(0, 3).map((b) => center(b.x, b.y + 1, b.z));
    sites.push({
      farm: 'bee', built: true, center: { x: box.x + 0.5, y: box.y + 3, z: box.z + 0.5 }, drop: center(box.x, box.y, box.z),
      score: taking('bee') ? score(rate * 2, `${rate * 2} honey and wax now`, 'Then they leave for three days', 'You took the comb.', 'Switch to Give, and they come back.') : score(rate, `${rate} honey and wax a day`, `${plural(boxes.length, 'box', 'boxes')}, ${grass} flowers in reach${tansy ? ', Tansy keeps them' : ''}`,
        anyTake ? 'A farm on Take within ten blocks drives them off.' : wall ? 'The field is planted wall to wall. There are no flowers for them.' : grass < 20 ? 'Too few flowers within ten blocks.' : 'The bees visit every flower within ten blocks.',
        anyTake ? 'Put that farm back on Give.' : wall ? 'Rest one row in four. Grass between the rows is flowers to a bee.' : grass < 20 ? 'Set the box where there is open meadow within ten blocks.' : 'Nothing is holding it back. Put the box inside your field and the wheat is on their way.'),
      take: rate * 2, hours: 'day', item: 'honey', also: 'wax', plan: { kind: 'spots', sprite: 'bee', spots, fly: true },
    });
  }

  return sites;
}
