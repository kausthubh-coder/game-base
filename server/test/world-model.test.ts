// Holds the world server to its model. docs/verify/world-join/WorldJoin.tla is the design of joining and
// leaving a world and of the world's card, and a checker has walked every order of its events. That says the
// design keeps its rules. It says nothing about this code. So this test plays random runs of the same events
// on the real WorldServer of server/world.ts, and after every event compares it with `Model` below, which is
// WorldJoin.tla's actions written again in TypeScript, and checks WorldJoin.tla's rules on the real server.
//
// world.ts runs as it is. Stand-ins play what is around it: the browser's tabs (net.ts as WorldJoin.tla
// writes it), the Durable Object's runtime (sockets, timers, the clock, storage), Convex (mayEnter's answer,
// and writeCard's rule for an old card, which convex/world-card-model.test.ts holds to the same model), and
// the room: `standInRoom` keeps room.ts's join and leave and nothing else, and the last test here holds the
// real room to it.
//
// When you change how a player joins or leaves, how the world sleeps, or how a card is posted, change
// WorldJoin.tla and `Model` with it. `.agents/skills/verify-world-join` has the steps.
import { Database } from 'bun:sqlite';
import { describe, expect, mock, test } from 'bun:test';
import { BUILD } from '../../src/engine/net/version.ts';
import { createRandom } from '../../src/game/kernel.sim.ts';
import type { WorldCard } from '../gate.ts';
import * as rooms from '../room.ts';
import type { Room, RoomSave } from '../room.ts';

// ---------------------------------------------------------------------------------------- the stand-ins

/** room.ts's join and leave: one body for each user, the user taken out first, null when the world is full. */
class StandInRoom {
  readonly players = new Map<string, string>();
  readonly world = { seed: 7 };
  readonly changes = 0;
  steps: number;
  constructor(save: RoomSave | null, readonly cap: number) { this.steps = save?.steps ?? 0; }
  get playerCount(): number { return this.players.size; }
  has(user: string): boolean { return this.players.has(user); }
  who(): { id: string; name: string }[] { return [...this.players].map(([id, name]) => ({ id, name })); }
  join(user: string, name: string): string | null {
    this.players.delete(user);
    if (this.players.size >= this.cap) return null;
    this.players.set(user, name);
    return `player:${user}`;
  }
  leave(user: string): void { this.players.delete(user); }
  input(): void {}
  step(): void { this.steps++; }
  snap(): null { return null; }
  save(): RoomSave { return { version: 1, steps: this.steps, world: { version: 1, seed: 7, edits: [] }, game: {} as RoomSave['game'], places: {} }; }
  stats() { return { steps: this.steps, players: this.players.size, chunks: 0, editedChunks: 0 }; }
}

// world.ts makes its room with room.ts's createRoom. The module is swapped for one that hands out the stand-in
// while `standIn` is set, and the real room otherwise, so the other test files that share this process are not
// touched. The Workers runtime's module is not there in Bun at all: DurableObject only keeps ctx and env.
const realRooms = { ...rooms };
let standIn: ((save: RoomSave | null) => Room) | null = null;
mock.module('../room.ts', () => ({ ...realRooms, createRoom: (save: RoomSave | null = null) => (standIn ?? realRooms.createRoom)(save) }));
mock.module('cloudflare:workers', () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env; }
  },
}));

/** The part of world.ts's WorldServer the test calls, and the fields it reads to compare. */
interface WorldServer {
  fetch(request: Request): Promise<Response>;
  webSocketMessage(ws: unknown, data: string): Promise<void>;
  webSocketClose(ws: unknown): Promise<void>;
}
interface Inside {
  room: StandInRoom | null;
  sessions: Map<FakeSocket, { user: string | null; checking: boolean; helloTimer: unknown }>;
  sockets: Map<string, FakeSocket>;
  timer: unknown;
}
// The path is a variable so that the test's type check does not follow world.ts into the Workers types.
const worldFile = '../world.ts';
const { WorldServer } = (await import(worldFile)) as { WorldServer: new (ctx: unknown, env: unknown) => WorldServer };

const ENV = {
  DEV_TOKENS: '1', DEV_TOOLS: '0',
  CONVEX_URL: 'https://world-model.convex.cloud', CONVEX_SITE_URL: 'https://world-model.convex.site', WORLD_SERVER_SECRET: 's',
  CLERK_ISSUER: '', CLERK_AUDIENCE: '', CLERK_PARTIES: '',
};
const STEP_MS = 50, HELLO_MS = 10_000, STEPS_PER_SECOND = 20, CARD_EVERY = 300 * STEPS_PER_SECOND, QUIET_STEPS = 15 * STEPS_PER_SECOND;

/** The server's end of one socket. The browser's end is the model's. */
class FakeSocket {
  code: number | null = null;
  welcomed = false;
  constructor(readonly id: string) {}
  send(wire: string): void {
    if (this.code !== null) throw new Error('closed');
    if ((JSON.parse(wire) as { t: string }).t === 'welcome') this.welcomed = true;
  }
  close(code: number): void {
    if (this.code !== null) throw new Error('closed');
    this.code = code;
  }
  serializeAttachment(): void {}
}

