// One world: a Durable Object that owns the sockets, the clock and the storage, and drives the room.
//
// Awake means stepping. The world steps 20 times a second from the moment its first player is let in
// until its last one leaves. Then it saves, stops its timer and holds nothing that keeps it in memory, so
// Cloudflare puts it to sleep and it costs nothing. The next player wakes it, and it loads its save.
import { DurableObject } from 'cloudflare:workers';
import { jsonCodec } from '../src/engine/net/codec.ts';
import { CLOSE, REFUSALS, STEPS_PER_SECOND, type RefuseReason } from '../src/engine/net/messages.ts';
import { BUILD } from '../src/engine/net/version.ts';
import { createTokenCheck, type TokenCheck } from './auth.ts';
import { runDev, type DevCommand, type DevResult } from './dev.ts';
import { convexGate, openGate, shutGate, type Gate } from './gate.ts';
import { createRoom, type Room } from './room.ts';
import type { Timing, WorldStats } from './stats.ts';
import { sqlStore, type SaveStore } from './store.ts';

const STEP_MS = 1000 / STEPS_PER_SECOND;
/** Steps run in one go to catch up after a late timer. Past that, the lost time is let go. */
const MAX_CATCH_UP = 3;
/** Steps between two saves while players are in: 30 seconds. */
const SAVE_EVERY = 30 * STEPS_PER_SECOND;
/** Steps between two cards while players are in: 5 minutes. A join and a leave post one at once. */
const CARD_EVERY = 300 * STEPS_PER_SECOND;
/** A connection that has not said hello in this long is closed. */
const HELLO_WITHIN_MS = 10_000;
/** How many of the last steps the timings are kept for: a minute. */
const TIMED = 60 * STEPS_PER_SECOND;

const codec = jsonCodec;

interface Session {
  /** The user id once the player is in. Null while the hello is awaited or being checked. */
  user: string | null;
  checking: boolean;
  helloTimer: ReturnType<typeof setTimeout> | null;
}

/** The last `TIMED` samples of a duration. */
class Timed {
  private readonly samples = new Float32Array(TIMED);
  private count = 0;

  add(ms: number): void {
    this.samples[this.count++ % TIMED] = ms;
  }

  reset(): void {
    this.count = 0;
  }

  summary(): Timing {
    const n = Math.min(this.count, TIMED);
    if (n === 0) return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    const sorted = this.samples.slice(0, n).sort();
    let sum = 0;
    for (let i = 0; i < n; i++) sum += sorted[i];
    const at = (q: number): number => Math.round(sorted[Math.min(n - 1, Math.floor(q * n))] * 1000) / 1000;
    return { count: n, mean: Math.round((sum / n) * 1000) / 1000, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(1) };
  }
}

const log = (message: string, more: Record<string, unknown> = {}): void => console.log(JSON.stringify({ message, ...more }));

export class WorldServer extends DurableObject<Env> {
  private room: Room | null = null;
  private worldId: string;
  private readonly store: SaveStore;
  private readonly check: TokenCheck;
  private readonly gate: Gate;
  private readonly sessions = new Map<WebSocket, Session>();
  /** The socket each player in the room plays through, by user id. */
  private readonly sockets = new Map<string, WebSocket>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  /** When the next step is due, in milliseconds since 1970. */
  private nextDue = 0;
  private savedAt = 0;
  private cardAt = 0;
  private stepErrors = 0;

