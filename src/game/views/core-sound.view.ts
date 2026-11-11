// What the game's events sound and look like. This is the one place that maps `game.events` to the
// sound engine and to the particle effects, and that tells the sound engine where the player is: which
// land's music, which recorded beds, which space the sounds ring in, which way the camera faces.
//
// The dialogue view makes the voice blips itself, one per letter:
//   view.audio?.emit({ type: 'talk', voice, char })
import { afterGameFrame } from '../../features/assets/cache.ts';
import { treeSounds } from '../../content/tree-sounds.ts';
import { BLOCKS } from '../../content/blocks.ts';
import type { GameEvent } from '../../engine/events.ts';
import type { Surface, Vec3 } from '../../engine/types.ts';
import type { AudioSystem, SampleInfo } from '../../features/audio/index.ts';
import type { Place, Systems } from '../api.sim.ts';
import { REGION } from '../content/region.ts';
import { FOLK_STEPS, LANE_AT, QUAY, WELL_AT, type SpotRule } from '../content/soundscape.ts';
import { bedLevels, gaitOf, SpotClock, stepMaterial, zonesAt, type Zones } from '../sound/soundscape.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The recordings' list, as tools/sound.ts writes it. */
interface SoundList {
  sounds: Record<string, SampleInfo & { file: string }>;
}

