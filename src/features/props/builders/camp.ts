// A ward's camp: the fire and the tent a guild ward sets up on the ground they were granted. The fire is
// built to be looked at from close by, across it and at night: a ring of stones, logs leaned together and
// burnt black at their heads, and tongues of flame that are pale at the root and red at the tip. The flame
// and the coals glow by day too, and the flame leans and licks with the wind.
import * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

type V3 = readonly [number, number, number];

const TAU = Math.PI * 2;
/**
 * A flame from its root to its tip. The glow makes each of these far lighter than it is here: lemon shows
 * as pale yellow, ochre as yellow-orange, oak as orange and brick as a dull red. The palette's brighter
 * reds, coral and rust, come out pink.
 */
const FLAME = [P.lemon, P.butter, P.oak, P.brick];
/** A flame at the edge of the fire, which burns cooler: less pale at its root and red sooner. */
const FLAME_OUTER = [P.butter, P.ochre, P.oak, P.brick];
/** Live coals, from the ones going out to the hottest. */
const COALS = [P.oakDark, P.oak, P.oak, P.ochre];

/** A point `r` from the middle of the fire toward `angle`, at height y. */
const around = (angle: number, r: number, y: number): V3 => [Math.cos(angle) * r, y, Math.sin(angle) * r];

/**
 * One tongue of flame through these points, as thick as `radii` at each and drawn to a point at its tip,
 * in the colors of `ramp` from root to tip. Its root stays where it is. The rest leans with the wind, the
 * tip `sway` far.
 */
function tongue(s: Shape, path: readonly V3[], radii: readonly number[], sides: number, ramp: readonly number[], sway: number, turn = 0): void {
  const last = path.length - 1;
  const tones = path.map((_, i) => ramp[Math.round((i / last) * (ramp.length - 1))]);
  s.tube(path, radii, sides, tones, { cap: 'none', glow: 2, turn, sways: path.map((_, i) => sway * Math.pow(i / last, 1.4)) });
}

/**
 * A campfire, 1.2 meters across: a ring of seven stones on scorched ground, with grass against the
 * stones. Variants: lit (logs leaned together and a flame a meter high), low (the logs burnt down to
 * glowing brands and a small flame), cold (grey ash and black logs, and no light).
 */
