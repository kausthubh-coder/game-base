// act1-city-buildings. B01-B16, measured envelopes in region-hollowmere/README.md.
import type * as THREE from 'three';
import { Shape } from '../shape.ts';
import { P, RAMP } from '../palette.ts';
import * as arch from '../arch.ts';

type Point = [number, number, number];
// At low detail the fine dressing goes (the roofs' tile seams, shutter straps, plaster patches, bevels), as
// the soft forms coarsen, so a building costs at least a fifth less.
const fine = (s: Shape): boolean => s.detail >= 0.75;

function beam(s: Shape, a: Point, b: Point, r = 0.12) {
  s.tube([a, b], [r, r], 4, RAMP.plank, { cap: 'both', skin: 'grain' });
}
function balcony(s: Shape, w: number, z: number, y: number) {
  s.box(0, y, z + 0.5, w, 0.18, 1.2, RAMP.plank, { skin: 'grain', bevel: fine(s) ? 0.03 : 0 });
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 8)
    s.box(x, y + 0.18, z + 1.02, 0.09, 0.9, 0.09, P.timber, { skin: 'grain' });
  beam(s, [-w / 2, y + 1.1, z + 1.02], [w / 2, y + 1.1, z + 1.02], 0.08);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) beam(s, [x, y - 0.8, z], [x, y, z + 1], 0.09);
}
function banner(s: Shape, x: number, z: number, y: number) {
  s.box(x, y, z, 1.1, 2.3, 0.06, P.gold, { skin: 'flat' });
  beam(s, [x - 0.7, y + 2.35, z], [x + 0.7, y + 2.35, z], 0.06);
  beam(s, [x, y + 0.25, z + 0.05], [x, y + 1.9, z + 0.05], 0.025);
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1])
      s.poly(
        [
          [x, y + 0.7 + i * 0.4, z + 0.06],
          [x + side * 0.3, y + 1.1 + i * 0.4, z + 0.06],
          [x, y + 0.95 + i * 0.4, z + 0.06],
        ],
        P.plasterLight,
        { two: true },
      );
}
/**
 * B01: a low stone-footed cottage, its gable end to the front with the door under a deep verge carried on
 * two posts, a stone chimney on the right slope and an awning over the side window.
 */
