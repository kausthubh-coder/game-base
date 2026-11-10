// The cutaway rule: what to hide so the player can still see the hero.
//   Under a roof or a floor: hide everything above the hero's head, in a wide circle.
//   Under ground: the same, in a smaller circle with a soft edge.
//   Always: clear a narrow tunnel from the hero toward the camera, for walls, trunks and hillsides.
// This file only decides. The world's material does the hiding, and `hides` answers the same
// question for a single block so a ray cast can skip what the player cannot see.
import { BLOCKS } from '../../content/blocks.ts';

/** Anything that can say which block is at a cell. The world's rules object fits. */
export interface BlockProbe {
  getBlock(x: number, y: number, z: number): number;
}

export type CutawayMode = 'open' | 'indoors' | 'underground';

export interface CutawayState {
  mode: CutawayMode;
  /** The center of the circle, on the hero. */
  x: number; z: number;
  /** Everything above this height is cut inside the circle. */
  y: number;
  /** The circle's radius right now. It opens and closes like an iris. 0 is closed. */
  radius: number;
  /** How wide the circle's faded edge is, in blocks. */
  soft: number;
  /** True indoors: what stands straight above the circle is cut too, so no piece of roof floats. */
  column: boolean;
  /** The point that must stay in sight: the hero's chest. */
  sightX: number; sightY: number; sightZ: number;
  /** The radius of the tunnel cleared from that point toward the camera. */
  sightRadius: number;
}

export interface CutawayOptions {
  indoorsRadius: number;
  undergroundRadius: number;
  /** How many blocks above the floor stay visible. 2 keeps walls as tall as the hero. */
  wallHeight: number;
  sightRadius: number;
  /** How far up to look for a ceiling. */
  ceilingReach: number;
}

export const DEFAULT_CUTAWAY: CutawayOptions = { indoorsRadius: 11, undergroundRadius: 8.5, wallHeight: 2, sightRadius: 1.5, ceilingReach: 14 };

const COVERS = new Uint8Array(256), NATURAL = new Uint8Array(256), STANDS = new Uint8Array(256);
for (const b of BLOCKS) {
  // Leaves do not count as a roof: the sight tunnel is enough under a tree.
  COVERS[b.id] = b.opaque && b.surface !== 'leaves' ? 1 : 0;
  NATURAL[b.id] = b.natural ? 1 : 0;
  STANDS[b.id] = b.solid ? 1 : 0;
}

export class CutawayRule {
  readonly options: CutawayOptions;
  readonly state: CutawayState = { mode: 'open', x: 0, y: 0, z: 0, radius: 0, soft: 1.5, column: false, sightX: 0, sightY: 0, sightZ: 0, sightRadius: 0 };
  private camX = 0; private camY = 1; private camZ = 0;
  private goal = 0;

  constructor(options: Partial<CutawayOptions> = {}) {
    this.options = { ...DEFAULT_CUTAWAY, ...options };
  }

  /** `x, y, z` is where the hero's feet are. `cam` is where the camera is. */
  update(dt: number, blocks: BlockProbe, x: number, y: number, z: number, camX: number, camY: number, camZ: number): void {
    const s = this.state, o = this.options;
    this.camX = camX; this.camY = camY; this.camZ = camZ;
    const fx = Math.floor(x), fz = Math.floor(z);

    // The floor is the first block under the feet. A jump must not move the cut, so look a few blocks down.
    let floor = Math.floor(y + 0.01);
    for (let k = 0; k < 4; k++) {
      if (STANDS[blocks.getBlock(fx, floor - 1 - k, fz)]) { floor -= k; break; }
    }

    let mode: CutawayMode = 'open';
    for (let cy = floor + o.wallHeight; cy <= floor + o.wallHeight + o.ceilingReach; cy++) {
      const id = blocks.getBlock(fx, cy, fz);
      if (COVERS[id]) { mode = NATURAL[id] ? 'underground' : 'indoors'; break; }
    }

    s.x = x; s.z = z;
    s.sightX = x; s.sightY = y + 1.1; s.sightZ = z;
    s.sightRadius = o.sightRadius;
    if (mode !== 'open') {
      s.mode = mode;
      s.y = floor + o.wallHeight;
      this.goal = mode === 'indoors' ? o.indoorsRadius : o.undergroundRadius;
      s.soft = mode === 'indoors' ? 1.5 : 3;
      s.column = mode === 'indoors';
    } else {
      this.goal = 0;
    }
    s.radius += (this.goal - s.radius) * (1 - Math.exp(-9 * dt));
    if (this.goal === 0 && s.radius < 0.05) { s.radius = 0; s.mode = 'open'; }
  }

  /** True when the cutaway hides most of this block, so a click should pass through it. */
  hides(x: number, y: number, z: number): boolean {
    const s = this.state;
    const px = x + 0.5, py = y + 0.5, pz = z + 0.5;
    if (s.radius > 0 && y >= s.y && this.camY > py) {
      const t = (s.y - py) / (py - this.camY);
      const lx = px + (px - this.camX) * t, lz = pz + (pz - this.camZ) * t;
      const inside = s.radius - s.soft / 2;
      if (Math.hypot(lx - s.x, lz - s.z) < inside || (s.column && Math.hypot(px - s.x, pz - s.z) < inside)) return true;
    }
    if (s.sightRadius > 0) {
      let ax = this.camX - s.sightX, ay = this.camY - s.sightY, az = this.camZ - s.sightZ;
      const len = Math.hypot(ax, ay, az) || 1;
      ax /= len; ay /= len; az /= len;
      const rx = px - s.sightX, ry = py - s.sightY, rz = pz - s.sightZ;
      const along = rx * ax + ry * ay + rz * az;
      if (along > 1.6 && Math.hypot(rx - ax * along, ry - ay * along, rz - az * along) < s.sightRadius * 0.75) return true;
    }
    return false;
  }
}
