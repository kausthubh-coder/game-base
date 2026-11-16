// Set pieces of the land. Dimensions are meters; the caller supplies walking surfaces.
// The rocks, the oak and the hut are soft forms (README.md in the props folder): smooth rock with broad planes
// and moss on top, a hollow swept trunk with its bark, a thatched lathe roof, all wearing painted skins.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape, type RockOptions } from '../shape.ts';
type V = [number, number, number];

/** The sheets' rock: lavender-grey in shade, pale honey limestone where it faces the sky. */
const ROCK = [P.iron, P.pewter, P.rose, P.ash, P.pearl, P.sand];
/** Leaves on the arch's little tree: deep green under, yellow-green on top. */
const LEAVES = [P.pine, P.moss, P.leaf, P.lime, P.straw];
const BARK = [P.umber, P.bark, P.wood, P.tan];
const THATCH = [P.ochre, P.gold, P.butter, P.lemon];
const TIMBER = [P.timber, P.wood, P.oak, P.tan];
const PLASTER = [P.sandDark, P.sand, P.plaster, P.plasterLight];
/** The cut end of an oak: warm heartwood. */
const HEARTWOOD = [P.ochre, P.gold, P.butter, P.lemon];

/** A boulder of the sheets: broad planes, moss over its top. */
function stone(s: Shape, x: number, z: number, w: number, h: number, d: number, o: RockOptions = {}): void {
  s.rock(x, 0, z, w, h, d, ROCK, { level: 3, planes: 9, flat: 1, reach: 0.6, lump: 0.07, moss: 0.55, light: 0.25, key: 0.5, skin: 'rock', ...o });
}

export function boulders(variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8001 + variant, detail);
  if (variant === 0) stone(s, 0, 0, 5, 4.1, 4);
  else if (variant === 1) {
    stone(s, -0.9, -0.4, 4.2, 4.8, 4.2);
    stone(s, 1.7, 1.1, 2.8, 2.6, 2.6, { moss: 0.6 });
  } else {
    stone(s, -0.6, -1.2, 4.6, 4.4, 3.8);
    stone(s, 1.5, -0.1, 3.2, 3.2, 3.4);
    stone(s, -1.4, 1.3, 3, 2.7, 3, { moss: 0.6 });
    // Two chocks at the foot.
    stone(s, 1.5, 2.2, 1.3, 0.9, 1.1, { level: 2, moss: 0.4 });
    stone(s, 0.1, 2.5, 1, 0.75, 0.9, { level: 2, moss: 0.4 });
  }
  return s.done();
}