/** Fetches and decodes every recording and hands each to the engine as it arrives. The beds come first. */
async function loadRecordings(audio: AudioSystem): Promise<number> {
  await afterGameFrame;
  const base = new URL('assets/', document.baseURI).href;
  try {
    const manifest = await (await fetch(base + 'manifest.json')).json() as { sound?: { list?: string } };
    if (!manifest.sound?.list) return 0;
    const list = await (await fetch(base + manifest.sound.list)).json() as SoundList;
    const order = Object.entries(list.sounds).sort(([, a], [, b]) => Number(b.kind === 'bed') - Number(a.kind === 'bed') || Number(b.kind === 'steps') - Number(a.kind === 'steps'));
    let loaded = 0;
    // Four at a time: enough to have the beds in a second or two, few enough not to crowd the page's own loads.
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < order.length) {
        const [id, info] = order[next++] as [string, SampleInfo & { file: string }];
        try {
          const res = await fetch(base + info.file);
          if (!res.ok) throw new Error(`${info.file}: ${res.status}`);
          audio.addSample(id, await audio.decode(await res.arrayBuffer()), info);
          loaded++;
        } catch (error) {
          // A missing recording leaves the made sound in its place.
          console.warn('[game] a recording did not load:', id, error);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return loaded;
  } catch (error) {
    console.warn('[game] the recordings did not load:', error);
    return 0;
  }
}

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
  /** A block's id. The world is read when asked, so a view without one still installs. */
  const blockAt = (x: number, y: number, z: number): number => world.sim.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  /** The block a foot at `at` stands on, by key. */
  const blockUnder = (at: Vec3): string => BLOCKS[blockAt(at.x, at.y - 0.5, at.z)]?.key ?? '';
  const materialAt = (at: Vec3, surface: Surface) => stepMaterial(blockUnder(at), surface, !world.query.openSky(at.x, at.y + 1.5, at.z));
  let speed = 0;
  game.events.on('footstep', (e) => {
    effects.onEvent({ type: 'footstep', surface: e.surface, at: e.at });
    const material = materialAt(e.at, e.surface) ?? undefined;
    // Under trees the grass has a litter of dry leaves.
    const litter = material === 'grass' ? Math.max(0, (state.trees - 0.35) * 1.4) : 0;
    view.audio?.emit({ type: 'footstep', surface: e.surface, at: e.at, material, gait: gaitOf(speed), litter, cloth: 0.35 });
    if (e.surface === 'water') water.ripple(e.at, 0.6);
  });
  game.events.on('jump', (e) => both({ type: 'jump', at: e.at }));
  game.events.on('land', (e) => {
    effects.onEvent({ type: 'land', surface: e.surface, at: e.at });
    view.audio?.emit({ type: 'land', surface: e.surface, at: e.at, material: materialAt(e.at, e.surface) ?? undefined });
    if (e.surface === 'water') water.ripple(e.at, 1);
  });
  const lastPos = { x: NaN, z: NaN };
  view.onSimStep((dt) => {
    const p = game.player.pos;
    if (!Number.isNaN(lastPos.x)) speed += (Math.hypot(p.x - lastPos.x, p.z - lastPos.z) / dt - speed) * 0.5;
    lastPos.x = p.x; lastPos.z = p.z;
  });

  // ---- other people's feet: quieter, placed where they walk, and muffled by a wall between
  const folk = new Map<string, { x: number; z: number; walked: number }>();
  const folkAt = { x: 0, y: 0, z: 0 };
  view.onSimStep(() => {
    const audio = view.audio;
    if (!audio) return;
    const me = game.player.pos;
    for (const actor of game.actors.values()) {
      if (actor.id === 'player' || actor.id.startsWith('pet:') || actor.id.startsWith('creature:')) continue;
      const p = actor.pos;
      const seen = folk.get(actor.id);
      if (!seen) { folk.set(actor.id, { x: p.x, z: p.z, walked: 0 }); continue; }
      const moved = Math.hypot(p.x - seen.x, p.z - seen.z);
      seen.x = p.x; seen.z = p.z;
      // A jump of more than a few blocks is a teleport, not a walk.
      if (moved > 3 || !actor.visible) { seen.walked = 0; continue; }
      seen.walked += moved;
      if (seen.walked < FOLK_STEPS.stride) continue;
      seen.walked -= FOLK_STEPS.stride;
      if (Math.hypot(p.x - me.x, p.z - me.z) > FOLK_STEPS.reach) continue;
      folkAt.x = p.x; folkAt.y = p.y; folkAt.z = p.z;
      const surface = BLOCKS[blockAt(p.x, p.y - 0.5, p.z)]?.surface ?? 'grass';
      audio.emit({ type: 'footstep', surface, at: folkAt, material: materialAt(folkAt, surface) ?? undefined, gait: 'walk', quiet: FOLK_STEPS.quiet, muffle: muffleTo(folkAt) });
    }
  });

  // ---- blocks
  // The trunk's block.broken precedes tree.felled in the same synchronous action.
  // Keep its particles, and wait until that action ends before choosing its sound.
  const pendingBreaks: { x: number; y: number; z: number; sound: GameEvent }[] = [];
  let breaksQueued = false;
  // A stroke of build mode changes many cells in one step. The build view spreads their sounds and dust over
  // a moment, so here each of those events is passed over.
  const inStroke = (): boolean => sys.build?.applying === true;
  game.events.on('block.broken', (e) => {
    if (inStroke()) return;
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
  game.events.on('block.placed', (e) => { if (!inStroke()) both({ type: 'blockPlaced', surface: BLOCKS[e.id]?.surface ?? 'dirt', at: center(e.x, e.y, e.z) }); });
  game.events.on('placeable.placed', (e) => { if (!inStroke()) both({ type: 'blockPlaced', surface: 'wood', at: center(e.x, e.y, e.z) }); });

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
    if (inStroke()) return;
    view.audio?.emit({ type: 'foley', sound: 'hoe', at: center(e.x, e.y, e.z) });
    effects.play('dust', { x: e.x + 0.5, y: e.y + 1.05, z: e.z + 0.5 }, { color: 0x8a6a45 });
  });
  game.events.on('crop.planted', (e) => {
    if (inStroke()) return;
    view.audio?.emit({ type: 'foley', sound: 'plant', at: center(e.x, e.y, e.z) });
    effects.play('popDust', { x: e.x + 0.5, y: e.y + 1, z: e.z + 0.5 }, { scale: 0.5 });
  });
  game.events.on('crop.watered', (e) => {
    view.audio?.emit({ type: 'foley', sound: 'pour', at: center(e.x, e.y, e.z) });
    effects.play('splash', { x: e.x + 0.5, y: e.y + 1.05, z: e.z + 0.5 }, { scale: 0.6 });
  });
  game.events.on('crop.grew', (e) => effects.play('trail', { x: e.x + 0.5, y: e.y + 1.2, z: e.z + 0.5 }, { scale: 0.45 }));
  game.events.on('crop.harvested', (e) => {
    view.audio?.emit({ type: 'foley', sound: 'harvest', at: center(e.x, e.y, e.z) });
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
  game.events.on('ui.sound', (e) => {
    // The panel that just opened names itself on its stage: the bag opens with its flap, the Almanac with a page.
    const stage = e.sound === 'open' ? document.querySelector('.gu-stage:not([hidden])') : null;
    const panel = stage ? /gu-stage-(\w+)/.exec(stage.className)?.[1] : undefined;
    if (panel === 'bag') view.audio?.emit({ type: 'foley', sound: 'bag' });
    else if (panel === 'almanac') view.audio?.emit({ type: 'foley', sound: 'page' });
    else view.audio?.emit({ type: 'ui', sound: e.sound });
  });

  // Thunder has no game event: the time system hands each clap over with where the bolt fell.
  sys.time?.onThunder?.((at) => {
    sky.strike(at);
    view.audio?.emit({ type: 'thunder', at });
  });

  // ---- what the music and the ambience follow
  const waterPlaces: Place[] = [];
  for (const name of ['grant.rocks', 'river.bank', 'ferry']) {
    try { const place = sys.region?.place(name); if (place) waterPlaces.push(place); } catch { /* Optional in another region. */ }
  }
  const regions = { meadow: 1, town: 0 };
  const state = { regions, town: 0, indoors: 0, nearWater: 0, trees: 0, stone: 0 };
  const zones: Zones = { town: 0, square: 0, bank: 0, lane: 0 };
  const where = { x: 0, z: 0, hour: 12, forest: 0 };
  const beds: Record<string, number> = {};
  const quayAt = { x: 0, y: QUAY.y, z: QUAY.z };
  const spots = new SpotClock(Math.random);
  const spotAt = { x: 0, y: 0, z: 0 };
  let sinceLook = 1, recordings: Promise<number> | null = null;

  /** 0 to 1: how much of the line from the hero's ears to `at` runs through solid blocks. Two blocks is a wall. */
  function muffleTo(at: Vec3): number {
    const p = view.playerPosition;
    const ax = p.x, ay = p.y + 1.6, az = p.z;
    const dx = at.x - ax, dy = at.y + 0.5 - ay, dz = at.z - az;
    const length = Math.hypot(dx, dy, dz);
    const steps = Math.min(40, Math.floor(length));
    let solid = 0;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const block = BLOCKS[blockAt(ax + dx * t, ay + dy * t, az + dz * t)];
      if (block?.solid && block.opaque) solid++;
    }
    return Math.min(1, solid / 2.5);
  }

  /** Reads the land around the player a few times a second: the zones of the town, a roof, water and trees. */
  function look(p: Vec3): void {
    zonesAt(p.x, p.z, zones);
    // The town's music comes in as the town's zone does, so the gate is the border band.
    regions.town = zones.town;
    regions.meadow = 1 - zones.town;
    state.town = zones.town;
    // Cobbles and walls: the square rings most, the streets a little.
    state.stone = Math.max(zones.square, 0.55 * zones.town);
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
    // Rendered trees are props, so surfaceAt alone cannot see their crowns: count the standing trees close by.
    let near = 0;
    for (const tree of sys.trees?.all() ?? REGION.trees) {
      if ('standing' in tree && !tree.standing) continue;
      const distance = Math.hypot(p.x - tree.x, p.z - tree.z);
      if (distance < 11) near += 1 - distance / 11;
    }
    // Greenhollow's trees stand apart: two crowns within a few blocks is already under the trees.
    state.trees = Math.max(state.trees, Math.min(1, near / 2.2));
    // A 2x2 pool can fall between every column of the sparse terrain probe.
    for (const place of waterPlaces) {
      const distance = Math.hypot(p.x - place.at.x, p.z - place.at.z);
      state.nearWater = Math.max(state.nearWater, Math.max(0, 1 - distance / 18));
    }
    where.x = p.x; where.z = p.z;
    where.hour = (game.ambient.timeOfDay * 24) % 24;
    where.forest = state.trees;
    bedLevels(zones, where, beds);
  }

  function playSpot(audio: AudioSystem, rule: SpotRule, weight: number): void {
    const p = view.playerPosition;
    if (rule.at) {
      const [x, y, z] = rule.at[Math.floor(Math.random() * rule.at.length)] as readonly [number, number, number];
      spotAt.x = x; spotAt.y = y; spotAt.z = z;
    } else if (rule.near) {
      const [lo, hi] = rule.near;
      const angle = Math.random() * Math.PI * 2, distance = lo + Math.random() * (hi - lo);
      spotAt.x = p.x + Math.cos(angle) * distance;
      spotAt.z = p.z + Math.sin(angle) * distance;
      spotAt.y = world.query.heightAt(spotAt.x, spotAt.z) + (rule.id === 'spot.bird' ? 4 : 1);
    }
    if (Math.hypot(spotAt.x - p.x, spotAt.z - p.z) > rule.reach) return;
    audio.emit({ type: 'sample', id: rule.id, at: spotAt, gain: rule.gain * (0.6 + 0.4 * weight), muffle: muffleTo(spotAt) });
  }

  function follow(audio: AudioSystem, dt: number): void {
    const p = view.playerPosition;
    recordings ??= loadRecordings(audio);
    sinceLook += dt;
    if (sinceLook >= 0.25) {
      sinceLook = 0;
      look(p);
      quayAt.x = Math.min(QUAY.x1, Math.max(QUAY.x0, p.x));
      for (const id in beds) {
        const lean = id === 'bed.town.water' ? quayAt : id === 'bed.town.workshop' ? LANE_AT : id === 'bed.town.square' ? WELL_AT : null;
        audio.setBed(id, beds[id] as number, lean);
      }
      spots.step(audio.now, zones, where.hour, (rule, weight) => playSpot(audio, rule, weight));
    }
    audio.setState(state);
    audio.followAmbient(game.ambient);
    audio.setListener(p, view.camera.yaw);
    audio.update(dt);
  }

  view.onFrame((dt) => {
    const audio = view.audio;
    if (audio) follow(audio, dt);
  });
}
