// Ruins and vaults: the five small ruins, the six shrines, the memory stones, the three vaults and their keepers,
// the keystones, Calla's seals, the Old Gate, the Rootworks, the Stag's hall and the Hall's second level (handbook
// chapters 22, 23, 26 and 27; README.md beside this file).
//
// A vault's door in the world takes the hero into its room, which stands in the rooms' own ground (rooms.sim.ts,
// land.sim.ts), and the room's way out brings them back. Each room has one rule a player reads in it:
//
//   The Pump House     The great wheel turns a shaft to a lever. Pull it and the flooded stair runs dry; below, the
//                      Sluice Keeper rolls in its trench, and a channel flooded through its gate stalls it.
//   The Lamp Gallery   Dark: you carry a lamp in. Six glass eyes along the walkway each see you only once the one
//                      before is lit, so you cross from wall to wall; the bars lift when all six burn.
//   The Seed Vault     Calla's seal is on the door before you. Wren knows the way in through the roots. The arm and
//                      its pods: your companion holds the arm.
//   The Rootworks      Three levels under the Old Gate, each with a dead machine you rebuild from parts in your pack:
//                      a wheel, a lamp on a sensor, an arm. Each one rebuilt opens its root lock and the rope down.
//
// The keepers and the Stag are the fights system's: this one builds their rooms and starts them
// (`FightsApi.startKeeper`, `startStag`). The scenes are the dialogue's: a memory stone starts its scene by id, and the
// story director plays Calla's seal (scene 25) when the first vault is cleared. This system sets the flags of
// docs/act1-foundation.md (`memory.<id>`, `keystone.<n>`, `shrine.<id>`, `vault.<id>.cleared` and `.sealed`) and
// the quest steps only it can finish.

import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { groundHeight } from '../../features/world/terrain.sim.ts';
import type { Game, Interactable, RuinState, RuinsApi, RuinsView, SimSystem } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { toWorld, type MapPoint } from '../content/greenhollow.ts';
import type { ItemId, KeystoneNumber, MemoryId, QuestId, RuinId, SceneNumber, ShrineId, VaultId } from '../content/ids.ts';
import { HALL as STAG_HALL } from '../fight/hall-layout.sim.ts';
import type { KeeperRoom } from '../fight/keepers.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { blockOf } from './land.sim.ts';
import { EYE_SEES, GALLERY_EYES, ROOMS, ROOM_DEFS, cellOf, roomAt, roomOf, roomOrigin, roomPoint, type RoomDef, type RoomId } from './rooms.sim.ts';

export interface Ruins {
  api: Required<RuinsApi>;
  system: SimSystem;
}

export const VAULTS: readonly VaultId[] = ['pumphouse', 'lampgallery', 'seedvault'];
export const SHRINES: readonly ShrineId[] = ['shrine-oak', 'shrine-bend', 'shrine-knoll', 'shrine-forest', 'shrine-marsh', 'shrine-terrace'];
export const SMALL_RUINS: readonly RuinId[] = ['ruin-tower', 'ruin-stair', 'ruin-mill', 'ruin-wall', 'ruin-post'];
const KEYSTONES: readonly KeystoneNumber[] = [1, 2, 3];

/** Each vault: its keystone, its keeper's fight, the room its keeper is in, its door's room, and its scene. */
export const VAULT: Readonly<Record<VaultId, { keystone: KeystoneNumber; fight: 7 | 9 | 10; room: RoomId; door: RoomId; scene: SceneNumber; quest: QuestId }>> = {
  pumphouse: { keystone: 1, fight: 7, room: 'pump-lower', door: 'pump-upper', scene: 26, quest: 'pump' },
  lampgallery: { keystone: 2, fight: 9, room: 'gallery', door: 'gallery', scene: 28, quest: 'gallery' },
  seedvault: { keystone: 3, fight: 10, room: 'seedvault', door: 'seedvault', scene: 29, quest: 'seeds' },
};

/** The scene each memory stone plays, and the line it gives when touched again (content/dialogue.ts). */
export const MEMORY_SCENE: Readonly<Partial<Record<MemoryId, SceneNumber>>> = { hall: 24, pumphouse: 26, lampgallery: 28, seedvault: 29 };

/**
 * The two stones of the small ruins have no scene of chapter 22: what each remembers is a few lines of its own,
 * shown one after another.
 */
export const RUIN_ECHOES: Readonly<Record<'ruin-tower' | 'ruin-stair', readonly string[]>> = {
  'ruin-tower': [
    'A stone no bigger than a plum. Under your marked hand it grows warm.',
    'This tower, whole. Two children at the top of its stair, counting boats on the river.',
    'The boy: "Nineteen." The girl: "Twenty. You never count the little ones."',
    'The stone goes dark.',
  ],
  'ruin-stair': [
    'The stone warms. The stair goes on down in it, lamp after lamp, to a door of oak.',
    'A girl runs down it two steps at a time. Behind her, something very large is trying to be quiet.',
    'The stone goes dark, and the stair stops at roots again.',
  ],
};

