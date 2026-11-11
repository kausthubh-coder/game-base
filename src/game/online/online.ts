// An online world in the browser: a copy of the world the server runs.
//
// The browser does not step the rules here. It connects with src/features/net, and from every snap it lays
// the server's changed blocks over its own land, loads the systems' state the server sent into its own
// systems, sets the clock and the weather, and emits the server's events on the bus the views hear
// (relay.ts). Everything a player does that the rules decide goes up as an act in the next input
// (`route`, below): the shell and the views call the same system methods as in solo play and never know.
//
// The player's own hero moves at once (predict.ts). The others are drawn a little in the past (interp.ts).
import { BODY_STEPS, MAX_ACTS, STEPS_PER_SECOND, AMBIENT_KEYS, type Act, type ActorState, type BodyState, type Breaking, type Line, type Refuse, type Snap, type StateCopy, type Target } from '../../engine/net/messages.ts';
import { createNet, type Net, type NetState, type SocketLike } from '../../features/net/index.ts';
import { HeroBody } from '../../features/hero/index.ts';
import { HEIGHT, buildChunk, type World } from '../../features/world/index.ts';
import type { Actor, FlagValue, Game, Placed, Systems, TalkLine, UseContext } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import type { PlayerRig } from '../shell/player.ts';
import { createOthers, createServerClock, type Drawn } from './interp.ts';
import type { Join } from './join.ts';
import { createPredictor, type Steer } from './predict.ts';
import type { Relay } from './relay.ts';

/** A disagreement larger than this, in blocks, is not blended: the hero is put where the server has them. */
const SNAP_AT = 3;
/** Frames kept for a check to read: about half a minute at 60 a second. */
const RECORD = 2000;

/**
 * `signin` while the world waits for a signed-in player. `connecting` until the first snap. `playing` while
 * snaps come. `reconnecting` after a drop or a restart, until the next snap. `refused` when the server said no:
 * `refusal` has its words. `closed` when the same player opened the world somewhere else.
 */
export type OnlineStatus = 'signin' | 'connecting' | 'playing' | 'reconnecting' | 'refused' | 'closed';

export interface OnlinePlayer {
  id: string;
  name: string;
  /** Where they are drawn this frame. */
  at: Readonly<Drawn>;
}

/** The online world as a view sees it: `view.online`. Null in solo play. */
export interface OnlineView {
  readonly world: string;
  readonly status: OnlineStatus;
  readonly refusal: Refuse | null;
  /** The other players in range, with where they are drawn this frame. */
  players(): readonly OnlinePlayer[];
  /** How the world server is asked who this is: a function that returns the player's token. Null when signed out. */
  setToken(token: (() => string | Promise<string>) | null): void;
  /** True when the address gave a dev name, so no account is needed. */
  readonly dev: boolean;
  onChange(fn: () => void): () => void;
  /** What a check reads: the connection, the numbers of the prediction and the frames it recorded. */
  debug(frames?: boolean): Record<string, unknown>;
}

export interface Online extends OnlineView {
  /** True once the first snap of this connection is in. Until then the hero stands still. */
  readonly ready: boolean;
  /** Connects, once there is a token. */
  start(): void;
  /** The shell played one body step steered like this. */
  bodyStepped(steer: Steer): void;
  /** One step of the rules came round: the input goes up. */
  step(): void;
  /** Once a frame, after the hero's drawn position is set and before the camera follows it. */
  frame(dt: number): void;
  readonly net: Net;
}

export interface OnlineParts {
  join: Join;
  game: Game;
  kernel: Kernel;
  sim: World;
  player: PlayerRig;
  relay: Relay;
  /** Puts the hero somewhere at once, with the land there loaded and the camera on them. */
  place(x: number, y: number, z: number, facing: number): void;
  /** Where the hero's feet are drawn. */
  drawn: Readonly<{ x: number; y: number; z: number }>;
  /** The page's clock, in seconds. */
  now?: () => number;
  /** Opens a socket. The page's WebSocket when left out. */
  socket?: (url: string) => SocketLike;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const sign = (n: number): number => (n > 0.5 ? 1 : n < -0.5 ? -1 : 0);

/** A hit as an act's target: whole blocks and a face that is a step along one axis. Null when it is not one. */
function targetOf(hit: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null): Target | null {
  if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y) || !Number.isFinite(hit.z)) return null;
  return { x: Math.floor(hit.x), y: Math.floor(hit.y), z: Math.floor(hit.z), nx: sign(hit.nx), ny: sign(hit.ny), nz: sign(hit.nz) };
}

