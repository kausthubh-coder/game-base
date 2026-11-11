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