export function cityCottage(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21001, detail);
  const cx = -0.4, w = 5.6, d = 4.4, eave = 3, rise = 2.25;
  s.at(cx, 0, 0, 0, () => {
    const front = { kind: 'door' as const, x: 0.35, w: 1.1, h: 2.25, frame: 'stone' as const };
    arch.wall(s, 0, 0, d / 2, w, eave, { plinth: 0.55, openings: [front, { kind: 'window', x: -1.65, y: 1.05, w: 0.62, h: 1, top: 'arch', frame: 'stone', shutters: false }], patches: 3 });
    s.at(0, 0, 0, Math.PI, () => arch.wall(s, 0, 0, d / 2, w, eave, { plinth: 0.55, patches: 1, openings: [{ kind: 'window', x: 0.8, w: 0.9, h: 1.1, shutters: false }] }));
    s.at(0, 0, 0, Math.PI / 2, () => arch.wall(s, 0, 0, w / 2, d, eave, { plinth: 0.55, frame: 'cottage', openings: [{ kind: 'window', x: 0.4, w: 0.9, h: 1.1, shutters: false }] }));
    s.at(0, 0, 0, -Math.PI / 2, () => arch.wall(s, 0, 0, w / 2, d, eave, { plinth: 0.55, frame: 'cottage', openings: [{ kind: 'window', x: 0, w: 0.9, h: 1.1 }] }));
    for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const half = turn === 0 || turn === Math.PI ? [w / 2, d / 2] : [d / 2, w / 2];
      s.at(0, 0, 0, turn, () => arch.quoins(s, half[0], 0, half[1], 1.7));
    }
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, eave, 0, d, w, { rise, overhang: 0.55, verge: 0.75, sag: 0.1, gables: 'king', moss: 0.12 }));
    // The deep front verge stands on two posts with knee braces.
    for (const side of [-1, 1]) {
      const px = side * (w / 2 + 0.05), pz = d / 2 + 0.5;
      arch.stoneBlock(s, px, 0, pz, 0.5, 0.55, 0.5, { faces: '+z+x-x+y' });
      arch.timber(s, [px, 0.55, pz], [px, eave - 0.05, pz], 0.24);
      arch.timber(s, [px, eave - 0.8, pz], [px - side * 0.75, eave - 0.05, pz], 0.16);
      arch.timber(s, [px, eave - 0.05, pz + 0.1], [px, eave - 0.05, d / 2 - 0.3], 0.2);
    }
    arch.steps(s, 0.35, 0, d / 2 + 0.05, 1.7, 0.3, 0.6);
    arch.chimney(s, 1.35, 3.9, -0.7, 0.85, 0.85, 5.8);
    s.at(w / 2, 0, -0.4, Math.PI / 2, () => arch.awning(s, 0, 2.2, 0, 2.3, 0.9, { posts: true, drop: 0.3 }));
    s.shadowBox(0, 0, 0, w, eave, d);
  });
  return s.done();
}
// House shells keep real reveals on every face; the street elevation owns the costly stone heads.
function aWindow(x: number, y: number, w = 0.9, h = 1.3): arch.Opening {
  return { kind: 'window', x, y, w, h, shutters: false };
}
function aDoor(x: number, y = 0.15, w = 1.3, h = 2.4): arch.Opening {
  return { kind: 'door', x, y, w, h, frame: 'stone' };
}
function aShell(s: Shape, w: number, d: number, h: number, front: arch.Opening[], rails: number[], sides = true) {
  arch.wall(s, 0, 0, d / 2, w, h, { plinth: 0.65, frame: 'cottage', rails, openings: front, bay: 3, patches: 3 });
  for (const turn of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const back = turn === Math.PI;
    const openings = back || sides ? [aWindow(0, 1.2), ...rails.map(y => aWindow(0, y + 0.65))] : [];
    s.at(0, 0, 0, turn, () => arch.wall(s, 0, 0, (back ? d : w) / 2, back ? w : d, h, {
      plinth: 0.65, frame: sides || back ? 'cottage' : 'none', rails, openings, patches: 1, stone: { flat: true },
    }));
  }
  s.shadowBox(0, 0, 0, w, h, d);
}
// A shallow projecting upper bay; its gable faces the street and intersects the main roof.
function aBay(s: Shape, x: number, y: number, z: number, w: number, h: number, rise: number) {
  s.at(x, y, z, 0, () => {
    arch.wall(s, 0, 0, 0.8, w, h, { openings: [aWindow(0, 0.45, 1.05, 1.2)], moss: 0, patches: 1, frame: 'cottage' });
    for (const side of [-1, 1]) s.at(0, 0, 0, side * Math.PI / 2, () => arch.wall(s, 0, 0, w / 2, 1.6, h, { moss: 0, patches: 0, frame: 'none' }));
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, h, 0, 1.6, w, { rise, overhang: 0.3, verge: 0.35, gables: 'king', tails: 0, sag: 0.05 }));
  });
}
export function cityFamilyHouse(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21002, detail);
  aShell(s, 7.4, 5.4, 4.8, [aDoor(-1.9), aDoor(2), { ...aWindow(1.8, 3.35), shutters: true }], [2.9]);
  arch.roof(s, 0, 4.8, 0, 7.4, 5.4, { rise: 1.75, verge: 0.45, overhang: 0.45, sag: 0.08, gables: 'queen' });
  aBay(s, -1.9, 2.9, 2.35, 2.8, 1.9, 1.65);
  arch.balcony(s, -1.9, 2.9, 3.15, 3, 0.7);
  arch.awning(s, 2, 3, 2.7, 2.8, 1.2, { posts: true, drop: 0.45 });
  arch.steps(s, -1.9, 0, 2.8, 1.9, 0.3, 0.65);
  return s.done();
}
export function cityLongHouse(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21003, detail);
  aShell(s, 8.4, 4.6, 3.4, [aDoor(-2.6), aDoor(2.6), aWindow(0, 1.1, 1.4, 1.5)], []);
  arch.roof(s, 0, 3.4, 0, 8.4, 4.6, { rise: 2.15, overhang: 0.5, verge: 0.45, sag: 0.12, dormers: [{ x: -2.5, side: 1, w: 1.35, h: 1.1 }, { x: 2.5, side: 1, w: 1.35, h: 1.1 }] });
  arch.awning(s, 0, 2.95, 2.3, 3, 1.1, { drop: 0.4 });
  s.at(4.2, 0, 0, Math.PI / 2, () => arch.awning(s, 0, 2.85, 0, 2.6, 0.75, { posts: true, drop: 0.35 }));
  for (const x of [-2.6, 2.6]) arch.steps(s, x, 0, 2.35, 1.8, 0.3, 0.6);
  return s.done();
}
export function cityTallHouse(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21004, detail);
  aShell(s, 6.4, 5.8, 6.65, [aDoor(-1.1), aWindow(1.65, 1.1), aWindow(-1.2, 3.1), aWindow(1.65, 3.1), aWindow(1.65, 5.25)], [2.7, 4.8]);
  arch.roof(s, 0, 6.65, 0, 6.4, 5.8, { rise: 1.9, verge: 0.45, overhang: 0.45, sag: 0.09, gables: 'queen' });
  aBay(s, -1.3, 4.8, 2.65, 2.6, 1.85, 1.7);
  arch.balcony(s, -1.3, 4.8, 3.45, 2.8, 0.5);
  banner(s, 2.1, 3.1, 3.7);
  arch.steps(s, -1.1, 0, 3, 1.8, 0.3, 0.7);
  return s.done();
}
export function cityMerchantRowHouse(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21005, detail);
  aShell(s, 4.6, 7.8, 9.1, [aDoor(1.25, 0.15, 1, 2.4), aWindow(-0.85, 0.8, 1.6, 1.8), aDoor(0, 3.3, 1.1, 2.2), aDoor(0, 6.3, 1.1, 2.2)], [3.2, 6.2], false);
  s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, 9.1, 0, 7.8, 4.6, { rise: 2.45, overhang: 0.35, verge: 0.45, sag: 0.08, tails: 2.5, gables: 'king' }));
  for (const y of [3.2, 6.2]) arch.balcony(s, 0, y, 3.9, 3.8, 0.85);
  arch.awning(s, 0, 2.9, 3.9, 4.6, 1, { drop: 0.4 });
  arch.banner(s, 1.9, 5.7, 4.05, 0.65, 1.7);
  return s.done();
}
export function cityCornerShop(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21006, detail);
  const w = 7.4, d = 7.4, eave = 7.6;
  for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) s.at(0, 0, 0, turn, () => {
    const shop = turn === 0 || turn === Math.PI / 2;
    arch.wall(s, 0, 0, d / 2, w, eave, { plinth: 0.75, rails: [4], frame: 'cottage', patches: 2, stone: { flat: !shop }, openings: shop ? [aDoor(2.1), aWindow(-1.4, 0.8, 2.3, 2.1), aWindow(-1.6, 4.8, 1, 1.8), aWindow(1.6, 4.8, 1, 1.8)] : [aWindow(0, 4.8, 1, 1.8)] });
    if (shop) {
      arch.awning(s, -1.25, 3.5, 3.7, 4.5, 1.25, { drop: 0.5 });
      arch.balcony(s, -0.2, 4, 3.7, 6, 0.7);
    }
  });
  arch.roof(s, 0, eave, 0, w, d, { kind: 'hip', rise: 2.7, overhang: 0.55, sag: 0.06, tails: 2 });
  arch.chimney(s, -2, 8, -1.5, 0.8, 0.8, 10.8);
  s.shadowBox(0, 0, 0, w, eave, d);
  return s.done();
}
/** Loaves on a timber shelf `w` wide at height y, its front edge at z, facing +z. */
function bread(s: Shape, x: number, y: number, z: number, w: number, loaves: number) {
  arch.timber(s, [x - w / 2, y, z - 0.25], [x + w / 2, y, z - 0.25], 0.5, arch.TIMBER, { height: 0.1 });
  for (const side of [-1, 1]) arch.timber(s, [x + side * (w / 2 - 0.1), 0, z - 0.1], [x + side * (w / 2 - 0.1), y - 0.05, z - 0.1], 0.1);
  for (let i = 0; i < loaves; i++)
    s.lathe(x - w / 2 + (w * (i + 0.5)) / loaves, y + 0.05, z - 0.25 + (i % 2 ? 0.08 : -0.06), [[0.2, 0], [0.24, 0.08], [0.17, 0.19], [0, 0.23]], [P.ochre, P.gold, P.butter], { sides: 7, light: 0.5, cavity: 0.2, capTone: P.ochre });
}
/**
 * B07: the bakery. A long stone-footed house with its ridge along x: on the left gable an oven alcove with
 * bread and the guild's wheat banner, on the front the great oven mouth glowing under a striped awning, and
 * a broad stone chimney astride the ridge.
 */
