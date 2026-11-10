// The hero as rules: a body that walks, jumps, swims and collides with blocks. It knows nothing
// about drawing or keys. It tells the rest of the game what happened through the event bus.
import { BLOCKS } from '../../content/blocks.ts';
import type { Bus, GameEvent } from '../../engine/events.ts';
import type { Surface, Vec3 } from '../../engine/types.ts';

/** Anything that can say which block is at a cell. The world's rules object fits. */
export interface BlockSource {
  getBlock(x: number, y: number, z: number): number;
  /** False where the land has not loaded yet. The body waits there and does not fall through. */
  isLoaded?(x: number, z: number): boolean;
  /** Light from lamps at a point, 0 to 15. The placeholder drawing uses it to glow by a lamp at night. */
  blockLightAt?(x: number, y: number, z: number): number;
}

/** What the player wants this step. The direction is in world space and need not be normalized. */
export interface HeroInput {
  moveX: number;
  moveZ: number;
  jump: boolean;
}

export interface HeroTuning {
  /** Half the body's width, and its height, in blocks. */
  half: number;
  tall: number;
  walkSpeed: number;
  swimSpeed: number;
  gravity: number;
  /** Upward speed at the start of a jump. 8.6 clears one block with room to spare. */
  jumpSpeed: number;
  /** Meters between two footstep events. */
  stride: number;
}

export const DEFAULT_HERO: HeroTuning = { half: 0.3, tall: 1.8, walkSpeed: 4.4, swimSpeed: 2.4, gravity: 28, jumpSpeed: 8.6, stride: 0.8 };

/** The body moves in steps of this many seconds, always, so it behaves the same at any frame rate. */
export const HERO_STEP = 1 / 60;

const SOLID = new Uint8Array(256), LIQUID = new Uint8Array(256);
for (const b of BLOCKS) { SOLID[b.id] = b.solid ? 1 : 0; LIQUID[b.id] = b.liquid ? 1 : 0; }
const EPS = 1e-4;

export class HeroBody {
  /** The middle of the feet. */
  x: number; y: number; z: number;
  vx = 0; vy = 0; vz = 0;
  grounded = false;
  swimming = false;
  /** The way the body last moved, in radians. 0 faces north (-z), and it grows clockwise seen from above. */
  facing = 0;
  readonly tuning: HeroTuning;

  private readonly blocks: BlockSource;
  private readonly bus: Bus<GameEvent> | undefined;
  private walked = 0;
  private sinceWater = 1;
  private blocked = false;

  constructor(blocks: BlockSource, spawn: Vec3, bus?: Bus<GameEvent>, tuning: Partial<HeroTuning> = {}) {
    this.blocks = blocks;
    this.bus = bus;
    this.tuning = { ...DEFAULT_HERO, ...tuning };
    this.x = spawn.x; this.y = spawn.y; this.z = spawn.z;
  }

  teleport(x: number, y: number, z: number): void {
    this.x = x; this.y = y; this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.grounded = false;
  }