/** A rock arch: one mass of rock swept from foot to foot over a 7 m passage with an 8 m crown, piers heaped at its feet. */
export function rockArch(_variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8011, detail);
  // The arch itself. Its section is wide across (6 m deep at the feet) and flatter through the crown.
  s.sweep([[-5.95, -0.8, 0.2], [-5.85, 3, 0.1], [-4.9, 6.6, 0], [-2.6, 9.2, 0], [0.6, 10.3, 0], [3.8, 10, 0], [5.6, 7.4, 0], [5.95, 3.5, -0.1], [6, -0.8, 0]],
    [2.75, 2.65, 2.5, 2.4, 2.45, 2.45, 2.6, 2.75, 2.85], ROCK, { sides: 16, steps: 3, squash: 0.76, lump: 0.12, cap: 'none', floor: 0, skin: 'rock', moss: 0.62, light: 0.3, key: 0.4, cavity: 0.55 });
  // Rock heaped round the feet, and the right pier rising above the span to carry the tree.
  stone(s, -6.4, 0.5, 3.6, 4.6, 5.2, { level: 2, moss: 0.45 });
  stone(s, -5, -2, 2.2, 2.2, 2.2, { level: 2, moss: 0.4 });
  stone(s, 6.3, 0.4, 3.4, 5.4, 5, { level: 2, moss: 0.45 });
  // Blocks bulging out of the piers and the span, so the arch is a heap of rock, not a tube.
  for (const [x, y, z, w, h] of [[-6.6, 4.2, -0.4, 3.2, 3], [-4.6, 7.6, 0.6, 3.2, 2.6], [6.6, 3.6, 0.8, 3, 3.2], [5.3, 6.6, 1, 3, 2.8], [2.2, 9.6, 0.9, 3.4, 2]] as [number, number, number, number, number][]) {
    s.rock(x, y, z, w, h, w * 1.1, ROCK, { level: 2, planes: 7, flat: 1, reach: 0.62, lump: 0.08, moss: 0.6, light: 0.25, key: 0.5, skin: 'rock', seat: false, shadow: false });
  }
  s.rock(5.8, 7.6, -0.2, 3.6, 4.4, 4, ROCK, { level: 2, planes: 7, flat: 1, reach: 0.62, lump: 0.08, moss: 0.6, light: 0.25, key: 0.5, skin: 'rock' });
  // Turf hanging over the lip of the span.
  for (const [x, y, z] of [[-4.6, 8.6, 1.3], [-2, 10.9, -0.9], [1.2, 11.9, 0.9], [-0.6, 11.8, -0.2], [4.6, 10.9, 1.2]] as V[]) {
    s.rock(x, y, z, 2.4, 0.8, 1.8, LEAVES, { level: 1, planes: 2, seat: false, skin: 'moss', light: 0.5, cavity: 0.3, shadow: false });
  }
  // The little tree on the right pier.
  s.sweep([[5.9, 11.4, -0.2], [5.7, 12.5, 0], [5.1, 13.4, 0.3], [4.4, 14, 0.4]], [0.4, 0.3, 0.2, 0.12], BARK, { sides: 7, steps: 2, skin: 'bark', cap: 'end', ribs: [6, 0.08] });
  s.sweep([[5.6, 12.7, 0], [6.5, 13.4, -0.4], [7.1, 13.7, -0.6]], [0.16, 0.11, 0.07], BARK, { sides: 5, steps: 2, skin: 'bark', cap: 'end' });
  for (const [x, y, z, w] of [[4, 13.7, 0.5, 3.2], [7, 13.4, -0.7, 2.6], [5.4, 14.5, -0.1, 3], [3.4, 14.2, -0.6, 2.2]] as [number, number, number, number][]) {
    s.rock(x, y, z, w, w * 0.6, w * 0.9, LEAVES, { level: 2, planes: 3, lump: 0.22, seat: false, skin: 'moss', light: 0.55, cavity: 0.35, sway: 0.12 });
  }
  // Loose rocks by the path.
  for (const [x, z, w] of [[-4.8, 3.1, 1.1], [4.9, 3.2, 1.3], [8, -2.4, 1.2]] as V[]) {
    s.rock(x, 0, z, w, w * 0.65, w * 0.9, ROCK, { level: 1, planes: 3, moss: 0.4, skin: 'rock' });
  }
  for (const x of [-6.3, 6.4]) s.shadowBox(x, 0, 0, 4.4, 8, 5.6);
  s.shadowBox(0, 8.4, 0, 9, 2.6, 4.6);
  return s.done();
}

/** A hollow fallen oak along x, open to the ground beneath, with a 3 m bore through it. */
export function fallenGiant(_variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8021, detail);
  const path: V[] = [[-12, 1.95, 0], [-6, 1.95, 0.08], [0, 1.95, -0.06], [6, 1.95, 0.05], [11.7, 1.95, 0]];
  s.sweep(path, [2.62, 2.5, 2.42, 2.3, 2.15], BARK, {
    sides: 28, steps: 4, bore: [1.66, 1.64, 1.63, 1.62, 1.6], gap: 1.3, lump: 0.05, ribs: [15, 0.08],
    skin: 'bark', moss: 0.55, light: 0.35, innerTone: [P.umber, P.bark, P.wood, P.tan], rimTone: HEARTWOOD, rimSkin: 'grain',
  });
  // Broken branches standing up off its back.
  s.sweep([[-7.2, 4.4, -0.6], [-7.8, 5.5, -0.9], [-8.2, 6.3, -0.9]], [0.75, 0.62, 0.52], BARK, { sides: 9, steps: 2, lump: 0.2, skin: 'bark', moss: 0.35, cap: 'end' });
  s.sweep([[3, 4.35, 0.5], [3.8, 5.2, 0.9], [4.1, 5.6, 1]], [0.6, 0.5, 0.42], BARK, { sides: 8, steps: 2, lump: 0.2, skin: 'bark', moss: 0.35, cap: 'end' });
  s.sweep([[9.6, 4.05, -0.3], [10.6, 4.7, -0.6]], [0.45, 0.36], BARK, { sides: 7, steps: 2, lump: 0.15, skin: 'bark', cap: 'end' });
  // Cushions of moss and fern along its top.
  for (let i = 0; i < 6; i++) {
    const x = -10 + i * 3.9 + s.rr(-0.6, 0.6);
    s.rock(x, 4.05 - i * 0.04, s.rr(-0.6, 0.6), s.rr(1.6, 2.4), 0.55, s.rr(1.2, 1.7), LEAVES, { level: 1, planes: 2, seat: false, skin: 'moss', light: 0.4, cavity: 0.3, shadow: false });
  }
  s.rock(-10.4, 0, 2.9, 1.3, 0.9, 1.1, ROCK, { level: 2, planes: 3, moss: 0.35, skin: 'rock' });
  s.rock(8.2, 0, -2.8, 1.6, 1, 1.3, ROCK, { level: 2, planes: 3, moss: 0.35, skin: 'rock' });
  for (const z of [-2, 2]) s.shadowBox(0, 0, z, 24, 3, 0.9);
  s.shadowBox(0, 3.6, 0, 24, 0.8, 4);
  return s.done();
}

