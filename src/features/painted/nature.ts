// What kind of land a column is, and the colour of its ground: the meadow's greens, the old forest's darker
// moss, the grey forest's pale dry grass, the marsh's mud and pools, the cave hills' scree, the terraces'
// carved flags. The game says which kind of land is where (`Nature`); the looks are LAND_KINDS in
// src/content/land.ts. The near land, the far land, the grass and the wilds all read the land through here,
// so a kind's edge is the same in all of them.
import * as THREE from 'three';
import { GREY, LAND_KINDS, POOLS, type LandKind } from '../../content/land.ts';
import { fbm, smoothstep } from './noise.ts';

/** What the painted world asks the game about the kinds of land. Every answer comes from the plan, so it works anywhere. */
export interface Nature {
  /** The kinds' names, in the order `mix` writes them: keys of LAND_KINDS. */
  readonly kinds: readonly string[];
  /** The share of each kind round a column, written into `out` (as long as `kinds`), which it returns. */
  mix(x: number, z: number, out: Float32Array): Float32Array;
  /** How grey a column is, from 0 (alive) to 1 (drained). */
  grey(x: number, z: number): number;
}

/** Nature for a world that is all meadow: a demo, a test, the fight lab. */
export const MEADOW_ONLY: Nature = { kinds: ['meadow'], mix: (_x, _z, out) => { out.fill(0); out[0] = 1; return out; }, grey: () => 0 };

/** The pool field's level at which a marsh pool's water begins. Its rim of wet mud is a little below. */
export const POOL_AT = 0.6;
const RIM = 0.045;

/**
 * One reading of the land at a point, as numbers in one array: the share of each kind, then how grey it is,
 * the marsh's pool field (water above POOL_AT), and how much of it is a bare patch (no grass).
 */
export interface Ground {
  readonly kinds: readonly string[];
  /** Numbers in one reading: the kinds, then grey, pool, patch. */
  readonly size: number;
  readonly GREY: number;
  readonly POOL: number;
  readonly PATCH: number;
  /** Reads the land at a point into `out`, `size` long. */
  read(x: number, z: number, out: Float32Array): Float32Array;
  /** The grass's green at a point of a reading, before its bare patches and its grey. */
  green(x: number, z: number, reading: Float32Array, out: THREE.Color): THREE.Color;
  /** Lays a reading's bare patches and pools on a colour. `grassy` is the share of the colour that is grass. */
  finish(reading: Float32Array, grassy: number, out: THREE.Color): THREE.Color;
  /** A reading's share of a number each kind has (`tall`, `flowers`...). */
  sum(reading: Float32Array, of: (kind: LandKind) => number): number;
  /** The share of the kind with this name, 0 where there is none. */
  share(reading: Float32Array, name: string): number;
  /** Drains a colour toward grey by `grey` (0 to 1), with this tint. */
  drain(color: THREE.Color, grey: number, tint?: THREE.Color): THREE.Color;
  /** Drains a colour as much as a reading's grey asks. */
  grey(reading: Float32Array, color: THREE.Color): THREE.Color;
  /** How much of a reading is wet mud or water: 0 on dry land, 1 in a pool. */
  wet(reading: Float32Array): number;
}

const lum = (c: THREE.Color): number => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;