  /** True when the body would overlap a solid block with its feet at this point. */
  private hits(x: number, y: number, z: number): boolean {
    const t = this.tuning, b = this.blocks;
    const x0 = Math.floor(x - t.half), x1 = Math.floor(x + t.half), z0 = Math.floor(z - t.half), z1 = Math.floor(z + t.half);
    const y0 = Math.floor(y), y1 = Math.floor(y + t.tall);
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) if (SOLID[b.getBlock(bx, by, bz)]) return true;
    return false;
  }

  /** The surface under the feet: the block below the middle, or below any corner when the middle hangs over an edge. */
  surface(): Surface {
    const t = this.tuning, b = this.blocks, y = Math.floor(this.y - 0.05);
    if (this.swimming) return 'water';
    let id = b.getBlock(Math.floor(this.x), y, Math.floor(this.z));
    for (let c = 0; c < 4 && !SOLID[id]; c++) {
      id = b.getBlock(Math.floor(this.x + (c & 1 ? t.half : -t.half)), y, Math.floor(this.z + (c & 2 ? t.half : -t.half)));
    }
    return SOLID[id] ? BLOCKS[id].surface : 'grass';
  }

  private emit(type: 'footstep' | 'land' | 'jump'): void {
    if (!this.bus) return;
    const at = { x: this.x, y: this.y, z: this.z };
    this.bus.emit(type === 'jump' ? { type, at } : { type, surface: this.surface(), at });
  }

  /** Advances the body by one fixed step. Call it `1 / HERO_STEP` times a second. */
  step(input: HeroInput): void {
    const t = this.tuning, b = this.blocks, dt = HERO_STEP;
    if (b.isLoaded && !b.isLoaded(this.x, this.z)) return;

    const wasSwimming = this.swimming;
    this.swimming = LIQUID[b.getBlock(Math.floor(this.x), Math.floor(this.y + 0.4), Math.floor(this.z))] === 1;
    this.sinceWater = this.swimming ? 0 : this.sinceWater + dt;
    if (this.swimming && !wasSwimming && this.vy < -4) this.emit('land');

    // Steer toward the wanted speed. The body turns faster on the ground than in the air.
    let mx = input.moveX, mz = input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const speed = this.swimming ? t.swimSpeed : t.walkSpeed;
    const grip = 1 - Math.exp(-(this.grounded ? 16 : this.swimming ? 6 : 4) * dt);
    this.vx += (mx * speed - this.vx) * grip;
    this.vz += (mz * speed - this.vz) * grip;
    if (len > 0.05) this.facing = Math.atan2(mx, -mz);

    if (this.swimming) {
      // Water holds the body up near the surface. Jump swims up.
      const deep = LIQUID[b.getBlock(Math.floor(this.x), Math.floor(this.y + 0.85), Math.floor(this.z))] === 1;
      this.vy += (deep ? 12 : -8) * dt;
      this.vy *= Math.exp(-3 * dt);
      if (input.jump) this.vy += (3.2 - this.vy) * (1 - Math.exp(-12 * dt));
      if (this.vy < -3) this.vy = -3;
    } else {
      this.vy -= t.gravity * dt;
      if (input.jump && this.grounded) {
        this.vy = t.jumpSpeed;
        this.grounded = false;
        this.emit('jump');
      }
    }
    // Pushing against a bank while in the water, or just out of it, climbs the bank.
    if (this.blocked && len > 0.05 && this.sinceWater < 0.35 && this.vy < 5.5) this.vy = 5.5;

    this.blocked = false;
    const dx = this.vx * dt, dz = this.vz * dt;
    if (dx !== 0) {
      if (this.hits(this.x + dx, this.y, this.z)) {
        this.x = dx > 0 ? Math.floor(this.x + dx + t.half) - t.half - EPS : Math.floor(this.x + dx - t.half) + 1 + t.half + EPS;
        this.vx = 0;
        this.blocked = true;
      } else this.x += dx;
    }
    if (dz !== 0) {
      if (this.hits(this.x, this.y, this.z + dz)) {
        this.z = dz > 0 ? Math.floor(this.z + dz + t.half) - t.half - EPS : Math.floor(this.z + dz - t.half) + 1 + t.half + EPS;
        this.vz = 0;
        this.blocked = true;
      } else this.z += dz;
    }

    const wasGrounded = this.grounded;
    const dy = this.vy * dt;
    this.grounded = false;
    if (this.hits(this.x, this.y + dy, this.z)) {
      if (dy < 0) {
        this.y = Math.floor(this.y + dy) + 1;
        this.grounded = true;
        if (!wasGrounded && this.vy < -3 && !this.swimming) this.emit('land');
      } else {
        this.y = Math.floor(this.y + dy + t.tall) - t.tall - EPS;
      }
      this.vy = 0;
    } else {
      this.y += dy;
    }

    // Footsteps on the ground, strokes in the water.
    if (this.grounded || this.swimming) {
      this.walked += Math.hypot(dx, dz);
      const stride = this.swimming ? t.stride * 1.5 : t.stride;
      if (this.walked >= stride) {
        this.walked -= stride;
        this.emit('footstep');
      }
    }
  }
}
