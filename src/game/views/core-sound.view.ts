// What the game's events sound and look like. This is the one place that maps `game.events` to the
// sound engine and to the particle effects, and that tells the sound engine where the player is.
//
// The dialogue view makes the voice blips itself, one per letter:
//   view.audio?.emit({ type: 'talk', voice, char })
import { treeSounds } from '../../content/tree-sounds.ts';
import { BLOCKS } from '../../content/blocks.ts';
import type { GameEvent } from '../../engine/events.ts';
import type { Vec3 } from '../../engine/types.ts';
import type { AudioSystem } from '../../features/audio/index.ts';
import type { Place, Systems } from '../api.sim.ts';
import { REGION } from '../content/region.ts';
import type { GameView } from '../shell/view.ts';

/** Within this many blocks of the square the town arrangement is fully in, and it fades out over the next stretch. */
const TOWN_NEAR = 45, TOWN_FAR = 80;

export function install(view: GameView): void {
  const { game, effects, water, sky, world } = view;
  const sys = game.systems as Partial<Systems>;
  const center = (x: number, y: number, z: number): Vec3 => ({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });

  /** Sends one of the base's own events to the sound engine and the effects together. */
  function both(event: GameEvent): void {
    view.audio?.onEvent(event);
    effects.onEvent(event);
  }

  // ---- the body
  game.events.on('footstep', (e) => {
    both({ type: 'footstep', surface: e.surface, at: e.at });
    if (e.surface === 'water') water.ripple(e.at, 0.6);
  });
  game.events.on('jump', (e) => both({ type: 'jump', at: e.at }));
  game.events.on('land', (e) => {
    both({ type: 'land', surface: e.surface, at: e.at });
    if (e.surface === 'water') water.ripple(e.at, 1);
  });

  // ---- blocks
  // The trunk's block.broken precedes tree.felled in the same synchronous action.
  // Keep its particles, and wait until that action ends before choosing its sound.
  const pendingBreaks: { x: number; y: number; z: number; sound: GameEvent }[] = [];
  let breaksQueued = false;
  game.events.on('block.broken', (e) => {
    const sound: GameEvent = { type: 'blockBroken', surface: BLOCKS[e.id]?.surface ?? 'dirt', at: center(e.x, e.y, e.z) };
    effects.onEvent(sound);
    pendingBreaks.push({ x: e.x, y: e.y, z: e.z, sound });
    if (!breaksQueued) {
      breaksQueued = true;
      queueMicrotask(() => {
        for (const pending of pendingBreaks) view.audio?.onEvent(pending.sound);
        pendingBreaks.length = 0;
        breaksQueued = false;
      });
    }
  });
  game.events.on('tree.felled', (e) => {
    for (let i = pendingBreaks.length - 1; i >= 0; i--) {
      const b = pendingBreaks[i];
      if (b.x === e.x && b.y === e.y && b.z === e.z) pendingBreaks.splice(i, 1);
    }
    view.audio?.emit({ type: 'treeFell', logs: e.logs, at: center(e.x, e.y, e.z) });
  });

  let chopElapsed = treeSounds.chopEvery, previousProgress = -1;
  const chopAt = { x: NaN, y: NaN, z: NaN };
  const chop = { type: 'treeChop' as const, at: chopAt };
  view.onSimStep((dt) => {
    const breaking = sys.actions?.breaking();
    if (!view.keys.primary || game.player.busy || !breaking?.tree) {
      chopElapsed = treeSounds.chopEvery;
      previousProgress = -1;
      return;
    }
    if (chopAt.x !== breaking.x + 0.5 || chopAt.y !== breaking.y + 0.5 || chopAt.z !== breaking.z + 0.5 || breaking.progress < previousProgress) chopElapsed = treeSounds.chopEvery;
    chopAt.x = breaking.x + 0.5; chopAt.y = breaking.y + 0.5; chopAt.z = breaking.z + 0.5;
    // A meter can linger after release: only advancing work makes another chop.
    if (breaking.progress > previousProgress) {
      chopElapsed += dt;
      if (chopElapsed >= treeSounds.chopEvery - 1e-8) {
        view.audio?.emit(chop);
        chopElapsed = 0;
      }
    }
    previousProgress = breaking.progress;
  });
  game.events.on('block.placed', (e) => both({ type: 'blockPlaced', surface: BLOCKS[e.id]?.surface ?? 'dirt', at: center(e.x, e.y, e.z) }));
  game.events.on('placeable.placed', (e) => both({ type: 'blockPlaced', surface: 'wood', at: center(e.x, e.y, e.z) }));

  // ---- items: a trail from where the thing was to the player's hands
  game.events.on('item.gained', (e) => {
    view.audio?.onEvent({ type: 'pickup', at: e.at ?? game.player.pos });
    if (!e.at) return;
    const p = view.playerPosition;
    effects.play('trail', e.at, { target: { x: p.x, y: p.y + 1, z: p.z } });
  });
  game.events.on('item.crafted', () => view.audio?.emit({ type: 'machine' }));

  // ---- farming
  game.events.on('soil.tilled', (e) => {
    view.audio?.emit({ type: 'blockBroken', surface: 'dirt', at: center(e.x, e.y, e.z) });
    effects.play('dust', { x: e.x + 0.5, y: e.y + 1.05, z: e.z + 0.5 }, { color: 0x8a6a45 });
  });
  game.events.on('crop.planted', (e) => {
    view.audio?.emit({ type: 'blockPlaced', surface: 'dirt', at: center(e.x, e.y, e.z) });
    effects.play('popDust', { x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5 }, { scale: 0.5 });
  });
  game.events.on('crop.watered', (e) => {
    view.audio?.emit({ type: 'footstep', surface: 'water', at: center(e.x, e.y, e.z) });
    effects.play('splash', { x: e.x + 0.5, y: e.y + 1.05, z: e.z + 0.5 }, { scale: 0.6 });
  });
  game.events.on('crop.grew', (e) => effects.play('trail', { x: e.x + 0.5, y: e.y + 1.2, z: e.z + 0.5 }, { scale: 0.45 }));
  game.events.on('crop.harvested', (e) => {
    view.audio?.emit({ type: 'blockBroken', surface: 'tallGrass', at: center(e.x, e.y, e.z) });
    effects.play('flecks', { x: e.x + 0.5, y: e.y + 1.3, z: e.z + 0.5 }, { color: 0xe0b84a, scale: 1.6 });
  });

  // ---- living things and people
  game.events.on('creature.gave', (e) => {
    view.audio?.emit({ type: 'pet', mood: 'curious', at: e.at });
    effects.play('trail', { x: e.at.x, y: e.at.y + 0.4, z: e.at.z }, { scale: 0.4 });
  });
  game.events.on('pet.fed', () => view.audio?.emit({ type: 'pet', mood: 'happy' }));
  game.events.on('pet.startled', () => view.audio?.emit({ type: 'pet', mood: 'alert' }));
  game.events.on('pet.bonded', () => {
    view.audio?.emit({ type: 'pet', mood: 'happy' });
    view.audio?.emit({ type: 'stinger' });
  });
  game.events.on('fact.learned', () => view.audio?.emit({ type: 'pickup' }));
  game.events.on('page.completed', () => view.audio?.emit({ type: 'stinger' }));
  game.events.on('quest.step', () => view.audio?.emit({ type: 'stinger' }));
  game.events.on('talk.started', () => view.audio?.emit({ type: 'ui', sound: 'open' }));
  game.events.on('talk.ended', () => view.audio?.emit({ type: 'ui', sound: 'close' }));
  game.events.on('ui.sound', (e) => view.audio?.emit({ type: 'ui', sound: e.sound }));

  // Thunder has no game event: the time system hands each clap over with where the bolt fell.
  sys.time?.onThunder?.((at) => {
    sky.strike(at);
    view.audio?.emit({ type: 'thunder', at });
  });

  // ---- what the music and the ambience follow
  let square: Place | null | undefined;
  const waterPlaces: Place[] = [];
  for (const name of ['grant.rocks', 'river.bank', 'ferry']) {
    try { const place = sys.region?.place(name); if (place) waterPlaces.push(place); } catch { /* Optional in another region. */ }
  }
  /** 0 to 1: how much the player is in town. The region names the square. Without a region there is no town. */
  function townAmount(p: Vec3): number {
    if (square === undefined) {
      square = null;
      try {
        square = sys.region?.place('town.square') ?? null;
      } catch {
        // A region without a square is all meadow.
      }
    }
    if (!square) return 0;
    const far = Math.hypot(p.x - square.at.x, p.z - square.at.z);
    return Math.min(1, Math.max(0, (TOWN_FAR - far) / (TOWN_FAR - TOWN_NEAR)));
  }

  const state = { regions: { meadow: 1 }, town: 0, indoors: 0, nearWater: 0, trees: 0 };
  let sinceLook = 1;

  /** Reads the land around the player a few times a second: a roof overhead, water and trees nearby. */
  function look(p: Vec3): void {
    state.town = townAmount(p);
    state.indoors = world.query.openSky(p.x, p.y + 1.5, p.z) ? 0 : 1;
    let wet = 0, leafy = 0, columns = 0;
    for (let dx = -8; dx <= 8; dx += 4) {
      for (let dz = -8; dz <= 8; dz += 4) {
        const surface = world.query.surfaceAt(p.x + dx, p.z + dz);
        if (surface === 'water') wet++;
        else if (surface === 'leaves') leafy++;
        columns++;
      }
    }
    state.nearWater = Math.min(1, (wet / columns) * 4);
    state.trees = Math.min(1, (leafy / columns) * 3);
    // Rendered trees are props, so surfaceAt alone cannot see their crowns.
    for (const tree of REGION.trees) {
      const distance = Math.hypot(p.x - tree.x, p.z - tree.z);
      state.trees = Math.max(state.trees, Math.max(0, 1 - distance / 20));
    }
    // A 2x2 pool can fall between every column of the sparse terrain probe.
    for (const place of waterPlaces) {
      const distance = Math.hypot(p.x - place.at.x, p.z - place.at.z);
      state.nearWater = Math.max(state.nearWater, Math.max(0, 1 - distance / 18));
    }
  }

  function follow(audio: AudioSystem, dt: number): void {
    const p = view.playerPosition;
    sinceLook += dt;
    if (sinceLook >= 0.3) {
      sinceLook = 0;
      look(p);
    }
    audio.setState(state);
    audio.followAmbient(game.ambient);
    audio.setListener(p);
    audio.update(dt);
  }

  view.onFrame((dt) => {
    const audio = view.audio;
    if (audio) follow(audio, dt);
  });
}
