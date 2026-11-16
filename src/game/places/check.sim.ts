// The place check: one set of questions asked of every place in the world, the same way each time.
//
// A place is anything built into the land: a ruin, a shrine, a court, a camp, a jetty. The check knows a place
// only as a `Subject`: its pieces (a model, where it stands and how it meets the ground), where a player stands
// in it, its ways in and out, and its budget. Two things make subjects: the place system (`subjectsOf` in
// build.sim.ts, from src/game/content/places) and the older lists it replaces (legacy.sim.ts). So the whole world
// is checked today, and a place that moves to the place system is checked harder, not differently.
//
// Everything here is a pure function of what it is handed. The land, the models' shapes and what is reachable come
// in as `CheckLand` and `CheckModels`: `tools/place-check.ts` hands it the real ones, a test hands it small fakes.
//
// Each finding names the place, the piece and the fix. Worst first.

export type Severity = 'error' | 'warn' | 'note';

export interface Finding {
  level: Severity;
  /** Which question found it: `floating`, `buried`, `in-water`, `old-blocks`, ... */
  check: string;
  place: string;
  /** The piece, or '' when it is about the whole place. */
  piece: string;
  x: number;
  z: number;
  what: string;
  fix: string;
  /** How bad, to sort by inside a level: blocks of gap, cells of overlap, old blocks counted. */
  size: number;
}

/** How a piece meets the ground. */
export type Sit =
  /** It stands on the ground: checked for a gap under it, land over it, water and slope. */
  | 'ground'
  /** It stands in water on purpose: a jetty, a boat, a wheel in the river. */
  | 'water'
  /** It stands on something built that is not the ground: the High Road's deck, a floor laid by the place. */
  | 'deck'
  /** Its foot goes down into the ground or the water by design (a pier, a tower's base): only a gap under it is a fault. */
  | 'rooted'
  /** It is set down into a pit dug for it. */
  | 'sunk';

export interface PieceFact {
  id: string;
  model: string;
  /** The variant's name, or '' for the first. */
  variant: string;
  x: number;
  z: number;
  /** Radians round y, as the view turns it. */
  rotation: number;
  /** The y its model's own y = 0 stands at, as the view draws it. */
  base: number;
  /** What the data says its footprint is: across its front, front to back, and high. */
  size: { w: number; d: number; h: number };
  sit: Sit;
  /** A body cannot walk through it: it is fenced with barrier. */
  solid: boolean;
  /** A bank of land is raised behind it on purpose (a door in a hill), so land over its back is not a fault. */
  bank: boolean;
  /** One of a run laid end to end (arches, boardwalks, wall faces): meeting its neighbour is not an overlap. */
  joins: boolean;
  /** What it stands in for, when it is not the model the plan asks for. */
  standIn: string;
}

export interface Subject {
  id: string;
  name: string;
  /** Built by the place system. A legacy subject is checked the same, but its findings never fail a build. */
  declared: boolean;
  pieces: readonly PieceFact[];
  /** Where a player must be able to stand: the place's own point and its named spots. */
  stands: readonly { id: string; x: number; z: number }[];
  /** Ways in and out: a door, a stair, a gate. `to` names where it leads. */
  links: readonly { id: string; x: number; z: number; to: string }[];
  sky: 'open' | 'under';
  /** The ground the place cleared for itself, where no old block, tree or scatter may be. Empty for a legacy subject. */
  cleared: readonly Rect[];
  /** Declared places only: what it may cost by itself at low and at high. */
  budget: { low: Cost; high: Cost } | null;
  /** Declared places only: its cameras, each with the painting it must match. */
  cameras: readonly { id: string; sheet: string }[];
  /** Lamps the place lights at night. */
  lamps: number;
}

export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Cost { draws: number; triangles: number }