/** Repeat at z + 8. Each run owns its -z posts; the end variant closes the last +z end. */
export function boardwalk(variant: number, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8031, detail);
  for (const x of [-0.72, 0.72]) {
    s.box(x, 0.57, 0, 0.22, 0.25, 8, TIMBER, { skin: 'grain' });
    // Each run owns its start and middle posts; only the end adds the final pair.
    for (const z of variant === 1 ? [-4, 0, 3.84] : [-4, 0]) {
      s.lathe(x, 0, z, [[0.16, 0], [0.155, 0.16], [0.14, 0.72], [0.16, 0.82]], TIMBER,
        { sides: 6, square: 0.7, skin: 'grain', moss: 0.16, cavity: 0.4 });
      s.box(x, 0.67, z, 0.3, 0.15, 0.28, P.plank, { bevel: 0.02, skin: 'grain' });
    }
  }
  // Continuous underside, with shallow seams between the weathered upper boards.
  s.box(0, 0.82, 0, 2, 0.14, 8, P.plankDark, { skin: 'grain' });
  for (let i = 0; i < 20; i++) {
    s.box(0, 0.96, -3.8 + i * 0.4, 2, 0.04, 0.38,
      i % 3 === 0 ? P.plankLight : P.plankPale, { bevel: detail < 1 ? 0 : 0.01, skin: 'grain' });
  }
  s.shadowBox(0, 0.82, 0, 2, 0.18, 8);
  return s.done();
}

