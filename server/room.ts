// One world as the server runs it: the same rules the browser runs solo, a body for every player, and a
// note of what each player has been told, so a snap holds only what is near them and new to them.
//
// Nothing here is a Workers call. The Durable Object in world.ts owns the sockets, the clock and the
// storage, and drives this: `join`, `input`, `step`, `snap`, `leave`, `save`. A test drives it the same way.
//
// The rules know one player: `game.player`, one bag, one break meter. Until they know many, the server
// stands in like this:
//   - Every player has a real body (the hero's own rules, three steps of it to one kernel step) and is an
//     actor like everyone else, `player:` and their user id.
//   - A click is run through the rules as that player: `game.player` holds their body while it runs.
//   - While the kernel steps, `game.player` is the host: the player who has been in the world longest.
//     Creatures wake and flee around the host, pets and quests follow the host.
//   - The bag, the quests and the story are the world's, shared by everyone in it.
import type { Act, ActorState, BodyState, ChunkEdits, Input, PlacedState, Snap, Target } from '../src/engine/net/messages.ts';
import { HERO_STEP, HeroBody } from '../src/features/hero/hero.sim.ts';
import { SOLID, chunkKey, keyX, keyZ } from '../src/features/world/chunk.sim.ts';
import { World, type RayHit, type WorldSave } from '../src/features/world/world.sim.ts';
import type { Actor, Game, Placed, Systems, UseContext } from '../src/game/api.sim.ts';
import { STEP, createKernel, type GameSave, type Kernel } from '../src/game/kernel.sim.ts';
import { INSTALLS, KERNEL_SEED, WORLD_SEED } from '../src/game/play/harness.sim.ts';

/** The most players in one world. The plan is 8 (docs/architecture.md). */
export const MAX_PLAYERS = 8;
/** Body steps in one kernel step: 60 a second against 20, as in the shell. */
const BODY_STEPS = Math.round(STEP / HERO_STEP);
/** The hero walks up a one-block ledge, as in the painted world the game draws by default. */
const STEP_UP = 1;
/** Faster than this along the ground, in blocks a second, is the walk animation. */
const MOVING = 0.4;
/** Chunks of land kept in memory around each player, each way: what the rules read. The shell's LOAD_REACH. */
const LOAD_REACH = 3;
/** A chunk farther than this from every player is dropped from memory. Its changed blocks are kept. */
const KEEP_REACH = 5;
/** Chunks around a player, each way, whose changed blocks and placed things that player is told. */
const TELL_REACH = 8;
/** Blocks around a player within which they are told of actors. Creatures sleep beyond 48. */
const ACTOR_RANGE = 56;
/**
 * Steps between two tellings of an actor that is not a player: 4 is five times a second. Players are told
 * every step. Each actor has its own turn in the four, so a crowd is spread evenly over the steps.
 */
const SLOW_EVERY = 4;
/** Inputs that may wait for one player. More than this and the oldest are dropped, so nobody runs ahead. */
const MAX_WAITING = 6;
/**
 * A player earns one input a step and may save up this many. A saved one is spent when two inputs arrive
 * in one step after a step with none, as they do on a line that stutters, so no input sits waiting a step
 * behind for the rest of the session. Over any stretch a player still uses no more inputs than steps, plus these.
 */
const MAX_SAVED = 3;
/** The most inputs of one player used in one step. */
const MAX_AT_ONCE = 2;

export interface RoomSave {
  version: 1;
  /** Kernel steps played, across sleeps. */
  steps: number;
  world: WorldSave;
  game: GameSave;
  /** Where each player was when they left, by user id. */
  places: Record<string, { x: number; y: number; z: number; facing: number }>;
}

export interface RoomStats {
  steps: number;
  players: number;
  /** Chunks of land in memory. */
  chunks: number;
  /** Chunks with at least one changed block. */
  editedChunks: number;
  actors: number;
  creatures: number;
  /** Creatures the rules stepped in the last step: the ones near the host. */
  creaturesAwake: number;
  placed: number;
  /** Inputs dropped because too many were waiting. */
  inputsDropped: number;
}

