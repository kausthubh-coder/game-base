// Ilara's Hall: the Shut Door north of the grant, and what happens there on the first night.
//
//   - The door is shut. Pushing it does nothing.
//   - On the first night under the player's own roof, a Blighted fox comes. The player cannot sleep, and
//     backs away to the door. There, with the fox in front of them, they lower the axe, and the door opens.
//   - Inside, the Mark comes to the player's hand, their key wakes the Custodian, and the Mark calms the fox.
//   - The Heartstone shows how alive the player's land is.
//   - In the morning a few of Hollowmere are at the grant stone, Tamsin among them.
//
// The words are conversations in content/dialogue.ts with the ids below. Each sets its flag when it ends,
// and this system does what the flag means. It implements `HallApi`.

import type { Vec3 } from '../../engine/types.ts';
import type { Actor, Game, HallApi, Heart, Interactable, NpcId, SimSystem } from '../api.sim.ts';
import { CUSTODIAN_HEART, SPEAKERS } from '../content/dialogue.ts';
import { HALL } from '../content/region.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { isDark } from '../quests/rules.sim.ts';

const AIR = 0;
const TICK = 0.5;

/** The fox walks slower than the player, so backing away from it works. Further off than `FAR` it runs. */
const FOX_WALK = 2, FOX_RUN = 5.5, FAR = 22;
/** It stops this far from the player and stares. */
const FOX_STOPS = 3.2;
/** How far from the player it first shows itself, and how far off it is taken out of the world again. */
const FOX_APPEARS = 9, FOX_LEAVES = 30;
/** Seconds it looks at the player after the Mark calms it, and seconds it then has to slip away. */
const FOX_THANKS = 3, FOX_GOES = 14;
/** The fox comes when night falls with the player this close to the middle of their plot. */
const CAMP = 40;
/** How close to the place `shut.door` the player's back is against the door. */
const AT_DOOR = 2.6;

/** Every scene this system starts. A test checks that each is a conversation in content/dialogue.ts. */
export const SCENES = ['door.shut', 'night.door', 'hall.mark', 'custodian.wake', 'fox.calm', 'heart.first', 'hall.mural', 'hall.mural.asked', 'hall.gate', 'hall.gate.asked'] as const;
type SceneId = (typeof SCENES)[number];

export const FOX_ID = 'fox:blighted';
export const CUSTODIAN_ID = 'npc:custodian';
/** The fox is a leaftail with the lume drained out of it. The Custodian has a sheet of its own. */
const FOX_SPRITE = 'fox-blighted', CUSTODIAN_SPRITE = 'custodian';

/** What one of each living thing adds to the Heartstone. */
export const HEART_WORTH = { roof: 2, crop: 0.25, beast: 5 } as const;

/** Who is at the grant stone the morning after, and where they stand around it, in blocks east and south. */
const MORNING: readonly (readonly [id: NpcId, x: number, z: number])[] = [
  ['tamsin', 0, 0], ['juniper', 2, 1], ['gus', 3, -1], ['brack', 1, 2],
];

interface Fox {
  pos: Vec3;
  facing: number;
  /** Seconds since the Mark calmed it, or -1 while it is Blighted. */
  calm: number;
}

interface HallSave {
  fox: { x: number; y: number; z: number; calm: number } | null;
}

export interface Hall {
  api: HallApi;
  system: SimSystem;
}

/** The Heartstone's number in words, for the toast it gives when touched. */
export function heartWords(heart: Heart): string {
  const parts = heart.parts.filter((part) => part.count > 0).map((part) => `${part.count} ${part.count === 1 ? part.label : `${part.label}s`}`);
  return `The Heartstone holds ${heart.level}. ${parts.length ? `${parts.join(', ')}.` : 'Nothing lives on your land yet.'}`;
}