/** A thatched hut on four stilts: plaster walls in a timber frame, a porch with a gable, a lit window and a lantern. */
export function stiltHut(_variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8041, detail);
  const wood = { skin: 'grain', round: 0.06, light: 0.25 } as const;
  // Stilts with rope bands, and braces up to the deck.
  for (const x of [-2.7, 2.7]) for (const z of [-2.7, 2.1]) {
    s.lathe(x, 0, z, [[0.27, 0], [0.25, 0.5], [0.23, 1.7], [0.22, 1.85]], TIMBER, { sides: 8, skin: 'grain', lump: 0.05, cavity: 0.4 });
    s.lathe(x, 0, z, [[0.25, 0.5], [0.3, 0.56], [0.3, 0.72], [0.25, 0.78]], RAMP.burlap, { sides: 8, cap: false });
    s.sweep([[x, 0.8, z], [x - Math.sign(x) * 1.1, 1.75, z]], [0.12, 0.11], TIMBER, { sides: 6, steps: 1, skin: 'grain', cap: 'both' });
  }
  // Beams under the deck, and the deck: planks along x.
  for (const z of [-2.7, 2.1]) s.roundBox(0, 1.58, z, 6.4, 0.24, 0.26, TIMBER, wood);
  for (let i = 0; i < 15; i++) s.box(0, 1.82, -2.95 + i * 0.41, 6.2, 0.16, 0.38, i % 3 ? P.plank : P.plankLight, { skin: 'grain', bevel: 0.03 });
  // Walls of plaster in a timber frame.
  s.roundBox(0, 1.98, -0.65, 5.2, 2.95, 3.9, PLASTER, { round: 0.1, skin: 'plaster', wobble: 0.03, skip: '-y', light: 0.12, cavity: 0.25 });
  for (const x of [-2.66, 2.66]) for (const z of [-2.62, 1.32]) s.roundBox(x, 1.98, z, 0.28, 3, 0.28, TIMBER, wood);
  for (const y of [1.98, 4.7]) {
    for (const z of [-2.66, 1.36]) s.roundBox(0, y, z, 5.6, 0.24, 0.24, TIMBER, wood);
    for (const x of [-2.7, 2.7]) s.roundBox(x, y, -0.65, 0.24, 0.24, 4.2, TIMBER, wood);
  }
  for (const x of [-2.7, 2.7]) {
    s.box(x, 3.25, -0.65, 0.18, 0.16, 3.9, P.timber, { skin: 'grain', bevel: 0.03 });
    s.sweep([[x * 1.005, 2.15, -2.45], [x * 1.005, 4.55, -0.9]], [0.08, 0.08], TIMBER, { sides: 5, steps: 1, skin: 'grain', cap: 'both' });
  }
  // The doorway: dark inside, in a frame, with a lintel.
  s.box(0, 2.05, 1.33, 1.3, 2.25, 0.06, P.ink);
  for (const x of [-0.78, 0.78]) s.roundBox(x, 1.98, 1.4, 0.22, 2.55, 0.2, TIMBER, wood);
  s.roundBox(0, 4.45, 1.4, 1.9, 0.22, 0.22, TIMBER, wood);
  // A lit window on the front and one on each side.
  s.box(1.75, 2.95, 1.33, 0.9, 0.95, 0.06, P.lamp, { glow: 1 });
  s.box(1.75, 2.88, 1.39, 1.05, 0.08, 0.12, P.timber, { skin: 'grain' });
  s.box(1.75, 3.88, 1.39, 1.05, 0.08, 0.12, P.timber, { skin: 'grain' });
  s.box(1.75, 2.95, 1.4, 0.07, 0.95, 0.06, P.timber);
  s.box(1.75, 3.38, 1.4, 0.9, 0.06, 0.06, P.timber);
  for (const x of [-2.74, 2.74]) {
    s.box(x, 2.95, -0.9, 0.06, 0.9, 1.0, P.lamp, { glow: 1 });
    s.box(x * 1.01, 3.38, -0.9, 0.08, 0.06, 1.0, P.timber);
    s.box(x * 1.01, 2.95, -0.9, 0.08, 0.9, 0.07, P.timber);
    s.box(x * 1.01, 2.85, -0.9, 0.12, 0.1, 1.2, P.timber, { skin: 'grain' });
  }
  s.light(2.9, 3.4, -0.9); s.light(-2.9, 3.4, -0.9); s.light(1.75, 3.4, 1.5);
  // A lantern by the door.
  s.box(-1.2, 4.2, 1.6, 0.08, 0.5, 0.08, P.iron);
  s.lathe(-1.2, 3.62, 1.62, [[0.13, 0], [0.16, 0.1], [0.16, 0.4], [0.2, 0.46], [0.04, 0.62]], P.iron, { sides: 6, cap: true });
  s.lathe(-1.2, 3.7, 1.62, [[0.11, 0], [0.12, 0.3]], P.lampHot, { sides: 6, glow: 1 });
  s.light(-1.2, 3.85, 1.62);
  // The roof: a soft hipped thatch, deep at the eaves, with moss in patches.
  s.lathe(0, 0, -0.4, [[3.3, 4.72], [4.42, 4.6], [4.5, 4.88], [3.7, 5.75], [2.4, 6.75], [1.1, 7.45], [0.4, 7.8], [0, 7.88]], THATCH,
    { sides: 20, square: 0.55, lump: 0.05, skin: 'thatch', moss: 0.2, light: 0.45, mottle: 0.3, cavity: 0.55, capTone: P.umber });
  s.lathe(0, 7.62, -0.4, [[0.55, 0], [0.62, 0.18], [0.45, 0.4], [0, 0.46]], THATCH, { sides: 8, square: 0.5, skin: 'thatch', light: 0.2 });
  // The porch: two posts up to the eaves, and a beam across.
  for (const sign of [-1, 1]) s.roundBox(sign * 1.5, 1.98, 3.15, 0.22, 2.75, 0.22, TIMBER, wood);
  s.roundBox(0, 4.62, 3.18, 3.4, 0.2, 0.22, TIMBER, wood);
  // Railings round the porch, open at the stairs.
  for (const sign of [-1, 1]) {
    s.box(sign * 1.95, 2.85, 3.15, 1.9, 0.12, 0.12, P.plankLight, { skin: 'grain', bevel: 0.02 });
    s.box(sign * 2.9, 2.85, 2.25, 0.12, 0.12, 1.9, P.plankLight, { skin: 'grain', bevel: 0.02 });
    for (const x of [1.1, 1.95, 2.9]) s.box(sign * x, 1.98, 3.15, 0.14, 0.95, 0.14, P.plank, { skin: 'grain' });
    s.box(sign * 2.9, 1.98, 2.25, 0.14, 0.95, 0.14, P.plank, { skin: 'grain' });
    s.box(sign * 1.95, 2.4, 3.15, 1.9, 0.08, 0.08, P.plank, { skin: 'grain' });
  }
  // Stairs down to the boardwalk.
  for (let i = 0; i < 4; i++) s.box(0, 1.45 - i * 0.37, 3.55 + i * 0.32, 1.7, 0.14, 0.34, i % 2 ? P.plank : P.plankLight, { skin: 'grain', bevel: 0.02 });
  for (const x of [-0.9, 0.9]) s.sweep([[x, 0, 4.7], [x, 1.85, 3.3]], [0.07, 0.07], TIMBER, { sides: 5, steps: 1, skin: 'grain', cap: 'both' });
  s.shadowBox(0, 2, -0.6, 5.5, 3, 4.2);
  // The roof's shadow is drawn no wider than the walls, so the eaves shade only their tops, as the sheet paints it.
  s.shadowBox(0, 5.4, -0.55, 5.6, 1.6, 4.4);
  s.shadowBox(0, 1.8, 0, 6.2, 0.2, 6.2);
  return s.done();
}