/** What the check asks of the land. Heights are the top of the ground: feet stand at `ground(x, z)`. */
export interface CheckLand {
  ground(x: number, z: number): number;
  /** The y water fills to at a column. */
  water(x: number, z: number): number;
  /** The key of a block that is drawn at this cell and is not the land's own (planks, bricks, crystals), or ''. */
  oldBlock(x: number, y: number, z: number): string;
  /** Trees rooted in a box of columns. */
  trees(x0: number, z0: number, x1: number, z1: number): readonly { x: number; z: number; kind: string }[];
  /** True when a body can walk from the road to this column. */
  walkable(x: number, z: number): boolean;
  /** True inside the map a player walks. */
  inMap(x: number, z: number): boolean;
}

/** One model's shape, measured from its geometry. Cells are whole blocks of its own space, before it is turned. */
export interface ModelShape {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  /** The cells where it touches down, as x, z, lowest y: three numbers a cell. */
  feet: ArrayLike<number>;
  /** Every cell it covers, as x, z, lowest y: three numbers a cell. */
  cover: ArrayLike<number>;
  /** Its triangles at low and at high. */
  triangles: { low: number; high: number };
}

export interface CheckModels {
  /** The model's shape, or null when no such model or variant is made. */
  shape(model: string, variant: string): ModelShape | null;
}

export interface CheckOptions {
  /** Where the game's camera stands from the hero's feet, so the check can ask what the land hides. */
  eye: { dx: number; dy: number; dz: number };
  /** Every name a link may lead to. */
  known: ReadonlySet<string>;
  /** True when a painting's file is there. */
  sheetExists(path: string): boolean;
}

// ------------------------------------------------------------------------------------------ numbers

/** A gap under a foot smaller than this is hidden by grass and the model's own skirt. */
const GAP = 0.6;
/** A gap this big is seen from any camera. */
const GAP_BAD = 1.5;
/** This share of a model's feet must hang or drown before it is a finding: one corner on a slope is not. */
const SHARE = 0.15;
const SHARE_BAD = 0.4;
/** The hero's chest over the feet, as the sight rule has it. */
const CHEST = 1.1;

const rank: Record<Severity, number> = { error: 0, warn: 1, note: 2 };

/** A model cell's middle, turned and put where its piece stands. Three.js turns x toward -z as y rotation grows. */
function place(p: PieceFact, cx: number, cz: number, out: { x: number; z: number }): { x: number; z: number } {
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation), lx = cx + 0.5, lz = cz + 0.5;
  out.x = Math.floor(p.x + lx * c + lz * s);
  out.z = Math.floor(p.z - lx * s + lz * c);
  return out;
}
const at = { x: 0, z: 0 };

/** The corners of a piece's footprint on the ground: its model's own box when it is made, else its declared size. */
function corners(p: PieceFact, shape: ModelShape | null, grow: number): [number, number][] {
  const x0 = (shape ? shape.min[0] : -p.size.w / 2) - grow, x1 = (shape ? shape.max[0] : p.size.w / 2) + grow;
  const z0 = (shape ? shape.min[2] : -p.size.d / 2) - grow, z1 = (shape ? shape.max[2] : p.size.d / 2) + grow;
  const c = Math.cos(p.rotation), s = Math.sin(p.rotation);
  return ([[x0, z0], [x1, z0], [x1, z1], [x0, z1]] as const).map(([lx, lz]) => [p.x + lx * c + lz * s, p.z - lx * s + lz * c]);
}

function boxOf(points: readonly [number, number][]): Rect {
  return {
    x0: Math.floor(Math.min(...points.map((q) => q[0]))), z0: Math.floor(Math.min(...points.map((q) => q[1]))),
    x1: Math.ceil(Math.max(...points.map((q) => q[0]))), z1: Math.ceil(Math.max(...points.map((q) => q[1]))),
  };
}

/** True when a point is inside a turned box given by its four corners in order. */
function inside(quad: readonly [number, number][], x: number, z: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, az] = quad[i], [bx, bz] = quad[(i + 1) % 4];
    const cross = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** How deep two turned boxes go into each other, in blocks: 0 when they do not meet. The separating axis test. */
