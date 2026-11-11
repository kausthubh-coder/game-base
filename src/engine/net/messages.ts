// The messages the browser and the world server send each other, defined once and imported by both.
// Nothing here touches the page, Three.js, Bun or Workers: it is plain data and checks, like a .sim.ts file.
//
// A connection goes like this. The browser opens a WebSocket to the world's address and says `hello`.
// The server answers `welcome` or `refuse`. From then on the browser sends one `input` for every step it
// plays, 20 a second, each numbered one higher than the last. After every step the server sends a `snap`:
// the number of the last input it used, the player's own body, and what changed near that player.

/** Steps a second, on the server and in the browser. The same as 1 / STEP in src/game/kernel.sim.ts. */
export const STEPS_PER_SECOND = 20;
/** Steps of a hero's body in one step of the rules: 60 a second against 20, as in the shell and on the server. */
export const BODY_STEPS = 3;

/** Why the server closed a connection. A browser reconnects after any other code. */
export const CLOSE = {
  /** A `refuse` was sent first and says why. */
  refused: 4000,
  /** The same player connected again, from another tab or after a drop. The newer connection plays. */
  replaced: 4001,
  /** The world server restarted and no longer knows this connection. Say hello again. */
  restart: 4002,
  /** Nothing was heard for too long. */
  quiet: 4003,
} as const;

// ---------------------------------------------------------------------------------------- browser to server

export interface Hello {
  t: 'hello';
  /** The build the browser runs: `BUILD` from version.ts. */
  build: string;
  /** The player's token from Clerk, or a dev token where the server allows those. */
  token: string;
}

/** A block and the face of it the pointer is on, as a ray cast gives it. */
export interface Target {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
}

/** Something the player did in one step besides moving. */
export type Act =
  /** Picked a quick slot, 0 to 8. */
  | { a: 'slot'; slot: number }
  /** One click on a block: `primary` breaks or gathers, `secondary` places or uses. */
  | ({ a: 'use'; button: 'primary' | 'secondary' } & Target)
  /** The primary button stayed down on a block for this step. */
  | ({ a: 'hold' } & Target)
  /** The E key: the nearest thing with a prompt. */
  | { a: 'interact' }
  /** One click in this player's conversation: the next line, or the choice of this index. */
  | { a: 'say'; choice?: number }
  /** A recipe made from the bag. */
  | { a: 'craft'; recipe: string }
  /** A stack moved in the bag, or `count` of it. Slots 0 to 35. */
  | { a: 'move'; from: number; to: number; count?: number }
  /**
   * One build-mode stroke, whole: the button went down on `at` and came up on `to`, with the held piece at
   * `turns` quarter turns. Without `to` it was only the press, which takes a placed thing back into the bag.
   * Each is what the pointer was given, before build mode works out the cell.
   */
  | { a: 'build'; at: Target; to?: Target; turns?: number }
  /** Takes back the last build-mode stroke. */
  | { a: 'undo' };

export interface Input {
  t: 'input';
  /** One higher than the input before it. The server answers with the last number it used. */
  n: number;
  /** The way the player wants to go along the ground, in world space, each -1 to 1. Shorter than 1 walks slower. */
  mx: number;
  mz: number;
  jump: boolean;
  /**
   * The way the player steered in each body step of this step: mx, mz and jump (0 or 1), three numbers for
   * each of the `BODY_STEPS`. The browser moves the hero at once and reads the keys at every body step, so
   * this is what it did. Left out, `mx`, `mz` and `jump` hold for all of them.
   */
  moves?: number[];
  /** What else the player did in this step, in order. */
  acts?: Act[];
}

export type ClientMessage = Hello | Input;

// ---------------------------------------------------------------------------------------- server to browser

export type RefuseReason =
  /** The browser runs another build than the server. It should reload. */
  | 'reload'
  /** The token is missing, wrong or out of date. */
  | 'token'
  /** This player may not enter this world. */
  | 'closed'
  /** The world has all the players it holds. */
  | 'full'
  /** The first message was not a hello. */
  | 'hello';

/** The words shown to the player for each refusal. */
export const REFUSALS: Readonly<Record<RefuseReason, string>> = {
  reload: 'The game was updated. Reload the page to keep playing.',
  token: 'Sign in again to enter this world.',
  closed: 'You are not invited to this world.',
  full: 'This world is full.',
  hello: 'The first message has to be a hello.',
};

export interface Refuse {
  t: 'refuse';
  why: RefuseReason;
  text: string;
}

