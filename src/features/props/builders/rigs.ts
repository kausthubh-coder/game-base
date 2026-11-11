// Fight rigs share one merged geometry per state; every rooted part stays still.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

function lamp(spent: boolean): THREE.BufferGeometry {
  const s = new Shape(1601);
  s.box(0, 0, 0, 0.5, 0.14, 0.5, RAMP.stone, { bevel: 0.035, skip: '-y' });
  s.box(0, 0.12, 0, 0.14, 1.18, 0.14, P.plank, { top: P.plankLight });
  // The globe sits forward of the post so its broad face reads from above.
  s.box(0, 1.12, 0.12, 0.32, 0.045, 0.36, P.ochre);
  s.blob(0, 1.34, 0.12, 0.23, 0.21, 0.23,
    spent ? [P.slate, P.iron, P.pewter] : [P.lumeDeep, P.lume, P.lumeLight],
    { sides: 6, rings: 2, jitter: 0, noise: 0, glow: spent ? 0 : 2 });
  s.cyl(0, 1.49, 0.12, 0.3, 0.15, 0.12, 6, P.gold, { capTone: P.butter });
  if (spent) {
    // A broad jagged fracture on the front, readable even without the light change.
    s.tube([[-0.07, 1.46, 0.29], [0.04, 1.35, 0.34], [-0.02, 1.22, 0.28]],
      [0.022, 0.025, 0.018], 4, P.night, { cap: 'both' });
  } else s.light(0, 1.34, 0.12);
  s.shadowBox(0, 0, 0, 0.5, 0.14, 0.5);
  s.shadowBox(0, 0.14, 0, 0.14, 1.16, 0.14);
  s.shadowBlob(0, 1.36, 0.12, 0.26, 0.24, 0.26);
  return s.done();
}

export function rigLamp(): THREE.BufferGeometry { return lamp(false); }
export function rigLampSpent(): THREE.BufferGeometry { return lamp(true); }

function snare(spent: boolean): THREE.BufferGeometry {
  const s = new Shape(1613);
  const path: [number, number, number][] = [];
  const count = spent ? 20 : 12;
  for (let i = 0; i <= count; i++) {
    const a = i / count * Math.PI * (spent ? 4 : 2);
    const radius = spent ? 0.125 + 0.015 * Math.cos(a * 1.5) : 0.39;
    path.push([Math.cos(a) * radius, spent ? 0.055 + i / count * 0.07 : 0.055, Math.sin(a) * radius]);
  }
  s.tube(path, path.map(() => spent ? 0.05 : 0.055), 5, RAMP.bushLeaf, { cap: 'both' });
  if (spent) s.tube([[-0.13, 0.08, -0.08], [0, 0.14, 0], [0.13, 0.08, 0.08]], [0.05, 0.055, 0.05], 5, P.moss, { cap: 'both' });
  for (const a of [0.5, 2.5, 4.5]) {
    const radius = spent ? 0.14 : 0.39;
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
    s.tube([[x, 0.075, z], [x * 1.1, 0.17, z * 1.1]], [0.035, 0], 5, P.pine, { cap: 'none' });
  }
  for (const side of [-1, 1]) {
    s.at(side * (spent ? 0.025 : 0.27), 0.06, 0.08, side * 0.5, () => {
      s.poly([[0, 0, 0], [side * 0.1, 0.035, -0.06], [side * 0.13, 0.015, 0.04], [side * 0.08, 0, 0.1]], P.leaf, { two: true, toward: [0, 1, 0] });
    });
  }
  s.shadowBlob(0, 0.04, 0, spent ? 0.2 : 0.44, 0.045, spent ? 0.2 : 0.44);
  return s.done();
}

export function rigSnare(): THREE.BufferGeometry { return snare(false); }
export function rigSnareSpent(): THREE.BufferGeometry { return snare(true); }

function plate(spent: boolean): THREE.BufferGeometry {
  const s = new Shape(1627);
  s.box(0, 0, 0, 0.9, 0.09, 0.9, RAMP.stone, { bevel: 0.025, skip: '-y' });
  const path: [number, number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const a = i / 14 * Math.PI * 4;
    path.push([Math.cos(a) * 0.36, 0.095 + i / 14 * (spent ? 0.45 : 0.025), Math.sin(a) * 0.36]);
  }
  path.push([0, spent ? 0.54 : 0.135, 0]);
  s.tube(path, path.map(() => 0.025), 5, P.iron, { cap: 'both' });
  s.at(0, spent ? 0.54 : 0.135, 0, { rz: spent ? 0.35 : 0 }, () => {
    s.box(0, 0, 0, 0.68, 0.04, 0.68, P.gold, { bevel: 0.015, top: P.butter });
    // A broad inset identifies the pressure surface.
    s.box(0, 0.04, 0, 0.44, 0.012, 0.44, P.ochre);
  });
  s.shadowBox(0, 0, 0, 0.9, 0.09, 0.9);
  if (spent) s.shadowBox(0, 0.54, 0, 0.68, 0.06, 0.68);
  return s.done();
}

export function rigPlate(): THREE.BufferGeometry { return plate(false); }
export function rigPlateSpent(): THREE.BufferGeometry { return plate(true); }

function channel(spent: boolean): THREE.BufferGeometry {
  const s = new Shape(1637);
  // Flush ends at z = +/-.5: callers join copies one block apart along z.
  s.box(0, 0, 0, 0.85, 0.055, 1, RAMP.stone, { skip: '-y' });
  for (const x of [-0.36, 0.36]) {
    s.box(x, 0.045, 0, 0.13, 0.12, 1, RAMP.stone, { bevel: 0.025, skip: '-y+z-z', top: RAMP.stone[4] });
  }
  if (spent) {
    s.box(-0.08, 0.055, 0.08, 0.36, 0.008, 0.62, P.soil, { bevel: 0.003, skip: '-y' });
    s.box(0.14, 0.055, -0.3, 0.16, 0.008, 0.22, P.timberLight, { skip: '-y' });
  } else {
    s.box(0, 0.065, 0, 0.59, 0.025, 1, P.denim, { skip: '-y+z-z', top: P.sky });
    // Wide short glints, with a gap to each end so they do not mark the joins.
    for (const z of [-0.26, 0.22]) s.box(-0.04, 0.091, z, 0.31, 0.003, 0.035, P.ice, { skip: '-y' });
  }
  s.shadowBox(0, 0, 0, 0.85, 0.16, 1);
  return s.done();
}

export function rigChannel(): THREE.BufferGeometry { return channel(false); }
export function rigChannelSpent(): THREE.BufferGeometry { return channel(true); }