/** What a close code makes net.ts do, in WorldJoin.tla's words: 4000 and 4001 stop, 4002 and 4003 connect again. */
const codeOf = (code: number | null): Code => (code === null ? 'none' : code === 4000 || code === 4001 ? 'stop' : 'again');

// ---------------------------------------------------------------------------------------- the model

type Sess = 'none' | 'waiting' | 'checking' | 'in';
type Code = 'none' | 'stop' | 'again';
type Mode = 'idle' | 'connecting' | 'in' | 'stopped';
interface Sock { id: string; tab: string; user: string; up: boolean; told: Code; helloDue: boolean; closeDue: boolean; sess: Sess; asking: boolean }

const TABS = ['a1', 'a2', 'b1'];
const userOf = (tab: string): string => tab[0];

/** WorldJoin.tla, action by action. The names are the model's. Each action returns false when it cannot happen now. */
class Model {
  page = new Map(TABS.map((t) => [t, 'shut' as 'shut' | 'open']));
  mode = new Map(TABS.map((t) => [t, 'idle' as Mode]));
  conn = new Map(TABS.map((t) => [t, 0]));
  /** Every socket, in the order they were opened, which is the order of world.ts `sessions` too. */
  socks = new Map<string, Sock>();
  room = new Set<string>();
  sockOf = new Map<string, string>();
  stepping = false;
  posts: string[][] = [];
  card: string[] = [];
  /** How often each thing worth testing happened, so the test can say its runs reached it. */
  seen = { joined: 0, replaced: 0, full: 0, refused: 0, lateAnswer: 0, forgotten: 0, helloTimeout: 0, quietDrop: 0, periodic: 0, slept: 0, restart: 0, lost: 0, settled: 0 };
  /** `troubles` lets the world restart and card posts fail. */
  constructor(readonly cap: number, readonly tries: number, readonly troubles: boolean) {}

  cur(t: string): Sock | undefined { return this.socks.get(`${t}.${this.conn.get(t)}`); }
  private post(players: Iterable<string>): void { this.posts.push([...players].sort()); }
  private told(s: Sock, code: Code): void { if (s.up && s.told === 'none') s.told = code; }
  private gone(s: Sock): void {
    const u = s.user;
    if (s.sess === 'in' && this.sockOf.get(u) === s.id) {
      s.sess = 'none';
      this.room.delete(u);
      this.sockOf.delete(u);
      if (this.room.size === 0) { this.stepping = false; this.seen.slept++; }
      this.post(this.room);
    } else s.sess = 'none';
  }
  private end(s: Sock, code: Code): void { this.told(s, code); this.gone(s); }

  openPage(t: string): boolean {
    if (this.page.get(t) !== 'shut') return false;
    this.page.set(t, 'open');
    this.mode.set(t, 'idle');
    return true;
  }
  connect(t: string): Sock | null {
    if (this.page.get(t) !== 'open' || this.mode.get(t) !== 'idle' || this.socks.size >= this.tries) return null;
    const n = (this.conn.get(t) ?? 0) + 1;
    this.conn.set(t, n);
    this.mode.set(t, 'connecting');
    const s: Sock = { id: `${t}.${n}`, tab: t, user: userOf(t), up: true, told: 'none', helloDue: true, closeDue: false, sess: 'waiting', asking: false };
    this.socks.set(s.id, s);
    return s;
  }
  private letGo(t: string, heard: boolean): Sock | null {
    const s = this.cur(t);
    if (!s || (this.mode.get(t) !== 'connecting' && this.mode.get(t) !== 'in')) return null;
    s.up = false;
    s.told = 'none';
    s.closeDue = heard;
    this.mode.set(t, 'idle');
    return s;
  }
  closePage(t: string, heard: boolean): boolean {
    if (this.page.get(t) !== 'open') return false;
    this.page.set(t, 'shut');
    this.letGo(t, heard);
    return true;
  }
  drop(t: string, heard: boolean): boolean { return this.page.get(t) === 'open' && this.letGo(t, heard) !== null; }
  hearClose(t: string): boolean {
    const s = this.cur(t);
    if (!s || (this.mode.get(t) !== 'connecting' && this.mode.get(t) !== 'in') || s.told === 'none') return false;
    this.mode.set(t, s.told === 'stop' ? 'stopped' : 'idle');
    s.up = false;
    s.told = 'none';
    return true;
  }
  talk(t: string): boolean {
    const s = this.cur(t);
    if (!s || this.mode.get(t) !== 'in' || !s.up || s.told !== 'none' || s.sess !== 'none') return false;
    this.end(s, 'again');
    this.seen.forgotten++;
    return true;
  }
  helloArrives(s: Sock): void {
    s.helloDue = false;
    if (s.sess === 'waiting') { s.sess = 'checking'; s.asking = true; }
    else { this.end(s, 'again'); this.seen.forgotten++; }
  }
  answer(s: Sock, ok: boolean): void {
    s.asking = false;
    const u = s.user;
    if (!ok) { this.end(s, 'stop'); this.seen.refused++; return; }
    if (s.sess !== 'checking') { this.seen.lateAnswer++; return; }
    const before = this.sockOf.get(u);
    if (before !== undefined && before !== s.id) {
      const old = this.socks.get(before) as Sock;
      this.told(old, 'stop');
      old.sess = 'none';
      this.seen.replaced++;
    }
    this.room.delete(u);
    if (this.room.size >= this.cap) { this.told(s, 'stop'); s.sess = 'none'; this.seen.full++; return; }
    this.room.add(u);
    s.sess = 'in';
    this.sockOf.set(u, s.id);
    this.stepping = true;
    if (s.up) this.mode.set(s.tab, 'in');
    this.post(this.room);
    this.seen.joined++;
  }
  closeArrives(s: Sock): void { s.closeDue = false; this.gone(s); }
  helloTimeout(s: Sock): void { this.end(s, 'again'); this.seen.helloTimeout++; }
  quietDrop(s: Sock): void { this.end(s, 'again'); this.seen.quietDrop++; }
  cardTimer(): void { this.post(this.room); this.seen.periodic++; }
  restart(): void {
    for (const s of this.socks.values()) { s.sess = 'none'; s.asking = false; }
    this.room.clear();
    this.sockOf.clear();
    this.stepping = false;
    this.seen.restart++;
  }
  land(i: number): void { this.card = this.posts[i]; this.posts = this.posts.slice(i + 1); }
  lost(i: number): void { this.posts.splice(i, 1); this.seen.lost++; }

