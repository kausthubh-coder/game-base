// The particle pool. No Three.js here, so it runs in tests.
//
// A particle is written once, when it is born: where it starts, how fast it goes, how long it lives and how it
// looks. The vertex shader works out the rest from the time, so a frame costs the main thread only the particles
// born in it. The pool is one flat array with a fixed number of slots, and it never grows.
import type { Vec3 } from '../../engine/types.ts';
import { effectBudget, effects, type EffectEntry, type EffectId, type SpriteShape } from '../../content/effects.ts';

/** Floats for each particle. The view reads them as seven vec4 attributes. */
export const STRIDE = 28;

// Offsets inside one particle.
const ORIGIN = 0; // x, y, z, then the time it is born
const VELOCITY = 4; // x, y, z, then seconds of life
const COLOR0 = 8; // r, g, b, a at birth
const COLOR1 = 12; // r, g, b, a at death
const MOTION = 16; // size at birth, size at death, gravity, drag
const LOOK = 20; // shape + 16 * facing, spin or stretch, wobble meters, a random seed
const FADE = 24; // fade in, fade out, flags, wobble radians a second

const SHAPES: Record<SpriteShape, number> = { glow: 0, square: 1, puff: 2, streak: 3, ring: 4, leaf: 5, spark: 6 };
const FACINGS = { camera: 0, motion: 1, ground: 2 } as const;
export const FLAG_LIT = 1;
export const FLAG_BLINK = 2;
export const FLAG_ADD = 4;

// The clock is pulled back now and then so times stay exact in 32-bit floats.
const REBASE_AFTER = 1024;

export interface EmitOptions {
  /** Replaces the entry's colors, as 0xrrggbb. Block chips pass the block's color. */
  color?: number;
  /** Multiplies the count. */
  scale?: number;
  /** A push added to every particle's aim. */
  direction?: Vec3;
  /** Particles end here, for a trail from an item to the bag. */
  target?: Vec3;
}

export interface ParticleStoreOptions {
  capacity?: number;
  weatherCapacity?: number;
  seed?: number;
}

export interface ParticleStore {
  readonly capacity: number;
  /** `capacity * STRIDE` floats. */
  readonly data: Float32Array;
  /** Particles alive now. Never more than `capacity`. */
  readonly live: number;
  readonly liveWeather: number;
  /** Slots 0 to this one hold every living particle, so the view draws only that many. */
  readonly highWater: number;
  /** The pool's clock, in seconds. Births are written against it. */
  readonly now: number;
  /** The slots written since `clearDirty`, as from and to. Empty when from >= to. */
  readonly dirtyFrom: number;
  readonly dirtyTo: number;
  /** Multiplies every count. The quality switch sets it. */
  quality: number;
  /** The wind, in meters a second. Particles born now pick up their share of it. */
  windX: number;
  windZ: number;
  /** The height of the ground, for particles that end when they land. */
  groundAt: ((x: number, z: number) => number) | null;
  /** Moves the clock on and frees the slots of particles that have ended. */
  advance(dt: number): void;
  /** Plays an entry at a point. Returns how many particles it started. */
  emit(id: EffectId, x: number, y: number, z: number, options?: EmitOptions): number;
  /** Starts one particle with a given motion and the entry's look. `delay` holds it back. False when the pool is full. */
  put(id: EffectId, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, delay?: number): boolean;
  /** A number from 0 to 1 from the pool's own seeded generator. */
  random(): number;
  clearDirty(): void;
  /** Ends every particle. */
  clear(): void;
}

interface Compiled {
  entry: EffectEntry;
  color0: [number, number, number];
  color1: [number, number, number];
  alpha0: number;
  alpha1: number;
  code: number;
  flags: number;
  spinOrStretch: number;
  wobbleMeters: number;
  wobbleRate: number;
  weather: boolean;
  also: EffectId[];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgb(hex: number, gain: number): [number, number, number] {
  return [linear((hex >> 16) & 255) * gain, linear((hex >> 8) & 255) * gain, linear(hex & 255) * gain];
}

function compile(entry: EffectEntry): Compiled {
  const facing = entry.facing ?? 'camera';
  const add = entry.blend === 'add';
  const gain = entry.glow ?? 1;
  return {
    entry,
    color0: rgb(entry.color[0], gain),
    color1: rgb(entry.color[1], gain),
    alpha0: entry.alpha?.[0] ?? 1,
    alpha1: entry.alpha?.[1] ?? 1,
    code: SHAPES[entry.shape] + 16 * FACINGS[facing],
    flags: (add ? FLAG_ADD : FLAG_LIT) | (entry.blink ? FLAG_BLINK : 0),
    spinOrStretch: facing === 'motion' ? (entry.stretch ?? 1) : (entry.spin ?? 0) * Math.PI * 2,
    wobbleMeters: entry.wobble?.[0] ?? 0,
    wobbleRate: (entry.wobble?.[1] ?? 0) * Math.PI * 2,
    weather: entry.weather === true,
    also: (entry.with ?? []) as EffectId[],
  };
}

export function createParticleStore(options: ParticleStoreOptions = {}): ParticleStore {
  const capacity = options.capacity ?? effectBudget.particles;
  const weatherCapacity = Math.min(capacity, options.weatherCapacity ?? effectBudget.weather);
  const data = new Float32Array(capacity * STRIDE);
  const dieAt = new Float64Array(capacity);
  // 0 is free, 1 is a living particle, 2 is a living weather particle.
  const state = new Uint8Array(capacity);
  // The free slots, as a heap with the lowest on top. A new particle always takes the lowest free slot, so the
  // living ones stay packed at the front and the view draws no more instances than it must.
  const free = new Uint16Array(capacity);
  let freeCount = capacity;
  for (let i = 0; i < capacity; i++) free[i] = i;

  function release(slot: number): void {
    let i = freeCount++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (free[parent] <= slot) break;
      free[i] = free[parent];
      i = parent;
    }
    free[i] = slot;
  }