function overlap(a: readonly [number, number][], b: readonly [number, number][]): number {
  let least = Infinity;
  for (const quad of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const ex = quad[i + 1][0] - quad[i][0], ez = quad[i + 1][1] - quad[i][1], len = Math.hypot(ex, ez) || 1;
      const nx = -ez / len, nz = ex / len;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, z] of a) { const d = x * nx + z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const [x, z] of b) { const d = x * nx + z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      const depth = Math.min(a1, b1) - Math.max(a0, b0);
      if (depth <= 0) return 0;
      least = Math.min(least, depth);
    }
  }
  return least;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

// ------------------------------------------------------------------------------------------ one piece

function checkPiece(subject: Subject, p: PieceFact, land: CheckLand, models: CheckModels, out: Finding[]): void {
  const add = (level: Severity, check: string, what: string, fix: string, size = 0): void => {
    out.push({ level, check, place: subject.id, piece: p.id, x: Math.round(p.x), z: Math.round(p.z), what, fix, size });
  };
  const shape = models.shape(p.model, p.variant);
  if (!shape) {
    add('error', 'no-model', `the model ${p.model}${p.variant ? ` (${p.variant})` : ''} is not made, so nothing is drawn here`,
      `build ${p.model} with the make-3d-asset skill, or name a model that exists and mark it standIn`);
    return;
  }
  if (p.standIn) add('warn', 'stand-in', `${p.model} stands in for ${p.standIn}`, `build ${p.standIn} from its sheet and put it here`);

  // The data's footprint against the model's own: the barrier and the levelled ground follow the data.
  const w = shape.max[0] - shape.min[0], d = shape.max[2] - shape.min[2], h = shape.max[1] - shape.min[1];
  const off = (said: number, is: number): boolean => Math.abs(said - is) > Math.max(1.5, 0.3 * Math.max(said, is));
  if (off(p.size.w, w) || off(p.size.d, d) || off(p.size.h, h)) {
    add('warn', 'size', `the data says ${p.size.w} x ${p.size.d} x ${p.size.h} (across, deep, high) and the model is ${round1(w)} x ${round1(d)} x ${round1(h)}: its barrier and its level ground are the wrong size`,
      `set the size of ${p.model} to the model's, or rebuild the model to the sheet's size`, Math.abs(p.size.w - w) + Math.abs(p.size.d - d));
  }

  if (p.sit === 'ground' || p.sit === 'rooted') {
    const rooted = p.sit === 'rooted';
    // Under each foot: a gap, water, or neither. Over each covered cell: land higher than the model's foot.
    const feet = shape.feet.length / 3;
    let hang = 0, gap = 0, wet = 0, low = Infinity, high = -Infinity;
    for (let i = 0; i < shape.feet.length; i += 3) {
      place(p, shape.feet[i], shape.feet[i + 1], at);
      const g = land.ground(at.x, at.z), under = p.base + shape.feet[i + 2] - g;
      low = Math.min(low, g); high = Math.max(high, g);
      const inWater = g < land.water(at.x, at.z);
      if (inWater) wet++;
      // Over water a rooted thing stands on the river's bed, which the water hides.
      if (under > GAP && !(rooted && inWater)) { hang++; gap = Math.max(gap, under); }
    }
    const slope = feet ? high - low : 0;
    const why = slope >= 1.5 ? `; the ground under it falls ${round1(slope)} blocks from one side to the other` : '';
    if (feet && !rooted && wet / feet >= SHARE) {
      add('error', 'in-water', `${pct(wet / feet)} of its feet stand in water${why}`,
        'move it to dry ground, raise the ground under it, or say it stands in water (wet / sit: water) and seat it on the water line', wet);
    } else if (feet && (hang / feet >= SHARE || gap >= GAP_BAD) && hang > 0) {
      add(gap >= GAP_BAD || hang / feet >= SHARE_BAD ? 'error' : 'warn', 'floating',
        `${pct(hang / feet)} of its feet hang over the ground, up to ${round1(gap)} blocks${why}`,
        'level the ground under its whole footprint (a pad as wide as the model, not its middle), or give it a base of rock down to the ground', gap);
    }
    if (!p.bank && !rooted) {
      const cells = shape.cover.length / 3, deep = Math.max(1.2, 0.25 * h);
      let sunk = 0, most = 0;
      for (let i = 0; i < shape.cover.length; i += 3) {
        place(p, shape.cover[i], shape.cover[i + 1], at);
        const over = land.ground(at.x, at.z) - p.base;
        if (over > deep) { sunk++; most = Math.max(most, over); }
      }
      if (cells && sunk / cells >= SHARE) {
        add(sunk / cells >= SHARE_BAD ? 'error' : 'warn', 'buried', `the land stands up to ${round1(most)} blocks over its foot on ${pct(sunk / cells)} of its footprint${why}`,
          'cut the ground down to its base across its footprint, or raise it; if a hill is meant to stand behind it, give it a bank (back)', most);
      }
    }
    if (slope >= 2 && !rooted && !out.some((f) => f.piece === p.id && f.place === subject.id && (f.check === 'floating' || f.check === 'buried' || f.check === 'in-water'))) {
      add('note', 'slope', `the ground under it falls ${round1(slope)} blocks from one side to the other`, 'level its ground, or check its picture: a small thing may lie on a slope');
    }
  }

  // Old blocks and trees inside its footprint.
  const quad = corners(p, shape, 0.5), box = boxOf(quad);
  const old = new Map<string, number>();
  for (let x = box.x0; x <= box.x1; x++) for (let z = box.z0; z <= box.z1; z++) {
    if (!inside(quad, x + 0.5, z + 0.5)) continue;
    const g = land.ground(x, z), top = Math.max(g, Math.ceil(p.base)) + Math.ceil(h) + 1;
    for (let y = Math.min(g, Math.floor(p.base)) - 1; y <= top; y++) {
      const key = land.oldBlock(x, y, z);
      if (key) old.set(key, (old.get(key) ?? 0) + 1);
    }
  }
  if (old.size) {
    const n = [...old.values()].reduce((a, b) => a + b, 0);
    add(n >= 6 ? 'error' : 'warn', 'old-blocks', `${[...old].map(([k, c]) => `${c} ${k}`).join(', ')} block${n === 1 ? '' : 's'} of the old block world ${n === 1 ? 'is' : 'are'} drawn inside its footprint`,
      'find what writes them (tools/place-check.ts --blocks names the source) and stop it here: a model and blocks must not both draw the same thing', n);
  }
  if (p.solid) {
    const trees = land.trees(box.x0, box.z0, box.x1 + 1, box.z1 + 1).filter((t) => inside(quad, t.x + 0.5, t.z + 0.5));
    if (trees.length) {
      add('error', 'tree-inside', `${trees.length} tree${trees.length === 1 ? '' : 's'} (${trees[0].kind} at ${trees[0].x}, ${trees[0].z}) grow${trees.length === 1 ? 's' : ''} through it`,
        'clear its footprint of trees: in the place system the footprint is cleared for you; in the old lists add it to the land\'s no-tree rule', trees.length);
    }
  }
}