export function createHall(game: Game): Hall {
  const { clock, events, flags, player, world } = game;
  const door = HALL.door, court = HALL.court;

  let ready = false;
  let sinceTick = TICK;
  let fox: Fox | null = null;
  let foxActor: Actor | null = null;
  /** True once every cell of the open door is air, so the cells are not read again. */
  let doorCleared = false;
  /** A save loaded before the first step, kept until the world is there. */
  let pending: HallSave | null = null;

  const custodian: Actor = {
    id: CUSTODIAN_ID, sprite: CUSTODIAN_SPRITE, pos: { x: HALL.plinth.x, y: HALL.plinth.y + HALL.plinthTop, z: HALL.plinth.z },
    facing: Math.PI, anim: 'sleep', visible: true, mark: 'sleep',
  };

  const nightOn = (): boolean => flags.is('quest.night.started') && !flags.is('quest.night.done');
  const inCourt = (at: Vec3): boolean => at.x > court.x0 + 1 && at.x < court.x1 && at.z > court.z0 + 1 && at.z < court.z1 - 0.5;
  const place = (name: string): Vec3 | null => {
    try {
      return game.systems.region?.place(name).at ?? null;
    } catch {
      return null;
    }
  };
  /** Starts a scene of content/dialogue.ts by its id, unless something else has the player's attention. */
  const say = (scene: SceneId): void => {
    if (!player.busy) game.systems.talk?.start(scene);
  };

  // ------------------------------------------------------------------------------------ the door

  /** Clears the door's cells once the flag says it is open. A chunk that is not there yet is tried again. */
  function syncDoor(): void {
    if (doorCleared || !flags.is('door.open')) return;
    let shut = 0;
    for (let x = door.x0; x <= door.x1; x++) {
      for (let y = door.y0; y <= door.y1; y++) {
        if (world.getBlock(x, y, door.z) === AIR) continue;
        if (!world.setBlock(x, y, door.z, AIR)) shut++;
      }
    }
    doorCleared = shut === 0;
  }

  // ------------------------------------------------------------------------------------ the fox

  function showFox(): void {
    if (!fox) return;
    if (!foxActor) {
      foxActor = { id: FOX_ID, sprite: FOX_SPRITE, pos: fox.pos, facing: fox.facing, anim: 'idle', visible: true, mark: 'alert' };
      game.actors.set(FOX_ID, foxActor);
    }
    foxActor.pos = fox.pos;
  }

  function dropFox(): void {
    fox = null;
    foxActor = null;
    game.actors.delete(FOX_ID);
  }

  /** Stands the fox a few blocks from the player, on the side away from the Hall where the ground lets it. */
  function bringFox(): void {
    const at = player.pos;
    for (const [dx, dz] of [[-FOX_APPEARS, 2], [-FOX_APPEARS, -3], [FOX_APPEARS, 3], [0, FOX_APPEARS], [-5, 6]] as const) {
      const x = at.x + dx, z = at.z + dz, y = world.heightAt(Math.floor(x), Math.floor(z));
      if (Math.abs(y - at.y) > 3 || inCourt({ x, y, z })) continue;
      fox = { pos: { x, y, z }, facing: 0, calm: -1 };
      showFox();
      return;
    }
    fox = { pos: { x: at.x - 4, y: at.y, z: at.z + 4 }, facing: 0, calm: -1 };
    showFox();
  }

  /** One step toward a point over the land. A wall or a drop of more than a block stops it. Returns true when it moved. */
  function foxToward(to: Vec3, speed: number, dt: number): boolean {
    if (!fox) return false;
    const dx = to.x - fox.pos.x, dz = to.z - fox.pos.z, far = Math.hypot(dx, dz);
    if (far < 0.05) return false;
    const reach = Math.min(speed * dt, far), ux = dx / far, uz = dz / far;
    fox.facing = Math.atan2(ux, -uz);
    // Straight on first, then along each axis, so it slides round a corner of the wall.
    for (const [sx, sz] of [[ux, uz], [ux, 0], [0, uz]] as const) {
      if (sx === 0 && sz === 0) continue;
      const x = fox.pos.x + sx * reach, z = fox.pos.z + sz * reach;
      const y = world.heightAt(Math.floor(x), Math.floor(z));
      if (Math.abs(y - fox.pos.y) > 1.05) continue;
      fox.pos.x = x;
      fox.pos.y = y;
      fox.pos.z = z;
      return true;
    }
    return false;
  }

  function stepFox(dt: number): void {
    if (!fox || !foxActor) return;
    const far = distance2d(fox.pos, player.pos);
    let moved = false;
    if (fox.calm < 0) {
      // Blighted: it comes at the player and stops short. It will not cross the Hall's threshold.
      const threshold = place('hall.door');
      const inside = flags.is('door.open') && inCourt(player.pos) && threshold;
      const to = inside ? { x: threshold.x, y: threshold.y, z: door.z + 1.6 } : player.pos;
      const close = inside ? distance2d(fox.pos, to) < 0.4 : far <= FOX_STOPS;
      if (!close) moved = foxToward(to, far > FAR ? FOX_RUN : FOX_WALK, dt);
      else fox.facing = Math.atan2(player.pos.x - fox.pos.x, -(player.pos.z - fox.pos.z));
      foxActor.mark = 'alert';
    } else {
      fox.calm += dt;
      foxActor.mark = fox.calm < FOX_THANKS ? 'heart' : '';
      if (fox.calm >= FOX_THANKS) {
        // Calmed: back out through the door, then west, toward the dead garden it keeps.
        const out = fox.pos.z < door.z + 2 ? { x: HALL.doorAt.x, y: fox.pos.y, z: door.z + 3 } : { x: fox.pos.x - 40, y: fox.pos.y, z: fox.pos.z + 6 };
        moved = foxToward(out, FOX_RUN, dt);
        if (far > FOX_LEAVES || fox.calm > FOX_THANKS + FOX_GOES) {
          dropFox();
          flags.set('fox.gone', true);
          return;
        }
      }
    }
    foxActor.facing = fox.facing;
    foxActor.anim = moved ? 'walk' : 'idle';
  }

  // ------------------------------------------------------------------------------------ the night, in order

  /** The fox comes: when the player lies down, or when night falls on their camp. */
  function foxComes(words: string): void {
    flags.set('night.fox', true);
    events.emit('toast', { text: words });
  }

  /** Keeps the player awake until the Hall has been seen. `time.sleep()` asks this each time they lie down. */
  function awake(): string | null {
    if (!nightOn() || flags.is('heart.seen')) return null;
    if (!flags.is('night.fox')) {
      flags.set('night.fox', true);
      return 'Something is moving outside. You cannot sleep.';
    }
    if (!flags.is('door.open')) return 'Not with that thing outside.';
    return 'You will not sleep before you know what that place is.';
  }

  function stepNight(): void {
    if (!nightOn()) return;
    if (!flags.is('night.fox')) {
      const camp = place('grant.center');
      if (isDark(clock.timeOfDay) && camp && distance2d(player.pos, camp) <= CAMP) foxComes('Something grey is moving at the edge of your camp.');
      return;
    }
    if (!fox && !flags.is('fox.calmed')) bringFox();
    if (!flags.is('door.open')) {
      const step = place('shut.door');
      if (step && distance2d(player.pos, step) <= AT_DOOR) say('night.door');
      return;
    }
    if (!flags.is('mark') && inCourt(player.pos)) say('hall.mark');
  }

  /** The morning after: a few of Hollowmere saw the light in the hill, and stand at the grant stone. */
  function gather(): void {
    const people = game.systems.people;
    if (!people) return;
    for (const [id, x, z] of MORNING) {
      people.send(id, 'grant.stone', { x, z });
      people.hold(id, true);
    }
  }

  function release(): void {
    const people = game.systems.people;
    for (const [id] of MORNING) people?.hold(id, false);
  }

  events.on('slept', () => {
    if (flags.is('mark') && !flags.is('night.told')) gather();
  });

  events.on('flag.changed', ({ flag, value }) => {
    if (!value) return;
    if (flag === 'door.open') syncDoor();
    else if (flag === 'custodian.awake') wake();
    else if (flag === 'fox.calmed' && fox && fox.calm < 0) fox.calm = 0;
    else if (flag === 'night.told') release();
  });

  function wake(): void {
    custodian.anim = 'idle';
    custodian.mark = '';
  }

  // ------------------------------------------------------------------------------------ the heart

  function heart(): Heart {
    const sys = game.systems;
    const roofs = sys.placeables?.all().filter((placed) => placed.kind === 'bed').length ?? 0;
    const crops = sys.crops?.all().length ?? 0;
    const beasts = sys.pets?.all().filter((pet) => pet.bonded).length ?? 0;
    const parts = [
      { label: 'roof', count: roofs, worth: HEART_WORTH.roof },
      { label: 'crop', count: crops, worth: HEART_WORTH.crop },
      { label: 'beast', count: beasts, worth: HEART_WORTH.beast },
    ];
    return { level: Math.floor(parts.reduce((sum, part) => sum + part.count * part.worth, 0)), parts };
  }

  /** The level at the last tick, or -1 before a look. A level only counts as risen from one seen in play. */
  let heartWas = -1;

  /** Once the Custodian is awake, the stone rising past 3, 6 or 10 gets a line from it, once each. */
  function stepHeart(): void {
    if (!flags.is('custodian.awake')) {
      heartWas = -1;
      return;
    }
    const level = heart().level;
    if (heartWas >= 0) {
      for (const [at, text] of CUSTODIAN_HEART) {
        if (heartWas >= at || level < at || flags.is(`heart.said.${at}`)) continue;
        flags.set(`heart.said.${at}`, true);
        events.emit('toast', { text: `${SPEAKERS.custodian}: ${text}` });
      }
    }
    heartWas = level;
  }

  // ------------------------------------------------------------------------------------ prompts

  const fixed = (at: Vec3): (() => Vec3) => () => at;
  const targets: Interactable[] = [
    {
      id: 'hall:door', pos: fixed({ x: HALL.doorAt.x, y: HALL.doorAt.y, z: HALL.doorAt.z + 1 }), radius: 2.2,
      prompt: () => (flags.is('door.open') || flags.is('night.fox') ? null : 'Push the door'),
      act: () => say('door.shut'),
    },
    {
      id: 'hall:custodian', pos: fixed(custodian.pos), radius: 2.4,
      prompt: () => (!flags.is('mark') ? null : flags.is('custodian.awake') ? 'Talk to the Custodian' : 'Turn the key'),
      act: () => {
        if (flags.is('custodian.awake')) game.systems.talk?.talkTo('custodian');
        else say('custodian.wake');
      },
    },
    {
      id: 'hall:fox', pos: () => fox?.pos ?? custodian.pos, radius: 3,
      prompt: () => (fox && fox.calm < 0 && flags.is('custodian.awake') ? 'Hold out your hand' : null),
      act: () => say('fox.calm'),
    },
    {
      id: 'hall:heart', pos: fixed({ x: HALL.heartstone.x, y: HALL.heartstone.y, z: HALL.heartstone.z + 1 }), radius: 2.4,
      prompt: () => (flags.is('mark') ? 'Touch the Heartstone' : null),
      act: () => {
        if (flags.is('custodian.awake') && !flags.is('heart.seen')) say('heart.first');
        else events.emit('toast', { text: heartWords(heart()) });
      },
    },
    {
      id: 'hall:mural', pos: fixed({ x: HALL.mural.x, y: HALL.mural.y, z: HALL.mural.z + 1.5 }), radius: 2,
      prompt: () => (flags.is('mark') ? 'Look at the mural' : null),
      act: () => say(flags.is('custodian.awake') ? 'hall.mural.asked' : 'hall.mural'),
    },
    {
      id: 'hall:gate', pos: fixed({ x: HALL.gate.x + 1, y: HALL.gate.y, z: HALL.gate.z }), radius: 2,
      prompt: () => (flags.is('mark') ? 'Look at the arch' : null),
      act: () => say(flags.is('custodian.awake') ? 'hall.gate.asked' : 'hall.gate'),
    },
  ];

  function start(): void {
    ready = true;
    game.actors.set(CUSTODIAN_ID, custodian);
    if (flags.is('custodian.awake')) wake();
    for (const target of targets) game.systems.interact?.add(target);
    game.systems.time?.guardSleep?.(awake);
    if (pending?.fox) {
      const saved = pending.fox;
      fox = { pos: { x: saved.x, y: saved.y, z: saved.z }, facing: 0, calm: saved.calm };
      showFox();
    }
    pending = null;
  }

  const api: HallApi = {
    heart,
    fox: () => fox?.pos ?? null,
  };

  const system: SimSystem = {
    step(dt) {
      if (!ready) start();
      stepFox(dt);
      sinceTick += dt;
      if (sinceTick < TICK) return;
      sinceTick = 0;
      syncDoor();
      stepNight();
      stepHeart();
    },
    save: (): HallSave => ({ fox: fox ? { x: fox.pos.x, y: fox.pos.y, z: fox.pos.z, calm: Math.round(fox.calm * 100) / 100 } : null }),
    load(data) {
      const saved = (data as Partial<HallSave> | null)?.fox ?? null;
      const good = saved && [saved.x, saved.y, saved.z, saved.calm].every((n) => Number.isFinite(n)) ? saved : null;
      doorCleared = false;
      dropFox();
      heartWas = -1;
      if (!ready) {
        pending = { fox: good };
        return;
      }
      if (good) {
        fox = { pos: { x: good.x, y: good.y, z: good.z }, facing: 0, calm: good.calm };
        showFox();
      }
      custodian.anim = flags.is('custodian.awake') ? 'idle' : 'sleep';
      custodian.mark = flags.is('custodian.awake') ? '' : 'sleep';
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createHall(kernel.game);
  kernel.add('hall', api, system);
}