  private readonly stepMs = new Timed();
  private readonly snapMs = new Timed();
  private stepsRun = 0;
  private stepsLost = 0;
  private messagesIn = 0;
  private bytesIn = 0;
  private bytesOut = 0;
  private saves = 0;
  private lastSave: WorldStats['lastSave'] = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.worldId = ctx.id.name ?? '';
    this.store = sqlStore(ctx.storage.sql, (run) => ctx.storage.transactionSync(run));
    const devTokens = env.DEV_TOKENS === '1';
    this.check = createTokenCheck({
      issuer: env.CLERK_ISSUER,
      audience: env.CLERK_AUDIENCE,
      parties: env.CLERK_PARTIES.split(',').map((origin) => origin.trim()).filter(Boolean),
      devTokens,
    });
    if (env.CONVEX_URL) this.gate = convexGate({ url: env.CONVEX_URL, siteUrl: env.CONVEX_SITE_URL, secret: env.WORLD_SERVER_SECRET });
    else if (devTokens) this.gate = openGate;
    else {
      this.gate = shutGate;
      console.error(JSON.stringify({ message: 'CONVEX_URL is not set, so nobody may enter any world' }));
    }
  }

  // ---------------------------------------------------------------------------------------- connections

  /** A browser opens its connection. The Worker in index.ts has checked the address and that it is a WebSocket. */
  override async fetch(request: Request): Promise<Response> {
    const id = new URL(request.url).pathname.split('/')[2];
    if (id) this.worldId = id;
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    // The hibernation API: an idle connection does not keep the object in memory.
    this.ctx.acceptWebSocket(server);
    const session: Session = { user: null, checking: false, helloTimer: null };
    session.helloTimer = setTimeout(() => {
      session.helloTimer = null;
      if (session.user === null) this.end(server, CLOSE.quiet, 'no hello');
    }, HELLO_WITHIN_MS);
    this.sessions.set(server, session);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    this.messagesIn++;
    this.bytesIn += typeof data === 'string' ? data.length : data.byteLength;
    const session = this.sessions.get(ws);
    if (!session) {
      // This object restarted under a live connection and has forgotten it. The browser says hello again.
      this.end(ws, CLOSE.restart, 'the world restarted');
      return;
    }
    const message = codec.decodeClient(data);
    if (session.user !== null) {
      if (message?.t === 'input') this.room?.input(session.user, message);
      return;
    }
    if (session.checking) return;
    if (message?.t !== 'hello') return this.refuse(ws, 'hello');
    if (message.build !== BUILD) return this.refuse(ws, 'reload');

    session.checking = true;
    const who = await this.check(message.token);
    if (!who) return this.refuse(ws, 'token');
    if (!(await this.gate.mayEnter(this.worldId, message.token))) return this.refuse(ws, 'closed');
    // The connection may have closed while the token was checked.
    if (this.sessions.get(ws) !== session) return;

    const room = this.wake();
    const before = this.sockets.get(who.id);
    if (before && before !== ws) {
      // The same player from another tab, or back after a drop the server has not noticed yet.
      this.sessions.delete(before);
      this.end(before, CLOSE.replaced, 'this player connected again');
    }
    const you = room.join(who.id, who.name);
    if (you === null) return this.refuse(ws, 'full');
    session.checking = false;
    session.user = who.id;
    if (session.helloTimer !== null) clearTimeout(session.helloTimer);
    session.helloTimer = null;
    this.sockets.set(who.id, ws);
    ws.serializeAttachment({ user: who.id });
    this.send(ws, codec.encode({ t: 'welcome', you, build: BUILD, seed: room.world.seed, step: room.steps }));
    log('a player joined', { worldId: this.worldId, user: who.id, players: room.playerCount });
    this.start();
    this.postCard();
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.gone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.gone(ws);
  }

  private refuse(ws: WebSocket, why: RefuseReason): void {
    this.send(ws, codec.encode({ t: 'refuse', why, text: REFUSALS[why] }));
    this.end(ws, CLOSE.refused, why);
  }

  /** Closes a connection from this side and forgets it. */
  private end(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      // Closed already.
    }
    this.gone(ws);
  }

  private send(ws: WebSocket, wire: string | ArrayBuffer): void {
    try {
      ws.send(wire);
      this.bytesOut += typeof wire === 'string' ? wire.length : wire.byteLength;
    } catch {
      // The connection is closing. Its close event takes the player out.
    }
  }

  /** A connection is gone, however it went. Its player leaves, and the last one out puts the world to sleep. */
  private gone(ws: WebSocket): void {
    const session = this.sessions.get(ws);
    if (!session) return;
    this.sessions.delete(ws);
    if (session.helloTimer !== null) clearTimeout(session.helloTimer);
    const user = session.user, room = this.room;
    if (user === null || !room || this.sockets.get(user) !== ws) return;
    this.sockets.delete(user);
    room.leave(user);
    log('a player left', { worldId: this.worldId, user, players: room.playerCount });
    if (room.playerCount === 0) this.sleep();
    else this.postCard();
  }

  // ---------------------------------------------------------------------------------------- awake and asleep

  /** The rules, loaded from the save the first time they are needed after waking. */
  private wake(): Room {
    if (this.room) return this.room;
    const started = performance.now();
    const save = this.store.read();
    this.room = createRoom(save);
    this.savedAt = this.cardAt = this.room.steps;
    log('the world loaded', { worldId: this.worldId, saved: save !== null, steps: this.room.steps, ms: Math.round(performance.now() - started) });
    return this.room;
  }

  private start(): void {
    if (this.timer !== null) return;
    this.nextDue = Date.now() + STEP_MS;
    this.timer = setTimeout(this.tick, STEP_MS);
    log('the world is awake and stepping', { worldId: this.worldId, steps: this.room?.steps });
  }

  /** The last player left: save, tell Convex, stop the timer. Nothing is left that keeps this object in memory. */
  private sleep(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.save('the last player left');
    this.postCard();
    log('the world stopped stepping and sleeps', { worldId: this.worldId, steps: this.room?.steps });
  }

  private readonly tick = (): void => {
    this.timer = null;
    const room = this.room;
    if (!room || room.playerCount === 0) return;

    const now = Date.now();
    let ran = 0;
    while (now >= this.nextDue && ran < MAX_CATCH_UP) {
      const started = performance.now();
      try {
        room.step();
      } catch (error) {
        // A rule threw. The step is lost, the world goes on, and the first few are logged.
        if (this.stepErrors++ < 5) console.error(JSON.stringify({ message: 'a step threw', worldId: this.worldId, error: String(error), stack: error instanceof Error ? error.stack : undefined }));
      }
      this.stepMs.add(performance.now() - started);
      this.nextDue += STEP_MS;
      this.stepsRun++;
      ran++;
    }
    if (now >= this.nextDue) {
      // Too far behind to catch up: the time is let go, so the world runs slow for a moment and never in a burst.
      const lost = Math.floor((now - this.nextDue) / STEP_MS) + 1;
      this.stepsLost += lost;
      this.nextDue += lost * STEP_MS;
    }

    if (ran > 0) {
      const started = performance.now();
      for (const [user, ws] of this.sockets) {
        const snap = room.snap(user);
        if (snap) this.send(ws, codec.encode(snap));
      }
      this.snapMs.add(performance.now() - started);
    }
    if (room.steps - this.savedAt >= SAVE_EVERY) this.save('30 seconds passed');
    if (room.steps - this.cardAt >= CARD_EVERY) this.postCard();
    this.timer = setTimeout(this.tick, Math.max(0, this.nextDue - Date.now()));
  };

  private save(why: string): void {
    const room = this.room;
    if (!room) return;
    const started = performance.now();
    try {
      const { rows, bytes } = this.store.write(room.save());
      this.savedAt = room.steps;
      this.saves++;
      this.lastSave = { ms: Math.round((performance.now() - started) * 100) / 100, rows, bytes, why };
      log('the world saved', { worldId: this.worldId, steps: room.steps, ...this.lastSave });
    } catch (error) {
      console.error(JSON.stringify({ message: 'the world could not be saved', worldId: this.worldId, error: String(error) }));
    }
  }

  private postCard(): void {
    const room = this.room;
    if (!room) return;
    this.cardAt = room.steps;
    this.ctx.waitUntil(this.gate.postCard({ worldId: this.worldId, players: room.who(), lastPlayed: Date.now() }));
  }

  // ---------------------------------------------------------------------------------------- for the checks

  /** What the world is doing, for /world/<id>/stats. The Worker answers that address only with DEV_TOOLS on. */
  async stats(reset = false): Promise<WorldStats> {
    const stats: WorldStats = {
      worldId: this.worldId,
      build: BUILD,
      stepping: this.timer !== null,
      loaded: this.room !== null,
      sockets: this.ctx.getWebSockets().length,
      ...this.room?.stats(),
      stepsRun: this.stepsRun,
      stepsLost: this.stepsLost,
      stepMs: this.stepMs.summary(),
      snapMs: this.snapMs.summary(),
      messagesIn: this.messagesIn,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
      saves: this.saves,
      lastSave: this.lastSave,
    };
    if (reset) {
      this.stepMs.reset();
      this.snapMs.reset();
    }
    return stats;
  }

  /** Test tools, for /world/<id>/dev. The Worker answers that address only with DEV_TOOLS on. */
  async dev(command: DevCommand | { do: 'save' }): Promise<DevResult> {
    if (this.env.DEV_TOOLS !== '1' || !this.room) return { ok: false };
    if (command.do === 'save') {
      this.save('a test asked');
      return { ok: true };
    }
    return runDev(this.room, command);
  }
}
