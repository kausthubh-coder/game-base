// What the weather puts in the air: rain with its splashes, falling leaves, wind lines, fireflies and the
// glowing motes. No Three.js here. Each frame it reads the Ambient numbers and starts a few particles around
// the focus point, through the same pool as every other effect.
import type { Ambient, Vec3 } from '../../engine/types.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import { effects, windSpeed } from '../../content/effects.ts';
import type { ParticleStore } from './particles.ts';

/** Half the side of the square around the focus where weather falls, in meters. */
const AREA = 26;
/** Rain starts this far above the focus. */
const CEILING = 13;
/** A long frame starts no more than this many seconds of particles. */
const LONGEST_STEP = 0.1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface WeatherEmitters {
  /** `motes` is the strength of the glowing motes, 0 to 1. */
  update(dt: number, ambient: Ambient, world: WorldQuery, focus: Vec3, motes: number): void;
}

export function createWeatherEmitters(store: ParticleStore): WeatherEmitters {
  // Parts of a particle still owed from earlier frames.
  const owed = { rain: 0, leaf: 0, windLine: 0, firefly: 0, mote: 0 };
  const random = store.random;
  const spread = (half: number) => (random() * 2 - 1) * half;
  const between = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * random();

  function count(key: keyof typeof owed, perSecond: number, dt: number): number {
    owed[key] += perSecond * store.quality * Math.min(dt, LONGEST_STEP);
    const whole = Math.floor(owed[key]);
    owed[key] -= whole;
    return whole;
  }

  return {
    update(dt, ambient, world, focus, motes) {
      const windX = Math.cos(ambient.windDir);
      const windZ = Math.sin(ambient.windDir);
      store.windX = windX * ambient.wind * windSpeed;
      store.windZ = windZ * ambient.wind * windSpeed;

      // ---- rain: each streak ends where it lands. Its splash is born there right away, not when the streak
      // arrives: in steady rain nobody can tell, and a particle that waits would hold a slot while it waits.
      const rain = effects.rain;
      const slantX = 1.1 + store.windX * rain.wind;
      const slantZ = store.windZ * rain.wind;
      const top = focus.y + CEILING;
      for (let i = count('rain', ambient.rain * rain.count, dt); i > 0; i--) {
        const x = focus.x + spread(AREA);
        const z = focus.z + spread(AREA);
        const speed = between(rain.speed);
        const guess = CEILING / speed;
        const ground = world.heightAt(x + slantX * guess, z + slantZ * guess);
        if (ground > top - 1) continue;
        const fall = (top - ground) / speed;
        if (!store.put('rain', x, top, z, slantX, -speed, slantZ, fall)) break;
        if (random() < 0.4) {
          const landX = x + slantX * fall;
          const landZ = z + slantZ * fall;
          // Water shows rings of its own, and nothing splashes under a roof.
          if (world.openSky(landX, ground + 0.5, landZ) && world.surfaceAt(landX, landZ) !== 'water') {
            store.put('rainSplash', landX, ground + 0.03, landZ, 0, 0, 0, between(effects.rainSplash.life));
            if (random() < 0.6) store.put('rainDrop', landX, ground + 0.05, landZ, spread(0.6), between(effects.rainDrop.speed), spread(0.6), between(effects.rainDrop.life));
          }
        }
      }

      // ---- leaves: a few in calm air, many in a wind. They drift in from upwind.
      const leaf = effects.leaf;
      for (let i = count('leaf', leaf.count * (0.08 + 0.92 * ambient.wind), dt); i > 0; i--) {
        const x = focus.x + spread(22) - windX * 6 * ambient.wind;
        const z = focus.z + spread(22) - windZ * 6 * ambient.wind;
        const y = focus.y + 4 + random() * 5;
        const fall = between(leaf.speed);
        const life = Math.min(between(leaf.life), Math.max(0.5, (y - world.heightAt(x, z)) / fall));
        if (!store.put('leaf', x, y, z, store.windX * leaf.wind, -fall, store.windZ * leaf.wind, life)) break;
      }

      // ---- wind lines: pale streaks that show a strong wind
      const line = effects.windLine;
      for (let i = count('windLine', line.count * clamp01((ambient.wind - 0.45) / 0.55), dt); i > 0; i--) {
        const x = focus.x + spread(22);
        const z = focus.z + spread(22);
        const speed = between(line.speed);
        if (!store.put('windLine', x, world.heightAt(x, z) + 0.8 + random() * 4.5, z, windX * speed, 0, windZ * speed, between(line.life))) break;
      }

      // ---- fireflies: on dry, calm nights
      const time = ambient.timeOfDay;
      const night = clamp01(Math.max((time - 0.76) / 0.04, (0.24 - time) / 0.04));
      const firefly = effects.firefly;
      const calm = ambient.wind < 0.7 ? 1 - clamp01(ambient.rain * 5) : 0;
      for (let i = count('firefly', firefly.count * night * calm, dt); i > 0; i--) {
        const x = focus.x + spread(20);
        const z = focus.z + spread(20);
        const speed = between(firefly.speed);
        if (!store.put('firefly', x, world.heightAt(x, z) + 0.4 + random() * 1.8, z, spread(speed), spread(speed * 0.3), spread(speed), between(firefly.life))) break;
      }

      // ---- the glowing motes of a seedfall
      const mote = effects.mote;
      for (let i = count('mote', mote.count * motes, dt); i > 0; i--) {
        const x = focus.x + spread(24);
        const z = focus.z + spread(24);
        const y = focus.y + 6 + random() * 6;
        const fall = between(mote.speed);
        const life = Math.min(between(mote.life), Math.max(0.5, (y - world.heightAt(x, z)) / fall));
        if (!store.put('mote', x, y, z, store.windX * mote.wind, -fall, store.windZ * mote.wind, life)) break;
      }
    },
  };
}