export function createGround(nature: Nature): Ground {
  const looks = nature.kinds.map((name) => LAND_KINDS[name] ?? (LAND_KINDS.meadow as LandKind));
  const n = looks.length;
  const greens = looks.map((k) => ({ light: new THREE.Color(k.greens.light), mid: new THREE.Color(k.greens.mid), deep: new THREE.Color(k.greens.deep), straw: new THREE.Color(k.greens.straw) }));
  const bares = looks.map((k) => new THREE.Color(k.bareColor));
  const marsh = nature.kinds.indexOf('marsh');
  const ash = new THREE.Color(GREY.tint);
  const poolShallow = new THREE.Color(POOLS.shallow), rim = new THREE.Color(POOLS.rim);
  const part = new THREE.Color(), bare = new THREE.Color(), grey = new THREE.Color();
  const GREY_AT = n, POOL = n + 1, PATCH = n + 2;
  const kindsOut = new Float32Array(n);
  const sum = (reading: Float32Array, of: (kind: LandKind) => number): number => {
    let total = 0;
    for (let k = 0; k < n; k++) if ((reading[k] as number) > 0) total += (reading[k] as number) * of(looks[k] as LandKind);
    return total;
  };
  const drain = (color: THREE.Color, amount: number, tint = ash): THREE.Color => {
    if (amount <= 0) return color;
    const l = lum(color) / lum(tint);
    return color.lerp(grey.copy(tint).multiplyScalar(l), Math.min(1, amount));
  };
  return {
    kinds: nature.kinds, size: n + 3, GREY: GREY_AT, POOL, PATCH,
    read(x, z, out) {
      nature.mix(x, z, kindsOut);
      out.set(kindsOut);
      out[GREY_AT] = nature.grey(x, z);
      // Pools lie where a slow noise is high, in the marsh only: the field sinks well under the water's level outside it.
      const wet = marsh >= 0 ? (kindsOut[marsh] as number) : 0;
      out[POOL] = wet > 0 ? fbm(x / 9, z / 9, 2, 91) * (1 + POOLS.share * 0.6) - 0.12 + (wet - 1) * 0.6 : 0;
      // Bare patches: more of them where the kind is barer. None at all where no kind has any.
      const share = sum(out, (k) => k.bare);
      out[PATCH] = share > 0 ? smoothstep(0.69 - 0.4 * share, 0.75 - 0.4 * share, fbm(x / 6.5, z / 6.5, 2, 93)) * smoothstep(0, 0.12, share) : 0;
      return out;
    },
    green(x, z, reading, out) {
      const a = smoothstep(0.35, 0.68, fbm(x / 36, z / 36, 3, 21)), b = smoothstep(0.5, 0.78, fbm(x / 10, z / 10, 2, 33)) * 0.55, c = smoothstep(0.6, 0.78, fbm(x / 52, z / 52, 2, 44)) * 0.5;
      out.setRGB(0, 0, 0);
      for (let k = 0; k < n; k++) {
        const w = reading[k] as number;
        if (w <= 0) continue;
        const g = greens[k] as (typeof greens)[number];
        part.copy(g.mid).lerp(g.light, a).lerp(g.deep, b).lerp(g.straw, c);
        out.r += part.r * w; out.g += part.g * w; out.b += part.b * w;
      }
      return out;
    },
    finish(reading, grassy, out) {
      const patch = (reading[PATCH] as number) * grassy;
      if (patch > 0) {
        bare.setRGB(0, 0, 0);
        let total = 0;
        for (let k = 0; k < n; k++) {
          const w = (reading[k] as number) * (looks[k] as LandKind).bare;
          if (w <= 0) continue;
          const c = bares[k] as THREE.Color;
          bare.r += c.r * w; bare.g += c.g * w; bare.b += c.b * w; total += w;
        }
        if (total > 0) out.lerp(bare.multiplyScalar(1 / total), patch);
      }
      // A pool's rim is wet dark mud, and the pool itself is drawn as water by the land's shader.
      const pool = reading[POOL] as number;
      if (pool > POOL_AT - RIM) out.lerp(rim, smoothstep(POOL_AT - RIM, POOL_AT, pool) * 0.8 * grassy);
      if (pool > POOL_AT) out.lerp(poolShallow, smoothstep(POOL_AT, POOL_AT + 0.03, pool) * grassy);
      return out;
    },
    sum,
    grey: (reading, color) => drain(color, (reading[GREY_AT] as number) * GREY.drain),
    wet: (reading) => smoothstep(POOL_AT - RIM, POOL_AT, reading[POOL] as number),
    share(reading, name) {
      const k = nature.kinds.indexOf(name);
      return k < 0 ? 0 : (reading[k] as number);
    },
    drain,
  };
}