  function lowestFree(): number {
    const lowest = free[0];
    const last = free[--freeCount];
    let i = 0;
    for (;;) {
      let child = i * 2 + 1;
      if (child >= freeCount) break;
      if (child + 1 < freeCount && free[child + 1] < free[child]) child++;
      if (free[child] >= last) break;
      free[i] = free[child];
      i = child;
    }
    free[i] = last;
    return lowest;
  }

  let now = 0;
  let liveWeather = 0;
  let highWater = 0;
  let dirtyFrom = capacity;
  let dirtyTo = 0;

  let seed = (options.seed ?? 1) >>> 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * random();

  const compiled = new Map<string, Compiled>();
  for (const [id, entry] of Object.entries(effects)) compiled.set(id, compile(entry));
  const look = (id: EffectId): Compiled => compiled.get(id) as Compiled;

  // One override color, kept here so `emit` allocates nothing.
  const tint: [number, number, number] = [0, 0, 0];

  function take(weather: boolean): number {
    if (freeCount === 0) return -1;
    if (weather && liveWeather >= weatherCapacity) return -1;
    const slot = lowestFree();
    state[slot] = weather ? 2 : 1;
    if (weather) liveWeather++;
    if (slot >= highWater) highWater = slot + 1;
    if (slot < dirtyFrom) dirtyFrom = slot;
    if (slot >= dirtyTo) dirtyTo = slot + 1;
    return slot;
  }

  function write(c: Compiled, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, delay: number, color0: readonly number[], color1: readonly number[]): boolean {
    const slot = take(c.weather);
    if (slot < 0) return false;
    const entry = c.entry;
    const o = slot * STRIDE;
    const born = now + delay;
    dieAt[slot] = born + life;
    // A little brightness change from one particle to the next.
    const shade = 0.86 + random() * 0.24;
    let r0 = color0[0], g0 = color0[1], b0 = color0[2];
    let r1 = color1[0], g1 = color1[1], b1 = color1[2];
    if (entry.pickColor) {
      const k = random();
      r0 = r1 = r0 + (r1 - r0) * k;
      g0 = g1 = g0 + (g1 - g0) * k;
      b0 = b1 = b0 + (b1 - b0) * k;
    }
    data[o + ORIGIN] = x;
    data[o + ORIGIN + 1] = y;
    data[o + ORIGIN + 2] = z;
    data[o + ORIGIN + 3] = born;
    data[o + VELOCITY] = vx;
    data[o + VELOCITY + 1] = vy;
    data[o + VELOCITY + 2] = vz;
    data[o + VELOCITY + 3] = life;
    data[o + COLOR0] = r0 * shade;
    data[o + COLOR0 + 1] = g0 * shade;
    data[o + COLOR0 + 2] = b0 * shade;
    data[o + COLOR0 + 3] = c.alpha0;
    data[o + COLOR1] = r1 * shade;
    data[o + COLOR1 + 1] = g1 * shade;
    data[o + COLOR1 + 2] = b1 * shade;
    data[o + COLOR1 + 3] = c.alpha1;
    const size = 0.85 + random() * 0.3;
    data[o + MOTION] = entry.size[0] * size;
    data[o + MOTION + 1] = entry.size[1] * size;
    data[o + MOTION + 2] = entry.gravity;
    data[o + MOTION + 3] = entry.drag ?? 0;
    data[o + LOOK] = c.code;
    data[o + LOOK + 1] = c.spinOrStretch;
    data[o + LOOK + 2] = c.wobbleMeters;
    data[o + LOOK + 3] = random();
    data[o + FADE] = entry.fade?.[0] ?? 0;
    data[o + FADE + 1] = entry.fade?.[1] ?? 0.3;
    data[o + FADE + 2] = c.flags + (c.weather ? 8 : 0);
    data[o + FADE + 3] = c.wobbleRate;
    return true;
  }