export function campfire(variant: number): THREE.BufferGeometry {
  // One seed for all three, and the stones first, so it is the same ring as the fire burns down.
  const s = new Shape(2201);
  const lit = variant === 0, low = variant === 1;
  s.disc(0, 0.012, 0, 0.52, 8, P.soil, { turn: 0.2 });
  for (let k = 0; k < 7; k++) {
    const a = k * TAU / 7 + s.rr(-0.1, 0.1), big = k % 2 === 0;
    const rx = big ? s.rr(0.17, 0.2) : s.rr(0.13, 0.155), ry = big ? s.rr(0.12, 0.15) : s.rr(0.09, 0.11), rz = rx * s.rr(0.68, 0.8);
    const [x, , z] = around(a, s.rr(0.45, 0.49), 0);
    // Its long side lies along the ring.
    s.at(x, 0, z, -(a + Math.PI / 2) + s.rr(-0.25, 0.25), () => s.blob(0, ry * 0.42, 0, rx, ry, rz, RAMP.stone, { floor: 0, jitter: 0.2, sides: big ? 5 : 4, rings: 2, noise: 0.45 }));
  }
  // Grass grows up against the outside of the stones.
  for (let k = 0; k < 6; k++) {
    const a = (k + 0.5) * TAU / 6 + s.rr(-0.3, 0.3), h = s.rr(0.12, 0.22);
    const foot = around(a, s.rr(0.57, 0.62), 0), tip = around(a + s.rr(-0.4, 0.4), 0.6 + h * s.rr(0.1, 0.4), h);
    s.tube([foot, tip], [0.03, 0], 3, RAMP.grass, { cap: 'none', flat: true, sways: [0, 0.5], turn: s.r() * 6 });
  }
  s.shadowBlob(0, 0.06, 0, 0.62, 0.14, 0.62);

  if (lit) {
    // Five logs leaned together over the middle. Each is bark at its foot and burnt black where it stands in the fire.
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5 + 0.35 + s.rr(-0.12, 0.12);
      s.tube([around(a, -s.rr(0.05, 0.11), s.rr(0.31, 0.39)), around(a, s.rr(0.31, 0.35), 0.07)], [0.05, 0.07], 5, [P.ink, P.soil, P.bark], { capTone: P.clay, flat: true, turn: s.r() });
    }
    s.cone(0, 0.012, 0, 0.3, 0.1, 6, COALS, { glow: 2 });
    // Broad roots and gently narrowing shoulders keep the silhouette soft at the close camera.
    // Three tongues share the coal bed. Detached sparks belong to the pooled ember effect.
    tongue(s, [[0, 0.1, 0], [0.01, 0.34, 0], [0.04, 0.64, 0], [0.08, 0.87, 0]], [0.23, 0.21, 0.12, 0], 7, FLAME, 1.5);
    tongue(s, [[-0.15, 0.1, 0.06], [-0.19, 0.26, 0.06], [-0.22, 0.43, 0.06], [-0.2, 0.6, 0.06]], [0.13, 0.12, 0.07, 0], 6, FLAME_OUTER, 1.1);
    tongue(s, [[0.17, 0.1, 0.08], [0.2, 0.24, 0.08], [0.23, 0.37, 0.08], [0.26, 0.52, 0.08]], [0.12, 0.1, 0.06, 0], 6, FLAME_OUTER, 1.3);
    s.light(0, 0.6, 0);
  } else if (low) {
    // The logs have burnt through and fallen in. What is left of each glows from its head.
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + 0.5 + s.rr(-0.2, 0.2);
      const head = around(a, -s.rr(0, 0.06), s.rr(0.13, 0.19)), foot = around(a, s.rr(0.28, 0.33), 0.06);
      // The glowing third of it.
      const mid: V3 = [head[0] + (foot[0] - head[0]) * 0.36, head[1] + (foot[1] - head[1]) * 0.36, head[2] + (foot[2] - head[2]) * 0.36];
      const turn = s.r();
      s.tube([head, mid], [0.045, 0.056], 4, [P.ochre, P.oakDark], { cap: 'start', capTone: P.gold, flat: true, glow: 2, turn });
      s.tube([mid, foot], [0.056, 0.062], 4, P.soil, { capTone: P.ink, grade: 0.75, flat: true, turn });
    }
    // A bed of black cinders under them, and the coals that still glow on it.
    s.cone(0, 0.012, 0, 0.31, 0.07, 6, [P.ink, P.soil]);
    for (let k = 0; k < 4; k++) {
      const [x, , z] = around(k * TAU / 4 + 1.25 + s.rr(-0.2, 0.2), s.rr(0.12, 0.2), 0);
      s.blob(x, 0.07, z, s.rr(0.07, 0.1), 0.05, s.rr(0.06, 0.08), COALS, { sides: 4, rings: 1, jitter: 0.25, noise: 0.9, glow: 2 });
    }
    tongue(s, [[0, 0.1, 0], [0.02, 0.22, 0.01], [-0.02, 0.36, -0.01], [0.04, 0.5, 0.01]], [0.12, 0.1, 0.065, 0], 6, FLAME, 1.2);
    tongue(s, [[0.13, 0.08, 0.05], [0.16, 0.2, 0.07], [0.12, 0.33, 0.03]], [0.07, 0.05, 0], 5, FLAME_OUTER, 0.9, 1);
    tongue(s, [[-0.1, 0.08, -0.1], [-0.13, 0.18, -0.12], [-0.09, 0.28, -0.08]], [0.065, 0.045, 0], 4, FLAME_OUTER, 1.1, 2);
    s.light(0, 0.3, 0);
  } else {
    // Cold: what did not burn lies black in a heap of grey ash.
    s.disc(0, 0.02, 0, 0.36, 7, RAMP.stone[2], { turn: 0.5 });
    s.blob(0.02, 0.03, -0.02, 0.24, 0.1, 0.21, RAMP.stone, { floor: 0, sides: 6, rings: 2, jitter: 0.2, noise: 0.5 });
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + 0.5 + s.rr(-0.25, 0.25);
      const head = around(a, s.rr(0.02, 0.08), s.rr(0.1, 0.14)), foot = around(a, s.rr(0.29, 0.34), 0.055);
      const mid: V3 = [(head[0] + foot[0]) / 2, (head[1] + foot[1]) / 2 + 0.01, (head[2] + foot[2]) / 2];
      // Ash on the end that was in the fire.
      s.tube([head, mid, foot], [0.04, 0.052, 0.056], 4, [RAMP.stone[2], P.ink, P.ink], { cap: 'both', capTone: P.night, flat: true, turn: s.r() });
    }
    for (const [x, z] of [[0.17, 0.12], [-0.14, 0.16]] as const) s.blob(x, 0.04, z, 0.06, 0.04, 0.05, [P.ink, P.soil], { floor: 0, sides: 4, rings: 1, jitter: 0.3 });
  }
  const geometry = s.done();
  // Char is the palette's earth under soot. Bake the shade once, not in the frame loop.
  const colors = geometry.getAttribute('color'), fx = geometry.getAttribute('aFx');
  const earth = new THREE.Color(P.soil), ink = new THREE.Color(P.ink);
  for (let i = 0; i < colors.count; i++) {
    if (fx.getY(i) !== 0) continue;
    const r = colors.getX(i), g = colors.getY(i), b = colors.getZ(i);
    const matches = (c: THREE.Color) => Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) < 0.00001;
    if (matches(earth) || matches(ink)) colors.setXYZ(i, earth.r * 0.22, earth.g * 0.22, earth.b * 0.22);
  }
  return geometry;
}

// Keep the legacy prop key for callers and saves, with one canonical camp model.
export { homeTent as tent } from './settlement.ts';