  get settled(): boolean {
    if (this.posts.length > 0) return false;
    for (const s of this.socks.values()) {
      if (s.helloDue || s.closeDue || s.asking || s.told !== 'none') return false;
      if (s.sess !== 'none' && !(s.up && this.cur(s.tab) === s && this.mode.get(s.tab) === 'in')) return false;
    }
    if (TABS.some((t) => this.mode.get(t) === 'in' && this.cur(t)?.sess !== 'in')) return false;
    return TABS.every((t) => this.page.get(t) === 'shut' || this.mode.get(t) === 'in' || this.mode.get(t) === 'stopped');
  }
}

// ---------------------------------------------------------------------------------------- the real server

/** A post on its way to Convex. */
interface Posted { card: WorldCard; players: string[]; settle(ok: boolean): void; settled: boolean }

/** world.ts in its stand-in runtime, driven by the same events as the model. */
class Real {
  readonly db = new Database(':memory:');
  server!: WorldServer;
  room: StandInRoom | null = null;
  readonly socks = new Map<string, FakeSocket>();
  /** The mayEnter question each socket's hello is waiting on, and the hello's handler. */
  readonly asked = new Map<string, (answer: Response) => void>();
  readonly handlers = new Map<string, Promise<void>>();
  readonly helloTimers = new Map<string, number>();
  readonly timers = new Map<number, { run: () => void; ms: number }>();
  readonly posts: Posted[] = [];
  /** Convex's card: worlds.playersNow and worlds.cardAt. */
  convex = { players: [] as string[], cardAt: undefined as number | undefined };
  clock = 1_800_000_000_000;
  /** The room's step at the last card, as world.ts `cardAt`. */
  lastCardStep = 0;
  private nextTimer = 1;
  private hearing: string | null = null;

  constructor(readonly cap: number) {
    this.start();
  }

  get inside(): Inside { return this.server as unknown as Inside; }

  /** A new Durable Object on the same storage: the first, or the one after a restart. */
  start(): void {
    const ctx = {
      id: { name: 'w1' },
      storage: { sql: { exec: (query: string, ...bindings: (string | number | null)[]) => { const rows = this.db.query(query).all(...bindings) as Record<string, unknown>[]; return { toArray: () => rows }; } }, transactionSync: (run: () => void) => this.db.transaction(run)() },
      acceptWebSocket: () => undefined,
      waitUntil: () => undefined,
      getWebSockets: () => [],
    };
    this.server = new WorldServer(ctx, ENV);
  }

  /** Runs `body` with this run's runtime in place of Bun's: timers, the clock, fetch, WebSocketPair, Response. */
  static install(real: () => Real): () => void {
    const g = globalThis as Record<string, unknown>;
    const kept = { setTimeout: g.setTimeout, clearTimeout: g.clearTimeout, fetch: g.fetch, now: Date.now, createRoom: standIn, log: console.log, error: console.error };
    // world.ts and gate.ts log every join, leave and failed post.
    console.log = console.error = () => undefined;
    g.setTimeout = (run: () => void, ms: number) => real().addTimer(run, ms);
    g.clearTimeout = (id: number) => { real().timers.delete(id); };
    Date.now = () => real().clock;
    g.fetch = (url: string, init: RequestInit) => real().fetch(url, init);
    standIn = (save) => real().wake(save);
    return () => {
      g.setTimeout = kept.setTimeout;
      g.clearTimeout = kept.clearTimeout;
      g.fetch = kept.fetch;
      Date.now = kept.now;
      standIn = kept.createRoom;
      console.log = kept.log;
      console.error = kept.error;
    };
  }