export function createOnline(parts: OnlineParts): Online {
  const { join, game, kernel, sim, player, relay } = parts;
  const now = parts.now ?? ((): number => performance.now() / 1000);
  const sys = game.systems as Partial<Systems>;
  const flagValues = (game.flags as { values?: Map<string, FlagValue> }).values ?? new Map<string, FlagValue>();

  let token: (() => string | Promise<string>) | null = null;
  let wanted = false, ready = false, everOpen = false;
  let status: OnlineStatus = 'connecting';
  const changeListeners = new Set<() => void>();
  let bytesIn = 0, messagesIn = 0, snaps = 0, openedAt = 0, welcomes = 0;

  const net = createNet(null, {
    url: join.url,
    token: () => (token ? token() : Promise.reject(new Error('no token'))),
    socket: (url) => {
      const socket = parts.socket ? parts.socket(url) : (new WebSocket(url) as unknown as SocketLike);
      // Counted beside the client's own handler, which `createNet` sets once the socket is made.
      const counted = socket as SocketLike & { addEventListener?: (type: string, fn: (event: { data: unknown }) => void) => void };
      counted.addEventListener?.('message', (event) => {
        messagesIn++;
        bytesIn += typeof event.data === 'string' ? event.data.length : event.data instanceof ArrayBuffer ? event.data.byteLength : 0;
      });
      return socket;
    },
  });

  function setStatus(next: OnlineStatus): void {
    if (next === status) return;
    status = next;
    for (const fn of [...changeListeners]) fn();
  }

  function connect(): void {
    if (!wanted) return;
    if (!token) {
      setStatus('signin');
      return;
    }
    if (net.state === 'idle' || net.state === 'closed' || net.state === 'refused') {
      setStatus(everOpen ? 'reconnecting' : 'connecting');
      net.connect();
    }
  }

  // ------------------------------------------------------------------------------ acts
  const acts: Act[] = [];
  /** True while the server's state is being loaded: a system calling another then is not the player. */
  let applying = false;
  const send = (act: Act): void => {
    if (applying || !ready) return;
    acts.push(act);
  };

  let breaking: Breaking | null = null;
  let talk: Line | null = null;
  const useListeners = new Set<(placed: Placed) => void>();
  /** What the pointer was last given in build mode, and where the button went down. */
  let pointed: Target | null = null, pressedAt: Target | null = null;

  /** Points the systems' methods that change the world at the server. What they return is this browser's best guess. */
  function route(): void {
    const inventory = sys.inventory;
    if (inventory) {
      const slot = Object.getOwnPropertyDescriptor(inventory, 'selected');
      if (slot?.get && slot.set) {
        const get = slot.get.bind(inventory), set = slot.set.bind(inventory);
        Object.defineProperty(inventory, 'selected', {
          configurable: true, enumerable: true, get,
          // The slot in hand shows at once, and the server is told.
          set(n: number) {
            set(n);
            send({ a: 'slot', slot: get() as number });
          },
        });
      }
      const move = inventory.move.bind(inventory);
      inventory.move = (from, to, count) => {
        if (applying) return move(from, to, count);
        send(count === undefined ? { a: 'move', from, to } : { a: 'move', from, to, count });
      };
    }
    const actions = sys.actions;
    if (actions) {
      const use = actions.use.bind(actions), hold = actions.hold.bind(actions);
      actions.use = (context: UseContext) => {
        if (applying) return use(context);
        const target = targetOf(context.hit);
        if (target) send({ a: 'use', button: context.button, ...target });
        return false;
      };
      actions.hold = (context: UseContext, dt: number) => {
        if (applying) return hold(context, dt);
        const target = targetOf(context.hit);
        if (target) send({ a: 'hold', ...target });
        return false;
      };
      actions.breaking = () => breaking;
    }
    const interact = sys.interact;
    if (interact) {
      interact.act = () => {
        const near = interact.nearest() !== null;
        if (near) send({ a: 'interact' });
        return near;
      };
    }
    const crafting = sys.crafting;
    if (crafting) {
      crafting.make = (id) => {
        const can = crafting.canMake(id);
        if (can) send({ a: 'craft', recipe: id });
        return can;
      };
    }
    const talking = sys.talk;
    if (talking) {
      Object.defineProperty(talking, 'active', { configurable: true, enumerable: true, get: () => talk !== null });
      talking.current = () => talk as TalkLine | null;
      talking.advance = () => { if (talk) send({ a: 'say' }); };
      talking.choose = (index) => { if (talk) send({ a: 'say', choice: index }); };
      // A conversation starts on the server, from E or from the story.
      talking.start = () => undefined;
      talking.talkTo = () => undefined;
    }
    const placeables = sys.placeables;
    if (placeables?.onUse) {
      const onUse = placeables.onUse.bind(placeables);
      placeables.onUse = (listener) => {
        useListeners.add(listener);
        const off = onUse(listener);
        return () => {
          useListeners.delete(listener);
          off();
        };
      };
    }
    const build = sys.build;
    if (build) {
      // Build mode itself, the pointer and the plan, stay in this browser. A stroke goes up whole when the
      // button comes up, and the server lays it.
      const point = build.point.bind(build), press = build.press.bind(build), release = build.release.bind(build), cancel = build.cancel.bind(build);
      build.point = (at) => {
        pointed = targetOf(at);
        point(at);
      };
      build.press = () => {
        if (!build.active || !pointed) return false;
        const plan = build.plan();
        if (plan?.lift) {
          send({ a: 'build', at: pointed });
          return true;
        }
        const started = press();
        if (started) pressedAt = pointed;
        return started;
      };
      build.release = () => {
        if (!build.dragging) return release();
        const plan = build.plan();
        const at = pressedAt, to = pointed ?? pressedAt;
        cancel();
        pressedAt = null;
        if (!plan || !at || !to) return 0;
        const act: Act = { a: 'build', at, to };
        if (plan.tool.kind === 'place') act.turns = plan.turns & 3;
        send(act);
        return plan.ok;
      };
      build.undo = () => {
        send({ a: 'undo' });
        return true;
      };
    }
    // The clock and the weather are the server's.
    const time = sys.time;
    if (time) {
      time.sleep = () => undefined;
      time.setTimeOfDay = () => undefined;
      time.setWeather = () => undefined;
    }
  }
  route();

  // ------------------------------------------------------------------------------ the copy
  const others = createOthers();
  const clock = createServerClock(STEPS_PER_SECOND);
  const ghost = new HeroBody(sim, { x: 0, y: 0, z: 0 }, undefined, player.body.tuning);
  const predictor = createPredictor(ghost);
  let snapped = 0;
  /** The last body the server sent, for a check. */
  let server: BodyState | null = null;

  /** Loads systems' saves into this browser's systems, with the flags as they are and the hero where they are. */
  function load(systems: Record<string, unknown>, flags: [string, FlagValue][] | null): void {
    const p = game.player;
    const keep = sys.inventory?.selected ?? 0;
    applying = true;
    try {
      relay.quietly(() => kernel.load({
        version: 1,
        flags: flags ?? [...flagValues],
        player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, facing: p.facing },
        clock: { ...game.clock },
        systems,
      }));
      // The bag is the world's; the slot in hand is this player's.
      if (sys.inventory && 'inventory' in systems) sys.inventory.selected = keep;
    } finally {
      applying = false;
    }
  }

  function takeState(state: StateCopy): void {
    let flags: [string, FlagValue][] | null = null;
    if (state.flags) {
      // A flag a view set for itself, such as having seen a hint, stays; the server's flags are laid over it.
      const merged = new Map(flagValues);
      for (const [key, value] of state.flags) merged.set(key, value);
      flags = [...merged];
    }
    load(state.systems ?? {}, flags);
  }

  /** The placed things in range, as the snaps added them up, into this browser's placeables. */
  function takePlaced(): void {
    const placed = [...net.near.placed.values()].map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y, z: p.z, quarterTurns: p.turns }));
    load({ placeables: { next: 1, placed } }, null);
  }

  /** Blocks the server changed, put into this browser's land. A chunk that is not in memory is made first, so no change is lost. */
  function setBlock(x: number, y: number, z: number, id: number): void {
    if (!sim.chunkAt(x >> 4, z >> 4)) sim.load(x >> 4, z >> 4);
    sim.setBlock(x, y, z, id);
  }

  /**
   * After a drop the server may have lost what it had not saved, as after a restart. A cell this browser
   * changed that the server does not have changed goes back to the land the seed makes, in the chunks the
   * first snap told of and the chunks around the hero that it did not name.
   */
  let staleEdits: Map<number, Map<number, number>> | null = null;
  const chunkKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);
  function dropStale(snap: Snap): void {
    const before = staleEdits;
    staleEdits = null;
    if (!before) return;
    const told = new Map<number, Set<number>>();
    for (const [cx, cz, cells] of snap.chunks ?? []) {
      const set = new Set<number>();
      for (let i = 0; i < cells.length; i += 2) set.add(cells[i]);
      told.set(chunkKey(cx, cz), set);
    }
    const hx = Math.floor(snap.you.x) >> 4, hz = Math.floor(snap.you.z) >> 4;
    for (const [key, cells] of before) {
      const cx = Math.floor(key / 65536) - 32768, cz = (key % 65536) - 32768;
      // The server tells of every changed chunk within 8 of the player. Beyond that this browser cannot tell.
      if (Math.abs(cx - hx) > 8 || Math.abs(cz - hz) > 8) continue;
      const kept = told.get(key);
      let land: Uint8Array | null = null;
      for (const [cell] of cells) {
        if (kept?.has(cell)) continue;
        land ??= buildChunk(sim.seed, cx, cz, null).blocks;
        const y = cell % HEIGHT, col = (cell - y) / HEIGHT;
        setBlock(cx * 16 + (col >> 4), y, cz * 16 + (col & 15), land[cell]);
      }
    }
  }

  function takeBlocks(snap: Snap): void {
    if (snap.chunks) {
      for (const [cx, cz, cells] of snap.chunks) {
        for (let i = 0; i < cells.length; i += 2) {
          const cell = cells[i], y = cell % HEIGHT, col = (cell - y) / HEIGHT;
          setBlock(cx * 16 + (col >> 4), y, cz * 16 + (col & 15), cells[i + 1]);
        }
      }
    }
    if (snap.blocks) for (let i = 0; i < snap.blocks.length; i += 4) setBlock(snap.blocks[i], snap.blocks[i + 1], snap.blocks[i + 2], snap.blocks[i + 3]);
  }

  let firstSnap = true;
  net.onState((state: NetState) => {
    if (state === 'open') {
      welcomes++;
      openedAt = now();
      firstSnap = true;
      // A second welcome: lay the server's land over this browser's again, and forget what it had not answered.
      if (everOpen) {
        const edits = new Map<number, Map<number, number>>();
        for (const [cx, cz, cells] of sim.save().edits) {
          const map = new Map<number, number>();
          for (let i = 0; i < cells.length; i += 2) map.set(cells[i], cells[i + 1]);
          edits.set(chunkKey(cx, cz), map);
        }
        staleEdits = edits;
      }
      everOpen = true;
      others.clear();
      predictor.reset();
    } else if (state === 'waiting' || state === 'connecting') {
      ready = false;
      acts.length = 0;
      if (everOpen) setStatus('reconnecting');
    } else if (state === 'refused') {
      ready = false;
      setStatus('refused');
    } else if (state === 'closed') {
      ready = false;
      setStatus('closed');
    }
  });

  net.onSnap((snap) => {
    snaps++;
    clock.heard(snap.step, now());
    applying = true;
    try {
      relay.quietly(() => takeBlocks(snap));
      if (firstSnap) dropStale(snap);
    } finally {
      applying = false;
    }
    if (snap.placed || snap.unplaced || firstSnap) takePlaced();
    if (snap.state) takeState(snap.state);

    game.clock.day = snap.day;
    game.clock.timeOfDay = snap.time;
    game.clock.seconds = snap.step / STEPS_PER_SECOND;
    if (snap.air) {
      const ambient = game.ambient as unknown as Record<string, number>;
      AMBIENT_KEYS.forEach((key, i) => { ambient[key] = snap.air![i]; });
    }
    others.take(snap.step, snap.actors, snap.gone);

    if ('breaking' in snap) breaking = snap.breaking ?? null;
    if ('talk' in snap) {
      const was = talk !== null;
      talk = snap.talk ?? null;
      // The rules hold the player while a conversation is open, as the talk system does in solo play.
      if (was !== (talk !== null)) game.player.busy = talk !== null;
    }

    server = snap.you;
    if (firstSnap) {
      firstSnap = false;
      parts.place(snap.you.x, snap.you.y, snap.you.z, snap.you.facing);
      player.correct(snap.you);
      predictor.reset();
      ready = true;
      // A new connection starts with the first quick slot in the server's hand.
      send({ a: 'slot', slot: sys.inventory?.selected ?? 0 });
      setStatus('playing');
    } else {
      const at = predictor.answer(snap.ack, snap.you);
      if (at) {
        const body = player.body;
        if (Math.hypot(at.x - body.x, at.y - body.y, at.z - body.z) > SNAP_AT) {
          snapped++;
          parts.place(at.x, at.y, at.z, at.facing);
        }
        player.correct(at);
      }
    }

    for (const id of snap.used ?? []) {
      const placed = sys.placeables?.all().find((p) => p.id === id);
      if (placed) for (const listener of [...useListeners]) listener(placed);
    }
    for (const [name, data] of snap.events ?? []) relay.fromServer(name, data);
  });

  // ------------------------------------------------------------------------------ drawing the others
  /** Actors this file made, for players and creatures the browser's own systems do not have. */
  const made = new Set<string>();
  const drawn: Drawn = { x: 0, y: 0, z: 0, facing: 0 };
  const playersNow: OnlinePlayer[] = [];

  function write(state: ActorState, at: Drawn): void {
    let actor: Actor | undefined = game.actors.get(state.id);
    if (!actor) {
      actor = { id: state.id, sprite: state.sprite, pos: { x: at.x, y: at.y, z: at.z }, facing: at.facing, anim: state.anim, visible: true };
      game.actors.set(state.id, actor);
      made.add(state.id);
    }
    actor.pos.x = at.x; actor.pos.y = at.y; actor.pos.z = at.z;
    actor.facing = at.facing;
    actor.sprite = state.sprite;
    actor.anim = state.anim;
    actor.mark = (state.mark ?? '') as Actor['mark'];
    actor.visible = true;
  }

  // ------------------------------------------------------------------------------ what a check reads
  /** Each frame: when it was drawn, where the hero was drawn, the last input sent and the last one the server had used. */
  const frames = { t: new Float64Array(RECORD), x: new Float32Array(RECORD), y: new Float32Array(RECORD), z: new Float32Array(RECORD), sent: new Int32Array(RECORD), ack: new Int32Array(RECORD), n: 0 };
  let lastSent = 0;

  return {
    get world() { return join.world; },
    get dev() { return join.dev !== null; },
    get status() { return status; },
    get refusal() { return net.refusal; },
    get ready() { return ready && net.state === 'open'; },
    net,

    players: () => playersNow,

    setToken(next) {
      token = next;
      if (!token && status === 'connecting') setStatus('signin');
      connect();
    },

    onChange(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },

    start() {
      wanted = true;
      connect();
    },

    bodyStepped(steer) {
      predictor.stepped(steer);
    },

    step() {
      const moves = predictor.moves();
      if (!ready || net.state !== 'open') {
        acts.length = 0;
        return;
      }
      const body = player.body;
      const n = net.send({ mx: moves[0], mz: moves[1], jump: moves[2] === 1, moves, acts: acts.splice(0, MAX_ACTS) });
      if (n > 0) {
        predictor.sent(n, moves, body);
        lastSent = n;
      }
    },

    frame(dt) {
      net.update(dt, null as never);
      const t = now();
      const i = frames.n++ % RECORD;
      frames.t[i] = t; frames.x[i] = parts.drawn.x; frames.y[i] = parts.drawn.y; frames.z[i] = parts.drawn.z;
      frames.sent[i] = lastSent; frames.ack[i] = net.near.ack;
      if (!clock.known) return;
      const at = clock.at(t);
      playersNow.length = 0;
      for (const track of others.tracks.values()) {
        const where = others.sample(track, at, drawn);
        write(track.state, where);
        if (track.id.startsWith('player:')) playersNow.push({ id: track.id, name: track.state.name ?? '', at: { ...where } });
      }
      for (const [id, actor] of game.actors) {
        if (id === player.actor.id || others.tracks.has(id)) continue;
        if (made.has(id)) {
          game.actors.delete(id);
          made.delete(id);
        } else actor.visible = false;
      }
    },

    debug(withFrames = false) {
      const out: Record<string, unknown> = {
        world: join.world, status, net: net.state, ready: ready && net.state === 'open', refusal: net.refusal,
        welcomes, snaps, messagesIn, bytesIn, seconds: round(now() - openedAt),
        step: net.near.step, ack: net.near.ack, waiting: predictor.waiting,
        prediction: { ...predictor.stats, snapped },
        server: server ? { x: server.x, y: server.y, z: server.z } : null,
        drawn: { x: parts.drawn.x, y: parts.drawn.y, z: parts.drawn.z },
        body: { x: player.body.x, y: player.body.y, z: player.body.z, speed: round(Math.hypot(player.body.vx, player.body.vz)) },
        others: [...others.tracks.keys()],
        players: playersNow.map((p) => ({ id: p.id, name: p.name, x: round(p.at.x), y: round(p.at.y), z: round(p.at.z) })),
        breaking, talk,
        bodySteps: BODY_STEPS,
      };
      if (withFrames) {
        const count = Math.min(frames.n, RECORD), list: number[][] = [];
        for (let k = frames.n - count; k < frames.n; k++) {
          const j = k % RECORD;
          list.push([round(frames.t[j]), round(frames.x[j]), round(frames.y[j]), round(frames.z[j]), frames.sent[j], frames.ack[j]]);
        }
        out.frames = list;
      }
      return out;
    },
  };
}