// ------------------------------------------------------------------------------------------ one place

function checkSubject(subject: Subject, land: CheckLand, models: CheckModels, options: CheckOptions, out: Finding[]): void {
  const add = (level: Severity, check: string, x: number, z: number, what: string, fix: string, size = 0, piece = ''): void => {
    out.push({ level, check, place: subject.id, piece, x: Math.round(x), z: Math.round(z), what, fix, size });
  };
  for (const p of subject.pieces) checkPiece(subject, p, land, models, out);
  const mid = subject.stands[0] ?? subject.pieces[0] ?? { x: 0, z: 0 };

  // The ground the place cleared for itself.
  for (const r of subject.cleared) {
    const old = new Map<string, number>();
    for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) {
      const g = land.ground(x, z);
      for (let y = g - 1; y <= g + 12; y++) { const key = land.oldBlock(x, y, z); if (key) old.set(key, (old.get(key) ?? 0) + 1); }
    }
    if (old.size) {
      const n = [...old.values()].reduce((a, b) => a + b, 0);
      add('error', 'old-blocks', (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, `${[...old].map(([k, c]) => `${c} ${k}`).join(', ')} blocks of the old block world are drawn on its cleared ground`,
        'something still stamps blocks here after the place cleared it: see tools/place-check.ts --blocks', n);
    }
    const trees = land.trees(r.x0, r.z0, r.x1 + 1, r.z1 + 1);
    if (trees.length) add('error', 'tree-inside', trees[0].x, trees[0].z, `${trees.length} trees grow on its cleared ground`, 'the terrain must ask the place system before it plants a tree', trees.length);
  }

  // Where a player stands, and the ways in and out.
  if (subject.sky === 'open') {
    for (const s of subject.stands) {
      if (!land.inMap(s.x, s.z)) continue;
      let ok = false;
      for (let dz = -2; dz <= 2 && !ok; dz++) for (let dx = -2; dx <= 2 && !ok; dx++) ok = land.walkable(Math.floor(s.x) + dx, Math.floor(s.z) + dz);
      if (!ok) add('error', 'unreachable', s.x, s.z, `nobody can walk to ${s.id} from the road`, 'join it to a path of the plan with walkable ground (a slope of one block a step at most), or open the barrier that fences it');
    }
  } else {
    const open = subject.stands.filter((s) => land.inMap(s.x, s.z) && land.walkable(Math.floor(s.x), Math.floor(s.z)));
    if (open.length) add('error', 'under-sky', open[0].x, open[0].z, `it is underground, yet a player can walk into it from the meadow at ${open[0].id}`, 'sink it under rock or move it off the walked map, and reach it only through its link');
    if (!subject.links.length) add('error', 'no-way-in', mid.x, mid.z, 'it is underground and has no link, so nothing leads to it', 'give it a link from the door, stair or gate that leads to it');
  }
  for (const l of subject.links) {
    if (!options.known.has(l.to)) add('error', 'dead-end', l.x, l.z, `${l.id} leads to ${l.to}, which is not a place, a spot or a room`, 'name the place it leads to, or build that place first');
    else if (land.inMap(l.x, l.z) && subject.sky === 'open') {
      let ok = false;
      for (let dz = -2; dz <= 2 && !ok; dz++) for (let dx = -2; dx <= 2 && !ok; dx++) ok = land.walkable(Math.floor(l.x) + dx, Math.floor(l.z) + dz);
      if (!ok) add('error', 'dead-end', l.x, l.z, `nobody can walk to ${l.id}, the way to ${l.to}`, 'clear walkable ground up to it');
    }
  }

  // The game's camera: along the ways a player stands, how often the land itself stands between lens and hero.
  if (subject.sky === 'open' && subject.stands.length) {
    let hidden = 0, worst = 0, wx = 0, wz = 0;
    for (const s of subject.stands) {
      const fx = Math.floor(s.x) + 0.5, fz = Math.floor(s.z) + 0.5, fy = land.ground(Math.floor(s.x), Math.floor(s.z)) + CHEST;
      const len = Math.hypot(options.eye.dx, options.eye.dy, options.eye.dz);
      let over = 0;
      for (let t = 3; t < len; t += 1) {
        const k = t / len, x = fx + options.eye.dx * k, z = fz + options.eye.dz * k, y = fy + (options.eye.dy - CHEST) * k;
        over = Math.max(over, land.ground(Math.floor(x), Math.floor(z)) - y);
      }
      if (over > 0.5) { hidden++; if (over > worst) { worst = over; wx = s.x; wz = s.z; } }
    }
    if (hidden) {
      add(hidden === subject.stands.length || worst >= 4 ? 'warn' : 'note', 'hidden', wx, wz,
        `from the game's camera the land hides the hero at ${hidden} of its ${subject.stands.length} standing points, by up to ${round1(worst)} blocks`,
        'lower or move the hill that stands south-east of it: the camera looks north-west, so high ground belongs north and west of where a player stands', worst);
    }
  }

  if (!subject.declared) return;
  // What only a place of the place system promises.
  if (!subject.cameras.length) add('error', 'no-camera', mid.x, mid.z, 'it has no camera, so nothing shoots it beside its painting', 'give it a camera for each vista of its region that shows it');
  for (const c of subject.cameras) if (!c.sheet || !options.sheetExists(c.sheet)) add('error', 'no-sheet', mid.x, mid.z, `camera ${c.id} names the painting ${c.sheet || '(none)'}, which is not there`, 'name the approved sheet under assets-src/concept');
  if (!subject.lamps && subject.sky === 'open') add('note', 'no-light', mid.x, mid.z, 'it has no lamp, so at night only the moon lights it', 'look at its night picture; give it a lamp, a fire or a glow if it reads as a black shape');
  if (subject.budget) {
    const kinds = new Set<string>();
    let low = 0, high = 0;
    for (const p of subject.pieces) {
      const shape = models.shape(p.model, p.variant);
      if (!shape) continue;
      kinds.add(`${p.model}:${p.variant}`);
      low += shape.triangles.low; high += shape.triangles.high;
    }
    for (const [name, cost, triangles] of [['low', subject.budget.low, low], ['high', subject.budget.high, high]] as const) {
      if (kinds.size > cost.draws || triangles > cost.triangles) {
        add('error', 'over-budget', mid.x, mid.z, `at ${name} its own models cost ${kinds.size} draw calls and ${triangles} triangles against its budget of ${cost.draws} and ${cost.triangles}`,
          'use fewer kinds of model (each kind and variant is a draw call), or fewer and lighter pieces', triangles - cost.triangles);
      }
    }
  }
}