  addTimer(run: () => void, ms: number): number {
    const id = this.nextTimer++;
    this.timers.set(id, { run, ms });
    if (ms === HELLO_MS && this.hearing !== null) this.helloTimers.set(this.hearing, id);
    return id;
  }

  wake(save: RoomSave | null): Room {
    this.room = new StandInRoom(save, this.cap);
    this.lastCardStep = this.room.steps;
    return this.room as unknown as Room;
  }

  fetch(url: string, init: RequestInit): Promise<Response> {
    if (url.endsWith('/api/query')) {
      const id = this.hearing;
      if (id === null) throw new Error('mayEnter was asked outside a hello');
      return new Promise((resolve) => this.asked.set(id, resolve));
    }
    if (url.endsWith('/world-server/card')) {
      const card = JSON.parse(String(init.body)) as WorldCard;
      this.lastCardStep = this.room?.steps ?? 0;
      return new Promise((resolve) => {
        const posted: Posted = {
          card, players: card.playersNow.map((p) => p.replace('p_', '')).sort(), settled: false,
          settle: (ok) => {
            posted.settled = true;
            // worlds.ts writeCard: a card made before the one it holds changes only lastPlayedAt.
            if (ok && !(this.convex.cardAt !== undefined && card.sentAt < this.convex.cardAt)) this.convex = { players: posted.players, cardAt: card.sentAt };
            resolve(new Response(ok ? '{"ok":true}' : 'down', { status: ok ? 200 : 500 }));
          },
        };
        this.posts.push(posted);
      });
    }
    throw new Error(`an unexpected fetch: ${url}`);
  }

  /** Posts Convex would still take, oldest first. */
  get freshPosts(): Posted[] {
    const at = this.convex.cardAt;
    return this.posts.filter((p) => !p.settled && (at === undefined || p.card.sentAt >= at));
  }

  async connect(id: string): Promise<void> {
    const g = globalThis as Record<string, unknown>;
    const kept = { pair: g.WebSocketPair, response: g.Response };
    const server = new FakeSocket(id);
    this.socks.set(id, server);
    g.WebSocketPair = class { 0 = new FakeSocket(`${id} browser`); 1 = server; };
    // A Response of status 101 is the Workers runtime's own.
    g.Response = class { constructor(readonly body: unknown, readonly init: unknown) {} };
    this.hearing = id;
    try {
      await this.server.fetch(new Request('https://game.test/world/w1', { headers: { Upgrade: 'websocket' } }));
    } finally {
      this.hearing = null;
      g.WebSocketPair = kept.pair;
      g.Response = kept.response;
    }
  }

  async hello(id: string): Promise<void> {
    const ws = this.socks.get(id) as FakeSocket;
    this.hearing = id;
    let done = false;
    const handler = this.server.webSocketMessage(ws, JSON.stringify({ t: 'hello', build: BUILD, token: `dev:${userOf(id)}` })).then(() => { done = true; });
    this.handlers.set(id, handler);
    // The token check answers at once. Wait until the hello asks Convex, or is over.
    for (let i = 0; i < 100 && !done && !this.asked.has(id); i++) await Promise.resolve();
    this.hearing = null;
    if (!done && !this.asked.has(id)) throw new Error(`the hello on ${id} neither asked Convex nor ended`);
  }

  async answer(id: string, ok: boolean): Promise<void> {
    const resolve = this.asked.get(id);
    if (!resolve) throw new Error(`the hello on ${id} is not waiting on Convex`);
    this.asked.delete(id);
    const user = userOf(id);
    resolve(Response.json({ status: 'success', value: ok ? { allowed: true, role: 'member', playerId: `p_${user}`, playerName: user.toUpperCase(), worldName: 'W', kind: 'online' } : { allowed: false, reason: 'notAllowed' } }));
    await this.handlers.get(id);
  }

  async input(id: string): Promise<void> {
    await this.server.webSocketMessage(this.socks.get(id) as FakeSocket, JSON.stringify({ t: 'input', n: 1, mx: 0, mz: 0, jump: false }));
  }

  async close(id: string): Promise<void> { await this.server.webSocketClose(this.socks.get(id) as FakeSocket); }

  fire(timer: number): void {
    const t = this.timers.get(timer);
    if (!t) throw new Error('that timer is not set');
    this.timers.delete(timer);
    t.run();
  }

  /** The tick timer: the one that is not a hello timer. */
  get tickTimer(): number | undefined {
    for (const [id, t] of this.timers) if (t.ms !== HELLO_MS) return id;
    return undefined;
  }

  /** One tick, which plays one step. */
  tick(): void {
    const timer = this.tickTimer;
    if (timer === undefined) throw new Error('the world is not stepping');
    this.clock += STEP_MS;
    this.fire(timer);
  }

  restart(): void {
    // The old object is gone with its timers and its awaits. Posts it sent still land.
    this.timers.clear();
    this.helloTimers.clear();
    this.asked.clear();
    this.room = null;
    // The clock has passed every stamp the old object made: WorldJoin.tla takes that as given.
    this.clock += 1_000_000;
    this.start();
  }