export interface Welcome {
  t: 'welcome';
  /** This player's actor id in the world, `player:` and their user id. */
  you: string;
  build: string;
  /** The seed the land is made from. The browser makes the same land and lays the server's changes over it. */
  seed: number;
  /** The server's step count now. */
  step: number;
}

/** A hero's body, with everything the browser needs to carry on from it. */
export interface BodyState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  facing: number;
  ground: boolean;
  water: boolean;
}

/** Someone drawn in the world: another player, a creature, a pet, a person. */
export interface ActorState {
  id: string;
  sprite: string;
  x: number; y: number; z: number;
  facing: number;
  anim: string;
  mark?: string;
  /** A player's name, shown over their head. Only players have one. */
  name?: string;
}

/** A station or a piece of furniture standing in the world. */
export interface PlacedState {
  id: string;
  kind: string;
  x: number; y: number; z: number;
  turns: number;
}

/** A chunk and every block in it that differs from the land the seed makes: pairs of cell index and block id. */
export type ChunkEdits = [cx: number, cz: number, cells: number[]];

/**
 * The rules' state that is not the land, the bodies or the placed things: each system's own save, as
 * `save()` gives it, and the flags. Only what changed since the player was last told is in it.
 */
export interface StateCopy {
  /** Every flag, when one of them changed. */
  flags?: [string, boolean | number | string][];
  /** A system's save, by the system's name. */
  systems?: Record<string, unknown>;
}

/** An event the rules emitted, as the name and what it carries. The browser emits it again on its own bus. */
export type WireEvent = [name: string, data: unknown];

/** The block this player is breaking and how far along it is, 0 to 1, as `actions.breaking()` gives it. */
export interface Breaking {
  x: number; y: number; z: number;
  progress: number;
  tree?: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number } | null;
}

/** The line of this player's conversation, as `talk.current()` gives it. */
export interface Line {
  npc: string | null;
  name: string;
  portrait: string;
  voice: string;
  text: string;
  choices: string[];
}

export interface Snap {
  t: 'snap';
  /** The server's step count after this step. */
  step: number;
  /** The number of the last input of this player the server used. 0 before the first. */
  ack: number;
  /** This player's own body after that input. */
  you: BodyState;
  day: number;
  /** The time of day, 0 to 1. */
  time: number;
  /** Actors near this player that came into range or changed since the last snap. */
  actors?: ActorState[];
  /** Ids of actors that went away or out of range. */
  gone?: string[];
  /** Chunks that came into range, each with all of its changed blocks. They come before `blocks`. */
  chunks?: ChunkEdits[];
  /** Blocks near this player that changed in this step: x, y, z and the new id, four numbers each. */
  blocks?: number[];
  /** Placed things that came into range or were set down. */
  placed?: PlacedState[];
  /** Ids of placed things that were taken away or went out of range. */
  unplaced?: string[];
  /** The rules' state that changed. All of it in the first snap after a welcome. */
  state?: StateCopy;
  /** The weather and the light: `game.ambient` as `AMBIENT_KEYS` lists it, when it changed. */
  air?: number[];
  /** Events of this step this player should hear, in the order they were emitted, after `state` is applied. */
  events?: WireEvent[];
  /** This player's break in progress, when it started, moved on or ended (null). */
  breaking?: Breaking | null;
  /** This player's conversation, when its line changed or it ended (null). */
  talk?: Line | null;
  /** Placed things this player used in this step: a workbench or a chest whose panel opens for them. */
  used?: string[];
}

/** The fields of `game.ambient` in `Snap.air`, in order. */
export const AMBIENT_KEYS = ['timeOfDay', 'rain', 'cloud', 'fog', 'wind', 'windDir', 'wetness', 'flash'] as const;

export type ServerMessage = Welcome | Refuse | Snap;

// ---------------------------------------------------------------------------------------- checks