/** What the small ruins hold beside their stones. */
const RUIN_LOOKS: Readonly<Record<'ruin-wall' | 'ruin-post', readonly string[]>> = {
  'ruin-wall': [
    'A mural on the old south wall: a king, and his friends round him.',
    'Seven of them. Between the fourth and the fifth the stone is cut away, clean, to the shape of a person.',
  ],
  'ruin-post': [
    'Calla\'s gold seal is already on the door. It is in her instructions.',
    'Through the arrow slit: on the lit road to the north, the Order\'s engine turns, and the grass round it is grey.',
  ],
};

/** The Rootworks' machines: what each needs from the pack, and what the prompt calls it. */
export const MACHINES: readonly { name: string; needs: readonly { id: ItemId; count: number }[]; done: string }[] = [
  { name: 'the wheel', needs: [{ id: 'gear_shaft', count: 1 }], done: 'The shaft goes in. Water takes the wheel, and the root lock groans open.' },
  { name: 'the lamp', needs: [{ id: 'sensor', count: 1 }, { id: 'switch_lamp', count: 1 }], done: 'The glass eye opens. The lamp lights, and the roots draw back from it.' },
  { name: 'the arm', needs: [{ id: 'harvester_arm', count: 1 }], done: 'The arm swings once, catches the roots and hauls the lock open. Below: the Stag\'s hall.' },
];

/** What lights the dark gallery, any one of them in the bag. */
export const LIGHTS: readonly ItemId[] = ['lantern', 'lamp', 'switch_lamp', 'lamp_post_kit', 'river_lamp'];
/** The rope you climb down the Rootworks on: a rope ladder, or this much vine rope. */
const VINE_FOR_ROPE = 2;

/** How near a place counts as being there, for a step that is to go somewhere. */
const THERE = 14;
/** How near a ruin the hero comes before it is found. */
const FOUND = 16;
/** Seconds between the lines of a stone or a ruin. */
const LINE_GAP = 3.2;
/** Seconds a keeper waits after a fight that ended in a fall or a walk-out before it can start again. */
const REARM = 3;
/** How much old brass the mill gives. */
const MILL_BRASS = 2;

/** Map points of the things in the world that are not places of the region, or world points in the Hall's court. */
export const AT: Readonly<Record<'gate' | 'waystone' | 'home' | 'hallBelow' | 'stoneHall' | 'roots', MapPoint | Vec3>> = {
  // In front of the Old Gate's disc, and the waystone beside the terraces' stair.
  gate: [470, 164],
  waystone: [456, 174],
  // The waystone by your plot, where a Rootworks waystone takes you.
  home: [384, 316],
  // In the Hall's court: the stair that opens after the Stag, and the dull stone under the mural.
  hallBelow: { x: -13.5, y: 0, z: -257.5 },
  stoneHall: { x: -19.2, y: 0, z: -262.6 },
  // The root gap in the side of the Seed Vault's hill, north of its door (the vault faces east).
  roots: [150, 291],
};

/** The column of one of `AT`'s points in the world. */
export function pointOf(name: keyof typeof AT): { x: number; z: number } {
  const p = AT[name];
  if (!Array.isArray(p)) return { x: (p as Vec3).x, z: (p as Vec3).z };
  const w = toWorld(p as MapPoint);
  return { x: w.x + 0.5, z: w.z + 0.5 };
}

interface RuinsSave {
  lever: boolean;
  eyes: number;
  machines: boolean[];
  deepest: number;
  /** Small ruins the hero has come near, and what has been taken from them. */
  found: string[];
  taken: string[];
  /** The first vault cleared: its stone is the one Calla is shown. */
  first: VaultId | null;
}