  /** The real server in the model's words. */
  read(model: Model) {
    const inside = this.inside;
    const sess: Record<string, string> = {};
    for (const [id, ws] of this.socks) {
      const s = inside.sessions.get(ws);
      const kind = !s ? 'none' : s.user !== null ? 'in' : s.checking ? 'checking' : 'waiting';
      const timer = this.helloTimers.get(id);
      sess[id] = kind + (timer !== undefined && this.timers.has(timer) ? ' with its hello timer' : '');
    }
    const told: Record<string, string> = {};
    for (const [id, s] of model.socks) if (s.up) told[id] = codeOf((this.socks.get(id) as FakeSocket).code);
    const sockOf: Record<string, string> = {};
    for (const [user, ws] of [...inside.sockets].sort()) sockOf[user.replace('dev_', '')] = ws.id;
    return {
      sess, told, sockOf,
      room: [...(inside.room?.players.keys() ?? [])].map((u) => u.replace('dev_', '')).sort(),
      stepping: inside.timer !== null,
      card: this.convex.players,
      posts: this.freshPosts.map((p) => p.players),
      welcomed: TABS.filter((t) => model.mode.get(t) === 'in' && model.cur(t)?.up && this.socks.get((model.cur(t) as Sock).id)?.welcomed),
    };
  }
}

/** The model in the same words. */
function readModel(m: Model) {
  const sess: Record<string, string> = {};
  for (const [id, s] of m.socks) sess[id] = s.sess + (s.sess === 'waiting' || s.sess === 'checking' ? ' with its hello timer' : '');
  const told: Record<string, string> = {};
  for (const [id, s] of m.socks) if (s.up) told[id] = s.told;
  return {
    sess, told,
    sockOf: Object.fromEntries([...m.sockOf].sort()),
    room: [...m.room].sort(),
    stepping: m.stepping,
    card: m.card,
    posts: m.posts,
    welcomed: TABS.filter((t) => m.mode.get(t) === 'in' && m.cur(t)?.up),
  };
}