  /** Seconds until something thrown from `y` at `vy` under `gravity` reaches `ground`. Infinity if it never does. */
  function landsIn(y: number, vy: number, gravity: number, ground: number): number {
    const drop = y - ground;
    if (drop <= 0) return 0;
    if (gravity > 1e-6) return (vy + Math.sqrt(vy * vy + 2 * gravity * drop)) / gravity;
    return vy < -1e-6 ? drop / -vy : Infinity;
  }

  const store: ParticleStore = {
    capacity,
    data,
    quality: 1,
    windX: 0,
    windZ: 0,
    groundAt: null,
    random,
    get live() {
      return capacity - freeCount;
    },
    get liveWeather() {
      return liveWeather;
    },
    get highWater() {
      return highWater;
    },
    get now() {
      return now;
    },
    get dirtyFrom() {
      return dirtyFrom;
    },
    get dirtyTo() {
      return dirtyTo;
    },

    advance(dt) {
      now += dt;
      for (let slot = 0; slot < highWater; slot++) {
        if (state[slot] !== 0 && dieAt[slot] <= now) {
          if (state[slot] === 2) liveWeather--;
          state[slot] = 0;
          release(slot);
        }
      }
      while (highWater > 0 && state[highWater - 1] === 0) highWater--;

      if (now > REBASE_AFTER) {
        // Shift every slot, dead ones too, so an old particle can never come back to life.
        now -= REBASE_AFTER;
        for (let slot = 0; slot < capacity; slot++) {
          data[slot * STRIDE + ORIGIN + 3] -= REBASE_AFTER;
          dieAt[slot] -= REBASE_AFTER;
        }
        dirtyFrom = 0;
        dirtyTo = capacity;
      }
    },

    emit(id, x, y, z, options) {
      const c = look(id);
      const entry = c.entry;
      let color0: readonly number[] = c.color0;
      let color1: readonly number[] = c.color1;
      if (options?.color !== undefined) {
        const gain = entry.glow ?? 1;
        tint[0] = linear((options.color >> 16) & 255) * gain;
        tint[1] = linear((options.color >> 8) & 255) * gain;
        tint[2] = linear(options.color & 255) * gain;
        color0 = color1 = tint;
      }
      const count = Math.max(1, Math.round(entry.count * (options?.scale ?? 1) * store.quality));
      const radius = entry.radius ?? 0;
      const up = entry.aim?.up ?? 0;
      const out = entry.aim?.out ?? 0;
      const any = entry.aim?.any ?? 0;
      let started = 0;
      for (let i = 0; i < count; i++) {
        const turn = random() * Math.PI * 2;
        const reach = radius * Math.sqrt(random());
        const outX = Math.cos(turn);
        const outZ = Math.sin(turn);
        const px = x + outX * reach;
        const py = y + (entry.height ? between(entry.height) : 0);
        const pz = z + outZ * reach;

        // A direction: up, away from the center, and a random part.
        let dx = out * outX + (options?.direction?.x ?? 0);
        let dy = up + (options?.direction?.y ?? 0);
        let dz = out * outZ + (options?.direction?.z ?? 0);
        if (any !== 0) {
          const h = random() * 2 - 1;
          const around = random() * Math.PI * 2;
          const flat = Math.sqrt(1 - h * h);
          dx += any * flat * Math.cos(around);
          dy += any * h;
          dz += any * flat * Math.sin(around);
        }
        const length = Math.hypot(dx, dy, dz);
        const speed = between(entry.speed);
        let vx = 0, vy = 0, vz = 0;
        if (length > 1e-6) {
          vx = (dx / length) * speed;
          vy = (dy / length) * speed;
          vz = (dz / length) * speed;
        }
        vx += store.windX * (entry.wind ?? 0);
        vz += store.windZ * (entry.wind ?? 0);

        let life = between(entry.life);
        if (options?.target) {
          vx += (options.target.x - px) / life;
          vy += (options.target.y - py) / life;
          vz += (options.target.z - pz) / life;
        } else if (entry.lands && store.groundAt) {
          life = Math.min(life, Math.max(0.05, landsIn(py, vy, entry.gravity, store.groundAt(px, pz))));
        }
        if (write(c, px, py, pz, vx, vy, vz, life, 0, color0, color1)) started++;
      }
      for (const other of c.also) started += store.emit(other, x, y, z, options);
      return started;
    },

    put(id, x, y, z, vx, vy, vz, life, delay = 0) {
      const c = look(id);
      return write(c, x, y, z, vx, vy, vz, life, delay, c.color0, c.color1);
    },

    clearDirty() {
      dirtyFrom = capacity;
      dirtyTo = 0;
    },

    clear() {
      for (let slot = 0; slot < capacity; slot++) {
        state[slot] = 0;
        dieAt[slot] = 0;
        data[slot * STRIDE + VELOCITY + 3] = 0;
        free[slot] = slot;
      }
      freeCount = capacity;
      liveWeather = 0;
      highWater = 0;
      dirtyFrom = 0;
      dirtyTo = capacity;
    },
  };
  return store;
}