interface Seen {
  state: ActorState;
  /** The step it last changed in. */
  at: number;
  /** The step it was last there in. */
  alive: number;
  /** Its turn among the slow steps, 0 to SLOW_EVERY - 1. -1 for a player, who is told every step. */
  turn: number;
}

interface RoomPlayer {
  user: string;
  name: string;
  body: HeroBody;
  actor: Actor;
  /** The quick slot this player holds. */
  slot: number;
  waiting: Input[];
  /** Inputs this player may use: one more every step, up to MAX_SAVED. */
  saved: number;
  /** The number of the newest input received, and of the last one used. */
  newest: number;
  ack: number;
  chunkX: number;
  chunkZ: number;
  /** Chunks this player has been told the changed blocks of. */
  chunks: Set<number>;
  /** Actors this player knows, with the step each was last sent in. */
  actors: Map<string, number>;
  placed: Set<string>;
  /** The placed things' revision this player was last brought up to, or -1 to bring them up again. */
  placedAt: number;
  // What the next snap carries.
  tellChunks: ChunkEdits[];
  tellBlocks: number[];
}

/** The world, with a note of every block that changes, so each change can be sent to the players near it. */
class ServerWorld extends World {
  /** x, y, z and the new id of every block changed since the list was last emptied. */
  readonly changes: number[] = [];