/** WorldJoin.tla's rules, on the real server. Each returns what is wrong, or null. */
function brokenRule(r: Real, m: Model, cardRule: boolean): string | null {
  const inside = r.inside;
  const ins = [...inside.sessions].filter(([, s]) => s.user !== null);
  for (const user of new Set(ins.map(([, s]) => s.user))) {
    if (ins.filter(([, s]) => s.user === user).length > 1) return `OneTabPlaysEachPlayer: two tabs play ${user}`;
  }
  for (const user of inside.room?.players.keys() ?? []) {
    const ws = inside.sockets.get(user);
    if (!ws || inside.sessions.get(ws)?.user !== user) return `NoBodyWithoutATab: ${user} is in the world with no socket the server hears`;
  }
  for (const [ws, s] of ins) {
    if (!inside.room?.has(s.user as string) || inside.sockets.get(s.user as string) !== ws) return `NoTabWithoutABody: ${ws.id} was let in and plays no body`;
  }
  const stepping = inside.timer !== null, someone = (inside.room?.playerCount ?? 0) > 0;
  if (stepping !== someone) return `AwakeExactlyWhileSomeoneIsIn: the world ${stepping ? 'steps with nobody in it' : 'has players and does not step'}`;
  if (cardRule && m.settled) {
    const room = [...(inside.room?.players.keys() ?? [])].map((u) => u.replace('dev_', '')).sort();
    if (JSON.stringify(r.convex.players) !== JSON.stringify(room)) return `CardMatchesTheWorld: the world list shows [${r.convex.players}] and the world holds [${room}]`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------- the events

/** One event, on both. Each returns its words, or null when it cannot happen now. */
type Event = (m: Model, r: Real, pick: <T>(list: T[]) => T) => Promise<string | null> | string | null;

/** The sockets of the model for which `ok` holds. */
const socks = (m: Model, ok: (s: Sock) => boolean): Sock[] => [...m.socks.values()].filter(ok);
/** One of them, or undefined when there is none. */
const any = <T>(pick: (list: T[]) => T, list: T[]): T | undefined => (list.length === 0 ? undefined : pick(list));

/** Every live tab that is in sends its input, as a browser does every step. */
async function keepHeard(m: Model, r: Real): Promise<void> {
  for (const t of TABS) {
    const s = m.cur(t);
    if (s && m.mode.get(t) === 'in' && s.up && s.told === 'none' && s.sess === 'in') await r.input(s.id);
  }
}

/**
 * One tick of the real world, `jump` steps after the last, and the same in the model: dropQuiet() takes out
 * each player whose browser has gone, once 15 seconds have passed, and the 5-minute card goes when it is due.
 */
async function tick(m: Model, r: Real, jump: number): Promise<string> {
  const room = r.room as StandInRoom;
  room.steps += jump;
  await keepHeard(m, r);
  const after = room.steps + 1;
  // world.ts tick(): dropQuiet() on whole seconds, then the card when 5 minutes have passed since the last.
  const dead = socks(m, (s) => s.sess === 'in' && !s.up);
  if (after % STEPS_PER_SECOND === 0 && jump < QUIET_STEPS && dead.length > 0) {
    throw new Error('a short tick on a whole second would leave open whether a quiet player is dropped');
  }
  const quiet = after % STEPS_PER_SECOND === 0 ? dead : [];
  const due = quiet.length === 0 && after - r.lastCardStep >= CARD_EVERY;
  r.tick();
  for (const s of quiet) m.quietDrop(s);
  if (due) m.cardTimer();
  if (quiet.length > 0) return `15 seconds pass: ${quiet.map((s) => s.id).join(', ')} ${quiet.length > 1 ? 'are' : 'is'} dropped for silence`;
  if (due) return '5 minutes pass: the world posts its card';
  return jump > 0 ? `${Math.round(jump / STEPS_PER_SECOND)} seconds pass` : 'the world steps';
}

/** A jump that brings the next tick to a whole second more than 15 seconds on. */
const quietJump = (r: Real): number => {
  const steps = (r.room as StandInRoom).steps;
  return QUIET_STEPS + STEPS_PER_SECOND - ((steps + QUIET_STEPS + 1) % STEPS_PER_SECOND);
};

const EVENTS: [weight: number, event: Event][] = [
  [3, (m, _r, pick) => { const t = pick(TABS); return m.openPage(t) ? `tab ${t} opens the game` : null; }],
  [6, async (m, r, pick) => { const t = pick(TABS); const s = m.connect(t); if (!s) return null; await r.connect(s.id); return `tab ${t} opens socket ${s.id}`; }],
  [2, (m, _r, pick) => { const t = pick(TABS), heard = pick([true, false]); return m.closePage(t, heard) ? `tab ${t} is closed${heard ? '' : ' and the server is not told'}` : null; }],
  [2, (m, _r, pick) => { const t = pick(TABS), heard = pick([true, false]); return m.drop(t, heard) ? `the line of tab ${t} drops${heard ? '' : ' and the server is not told'}` : null; }],
  [4, (m, _r, pick) => { const t = pick(TABS); return m.hearClose(t) ? `tab ${t} hears its socket close` : null; }],
  [3, async (m, r, pick) => { const t = pick(TABS); const s = m.cur(t); if (!s || !m.talk(t)) return null; await r.input(s.id); return `tab ${t} sends an input on ${s.id}, which the server does not know`; }],
  [6, async (m, r, pick) => {
    const s = any(pick, socks(m, (x) => x.helloDue));
    if (!s) return null;
    m.helloArrives(s);
    await r.hello(s.id);
    return `the hello on ${s.id} arrives`;
  }],
  [6, async (m, r, pick) => {
    const s = any(pick, socks(m, (x) => x.asking));
    if (!s) return null;
    const ok = pick([true, true, true, false]);
    m.answer(s, ok);
    await r.answer(s.id, ok);
    return `Convex ${ok ? 'lets' : 'does not let'} ${s.user} in on ${s.id}`;
  }],
  [4, async (m, r, pick) => {
    const s = any(pick, socks(m, (x) => x.closeDue && !x.helloDue));
    if (!s) return null;
    m.closeArrives(s);
    await r.close(s.id);
    return `the close of ${s.id} arrives`;
  }],
  [1, (m, r, pick) => {
    const s = any(pick, socks(m, (x) => x.sess === 'waiting' || x.sess === 'checking'));
    if (!s) return null;
    m.helloTimeout(s);
    r.fire(r.helloTimers.get(s.id) as number);
    return `10 seconds pass with no player on ${s.id}`;
  }],
  // The world steps, never onto a whole second, where a quiet player might or might not be due.
  [3, (m, r) => (m.stepping ? tick(m, r, ((r.room as StandInRoom).steps + 1) % STEPS_PER_SECOND === 0 ? 1 : 0) : null)],
  [2, (m, r) => (m.stepping ? tick(m, r, quietJump(r)) : null)],
  // Five minutes on and not on a whole second, so nobody is dropped and the card is due.
  [1, (m, r) => {
    if (!m.stepping) return null;
    const steps = (r.room as StandInRoom).steps;
    return tick(m, r, (steps + CARD_EVERY + 1) % STEPS_PER_SECOND === 0 ? CARD_EVERY + 1 : CARD_EVERY);
  }],
  [1, (m, r) => { if (!m.troubles || m.seen.restart >= 1) return null; m.restart(); r.restart(); return 'the world server restarts'; }],
  [5, (m, r, pick) => {
    if (m.posts.length === 0) return null;
    const i = pick(m.posts.map((_, n) => n));
    const p = r.freshPosts[i];
    m.land(i);
    p.settle(true);
    return `the card [${p.players}] reaches Convex`;
  }],
  [1, (m, r, pick) => {
    if (!m.troubles || m.posts.length === 0) return null;
    const i = pick(m.posts.map((_, n) => n));
    const p = r.freshPosts[i];
    m.lost(i);
    p.settle(false);
    return `the card [${p.players}] fails on its way to Convex`;
  }],
  // A post Convex will drop reaches it: nothing changes in the model, which let it go when a later card landed.
  [2, (_m, r, pick) => {
    const old = r.posts.filter((p) => !p.settled && !r.freshPosts.includes(p));
    if (old.length === 0) return null;
    const p = pick(old);
    p.settle(true);
    return `the old card [${p.players}] reaches Convex and is dropped`;
  }],
];
const WEIGHTS = EVENTS.map(([w]) => w), TOTAL = WEIGHTS.reduce((a, b) => a + b, 0);

/** At the end of a run, every tab closes and the server and Convex get to every event: the world must sleep. */
async function settle(m: Model, r: Real, told: string[]): Promise<string | null> {
  for (const t of TABS) if (m.closePage(t, true)) told.push(`tab ${t} is closed`);
  for (let round = 0; round < 40; round++) {
    const hello = socks(m, (s) => s.helloDue)[0];
    const asking = socks(m, (s) => s.asking)[0];
    const close = socks(m, (s) => s.closeDue && !s.helloDue)[0];
    const waiting = socks(m, (s) => s.sess === 'waiting' || s.sess === 'checking')[0];
    if (hello) { m.helloArrives(hello); await r.hello(hello.id); told.push(`the hello on ${hello.id} arrives`); }
    else if (asking) { m.answer(asking, true); await r.answer(asking.id, true); told.push(`Convex lets ${asking.user} in on ${asking.id}`); }
    else if (close) { m.closeArrives(close); await r.close(close.id); told.push(`the close of ${close.id} arrives`); }
    else if (waiting) { m.helloTimeout(waiting); r.fire(r.helloTimers.get(waiting.id) as number); told.push(`10 seconds pass with no player on ${waiting.id}`); }
    else if (m.stepping) told.push(await tick(m, r, quietJump(r))); else if (m.posts.length > 0) { const p = r.freshPosts[0]; m.land(0); p.settle(true); told.push(`the card [${p.players}] reaches Convex`); }
    else break;
  }
  if (r.inside.timer !== null) return 'SleepsOnceEveryoneHasGone: every tab is closed and the world still steps';
  if (r.timers.size > 0) return 'SleepsOnceEveryoneHasGone: every tab is closed and a timer still keeps the world awake';
  return null;
}

/** Plays one random run and returns what went wrong, with the run in words, or null. */
async function play(seed: number, length: number, cap: number, troubles: boolean, seen: Model['seen']): Promise<string | null> {
  const random = createRandom(seed);
  const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)];
  const m = new Model(cap, 8, troubles);
  let real: Real | null = null;
  const uninstall = Real.install(() => real as Real);
  const told: string[] = [];
  try {
    const r = (real = new Real(cap));
    const check = (): string | null => {
      // The card rule is known to break after a restart or a failed post: see the two tests marked failing below.
      const broken = brokenRule(r, m, m.seen.restart === 0 && m.seen.lost === 0);
      if (broken) return broken;
      if (m.settled) m.seen.settled++;
      const a = JSON.stringify(r.read(m)), b = JSON.stringify(readModel(m));
      return a === b ? null : `the server and the model differ:\n  server ${a}\n  model  ${b}`;
    };
    for (let i = 0; i < length; i++) {
      let at = Math.floor(random() * TOTAL), n = 0;
      while (at >= WEIGHTS[n]) at -= WEIGHTS[n++];
      const words = await EVENTS[n][1](m, r, pick);
      if (words === null) continue;
      told.push(words);
      const wrong = check();
      if (wrong) return `seed ${seed}, after ${told.length} events: ${wrong}\nThe last events:\n${told.slice(-16).map((line, k) => `  ${Math.max(0, told.length - 16) + k + 1}. ${line}`).join('\n')}`;
    }
    const asleep = await settle(m, r, told) ?? check();
    if (asleep) return `seed ${seed}, after ${told.length} events: ${asleep}\nThe last events:\n${told.slice(-16).map((line, k) => `  ${Math.max(0, told.length - 16) + k + 1}. ${line}`).join('\n')}`;
    for (const key of Object.keys(seen) as (keyof typeof seen)[]) seen[key] += m.seen[key];
    return null;
  } finally {
    uninstall();
  }
}

