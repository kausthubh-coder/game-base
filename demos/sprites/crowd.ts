// The demo's crowd: characters that walk one of eight ways for a while, stand for a while, and
// turn back when they stray. It only decides where each one is and what it does. The sprite system draws them.
import type { SpriteHandle, Sprites } from '../../src/features/sprites/index.ts';

export interface Look {
  /** A sprite name: one from the manifest, or a color variant. */
  sprite: string;
  /** Walking speed in blocks a second. */
  speed: number;
}

interface Walker {
  handle: SpriteHandle;
  x: number;
  z: number;
  /** The way it faces: 0 is north, a quarter turn is east. */
  heading: number;
  speed: number;
  walking: boolean;
  /** False for a sprite with no walk or no idle drawn, such as a bug that only flutters. It keeps its one animation. */
  canWalk: boolean;
  canIdle: boolean;
  /** Seconds until it changes its mind. */
  timer: number;
}

export interface Crowd {
  readonly count: number;
  /** The crowd stays within this many blocks of the middle. */
  readonly radius: number;
  setCount(count: number): void;
  setVisible(visible: boolean): void;
  update(dt: number): void;
}

const EIGHTH = Math.PI / 4;

export function createCrowd(sprites: Sprites, looks: readonly Look[], random: () => number): Crowd {
  const walkers: Walker[] = [];
  let radius = 6;
  let visible = true;
  const shares = (a: number, b: number): boolean => (b === 0 ? a > 1 : shares(b, a % b));
  let stride = Math.min(7, looks.length);
  while (stride > 1 && shares(stride, looks.length)) stride--;

  function spawn(index: number): Walker {
    // A step that shares no factor with the length of the cast, so neighbors in the list get different looks.
    const look = looks[(index * stride) % looks.length];
    const distance = Math.sqrt(random()) * radius, angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
    const heading = Math.floor(random() * 8) * EIGHTH;
    const walking = random() < 0.6;
    const handle = sprites.add(look.sprite, { x, y: 0, z, facing: heading, visible });
    const canWalk = handle.has('walk'), canIdle = handle.has('idle');
    if (walking && canWalk) handle.play('walk', { phase: 'random' });
    return { handle, x, z, heading, speed: look.speed, walking, canWalk, canIdle, timer: 0.5 + random() * 4 };
  }

  return {
    get count() { return walkers.length; },
    get radius() { return radius; },

    setCount(count) {
      radius = 3 + 0.95 * Math.sqrt(count);
      while (walkers.length > count) (walkers.pop() as Walker).handle.remove();
      while (walkers.length < count) walkers.push(spawn(walkers.length));
    },

    setVisible(next) {
      visible = next;
      for (const walker of walkers) walker.handle.setVisible(next);
    },

    update(dt) {
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        w.timer -= dt;
        if (w.timer <= 0) {
          w.walking = !w.walking;
          if (w.walking) {
            // One of the eight ways, or straight back toward the middle after straying.
            const strayed = w.x * w.x + w.z * w.z > radius * radius;
            w.heading = strayed ? Math.round(Math.atan2(-w.x, w.z) / EIGHTH) * EIGHTH : Math.floor(random() * 8) * EIGHTH;
            w.timer = 1.5 + random() * 3.5;
            w.handle.setFacing(w.heading);
            if (w.canWalk) w.handle.play('walk');
          } else {
            w.timer = 0.8 + random() * 2.7;
            if (w.canIdle) w.handle.play('idle');
          }
        }
        if (w.walking) {
          w.x += Math.sin(w.heading) * w.speed * dt;
          w.z -= Math.cos(w.heading) * w.speed * dt;
          w.handle.setPosition(w.x, 0, w.z);
        }
      }
    },
  };
}