export function cityBakery(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21007, detail);
  const w = 8.4, d = 6, eave = 3.4, rise = 2.3, plinth = 1;
  const oven = { kind: 'arch' as const, x: 0.6, y: 0.4, w: 2.4, h: 2.6, inside: 1.1, insideGlow: 1 };
  arch.wall(s, 0, 0, d / 2, w, eave, { plinth, frame: 'cottage', openings: [oven, { kind: 'door', x: 3.1, w: 1.1, h: 2.2, top: 'square', frame: 'timber' }, { kind: 'window', x: -2.6, y: 1.35, w: 0.8, h: 0.9, shutters: false }] });
  s.at(0, 0, 0, -Math.PI / 2, () => arch.wall(s, 0, 0, w / 2, d, eave, { plinth, frame: 'cottage', openings: [{ kind: 'arch', x: 0.5, y: 0.4, w: 2.2, h: 2.4, inside: 0.9 }] }));
  s.at(0, 0, 0, Math.PI / 2, () => arch.wall(s, 0, 0, w / 2, d, eave, { plinth, patches: 1, openings: [{ kind: 'window', x: 0, y: 1.3, w: 0.9, h: 1, shutters: false }] }));
  s.at(0, 0, 0, Math.PI, () => arch.wall(s, 0, 0, d / 2, w, eave, { plinth, patches: 1, openings: [{ kind: 'window', x: 1.5, y: 1.3, w: 0.9, h: 1, shutters: false }] }));
  for (const [turn, a, b] of [[0, w / 2, d / 2], [Math.PI / 2, d / 2, w / 2], [Math.PI, w / 2, d / 2], [-Math.PI / 2, d / 2, w / 2]] as const)
    s.at(0, 0, 0, turn, () => arch.quoins(s, a, plinth, b, 1.5));
  arch.roof(s, 0, eave, 0, w, d, { rise, overhang: 0.6, verge: 0.5, sag: 0.08, gables: 'king', moss: 0.1 });
  arch.chimney(s, 1.9, 4.4, 0.5, 1.4, 1.2, 6.85);
  // The oven mouth: bread on its shelf, a stone counter beside it, the awning over both.
  bread(s, 0.6, 0.85, d / 2 + 0.1, 2.1, 3);
  arch.stoneBlock(s, 2.25, 0, d / 2 + 0.35, 0.8, 0.85, 0.6, { faces: '+z+x-x+y' });
  arch.awning(s, 0.8, 3.2, d / 2, 3.8, 1.4, { drop: 0.5 });
  // The gable's alcove, its bread, and the wheat banner over it.
  s.at(-w / 2, 0, 0.5, -Math.PI / 2, () => {
    bread(s, 0, 0.85, 0.1, 1.9, 3);
    arch.banner(s, -1.75, 3.2, 0.14, 0.85, 1.7);
  });
  s.shadowBox(0, 0, 0, w, eave, d);
  return s.done();
}
export function cityGuildLodge(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21008, detail);
  aShell(s, 10.4, 7.4, 6.4, [aDoor(-2.6, 0.3, 1.65, 2.8), { ...aWindow(-4.25, 1.2, 0.65, 1.5), top: 'arch', frame: 'stone' }, { ...aWindow(3.7, 1.2, 0.9, 1.6), top: 'arch', frame: 'stone' }, aWindow(1.6, 4.4, 1.2, 1.5)], [3.7]);
  arch.roof(s, 0, 6.4, 0, 10.4, 7.4, { rise: 2.15, overhang: 0.5, verge: 0.45, sag: 0.1, gables: 'queen', tails: 2 });
  aBay(s, -2.4, 3.7, 3.3, 3.6, 2.4, 2);
  s.at(1.8, 0, 0, 0, () => balcony(s, 3.4, 3.7, 3.7));
  arch.banner(s, 1.8, 4.1, 4.8, 1.35, 2.6, { tone: [P.tealDark, P.teal, P.tealLight] });
  arch.steps(s, -2.6, 0, 3.75, 2.6, 0.45, 1);
  for (const x of [-3.9, -0.9]) arch.timber(s, [x, 0.5, 4.05], [x, 3.7, 4.05], 0.2);
  return s.done();
}
/** The toolkit plinth is solid. Cut the same openings in a separate stone skirt so doors reach the ground. */
function bWall(s: Shape, x: number, y: number, z: number, w: number, h: number, o: arch.WallOptions) {
  arch.wall(s, x, y, z, w, h, { ...o, plinth: 0 });
  const plinth = o.plinth ?? 0;
  if (plinth > 0) arch.ashlar(s, x, y, z - 0.12, w + 0.04, plinth, 0.48, {
    ...o.stone, faces: '+z', moss: 0.06,
    holes: (o.openings ?? []).filter((q) => (q.y ?? (q.kind === 'window' ? 1 : 0)) < plinth).map((q) => ({
      u0: q.x + (w + 0.04) / 2 - q.w / 2 - 0.05, u1: q.x + (w + 0.04) / 2 + q.w / 2 + 0.05,
      v0: q.y ?? (q.kind === 'window' ? 1 : 0), v1: (q.y ?? (q.kind === 'window' ? 1 : 0)) + q.h,
    })),
  });
}
/** Four real wall faces; callers own the roof, front openings and working attachments. */
function bWalls(s: Shape, w: number, d: number, h: number, front: arch.Opening[], options: arch.WallOptions = {}, sideDoor = false) {
  const base: arch.WallOptions = { plinth: 0.8, frame: 'cottage', bay: 3, patches: 3, ...options };
  bWall(s, 0, 0, d / 2, w, h, { ...base, openings: front });
  for (const turn of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const span = turn === Math.PI ? w : d;
    s.at(0, 0, 0, turn, () => bWall(s, 0, 0, (turn === Math.PI ? d : w) / 2, span, h, {
      ...base, stone: { flat: true }, patches: 1,
      openings: [
        ...[-span * 0.24, span * 0.24].map((x): arch.Opening => ({ kind: 'window', x, y: h > 6 ? h - 2.7 : 1.25, w: 0.8, h: 1.25, shutters: false })),
        ...(sideDoor && turn === Math.PI / 2 ? [{ kind: 'door' as const, x: 0, w: 2.5, h: 3.6, frame: 'stone' as const }] : h > 9 && turn !== Math.PI ? [-span * 0.24, span * 0.24].map((x): arch.Opening => ({ kind: 'window', x, y: 3.7, w: 0.65, h: 1.1, shutters: false })) : []),
      ],
    }));
  }
  for (const side of [-1, 1]) s.at(side * w / 2, 0, d / 2, side < 0 ? -Math.PI / 2 : 0, () => arch.quoins(s, 0, 0, 0, Math.min(2.2, base.plinth! + 0.8)));
  s.shadowBox(0, 0, 0, w, h, d);
}
function bBench(s: Shape, x: number, z: number, w: number) {
  arch.timber(s, [x - w / 2, 0.95, z], [x + w / 2, 0.95, z], 0.85, arch.TIMBER, { height: 0.16 });
  for (const dx of [-w / 2 + 0.2, w / 2 - 0.2]) {
    arch.timber(s, [x + dx, 0, z], [x + dx, 0.9, z], 0.18);
    arch.timber(s, [x + dx, 0.1, z - 0.4], [x + dx, 0.1, z + 0.4], 0.16);
  }
}
/** B09: deep gabled working porch, pale forge stack and an open work bay. */
export function cityWorkshop(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(21009, detail);
  s.at(0, 0, -0.8, 0, () => {
    bWalls(s, 8.6, 4.9, 3.6, [
      { kind: 'door', x: 2.9, w: 1.1, h: 2.4, frame: 'stone' },
      { kind: 'arch', x: -1.2, w: 2.5, h: 2.7, inside: 0.9 },
    ]);
    arch.roof(s, 0, 3.6, 0, 8.6, 4.9, { rise: 2.15, sag: 0.11, moss: 0.06, gables: 'king', overhang: 0.55, verge: 0.45 });
    arch.portico(s, -1.2, 0, 2.45, 5.8, 1.65, 3.15, { rise: 1.65, floor: 0.1, steps: 0, roof: { overhang: 0.25, verge: 0.2, tails: 2 } });
    arch.chimney(s, 2.5, 2.8, 1.1, 1.05, 1.1, 6.85, { material: 'plaster' });
  });
  bBench(s, -2.1, 2.7, 2.2);
  arch.stoneBlock(s, 0.5, 0, 2.5, 0.85, 0.65, 0.7);
  s.box(0.5, 0.65, 2.5, 1.3, 0.35, 0.5, [P.iron, P.pewter], { bevel: 0.08, skin: 'flat' });
  s.at(3.8, 1.05, 2.6, { ry: -0.2 }, () => bWheel(s, 0.95, 0.2, false));
  return s.done();
}
/** B10: civic grain store on a high stone loading base, with a steep front gable. */
export function cityGranary(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(21010, detail);
  s.at(0, 0, -0.9, 0, () => {
    bWalls(s, 12.3, 8.2, 9.8, [
      { kind: 'door', x: 0.5, y: 2.3, w: 2.8, h: 3.6, frame: 'stone' },
      ...[-4, 0.5, 4].map((x): arch.Opening => ({ kind: 'window', x, y: 7.3, w: 0.7, h: 1.25, shutters: false })),
    ], { plinth: 2.3, rails: [6.4], frame: 'close', bay: 3.1, stone: { course: 0.9, long: [1.8, 2.6] } });
    arch.roof(s, 0, 9.8, 0, 12.3, 8.2, { rise: 3.85, overhang: 0.65, verge: 0.6, sag: 0.1, gables: 'queen', dormers: [{ x: -3.6, side: 1, w: 1.5, h: 1.3 }] });
    arch.steps(s, 0.5, 0, 4.2, 4.2, 2.3, 2.6, { n: 10 });
    arch.timber(s, [-4.2, 2.3, 4.3], [-4.2, 7.2, 4.3], 0.25);
    arch.timber(s, [-4.2, 7.2, 4.1], [-4.2, 7.2, 6.1], 0.25);
    arch.timber(s, [-4.2, 5.8, 4.3], [-4.2, 7.2, 5.5], 0.18);
    s.sweep([[-4.2, 7.1, 5.9], [-4.2, 5.4, 5.9]], [0.035, 0.035], RAMP.plank, { sides: 6, steps: 1, skin: 'grain' });
  });
  return s.done();
}
/** B11: a long quay store with two loading faces and a sheltered work apron. */
export function cityWarehouse(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(21011, detail);
  s.at(0, 0, -0.7, 0, () => {
    bWalls(s, 10.6, 12.8, 7.3, [
      { kind: 'door', x: 1.8, w: 3.2, h: 4.2, frame: 'stone' },
      { kind: 'door', x: -3.3, w: 1.25, h: 2.5, frame: 'timber' },
      ...[-3.7, -1, 2.5].map((x): arch.Opening => ({ kind: 'window', x, y: 5.7, w: 0.55, h: 0.8, shutters: false, bars: 'none' })),
    ], { plinth: 2.4, rails: [4.9], bay: 3.4 }, true);
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, 7.3, 0, 12.8, 10.6, { rise: 3.35, overhang: 0.6, verge: 0.55, sag: 0.15, gables: 'queen', moss: 0.06 }));
    arch.awning(s, -3.2, 3.25, 6.4, 3.8, 1.5, { posts: true, drop: 0.45, stripes: [P.tealDark, P.teal] });
    arch.timber(s, [1.8, 6.3, 6.1], [1.8, 6.3, 8], 0.22);
    arch.timber(s, [1.8, 5.3, 6.3], [1.8, 6.3, 7.4], 0.15);
    s.sweep([[1.8, 6.25, 7.8], [1.8, 4.5, 7.8]], [0.035, 0.035], RAMP.plank, { sides: 6, steps: 1, skin: 'grain' });
  });
  bBench(s, -3.2, 6.7, 2.4);
  return s.done();
}
/** B12: front-gabled lamp shop, tiled repair porch and hanging amber glass. */
export function cityLampHouse(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(21012, detail);
  s.at(0, 0, -0.7, 0, () => {
    bWalls(s, 6.3, 5.1, 4.2, [
      { kind: 'door', x: 1.9, w: 1.1, h: 2.5, frame: 'stone' },
      { kind: 'window', x: -1.25, y: 1.4, w: 1.5, h: 1.6, top: 'arch', shutters: false },
    ]);
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, 4.2, 0, 5.1, 6.3, { rise: 2.1, verge: 0.6, overhang: 0.55, sag: 0.08, gables: 'king' }));
    arch.portico(s, -0.6, 0, 2.55, 5, 1.35, 2.9, { rise: 0.6, floor: 0.1, steps: 0, roof: { overhang: 0.2, verge: 0.2, tails: 0 } });
    arch.chimney(s, 1.8, 3.8, -0.8, 0.9, 0.95, 7.8, { material: 'plaster' });
  });
  bBench(s, -0.6, 2.9, 3.7);
  for (const x of [-2, -0.6, 0.8]) {
    arch.timber(s, [x, 2.8, 2.9], [x, 2.4, 2.9], 0.04);
    s.lathe(x, 1.95, 2.9, [[0.1, 0], [0.19, 0.12], [0.16, 0.42], [0.08, 0.5]], [P.gold, P.lamp, P.butter], { sides: 10, glow: 1, skin: 'flat' });
    s.lathe(x, 2.4, 2.9, [[0.23, 0], [0.07, 0.16]], [P.iron, P.pewter], { sides: 8, skin: 'flat' });
    s.light(x, 2.2, 2.9);
  }
  for (let i = 0; i < 6; i++) s.lathe(-2 + i * 0.55, 1.04, 2.9, [[0.12, 0], [0.14, 0.2], [0.06, 0.35]], i % 2 ? arch.GLASS : [P.gold, P.butter], { sides: 8, skin: 'flat' });
  return s.done();
}
/** Broad annular wooden rims; the mill's axle runs along x after the caller turns the pen. */
function bWheel(s: Shape, r: number, depth: number, paddles: boolean) {
  const n = fine(s) ? 32 : 16;
  for (const z of [-depth / 2, depth / 2]) {
    const points: number[] = [], triangles: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = i * Math.PI * 2 / n;
      for (const [radius, dz] of [[r, -0.09], [r, 0.09], [r - 0.24, 0.09], [r - 0.24, -0.09]]) points.push(Math.cos(a) * radius, Math.sin(a) * radius, z + dz);
      if (i < n) for (let j = 0; j < 4; j++) {
        const k = i * 4 + j, next = i * 4 + (j + 1) % 4;
        triangles.push(k, next, k + 4, next, next + 4, k + 4);
      }
    }
    s.mesh(points, triangles, arch.TIMBER, { skin: 'grain', crease: 0.6 });
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      arch.timber(s, [0, 0, z], [Math.cos(a) * (r - 0.12), Math.sin(a) * (r - 0.12), z], paddles ? 0.23 : 0.1);
    }
  }
  s.at(0, 0, -depth / 2 - 0.15, { rx: Math.PI / 2 }, () => s.lathe(0, 0, 0, [[0.24, 0], [0.32, 0.14], [0.27, depth + 0.3]], arch.TIMBER, { sides: 12, skin: 'grain' }));
  if (paddles) for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10;
    s.at(Math.cos(a) * (r - 0.16), Math.sin(a) * (r - 0.16), 0, { rz: a }, () => s.box(0, -0.11, 0, 0.55, 0.22, depth, arch.TIMBER, { skin: 'grain' }));
  }
}
export function cityWheelwrightYard(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(21013, detail);
  s.at(0, 0, -2, 0, () => {
    for (const x of [-5.6, 5.6]) for (const z of [-2.8, 2.8]) {
      arch.stoneBlock(s, x, 0, z, 0.75, 0.65, 0.75);
      arch.timber(s, [x, 0.65, z], [x, 5.4, z], 0.38);
      arch.timber(s, [x, 4, z], [x - Math.sign(x) * 1.35, 5.35, z], 0.22);
      arch.timber(s, [x, 4.2, z], [x, 5.35, z - Math.sign(z) * 1.2], 0.2);
    }
    arch.wall(s, 0, 0, -2.8, 11.2, 3.4, { plinth: 0.8, frame: 'close', patches: 3, openings: [{ kind: 'window', x: -4, y: 1.2, w: 0.8, h: 1.2 }] });
    arch.roof(s, 0, 5.4, 0, 11.2, 5.6, { rise: 2.3, overhang: 0.65, verge: 0.55, sag: 0.12, gables: 'none', moss: 0.06 });
    for (const x of [-5.65, 5.65]) s.at(x, 0, 0, Math.PI / 2, () => {
      arch.timber(s, [-2.8, 5.3, 0], [2.8, 5.3, 0], 0.26);
      arch.timber(s, [0, 5.3, 0], [0, 7.6, 0], 0.23);
      for (const side of [-1, 1]) arch.timber(s, [side * 2.7, 5.4, 0], [0, 7.6, 0], 0.22);
    });
  });
  for (const x of [-3.3, -0.8]) s.at(x, 1.3, -0.4, 0, () => bWheel(s, 1.2, 0.3, false));
  arch.timber(s, [-4.8, 0.7, -0.8], [0.8, 0.7, -0.8], 0.2);
  for (const x of [-6.5, 6.5]) {
    for (const z of [0, 2.5, 5.5]) arch.timber(s, [x, 0, z], [x, 1.2, z], 0.18);
    for (const y of [0.4, 0.9]) arch.timber(s, [x, y, 0], [x, y, 5.5], 0.14);
  }
  bBench(s, 2.7, 2.8, 3.5);
  s.shadowBox(0, 5.4, -2, 12, 1, 6.8);
  return s.done();
}
function bMillFixed(s: Shape) {
  s.at(-1.5, 0, 0, 0, () => {
    bWalls(s, 8.5, 10.6, 8.2, [
      { kind: 'door', x: -1.9, w: 1.35, h: 2.7, frame: 'stone' },
      { kind: 'window', x: 1.5, y: 1.3, w: 1, h: 1.6, top: 'arch', frame: 'stone', shutters: false },
      ...[-2, 1.8].map((x): arch.Opening => ({ kind: 'window', x, y: 5.4, w: 1, h: 1.5 })),
    ], { plinth: 3.7, rails: [4.1], bay: 3, stone: { course: 1, long: [1.5, 2.4] }, moss: 1.1 });
    arch.roof(s, 0, 8.2, 0, 8.5, 10.6, { rise: 3.45, overhang: 0.5, verge: 0.5, sag: 0.1, gables: 'king', moss: 0.06 });
    arch.chimney(s, -2, 8.5, 2.5, 0.7, 0.8, 11.8, { material: 'plaster' });
  });
  arch.ashlar(s, 6.55, 0, 0, 0.5, 4.35, 0.9, { course: 0.85, moss: 0.6 });
  arch.timber(s, [2.6, 4.4, 0], [6.8, 4.4, 0], 0.32);
}
/** Wheel pivot [5.1, 4.4, 0], axle along x; rotate rotation.x = seconds * .12.
 * Use fixed + wheel instead of the combined catalogue model when animating. */