/** The longest token the server reads. A Clerk token is about 1,000 characters. */
const MAX_TOKEN = 8192;
/** The most acts in one input. A player does one or two things in a twentieth of a second. */
export const MAX_ACTS = 8;
/** Block coordinates beyond this are nonsense: the world's chunk keys hold 32,768 chunks each way. */
const MAX_BLOCK = 32768 * 16;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isBlock = (n: unknown): n is number => Number.isInteger(n) && Math.abs(n as number) <= MAX_BLOCK;
const isStep = (n: unknown): n is number => n === -1 || n === 0 || n === 1;
const isSpeed = (n: unknown): n is number => typeof n === 'number' && n >= -1 && n <= 1;
const isIndex = (n: unknown, most: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= most;
/** A recipe's id. Ids are short words; anything longer is nonsense. */
const isName = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64;
/** The slots of the bag: 36. */
const BAG_SLOTS = 36;

function isTarget(v: Record<string, unknown>): boolean {
  return isBlock(v.x) && isBlock(v.y) && isBlock(v.z) && isStep(v.nx) && isStep(v.ny) && isStep(v.nz);
}

function isAct(value: unknown): value is Act {
  if (!isRecord(value)) return false;
  if (value.a === 'slot') return Number.isInteger(value.slot) && (value.slot as number) >= 0 && (value.slot as number) <= 8;
  if (value.a === 'use') return (value.button === 'primary' || value.button === 'secondary') && isTarget(value);
  if (value.a === 'hold') return isTarget(value);
  if (value.a === 'interact' || value.a === 'undo') return true;
  if (value.a === 'say') return value.choice === undefined || isIndex(value.choice, 8);
  if (value.a === 'craft') return isName(value.recipe);
  if (value.a === 'move') return isIndex(value.from, BAG_SLOTS - 1) && isIndex(value.to, BAG_SLOTS - 1) && (value.count === undefined || (isIndex(value.count, 999) && (value.count as number) > 0));
  if (value.a === 'build') {
    if (!isRecord(value.at) || !isTarget(value.at)) return false;
    if (value.to !== undefined && (!isRecord(value.to) || !isTarget(value.to))) return false;
    return value.turns === undefined || isIndex(value.turns, 3);
  }
  return false;
}

/** Copies an act with only the fields it names, so nothing else the browser sent reaches the rules. */
function cleanAct(act: Act): Act {
  const target = (t: Target): Target => ({ x: t.x, y: t.y, z: t.z, nx: t.nx, ny: t.ny, nz: t.nz });
  switch (act.a) {
    case 'slot': return { a: 'slot', slot: act.slot };
    case 'use': return { a: 'use', button: act.button, ...target(act) };
    case 'hold': return { a: 'hold', ...target(act) };
    case 'interact': return { a: 'interact' };
    case 'undo': return { a: 'undo' };
    case 'say': return act.choice === undefined ? { a: 'say' } : { a: 'say', choice: act.choice };
    case 'craft': return { a: 'craft', recipe: act.recipe };
    case 'move': return act.count === undefined ? { a: 'move', from: act.from, to: act.to } : { a: 'move', from: act.from, to: act.to, count: act.count };
    case 'build': {
      const out: Act = { a: 'build', at: target(act.at) };
      if (act.to) out.to = target(act.to);
      if (act.turns !== undefined) out.turns = act.turns;
      return out;
    }
  }
}

function isMoves(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== BODY_STEPS * 3) return false;
  for (let i = 0; i < value.length; i += 3) if (!isSpeed(value[i]) || !isSpeed(value[i + 1]) || (value[i + 2] !== 0 && value[i + 2] !== 1)) return false;
  return true;
}

/**
 * Reads what a browser sent. Null for anything that is not exactly a message, so the server never acts on
 * a number that is not a number or a list that is a thousand long.
 */
export function readClientMessage(value: unknown): ClientMessage | null {
  if (!isRecord(value)) return null;
  if (value.t === 'hello') {
    const { build, token } = value;
    if (typeof build !== 'string' || build.length > 64) return null;
    if (typeof token !== 'string' || token.length > MAX_TOKEN) return null;
    return { t: 'hello', build, token };
  }
  if (value.t === 'input') {
    const { n, mx, mz, jump, moves, acts } = value;
    if (!Number.isSafeInteger(n) || (n as number) < 1) return null;
    if (!isSpeed(mx) || !isSpeed(mz) || typeof jump !== 'boolean') return null;
    const input: Input = { t: 'input', n: n as number, mx, mz, jump };
    if (moves !== undefined) {
      if (!isMoves(moves)) return null;
      input.moves = moves.slice();
    }
    if (acts !== undefined) {
      if (!Array.isArray(acts) || acts.length > MAX_ACTS || !acts.every(isAct)) return null;
      if (acts.length > 0) input.acts = (acts as Act[]).map(cleanAct);
    }
    return input;
  }
  return null;
}

/** Reads what the server sent. The browser trusts its server, so this only tells the three kinds apart. */
export function readServerMessage(value: unknown): ServerMessage | null {
  if (!isRecord(value)) return null;
  return value.t === 'welcome' || value.t === 'refuse' || value.t === 'snap' ? (value as unknown as ServerMessage) : null;
}