// ---------------------------------------------------------------------------------------- the tests

describe('the world server and WorldJoin.tla', () => {
  test('the server does what WorldJoin.tla says, event by event, and keeps its rules', async () => {
    const seen = new Model(1, 1, false).seen;
    // Half the runs in a world of one, where a second player is turned away, and half in a world of two. One
    // run in three may restart the world and lose a card post.
    for (let seed = 1; seed <= 600; seed++) {
      const wrong = await play(seed, 200, seed % 2 === 0 ? 1 : 2, seed % 3 === 0, seen);
      if (wrong) throw new Error(wrong);
    }
    // Random runs that never replace a tab or restart would pass and prove nothing.
    console.log('[world] the runs reached:', JSON.stringify(seen));
    const AT_LEAST: typeof seen = { joined: 800, replaced: 140, full: 80, refused: 280, lateAnswer: 180, forgotten: 220, helloTimeout: 370, quietDrop: 320, periodic: 370, slept: 570, restart: 90, lost: 60, settled: 870 };
    for (const [what, least] of Object.entries(AT_LEAST)) expect(seen[what as keyof typeof seen], what).toBeGreaterThanOrEqual(least);
    // About 2 s alone. With several agents working on this machine, a 5 s limit has failed before.
  }, 60_000);
});

// ---------------------------------------------------------------------------------------- known to break