// ------------------------------------------------------------------------------------------ the world

/** Every finding about these places, worst first. */
export function checkPlaces(subjects: readonly Subject[], land: CheckLand, models: CheckModels, options: CheckOptions): Finding[] {
  const out: Finding[] = [];
  const ids = new Set<string>();
  for (const s of subjects) {
    if (ids.has(s.id)) out.push({ level: 'error', check: 'twice', place: s.id, piece: '', x: 0, z: 0, what: 'two descriptions of this place exist', fix: 'when a place moves to the place system, take its pieces out of the old lists', size: 0 });
    ids.add(s.id);
    checkSubject(s, land, models, options, out);
  }
  // Two solid footprints in one another, in one place or across two.
  const solid: { subject: Subject; p: PieceFact; quad: [number, number][]; box: Rect }[] = [];
  for (const s of subjects) for (const p of s.pieces) {
    if (!p.solid) continue;
    const quad = corners(p, models.shape(p.model, p.variant), 0);
    solid.push({ subject: s, p, quad, box: boxOf(quad) });
  }
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j];
    if (a.box.x1 < b.box.x0 || b.box.x1 < a.box.x0 || a.box.z1 < b.box.z0 || b.box.z1 < a.box.z0) continue;
    if (a.p.joins && b.p.joins && a.p.model === b.p.model) continue;
    const depth = overlap(a.quad, b.quad);
    if (depth < 1) continue;
    out.push({
      level: depth >= 2 ? 'error' : 'warn', check: 'overlap', place: a.subject.id, piece: a.p.id, x: Math.round(a.p.x), z: Math.round(a.p.z),
      what: `it stands ${round1(depth)} blocks inside ${b.p.id}${b.subject.id === a.subject.id ? '' : ` of ${b.subject.id}`}`,
      fix: 'move one of them, or if they are meant to meet (a wall into a tower) mark the smaller one not solid', size: depth,
    });
  }
  return sortFindings(out);
}

export function sortFindings(list: Finding[]): Finding[] {
  return list.sort((a, b) => rank[a.level] - rank[b.level] || b.size - a.size || a.place.localeCompare(b.place) || a.piece.localeCompare(b.piece));
}

/** One line a finding, as the tool prints it. */
export function describe(f: Finding): string {
  return `${f.level.toUpperCase().padEnd(5)} ${f.check.padEnd(11)} ${f.place}${f.piece ? ` / ${f.piece}` : ''} (${f.x}, ${f.z}): ${f.what}\n      fix: ${f.fix}`;
}