export function createRuins(game: Game): Ruins {
  const { flags, events, player, world } = game;
  const seed = game.world.seed;

  // ------------------------------------------------------------------------------------ state
  let lever = false;
  let eyes = 0;
  const machines = [false, false, false];
  let deepest = 0;
  const found = new Set<string>();
  const taken = new Set<string>();
  let first: VaultId | null = null;
  /** The room the hero stands in, worked out from where they are each step. */
  let inside: RoomDef | null = null;
  /** Seconds until a keeper may start again. */
  let rearm = 0;
  /** Lines waiting to be shown, one every LINE_GAP seconds. */
  const lines: string[] = [];
  let lineWait = 0;
  /** The room's blocks that follow its state, laid again until every chunk took them. */
  let blocksDue = true;

  const say = (...text: string[]): void => { lines.push(...text); };
  const toast = (text: string): void => { events.emit('toast', { text }); };
  const has = (id: ItemId, count = 1): boolean => (game.systems.inventory?.count(id) ?? 0) >= count;
  const stepFlag = (quest: QuestId, step: string): void => { if (!flags.is(FLAG.step(quest, step))) flags.set(FLAG.step(quest, step), true); };
  const started = (quest: QuestId): boolean => flags.is(FLAG.questStarted(quest));

  /** A point of the world on its ground. */
  const ground = (name: keyof typeof AT): Vec3 => {
    const w = pointOf(name);
    return { x: w.x, y: groundHeight(seed, Math.floor(w.x), Math.floor(w.z)), z: w.z };
  };
  const placeAt = (name: string): Vec3 | null => {
    try {
      return game.systems.region?.place(name).at ?? null;
    } catch {
      return null;
    }
  };
  const near = (a: Vec3 | null, within: number): boolean => !!a && Math.hypot(player.pos.x - a.x, player.pos.z - a.z) <= within;

  // ------------------------------------------------------------------------------------ moving the hero

  /** Puts the hero at a point, facing a way, and tells the views. */
  function move(to: Vec3, facing: number): void {
    player.pos.x = to.x;
    player.pos.y = to.y;
    player.pos.z = to.z;
    player.facing = facing;
    inside = roomAt(Math.floor(to.x), Math.floor(to.z));
    blocksDue = true;
    events.emit('ruins.moved', { x: to.x, y: to.y, z: to.z, facing, room: inside?.id ?? null });
  }

  function enter(id: RoomId, spot = 'arrive'): void {
    const room = roomOf(id);
    const s = room.spots[spot] ?? room.spots.arrive;
    move(roomPoint(room, s[0], s[1]), room.facing);
  }

  /** Out to a point of the world, facing south, away from the door. */
  function leaveTo(at: Vec3 | null): void {
    if (!at) return;
    move({ x: at.x, y: at.y, z: at.z }, Math.PI);
  }

  // ------------------------------------------------------------------------------------ the vaults

  const keystoneTaken = (v: VaultId): boolean => flags.is(FLAG.keystone(VAULT[v].keystone));
  const keeperWon = (v: VaultId): boolean => flags.is(FLAG.fightWon(VAULT[v].fight));

  /** Out of a vault: cleared once its keeper is down and its keystone taken, and then Calla seals it behind you. */
  function outOfVault(v: VaultId, at: Vec3 | null): void {
    leaveTo(at);
    if (!keeperWon(v) || !keystoneTaken(v) || flags.is(FLAG.vaultCleared(v))) return;
    if (!first) first = v;
    flags.set(FLAG.vaultCleared(v), true);
    // The story director plays scene 25 at the first door; at the others her seal is simply there.
    if (flags.is(FLAG.scene(25))) say('Calla\'s gold seal is on the door behind you. She was here before you came out.');
    if (!flags.is(FLAG.vaultSealed(v))) flags.set(FLAG.vaultSealed(v), true);
  }

  function takeKeystone(v: VaultId): void {
    if (!keeperWon(v) || keystoneTaken(v)) return;
    flags.set(FLAG.keystone(VAULT[v].keystone), true);
    const n = KEYSTONES.filter((k) => flags.is(FLAG.keystone(k))).length;
    say(`A keystone, round and heavy, cut to fit a socket. You have ${n} of the three.`, 'The stone beside it is warm.');
  }

  /** Touches a memory stone: its scene the first time, its one more line after that. */
  function touch(id: MemoryId): void {
    const talk = game.systems.talk;
    if (!talk || talk.active) return;
    const scene = MEMORY_SCENE[id];
    if (scene) {
      if (!flags.is(FLAG.scene(scene))) talk.start(`scene.${scene}`);
      else {
        if (!flags.is(FLAG.memory(id))) flags.set(FLAG.memory(id), true);
        talk.start(`memory.${id}.again`);
      }
      return;
    }
    const echo = RUIN_ECHOES[id as 'ruin-tower' | 'ruin-stair'];
    if (!echo) return;
    if (flags.is(FLAG.memory(id))) { say('The stone is cool now. It has told you what it had.'); return; }
    flags.set(FLAG.memory(id), true);
    taken.add(id);
    say(...echo);
  }

  // A memory stone's scene, played from the stone or by any other way, is its stone remembered. A vault's scene is
  // its step "take the keystone", so a scene set by `skipTo` or the bots leaves the keystone in hand too.
  events.on('flag.changed', ({ flag, value }) => {
    if (!value) return;
    for (const [id, scene] of Object.entries(MEMORY_SCENE) as [MemoryId, SceneNumber][]) {
      if (flag !== FLAG.scene(scene)) continue;
      if (!flags.is(FLAG.memory(id))) flags.set(FLAG.memory(id), true);
      const v = VAULTS.find((x) => x === id);
      if (v && !flags.is(FLAG.keystone(VAULT[v].keystone))) flags.set(FLAG.keystone(VAULT[v].keystone), true);
    }
  });

  /** The KeeperRoom the fights system fights a vault's keeper in: the room's ground and things in the world. */
  function keeperRoomOf(room: RoomDef): KeeperRoom | null {
    const k = room.keeper;
    if (!k) return null;
    const o = roomOrigin(room);
    const pt = (p: readonly [number, number]): { x: number; z: number } => ({ x: o.x + p[0], z: o.z + p[1] });
    const [tx0, tz0, tx1, tz1] = k.trigger;
    const cell = (x: number, z: number): string => cellOf(room, Math.floor(x) - o.x, Math.floor(z) - o.z);
    const center = { x: o.x + (tx0 + tx1) / 2, z: o.z + (tz0 + tz1) / 2 };
    const channels = k.channels?.map((c) => {
      const cells: { x: number; z: number }[] = [];
      const [x0, z0, x1, z1] = c.box;
      for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) cells.push({ x: o.x + x + 0.5, z: o.z + z + 0.5 });
      return { cells, gate: pt(c.gate) };
    });
    return {
      kind: k.kind,
      stage: {
        solid: (x, z) => { const c = cell(x, z); return c === ' ' || c === '#' || c === '+' || c === 'o' || c === 'x' || c === 'X' || c === 'k' || (c === 'b' && eyes < GALLERY_EYES.length) || c === 'w'; },
        inside: (x, z) => x >= o.x + tx0 && x < o.x + tx1 && z >= o.z + tz0 && z < o.z + tz1 && cell(x, z) !== ' ',
        water: () => false,
        center,
        radius: Math.max(tx1 - tx0, tz1 - tz0) / 2,
        start: pt(k.start),
        den: pt(k.home),
        wake: pt(k.start),
      },
      home: pt(k.home),
      channels,
      lamps: k.lamps?.map(pt),
      beds: k.beds?.map(pt),
    };
  }

  // ------------------------------------------------------------------------------------ the rooms' blocks

  /** Sets a cell's blocks above the floor to what the room's state says. False when its chunk is not there. */
  function setCell(room: RoomDef, x: number, z: number, open: boolean): boolean {
    const o = roomOrigin(room), c = cellOf(room, x, z);
    let ok = true;
    for (let dy = 0; dy < 3; dy++) {
      const want = open ? 0 : blockOf(c, dy);
      const wx = o.x + x, wy = ROOMS.ground + dy, wz = o.z + z;
      if (world.getBlock(wx, wy, wz) !== want && !world.setBlock(wx, wy, wz, want)) ok = false;
    }
    return ok;
  }

  const LIGHT = blockId('lantern_light'), WATER = blockId('water');
  /** A lamp's light block over a cell of a room: lit or not. */
  function setLight(room: RoomDef, x: number, z: number, lit: boolean): boolean {
    const o = roomOrigin(room), wx = o.x + Math.floor(x), wy = ROOMS.ground + 1, wz = o.z + Math.floor(z);
    const want = lit ? LIGHT : 0;
    return world.getBlock(wx, wy, wz) === want || world.setBlock(wx, wy, wz, want);
  }

  /** Lays every block that follows the state. True once all of them took. */
  function syncBlocks(): boolean {
    let ok = true;
    const gallery = roomOf('gallery');
    gallery.plan.forEach((row, z) => { for (let x = 0; x < row.length; x++) if (row[x] === 'b') ok = setCell(gallery, x, z, eyes >= GALLERY_EYES.length) && ok; });
    for (let i = 0; i < GALLERY_EYES.length; i++) for (const [x, z] of GALLERY_EYES[i].lamps) ok = setLight(gallery, x, z, i < eyes) && ok;
    for (let level = 0; level < 3; level++) {
      const room = roomOf(`rootworks-${level + 1}` as RoomId);
      room.plan.forEach((row, z) => { for (let x = 0; x < row.length; x++) if (row[x] === 'r') ok = setCell(room, x, z, machines[level]) && ok; });
    }
    ok = setLight(roomOf('rootworks-2'), 2.5, 9, machines[1]) && ok;
    // The flooded stair runs dry when the lever is pulled: its water goes, and a dry well is left.
    const upper = roomOf('pump-upper'), o = roomOrigin(upper);
    upper.plan.forEach((row, z) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] !== 'w') continue;
        const want = lever ? 0 : WATER;
        const wy = ROOMS.ground - 1;
        if (world.getBlock(o.x + x, wy, o.z + z) !== want && !world.setBlock(o.x + x, wy, o.z + z, want)) ok = false;
      }
    });
    return ok;
  }

  // ------------------------------------------------------------------------------------ the shrines

  function restore(shrine: ShrineId, gift: 'heart' | 'stamina'): boolean {
    if (!SHRINES.includes(shrine) || flags.get(FLAG.shrine(shrine)) || !flags.is('mark')) return false;
    flags.set(FLAG.shrine(shrine), gift);
    if (shrine === 'shrine-oak') stepFlag('echo', 'shrine');
    const restored = SHRINES.filter((s) => flags.get(FLAG.shrine(s))).length;
    toast(gift === 'heart' ? 'The shrine wakes under your hand. One more heart, for good.' : 'The shrine wakes under your hand. More stamina, for good.');
    if (restored === SHRINES.length) say('Six shrines awake. From any hill in Greenhollow you can see one burning.');
    return true;
  }

  // ------------------------------------------------------------------------------------ what can be used

  const targets: Interactable[] = [];
  const fighting = (): boolean => (game.systems.fights?.running?.() ?? null) !== null;
  const at = (room: RoomId, spot: string): (() => Vec3) => {
    const r = roomOf(room), s = r.spots[spot];
    const p = roomPoint(r, s[0], s[1]);
    return () => p;
  };
  /** A thing to use in a room. `when` hides it. */
  function inRoom(room: RoomId, spot: string, radius: number, prompt: () => string | null, act: () => void): void {
    // Nothing in a room is used while a fight runs there, or in the moments after it, while the fight still has the hero.
    targets.push({ id: `ruins:${room}:${spot}`, pos: at(room, spot), radius, prompt: () => (inside?.id === room && !fighting() ? prompt() : null), act });
  }
  /** A thing to use in the world, where `pos` says once it can say. */
  const NOWHERE: Vec3 = { x: 1e9, y: 0, z: 1e9 };
  function inWorld(id: string, pos: () => Vec3 | null, radius: number, prompt: () => string | null, act: () => void): void {
    let cached: Vec3 | null = null;
    const where = (): Vec3 => { cached ??= pos(); return cached ?? NOWHERE; };
    targets.push({ id: `ruins:${id}`, pos: where, radius, prompt: () => (inside === null ? prompt() : null), act });
  }

  // -------------------------------------------------- the Pump House
  inWorld('pumphouse', () => placeAt('pumphouse'), 4.5,
    () => (flags.is(FLAG.vaultSealed('pumphouse')) ? 'Calla\'s seal is on the door' : 'Go into the Pump House'),
    () => {
      if (flags.is(FLAG.vaultSealed('pumphouse'))) { toast('Gold, set like wax across the door. Calla does not like you going in alone.'); return; }
      enter('pump-upper');
      if (!found.has('pumphouse')) { found.add('pumphouse'); say('The great wheel turns outside, and nobody winds it. Its shaft comes through the wall.'); }
    });
  inRoom('pump-upper', 'out', 1.8, () => 'Go out to the river', () => {
    const door = placeAt('pumphouse');
    // The landmark centre is in the Mere. Return to its dry south approach,
    // with room for Calla beside the hero, still within reach of the sealed door.
    const x = door?.x ?? 0, z = (door?.z ?? 0) + 4;
    outOfVault('pumphouse', door ? { x, y: world.heightAt(Math.floor(x), Math.floor(z)) || groundHeight(seed, Math.floor(x), Math.floor(z)), z } : null);
  });
  inRoom('pump-upper', 'lever', 2, () => (lever ? null : 'Pull the lever'), () => {
    if (lever) return;
    lever = true;
    blocksDue = true;
    say('The wheel\'s shaft takes the lever. Somewhere below a sluice swings, and the stair begins to drain.', 'The sprays along the wall start to hiss: wheel, shaft, lever, spray.');
  });
  inRoom('pump-upper', 'stair', 1.8, () => (lever ? 'Go down the stair' : 'The stair is under water'), () => {
    if (!lever) { toast('Cold water to the top step. Something must let it out.'); return; }
    enter('pump-lower');
    if (started('pump')) stepFlag('pump', 'halls');
  });
  inRoom('pump-lower', 'up', 1.8, () => 'Go up the stair', () => enter('pump-upper', 'stair'));

  // -------------------------------------------------- the Lamp Gallery
  inWorld('lampgallery', () => placeAt('lampgallery'), 4.5,
    () => (flags.is(FLAG.vaultSealed('lampgallery')) ? 'Calla\'s seal is on the arch' : 'Go into the Lamp Gallery'),
    () => {
      if (flags.is(FLAG.vaultSealed('lampgallery'))) { toast('Calla\'s gold seal across the arch. It is in her instructions.'); return; }
      if (!LIGHTS.some((id) => has(id))) { toast('Pitch dark past the arch, and something in there clicks. You need a lamp to go in.'); return; }
      enter('gallery');
      if (eyes === 0) say('Your lamp finds a glass eye in the wall, and the dark beyond it. Let the eyes see you, one after another.');
    });
  inRoom('gallery', 'out', 1.8, () => 'Go out of the gallery', () => outOfVault('lampgallery', placeAt('lampgallery')));

  // -------------------------------------------------- the Seed Vault
  inWorld('seedvault', () => placeAt('seedvault'), 4.5,
    () => {
      if (flags.is(FLAG.vaultCleared('seedvault'))) return null;
      return flags.is(FLAG.vaultSealed('seedvault')) ? 'Calla\'s seal is on the door' : 'The Seed Vault\'s door';
    },
    () => toast(flags.is(FLAG.vaultSealed('seedvault')) ? 'Calla got here first: her gold sun is set across the oak. The roots on the west side might go further in.' : 'Oak doors under the roots, shut fast.'));
  inWorld('roots', () => ground('roots'), 3,
    () => (flags.is(FLAG.vaultCleared('seedvault')) ? null : wrenKnows() ? 'Go in through the roots' : 'Roots, thick as a cart'),
    () => {
      if (!wrenKnows()) { toast('The roots close over the vault\'s side like a fist. Someone who knows this forest might find a way.'); return; }
      enter('seedvault');
      if (started('seeds')) stepFlag('seeds', 'seal');
      if (!found.has('seedvault')) { found.add('seedvault'); say('Wren holds the roots back. "In you go. I\'ll keep the way open."'); }
    });
  inRoom('seedvault', 'roots', 1.8, () => 'Climb out through the roots', () => outOfVault('seedvault', ground('roots')));
  inRoom('seedvault', 'door', 2, () => (keeperWon('seedvault') && keystoneTaken('seedvault') ? 'Push the doors open' : null), () => {
    say('You put your shoulder to the oak. Calla\'s seal cracks down the middle, and the doors swing out into the forest.');
    outOfVault('seedvault', placeAt('seedvault'));
  });
  /** Wren has walked you down the forest stair, so she knows the way in. */
  function wrenKnows(): boolean {
    return flags.is(FLAG.step('seeds', 'stair')) || flags.is(FLAG.step('seeds', 'seal')) || keeperWon('seedvault');
  }

  // -------------------------------------------------- each vault's dais
  for (const v of VAULTS) {
    const room = VAULT[v].room;
    inRoom(room, 'keystone', 1.8, () => (keeperWon(v) && !keystoneTaken(v) ? 'Take the keystone' : null), () => takeKeystone(v));
    inRoom(room, 'memory', 1.8, () => (keeperWon(v) ? (flags.is(FLAG.memory(v)) ? 'Touch the stone again' : 'Touch the stone') : null), () => touch(v));
  }

  // -------------------------------------------------- memory stones in the world
  inWorld('stone-hall', () => ({ ...AT.stoneHall as Vec3, y: placeAt('hall.mural')?.y ?? 0 }), 1.8,
    () => (flags.is('mark') && started('echo') ? (flags.is(FLAG.memory('hall')) ? 'Touch the stone again' : 'Touch the dull stone') : null),
    () => touch('hall'));
  for (const id of ['ruin-tower', 'ruin-stair'] as const) {
    inWorld(`stone-${id}`, () => { const p = placeAt(id); return p ? { x: p.x + 2, y: p.y, z: p.z + 1 } : null; }, 2,
      () => (flags.is('mark') ? (flags.is(FLAG.memory(id)) ? 'Touch the stone again' : 'Touch the stone') : null),
      () => touch(id));
  }

  // -------------------------------------------------- the small ruins
  inWorld('ruin-stair', () => placeAt('ruin-stair'), 3,
    () => (started('seeds') && !flags.is(FLAG.step('seeds', 'stair')) ? 'Go down the forest stair with Wren' : null),
    () => {
      stepFlag('seeds', 'stair');
      say('Wren goes first, down steps that end in roots. "The vault\'s past this. Calla came by the road; I know a better way."');
    });
  inWorld('ruin-mill', () => placeAt('ruin-mill'), 3.5,
    () => (flags.is(FLAG.fightWon(6)) && !taken.has('ruin-mill') ? 'Take the old brass' : null),
    () => {
      const left = game.systems.inventory?.add('old_brass', MILL_BRASS) ?? MILL_BRASS;
      if (left >= MILL_BRASS) { toast('Your bag is full.'); return; }
      taken.add('ruin-mill');
      say('Old brass from the mill\'s gearing, green at the edges. Enough for a wheel of your own.');
    });
  for (const id of ['ruin-wall', 'ruin-post'] as const) {
    inWorld(id, () => placeAt(id), 3.5, () => (id === 'ruin-wall' ? 'Look at the mural' : 'Look through the slit'), () => { taken.add(id); say(...RUIN_LOOKS[id]); });
  }

  // -------------------------------------------------- the shrines
  for (const shrine of SHRINES) {
    inWorld(shrine, () => placeAt(shrine), 3.2,
      () => (flags.get(FLAG.shrine(shrine)) ? null : flags.is('mark') ? 'Restore the shrine' : 'A sleeping shrine'),
      () => {
        if (!flags.is('mark')) { toast('Cold stone. Something in it is asleep, and your hand is not the right hand yet.'); return; }
        events.emit('shrine.asked', { shrine });
      });
  }

  // -------------------------------------------------- the Old Gate and the Rootworks
  const gateOpen = (): boolean => flags.is(FLAG.scene(32)) && KEYSTONES.every((n) => flags.is(FLAG.keystone(n)));
  const rope = (): boolean => has('rope_ladder') || has('vine_rope', VINE_FOR_ROPE);
  inWorld('gate', () => ground('gate'), 4,
    () => {
      if (gateOpen()) return 'Climb down into the Rootworks';
      return KEYSTONES.every((n) => flags.is(FLAG.keystone(n))) ? 'Set the three keystones' : 'The Old Gate';
    },
    () => {
      const held = KEYSTONES.filter((n) => flags.is(FLAG.keystone(n))).length;
      if (held < 3) { toast(`A round gate in the terrace wall, and three round sockets over it. You have ${held} of the keystones.`); return; }
      if (!flags.is(FLAG.scene(32))) { if (!game.systems.talk?.active) game.systems.talk?.start('scene.32'); return; }
      if (deepest === 0 && !rope()) { toast('A sheer drop under the gate, and an iron ring for a rope. Bring your own: a rope ladder, or two of vine rope.'); return; }
      if (deepest === 0) say('You tie your own rope to the ring and go down hand over hand.');
      down(1);
    });
  inWorld('waystone', () => ground('waystone'), 2.6,
    () => (deepest > 0 ? `Touch the waystone: the Rootworks, level ${deepest}` : null),
    () => down(deepest, 'waystone'));

  /** Down to a level of the Rootworks. */
  function down(level: number, spot = 'arrive'): void {
    deepest = Math.max(deepest, level);
    enter(`rootworks-${level}` as RoomId, spot);
    if (started('keystones')) stepFlag('keystones', 'climb');
  }

  for (let i = 0; i < 3; i++) {
    const room = `rootworks-${i + 1}` as RoomId, m = MACHINES[i];
    inRoom(room, 'up', 1.6, () => 'Climb up the rope', () => (i === 0 ? leaveTo(ground('gate')) : enter(`rootworks-${i}` as RoomId, 'lock')));
    inRoom(room, 'machine', 2.2, () => (machines[i] ? null : `Rebuild ${m.name}`), () => {
      const missing = m.needs.filter((n) => !has(n.id, n.count));
      if (missing.length > 0) {
        const names = m.needs.map((n) => `${n.count} ${n.id.replace(/_/g, ' ')}`).join(' and ');
        toast(`Dead for a thousand years. It wants ${names} from your pack.`);
        return;
      }
      for (const n of m.needs) game.systems.inventory?.remove(n.id, n.count);
      machines[i] = true;
      blocksDue = true;
      say(m.done);
      if (i === 2 && started('keystones')) stepFlag('keystones', 'machines');
    });
    inRoom(room, 'lock', 2.4, () => (machines[i] ? (i === 2 ? 'Go down to the Stag\'s hall' : `Climb down to level ${i + 2}`) : null), () => {
      if (i === 2) enter('stag');
      else down(i + 2);
    });
    inRoom(room, 'waystone', 2, () => 'Touch the waystone: home', () => {
      say('The waystone hums. The terraces\' own stone will bring you back to this level.');
      leaveTo(ground('home'));
    });
  }

  // -------------------------------------------------- the Stag's hall
  inRoom('stag', 'out', 2, () => (flags.is(FLAG.fightWon(12)) ? 'Climb out under the sky' : 'Go back up'), () => {
    if (flags.is(FLAG.fightWon(12))) leaveTo(ground('gate'));
    else enter('rootworks-3', 'lock');
  });
  /** The Custodian's words before the chains, then the fight. */
  let stagAsked = false;
  function stepStag(): void {
    const fights = game.systems.fights;
    if (!fights?.startStag || flags.is(FLAG.fightWon(12)) || fights.active() !== null || rearm > 0) return;
    const room = roomOf('stag'), m = room.spots.middle, o = roomOrigin(room);
    const cx = o.x + m[0], cz = o.z + m[1];
    if (Math.hypot(player.pos.x - (cx + 0.5), player.pos.z - (cz + 0.5)) > STAG_HALL.radius - 0.5) return;
    const talk = game.systems.talk;
    if (talk?.active || player.busy) return;
    if (!stagAsked && !flags.is('story.seen.scene.33.before')) {
      stagAsked = true;
      talk?.start('scene.33.before');
      return;
    }
    fights.startStag(cx, cz);
  }

  // -------------------------------------------------- the Hall's second level
  inWorld('hall-below', () => ({ ...AT.hallBelow as Vec3, y: placeAt('hall.heart')?.y ?? 0 }), 2,
    () => (flags.is(FLAG.fightWon(12)) ? 'Go down to the Hall\'s second level' : null),
    () => {
      enter('hall-below');
      if (started('green')) stepFlag('green', 'level');
      if (!found.has('hall-below')) { found.add('hall-below'); say('A stair you never saw, open now under the court. At the bottom: a long table, and eight chairs.'); }
    });
  inRoom('hall-below', 'out', 1.8, () => 'Go back up to the court', () => leaveTo({ ...AT.hallBelow as Vec3, y: placeAt('hall.heart')?.y ?? 0, z: (AT.hallBelow as Vec3).z + 1.5 }));

  // ------------------------------------------------------------------------------------ the api
  const api: Required<RuinsApi> = {
    state(id): RuinState {
      if ((VAULTS as readonly string[]).includes(id)) {
        const v = id as VaultId;
        if (flags.is(FLAG.vaultCleared(v))) return 'cleared';
        if (flags.is(FLAG.vaultSealed(v))) return 'sealed';
        return found.has(v) ? 'found' : 'unknown';
      }
      if (id === 'ruin-post') return 'sealed';
      if (taken.has(id) || (id === 'ruin-tower' || id === 'ruin-stair') && flags.is(FLAG.memory(id))) return 'cleared';
      return found.has(id) ? 'found' : 'unknown';
    },
    shrine(id) {
      const picked = flags.get(FLAG.shrine(id));
      return picked === 'heart' || picked === 'stamina' ? picked : null;
    },
    remembered: (id) => flags.is(FLAG.memory(id)),
    keystones: () => KEYSTONES.filter((n) => flags.is(FLAG.keystone(n))).length,
    view(): RuinsView {
      const stones: MemoryId[] = ['hall', 'ruin-tower', 'ruin-stair'];
      for (const v of VAULTS) if (!flags.is(FLAG.vaultSealed(v)) || !flags.is(FLAG.vaultCleared(v))) stones.push(v);
      return {
        room: inside?.id ?? null,
        lever,
        eyes,
        machines,
        deepest,
        gate: gateOpen(),
        taken: { pumphouse: keystoneTaken('pumphouse'), lampgallery: keystoneTaken('lampgallery'), seedvault: keystoneTaken('seedvault') },
        below: flags.is(FLAG.fightWon(12)),
        stones,
      };
    },
    restore,
    enter: (room) => { if (ROOM_DEFS.some((r) => r.id === room)) enter(room as RoomId); },
  };

  // ------------------------------------------------------------------------------------ the step

  let joined = false;
  function join(): void {
    const interact = game.systems.interact;
    if (!interact) return;
    for (const t of targets) interact.add(t);
    joined = true;
  }

  function stepRoom(): void {
    const room = inside;
    if (!room) return;
    const o = roomOrigin(room);
    // The gallery's eyes, one after another.
    if (room.id === 'gallery' && eyes < GALLERY_EYES.length) {
      const eye = GALLERY_EYES[eyes];
      if (Math.hypot(player.pos.x - (o.x + eye.x), player.pos.z - (o.z + eye.z)) <= EYE_SEES) {
        eyes++;
        blocksDue = true;
        if (eyes === GALLERY_EYES.length) {
          say('The last eye opens. Twelve lamps burn the length of the gallery, and the bars ahead sink into the floor.');
          if (started('gallery')) stepFlag('gallery', 'lamps');
        } else if (eyes === 1) say('The glass eye sees you. Two lamps light, and the next eye glints across the walkway.');
      }
    }
    // A keeper in its room.
    const k = room.keeper;
    const fights = game.systems.fights;
    if (k && fights?.startKeeper && rearm <= 0 && fights.active() === null) {
      const v = VAULTS.find((x) => VAULT[x].room === room.id)!;
      const [x0, z0, x1, z1] = k.trigger;
      const lx = player.pos.x - o.x, lz = player.pos.z - o.z;
      const ready = room.id !== 'gallery' || eyes >= GALLERY_EYES.length;
      if (ready && !keeperWon(v) && lx >= x0 && lx < x1 && lz >= z0 && lz < z1) {
        const kr = keeperRoomOf(room);
        if (kr) fights.startKeeper(VAULT[v].fight, kr);
      }
    }
    if (room.id === 'stag') stepStag();
  }

  // A fight that ended without a win waits a moment before it can start again, so a walk-out is a walk-out.
  events.on('fight.ended', ({ result }) => { if (result !== 'won') rearm = REARM; });

  const system: SimSystem = {
    step(dt) {
      if (!joined) join();
      inside = roomAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
      if (rearm > 0) rearm -= dt;
      // Calla got to the Seed Vault before you: her seal is on its door once its quest begins.
      if (started('seeds') && !flags.is(FLAG.vaultSealed('seedvault')) && !flags.is(FLAG.vaultCleared('seedvault'))) flags.set(FLAG.vaultSealed('seedvault'), true);
      // Going somewhere is being there.
      if (!inside) {
        if (started('pump') && near(placeAt('pumphouse'), THERE)) stepFlag('pump', 'marsh');
        for (const id of [...SMALL_RUINS, ...VAULTS]) if (!found.has(id) && near(placeAt(id), FOUND)) found.add(id);
      }
      stepRoom();
      if (blocksDue) blocksDue = !syncBlocks();
      if (lineWait > 0) lineWait -= dt;
      if (lines.length > 0 && lineWait <= 0) {
        toast(lines.shift()!);
        lineWait = LINE_GAP;
      }
    },
    save(): RuinsSave {
      return { lever, eyes, machines: [...machines], deepest, found: [...found], taken: [...taken], first };
    },
    load(data) {
      const s = (data ?? {}) as Partial<RuinsSave>;
      lever = s.lever === true;
      eyes = Math.max(0, Math.min(GALLERY_EYES.length, Number(s.eyes) || 0));
      for (let i = 0; i < 3; i++) machines[i] = Array.isArray(s.machines) && s.machines[i] === true;
      deepest = Math.max(0, Math.min(3, Number(s.deepest) || 0));
      found.clear();
      for (const id of Array.isArray(s.found) ? s.found : []) if (typeof id === 'string') found.add(id);
      taken.clear();
      for (const id of Array.isArray(s.taken) ? s.taken : []) if (typeof id === 'string') taken.add(id);
      first = VAULTS.includes(s.first as VaultId) ? (s.first as VaultId) : null;
      blocksDue = true;
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createRuins(kernel.game);
  kernel.add('ruins', api, system);
}