  override setBlock(x: number, y: number, z: number, id: number): boolean {
    const changed = super.setBlock(x, y, z, id);
    if (changed) this.changes.push(x, y, z, id);
    return changed;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface Room {
  readonly world: World;
  readonly kernel: Kernel;
  readonly game: Game;
  readonly sys: Systems;
  /** Kernel steps played, across sleeps. */
  readonly steps: number;
  readonly playerCount: number;
  has(user: string): boolean;
  /** The user ids and names of everyone in the world, the host first. */
  who(): { id: string; name: string }[];
  /** Adds a player where they left, or at the spawn. Returns their actor id, or null when the world is full. */
  join(user: string, name: string): string | null;
  leave(user: string): void;
  /** Takes one input in. It is used in a later step: one a step, or two when a step before had none. */
  input(user: string, input: Input): void;
  /** One step: each player's next input, their bodies, then every rule. Nothing happens in an empty world. */
  step(): void;
  /** What to send this player after a step. Call it at most once a step for each player: it notes what it told them. */
  snap(user: string): Snap | null;
  save(): RoomSave;
  stats(): RoomStats;
}

export function createRoom(saved: RoomSave | null = null): Room {
  const world = new ServerWorld(WORLD_SEED);
  // As the shell's continueGame does: the world first, so a station's cells match the blocks around it.
  if (saved) world.restore(saved.world);
  const kernel = createKernel(world, KERNEL_SEED);
  const game = kernel.game;
  for (const [, install] of INSTALLS) install(kernel);
  const sys = game.systems;

  const players = new Map<string, RoomPlayer>();
  const places = new Map<string, { x: number; y: number; z: number; facing: number }>(Object.entries(saved?.places ?? {}));
  const seen = new Map<string, Seen>();
  let steps = saved?.steps ?? 0;
  let inputsDropped = 0;
  let nextTurn = 0;

  // Placed things have no event for being taken away, so the two ways in and out are counted here.
  let placedRev = 0;
  const placeables = sys.placeables;
  const place = placeables.place.bind(placeables), remove = placeables.remove.bind(placeables);
  placeables.place = (kind, x, y, z, turns) => {
    const placed = place(kind, x, y, z, turns);
    if (placed) placedRev++;
    return placed;
  };
  placeables.remove = (id) => {
    remove(id);
    placedRev++;
  };

  function loadAround(cx: number, cz: number): void {
    for (let dx = -LOAD_REACH; dx <= LOAD_REACH; dx++) for (let dz = -LOAD_REACH; dz <= LOAD_REACH; dz++) world.load(cx + dx, cz + dz);
  }

  if (saved) {
    // The land around the saved player, then the systems, as the shell does.
    const at = saved.game.player;
    loadAround(Math.floor(at.x) >> 4, Math.floor(at.z) >> 4);
    kernel.load(saved.game);
    placedRev++;
  }

  /** Drops the land no player is near. Its changed blocks stay in the world's save. */
  function unloadFar(): void {
    for (const chunk of [...world.chunks.values()]) {
      let near = false;
      for (const p of players.values()) {
        const dx = chunk.cx - p.chunkX, dz = chunk.cz - p.chunkZ;
        if (dx * dx + dz * dz <= KEEP_REACH * KEEP_REACH) { near = true; break; }
      }
      if (!near) world.unload(chunk.cx, chunk.cz);
    }
  }

  /** The player moved to another chunk: the land around them is made, and they are told of the chunks now in range. */
  function moved(p: RoomPlayer, cx: number, cz: number): void {
    p.chunkX = cx;
    p.chunkZ = cz;
    loadAround(cx, cz);
    for (const key of p.chunks) {
      const dx = keyX(key) - cx, dz = keyZ(key) - cz;
      if (dx < -TELL_REACH || dx > TELL_REACH || dz < -TELL_REACH || dz > TELL_REACH) p.chunks.delete(key);
    }
    for (let x = cx - TELL_REACH; x <= cx + TELL_REACH; x++) {
      for (let z = cz - TELL_REACH; z <= cz + TELL_REACH; z++) {
        const key = chunkKey(x, z);
        if (p.chunks.has(key)) continue;
        p.chunks.add(key);
        const edits = world.editsOf(x, z);
        if (edits) p.tellChunks.push([x, z, Array.from(edits)]);
      }
    }
    p.placedAt = -1;
  }

  /** `game.player` becomes this player's body, so the rules judge reach and facing from where they stand. */
  function become(p: RoomPlayer): void {
    const body = p.body, player = game.player;
    player.pos.x = body.x; player.pos.y = body.y; player.pos.z = body.z;
    player.facing = body.facing;
    player.onGround = body.grounded;
    player.inWater = body.swimming;
    sys.inventory.selected = p.slot;
  }

  const hit: RayHit = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, id: 0, distance: 0 };
  function contextOf(target: Target, button: 'primary' | 'secondary'): UseContext {
    hit.x = target.x; hit.y = target.y; hit.z = target.z;
    hit.nx = target.nx; hit.ny = target.ny; hit.nz = target.nz;
    hit.id = world.getBlock(target.x, target.y, target.z);
    return { hit, held: sys.inventory.held(), button };
  }

  function act(p: RoomPlayer, a: Act): void {
    if (a.a === 'slot') {
      p.slot = a.slot;
      sys.inventory.selected = a.slot;
    } else if (a.a === 'use') sys.actions.use(contextOf(a, a.button));
    else sys.actions.hold(contextOf(a, 'primary'), STEP);
  }

  const still = { moveX: 0, moveZ: 0, jump: false };
  const move = { moveX: 0, moveZ: 0, jump: false };

  /** One player's step: the clicks of their next input, then three steps of their body. Two inputs when one is owed. */
  function stepPlayer(p: RoomPlayer): void {
    const body = p.body;
    p.saved = Math.min(MAX_SAVED, p.saved + 1);
    let used = 0;
    while (used < MAX_AT_ONCE && p.saved >= 1 && p.waiting.length > 0) {
      const input = p.waiting.shift() as Input;
      p.saved--;
      used++;
      p.ack = input.n;
      if (input.acts) {
        become(p);
        for (const a of input.acts) act(p, a);
      }
      move.moveX = input.mx; move.moveZ = input.mz; move.jump = input.jump;
      for (let i = 0; i < BODY_STEPS; i++) body.step(move);
    }
    // No input came for this step: the body still falls and slows down.
    if (used === 0) for (let i = 0; i < BODY_STEPS; i++) body.step(still);
    const actor = p.actor;
    actor.pos.x = body.x; actor.pos.y = body.y; actor.pos.z = body.z;
    actor.facing = body.facing;
    actor.anim = Math.hypot(body.vx, body.vz) > MOVING ? 'walk' : 'idle';
    const cx = Math.floor(body.x) >> 4, cz = Math.floor(body.z) >> 4;
    if (cx !== p.chunkX || cz !== p.chunkZ) moved(p, cx, cz);
  }

  /** Notes every actor as it is after this step, and the step it last changed in. */
  function noteActors(): void {
    for (const actor of game.actors.values()) {
      if (!actor.visible) continue;
      const x = round2(actor.pos.x), y = round2(actor.pos.y), z = round2(actor.pos.z), facing = round2(actor.facing);
      const mark = actor.mark || undefined;
      const known = seen.get(actor.id);
      if (known) {
        known.alive = steps;
        const s = known.state;
        if (s.x === x && s.y === y && s.z === z && s.facing === facing && s.anim === actor.anim && s.sprite === actor.sprite && s.mark === mark) continue;
      }
      // A new object for every change, so a snap that was handed out is never changed after the fact.
      const state: ActorState = { id: actor.id, sprite: actor.sprite, x, y, z, facing, anim: actor.anim };
      if (mark) state.mark = mark;
      if (known) { known.state = state; known.at = steps; }
      else seen.set(actor.id, { state, at: steps, alive: steps, turn: actor.id.startsWith('player:') ? -1 : nextTurn++ % SLOW_EVERY });
    }
    for (const [id, known] of seen) if (known.alive !== steps) seen.delete(id);
  }

  /** Hands every block that changed in this step to the players who know its chunk. */
  function tellBlocks(): void {
    const changes = world.changes;
    for (let i = 0; i < changes.length; i += 4) {
      const key = chunkKey(changes[i] >> 4, changes[i + 2] >> 4);
      for (const p of players.values()) if (p.chunks.has(key)) p.tellBlocks.push(changes[i], changes[i + 1], changes[i + 2], changes[i + 3]);
    }
    changes.length = 0;
  }

  const placedState = (p: Placed): PlacedState => ({ id: p.id, kind: p.kind, x: p.x, y: p.y, z: p.z, turns: p.quarterTurns });

  /** Brings a player up to date on the placed things in range. Runs only after one was set down or taken, or the player changed chunk. */
  function tellPlaced(p: RoomPlayer, out: Snap): void {
    const inRange = new Set<string>();
    for (const placed of sys.placeables.all()) {
      const dx = (placed.x >> 4) - p.chunkX, dz = (placed.z >> 4) - p.chunkZ;
      if (dx < -TELL_REACH || dx > TELL_REACH || dz < -TELL_REACH || dz > TELL_REACH) continue;
      inRange.add(placed.id);
      if (!p.placed.has(placed.id)) (out.placed ??= []).push(placedState(placed));
    }
    for (const id of p.placed) if (!inRange.has(id)) (out.unplaced ??= []).push(id);
    p.placed = inRange;
    p.placedAt = placedRev;
  }

  function bodyState(body: HeroBody): BodyState {
    return { x: body.x, y: body.y, z: body.z, vx: body.vx, vy: body.vy, vz: body.vz, facing: body.facing, ground: body.grounded, water: body.swimming };
  }

  /** The host: the player who has been here longest. */
  function host(): RoomPlayer | undefined {
    for (const p of players.values()) return p;
    return undefined;
  }

  function leave(user: string): void {
    const p = players.get(user);
    if (!p) return;
    places.set(user, { x: p.body.x, y: p.body.y, z: p.body.z, facing: p.body.facing });
    game.actors.delete(p.actor.id);
    players.delete(user);
  }

  return {
    world, kernel, game, sys,
    get steps() { return steps; },
    get playerCount() { return players.size; },
    has: (user) => players.has(user),
    who: () => [...players.values()].map((p) => ({ id: p.user, name: p.name })),

    join(user, name) {
      leave(user);
      if (players.size >= MAX_PLAYERS) return null;
      const spawn = sys.region.spawn();
      const at = places.get(user) ?? { x: spawn.x, y: spawn.y, z: spawn.z, facing: sys.region.spawnFacing?.() ?? Math.PI };
      const cx = Math.floor(at.x) >> 4, cz = Math.floor(at.z) >> 4;
      loadAround(cx, cz);
      // Never inside a block: the land may have changed under a place that was saved.
      const bx = Math.floor(at.x), bz = Math.floor(at.z);
      const blocked = SOLID[world.getBlock(bx, Math.floor(at.y), bz)] || SOLID[world.getBlock(bx, Math.floor(at.y) + 1, bz)];
      const y = blocked ? world.heightAt(at.x, at.z) : at.y;
      const body = new HeroBody(world, { x: at.x, y, z: at.z }, undefined, { stepUp: STEP_UP });
      body.facing = at.facing;
      const actor: Actor = { id: `player:${user}`, sprite: 'hero', pos: { x: at.x, y, z: at.z }, facing: at.facing, anim: 'idle', visible: true };
      game.actors.set(actor.id, actor);
      const p: RoomPlayer = {
        user, name, body, actor, slot: 0,
        waiting: [], saved: 0, newest: 0, ack: 0,
        chunkX: NaN, chunkZ: NaN,
        chunks: new Set(), actors: new Map(), placed: new Set(), placedAt: -1,
        tellChunks: [], tellBlocks: [],
      };
      players.set(user, p);
      moved(p, cx, cz);
      return actor.id;
    },

    leave,

    input(user, input) {
      const p = players.get(user);
      // An input that is not newer than the last is a repeat. It is not used twice.
      if (!p || input.n <= p.newest) return;
      p.newest = input.n;
      p.waiting.push(input);
      if (p.waiting.length > MAX_WAITING) {
        p.waiting.shift();
        inputsDropped++;
      }
    },

    step() {
      const first = host();
      if (!first) return;
      for (const p of players.values()) stepPlayer(p);
      become(first);
      kernel.step();
      steps++;
      // The view's list of stale meshes. Nobody draws here.
      world.dirty.length = 0;
      noteActors();
      tellBlocks();
      if (steps % 20 === 0) unloadFar();
    },

    snap(user) {
      const p = players.get(user);
      if (!p) return null;
      const out: Snap = { t: 'snap', step: steps, ack: p.ack, you: bodyState(p.body), day: game.clock.day, time: Math.round(game.clock.timeOfDay * 10000) / 10000 };

      const px = p.body.x, pz = p.body.z;
      for (const [id, known] of seen) {
        if (id === p.actor.id) continue;
        const dx = known.state.x - px, dz = known.state.z - pz;
        const sent = p.actors.get(id);
        if (dx * dx + dz * dz <= ACTOR_RANGE * ACTOR_RANGE) {
          // New to this player: at once. Changed since they were told: in its turn.
          if (sent === undefined || (known.at > sent && (known.turn < 0 || steps % SLOW_EVERY === known.turn))) {
            (out.actors ??= []).push(known.state);
            p.actors.set(id, steps);
          }
        } else if (sent !== undefined) {
          (out.gone ??= []).push(id);
          p.actors.delete(id);
        }
      }
      for (const id of p.actors.keys()) {
        if (seen.has(id)) continue;
        (out.gone ??= []).push(id);
        p.actors.delete(id);
      }

      if (p.tellChunks.length > 0) {
        out.chunks = p.tellChunks;
        p.tellChunks = [];
      }
      if (p.tellBlocks.length > 0) {
        out.blocks = p.tellBlocks;
        p.tellBlocks = [];
      }
      if (p.placedAt !== placedRev) tellPlaced(p, out);
      return out;
    },

    save() {
      for (const p of players.values()) places.set(p.user, { x: p.body.x, y: p.body.y, z: p.body.z, facing: p.body.facing });
      return { version: 1, steps, world: world.save(), game: kernel.save(), places: Object.fromEntries(places) };
    },

    stats() {
      const creatures = sys.creatures.all();
      let awake = 0;
      for (const c of creatures) if (c.doing !== 'sleep') awake++;
      let editedChunks = 0;
      for (const [, , cells] of world.save().edits) if (cells.length > 0) editedChunks++;
      return {
        steps, players: players.size, chunks: world.chunks.size, editedChunks,
        actors: game.actors.size, creatures: creatures.length, creaturesAwake: awake,
        placed: sys.placeables.all().length, inputsDropped,
      };
    },
  };
}