/**
 * Plays one path of events on both, checking after each step that the server and the model agree, and gives
 * back what CardMatchesTheWorld says at the end, once everything has settled.
 */
async function walk(steps: Step[]): Promise<string | null> {
  const m = new Model(1, 8, true);
  let real: Real | null = null;
  const uninstall = Real.install(() => real as Real);
  try {
    const r = (real = new Real(1));
    for (const step of steps) {
      await step(m, r);
      expect(r.read(m)).toEqual(readModel(m));
      expect(brokenRule(r, m, false)).toBeNull();
    }
    expect(m.settled).toBe(true);
    return brokenRule(r, m, true);
  } finally {
    uninstall();
  }
}

type Step = (m: Model, r: Real) => Promise<unknown> | unknown;
const opens: Step = (m) => m.openPage('a1');
const connects: Step = async (m, r) => { m.connect('a1'); await r.connect('a1.1'); };
const helloArrives: Step = async (m, r) => { m.helloArrives(m.socks.get('a1.1') as Sock); await r.hello('a1.1'); };
const letIn: Step = async (m, r) => { m.answer(m.socks.get('a1.1') as Sock, true); await r.answer('a1.1', true); };
const cardLands: Step = (m, r) => { const p = r.freshPosts[0]; m.land(0); p.settle(true); };
const cardFails: Step = (m, r) => { const p = r.freshPosts[0]; m.lost(0); p.settle(false); };
const closesUntold: Step = (m) => m.closePage('a1', false);
const closes: Step = (m) => m.closePage('a1', true);
const closeArrives: Step = async (m, r) => { m.closeArrives(m.socks.get('a1.1') as Sock); await r.close('a1.1'); };
const restarts: Step = (m, r) => { m.restart(); r.restart(); };

// The shortest paths the checker gives for CardMatchesTheWorld on WorldJoinRestart.cfg and WorldJoinLostPost.cfg,
// one step for each of its actions.
/** Ada opens the game and shuts her laptop before her hello is let in. The world restarts while her card is on its way. */
const AFTER_A_RESTART = [opens, connects, closesUntold, helloArrives, letIn, restarts, cardLands];
/** Ada is let in, and the card that names her fails on its way. */
const WHEN_A_CARD_FAILS = [opens, connects, helloArrives, letIn, cardFails];
/** The same, for the card the world posts as it goes to sleep: nothing puts this one right. */
const WHEN_THE_LAST_CARD_FAILS = [opens, connects, helloArrives, letIn, cardLands, closes, closeArrives, cardFails];

describe('CardMatchesTheWorld, on the paths the checker found', () => {
  test('the paths play out as WorldJoin.tla says, up to the card', async () => {
    expect(await walk(AFTER_A_RESTART)).toBe('CardMatchesTheWorld: the world list shows [a] and the world holds []');
    expect(await walk(WHEN_A_CARD_FAILS)).toBe('CardMatchesTheWorld: the world list shows [] and the world holds [a]');
    expect(await walk(WHEN_THE_LAST_CARD_FAILS)).toBe('CardMatchesTheWorld: the world list shows [a] and the world holds []');
  });

  // Known to fail: docs/bugs/2026-11-11-world-list-keeps-player-after-restart.md. Remove `.failing` with the fix.
  test.failing('after a restart, the world list stops naming a player who has gone', async () => {
    expect(await walk(AFTER_A_RESTART)).toBeNull();
  });

  // Known to fail: docs/bugs/2026-11-11-world-list-keeps-player-when-a-card-fails.md. Remove `.failing` with the fix.
  test.failing('when a card fails on its way, the world list still comes to show who is in the world', async () => {
    expect(await walk(WHEN_A_CARD_FAILS)).toBeNull();
    expect(await walk(WHEN_THE_LAST_CARD_FAILS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------- the real room

test('room.ts keeps one body for each user, takes a user out before letting them in, and is full at MAX_PLAYERS', () => {
  // standInRoom stands for this in every run above.
  const room = realRooms.createRoom();
  const model = new Set<string>();
  const random = createRandom(11);
  const users = Array.from({ length: realRooms.MAX_PLAYERS + 3 }, (_, n) => `u${n}`);
  for (let i = 0; i < 300; i++) {
    const user = users[Math.floor(random() * users.length)];
    if (random() < 0.7) {
      model.delete(user);
      const full = model.size >= realRooms.MAX_PLAYERS;
      if (!full) model.add(user);
      expect(room.join(user, user) === null, `join ${user}`).toBe(full);
    } else {
      model.delete(user);
      room.leave(user);
    }
    expect(room.who().map((p) => p.id).sort()).toEqual([...model].sort());
    expect(room.playerCount).toBe(model.size);
    expect([...room.game.actors.keys()].filter((id) => id.startsWith('player:')).sort()).toEqual([...model].map((u) => `player:${u}`).sort());
  }
}, 30_000);