export function cityTownMillParts(detail = 1) {
  const s = new Shape(21014, detail);
  bMillFixed(s);
  const moving = new Shape(210140, detail);
  moving.at(0, 0, 0, Math.PI / 2, () => bWheel(moving, 3.9, 1.5, true));
  return { fixed: s.done(), wheel: moving.done(), pivot: [5.1, 4.4, 0] as const };
}
export function cityTownMill(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(21014, detail);
  bMillFixed(s);
  s.at(5.1, 4.4, 0, Math.PI / 2, () => bWheel(s, 3.9, 1.5, true));
  return s.done();
}
/**
 * B15: Queen Maren's hall. One tall storey on a raised stone base under a great hip roof with a dormer and a
 * gabled lantern on its ridge; a columned porch with its truss shown, wheat banners and broad steps before
 * double doors; paired arched windows in stone either side; civic framing with X braces above the rail.
 */
export function cityCivicHall(_v: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(21015, detail);
  const w = 17, d = 9, eave = 7.2, plinth = 1.2, rise = 4;
  const flat = { flat: true };
  s.at(0, 0, -1.2, 0, () => {
    const pair = (x: number) => ({ kind: 'window' as const, x, y: 2.5, w: 1.7, h: 2.7, top: 'arch' as const, pair: true, frame: 'stone' as const });
    arch.wall(s, 0, 0, d / 2, w, eave, {
      plinth, frame: 'civic', rails: [5.1], bay: 2.6,
      openings: [{ kind: 'door', x: 0, y: plinth, w: 2.4, h: 3.5, frame: 'stone' }, pair(-5.6), pair(5.6)],
    });
    for (const side of [-1, 1])
      s.at(0, 0, 0, (side * Math.PI) / 2, () => arch.wall(s, 0, 0, w / 2, d, eave, { plinth, stone: flat, frame: 'cottage', patches: 0, openings: [-2, 2].map((x) => ({ kind: 'window' as const, x, y: 2.5, w: 1.1, h: 1.9, top: 'arch' as const, shutters: false, frame: 'none' as const })) }));
    s.at(0, 0, 0, Math.PI, () => arch.wall(s, 0, 0, d / 2, w, eave, { plinth, stone: flat, patches: 0, openings: [-4, 4].map((x) => ({ kind: 'window' as const, x, y: 2.5, w: 1.1, h: 1.9, shutters: false, frame: 'none' as const })) }));
    for (const side of [-1, 1]) s.at(side * (w / 2), 0, d / 2, side < 0 ? -Math.PI / 2 : 0, () => arch.quoins(s, 0, plinth, 0, 2.4));
    arch.roof(s, 0, eave, 0, w, d, { kind: 'hip', rise, overhang: 0.8, course: 1.1, tails: 5, sag: 0.06, dormers: [{ x: -5.2, side: 1, w: 2, h: 1.7 }] });
    // The lantern astride the ridge: a framed plaster box under its own gable, which faces the front.
    const lw = 6, ld = 4, lb = eave + rise - 0.9, lh = 1.8;
    arch.wall(s, 0, lb, ld / 2, lw, lh, { frame: 'cottage', moss: 0, patches: 0, openings: [{ kind: 'window', x: 0, y: 0.35, w: 1.4, h: 1.15, top: 'arch', pair: true, frame: 'none' }] });
    for (const turn of [Math.PI / 2, Math.PI, -Math.PI / 2]) s.at(0, 0, 0, turn, () => arch.wall(s, 0, lb, (turn === Math.PI ? ld : lw) / 2, turn === Math.PI ? lw : ld, lh, { moss: 0, patches: 0, stains: false }));
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, lb + lh, 0, ld, lw, { rise: 2.8, overhang: 0.5, verge: 0.55, tails: 0, gables: 'cross', gableEnd: -1 }));
    arch.portico(s, 0, 0, d / 2, 7.2, 2.8, 6.4, { floor: plinth, steps: 4, run: 1.5, rise: 2.8, frame: 'king', banners: 2.3, roof: { gables: 'king' } });
    s.shadowBox(0, 0, 0, w, eave, d);
  });
  return s.done();
}
export function cityCourtyardTenement(_v: number, _d: unknown, detail = 1) {
  const s = new Shape(21016, detail);
  // The west wall is at -4, east at 3.4, and rear at -4; galleries leave the central 6 x 6 court clear.
  for (const side of [-1, 1]) s.at(side < 0 ? -5.2 : 5, 0, 1.5, 0, () => {
    const wing = side < 0 ? 2.4 : 3.2, gallery = side < 0 ? 0.8 : 0.4;
    arch.wall(s, 0, 0, 4.7, wing, 8.8, { plinth: 0.6, rails: [4.3], frame: 'cottage', openings: [aDoor(0, 0.1, 1, 2.4), { ...aWindow(0, 5.2, 0.85, 1.5), top: 'arch' }] });
    for (const facing of [-1, 1]) s.at(0, 0, 0, facing * Math.PI / 2, () => arch.wall(s, 0, 0, wing / 2, 9.4, 8.8, { plinth: 0.6, stone: { flat: true }, frame: 'cottage', bay: 4.5, rails: [4.3], patches: 0, openings: facing === -side ? [{ ...aDoor(0, 0.1, 1.15), top: 'square', frame: 'timber' }, { ...aDoor(0, 4.45, 1.1, 2.2), top: 'square', frame: 'timber' }] : [aWindow(-2, 5.1), aWindow(2, 5.1)] }));
    s.at(0, 0, 0, Math.PI / 2, () => arch.roof(s, 0, 8.8, 0, 9.4, wing, { rise: 2.75, overhang: 0.4, verge: 0.35, tails: 0, gables: 'king' }));
    s.at(0, 0, 0, -side * Math.PI / 2, () => arch.balcony(s, 0, 4.3, wing / 2, 8.4, gallery));
    s.shadowBox(0, 0, 0, wing, 8.8, 9.4);
  });
  s.at(0, 0, -5.2, 0, () => {
    arch.wall(s, 0, 0, 1.2, 12.8, 8.8, { plinth: 0.6, stone: { flat: true }, rails: [4.3], frame: 'cottage', openings: [aDoor(0, 0.1, 1.5, 2.6), { ...aDoor(0, 4.45, 1.2, 2.2), top: 'square', frame: 'timber' }], patches: 0 });
    s.at(0, 0, 0, Math.PI, () => arch.wall(s, 0, 0, 1.2, 12.8, 8.8, { plinth: 0.6, stone: { flat: true }, rails: [4.3], frame: 'none', patches: 0 }));
    arch.roof(s, 0, 8.8, 0, 12.8, 2.4, { rise: 2.75, overhang: 0.4, verge: 0.3, tails: 0 });
    arch.balcony(s, 0, 4.3, 1.2, 7.8, 0.8);
    s.shadowBox(0, 0, 0, 12.8, 8.8, 2.4);
  });
  // Stair tucked under the west gallery, outside x=-3 of the clear court.
  s.at(-3.5, 0, -3.2, 0, () => arch.steps(s, 0, 0, 0, 0.9, 4.3, 5.8, { n: 20, stone: { flat: true } }));
  return s.done();
}
