// The smallest browser client for a world server: connect, say hello, send numbered inputs, hand out
// snaps, and connect again after a drop. It draws nothing and predicts nothing. The hero still moves by
// the browser's own rules. Drawing other players and prediction build on what this hands out.
//
// It keeps no timers. `update(dt)` counts the wait before a reconnect and the silence on an open
// connection, so it runs off the frame loop like every other feature, and a test steps it by hand.
import { jsonCodec, type Codec, type Wire } from '../../engine/net/codec.ts';
import { CLOSE, type Act, type Refuse, type Snap, type Welcome } from '../../engine/net/messages.ts';
import { applySnap, createNear, type Near } from '../../engine/net/near.ts';
import { BUILD } from '../../engine/net/version.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';

/** The part of a WebSocket this file uses. The page's own WebSocket fits. */
export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: Wire): void;
  close(code?: number, reason?: string): void;
}

/**
 * `idle` before `connect()`. `connecting` from opening the socket to the server's welcome. `open` while
 * inputs go up and snaps come down. `waiting` between a drop and the next try. `refused` when the server
 * said no: `refusal` says why, and it does not try again by itself. `closed` after `close()`, or when the
 * same player connected from somewhere else.
 */
export type NetState = 'idle' | 'connecting' | 'open' | 'waiting' | 'refused' | 'closed';

export interface NetOptions {
  /** The world's address: `wss://<host>/world/<id>`. */
  url: string;
  /** The player's token. It is asked for again on every try: a Clerk token lasts a minute. */
  token: () => string | Promise<string>;
  /** The build this browser runs. `BUILD` when left out. */
  build?: string;
  codec?: Codec;
  /** Opens a socket. The page's WebSocket when left out. */
  socket?: (url: string) => SocketLike;
  /** Seconds before the first reconnect. It doubles with every failed try, up to `retryMax`. 0.5 when left out. */
  retryFirst?: number;
  /** 8 when left out. */
  retryMax?: number;
  /** Seconds of silence on an open connection before it is dropped as dead. The server sends 20 snaps a second. 5 when left out. */
  quietFor?: number;
}

/** What the player wants in one step. The number is added by `send`. */
export interface NetInput {
  mx: number;
  mz: number;
  jump: boolean;
  acts?: Act[];
}

export interface Net extends ViewSystem {
  readonly state: NetState;
  /** The server's welcome on this connection, or null. */
  readonly welcome: Welcome | null;
  /** Why the server refused, or null. `why` is `reload` when this browser's build is not the server's. */
  readonly refusal: Refuse | null;
  /** Everyone and everything near, built up from the snaps of this connection. */
  readonly near: Near;
  /** Seconds until the next try, while `waiting`. */
  readonly retryIn: number;
  /** Starts connecting, or starts over after a refusal. */
  connect(): void;
  /** Sends one step's input. Returns its number, or 0 when the connection is not open and nothing was sent. */
  send(input: NetInput): number;
  /** Hears every snap, after it was added to `near`. Returns a function that stops listening. */
  onSnap(listener: (snap: Snap) => void): () => void;
  /** Hears every change of `state`. Returns a function that stops listening. */
  onState(listener: (state: NetState) => void): () => void;
  /** Closes the connection for good. `connect()` opens a new one. */
  close(): void;
}

export function createNet(_ctx: ViewContext | null, options: NetOptions): Net {
  const codec = options.codec ?? jsonCodec;
  const build = options.build ?? BUILD;
  const open = options.socket ?? ((url: string): SocketLike => new WebSocket(url) as unknown as SocketLike);
  const retryFirst = options.retryFirst ?? 0.5, retryMax = options.retryMax ?? 8, quietFor = options.quietFor ?? 5;

  let state: NetState = 'idle';
  let socket: SocketLike | null = null;
  let welcome: Welcome | null = null;
  let refusal: Refuse | null = null;
  let near = createNear();
  /** The number of the last input sent. It goes on across reconnects, so the server never sees a number twice. */
  let sent = 0;
  let retryIn = 0, retryNext = retryFirst;
  /** Seconds since the open connection last said anything. */
  let quiet = 0;
  /** Counts the tries, so an answer for an old one is ignored. */
  let attempt = 0;
  const snapListeners = new Set<(snap: Snap) => void>();
  const stateListeners = new Set<(state: NetState) => void>();

  function setState(next: NetState): void {
    if (next === state) return;
    state = next;
    for (const listener of [...stateListeners]) listener(next);
  }

  /** Lets go of the socket without hearing from it again. */
  function drop(): void {
    const old = socket;
    socket = null;
    if (!old) return;
    old.onopen = old.onmessage = old.onclose = old.onerror = null;
    try {
      old.close();
    } catch {
      // Closed already.
    }
  }

  function retryLater(): void {
    drop();
    retryIn = retryNext;
    retryNext = Math.min(retryMax, retryNext * 2);
    setState('waiting');
  }

  function start(): void {
    drop();
    const mine = ++attempt;
    welcome = null;
    quiet = 0;
    setState('connecting');
    Promise.resolve()
      .then(options.token)
      .then((token) => {
        if (mine !== attempt) return;
        const ws = open(options.url);
        socket = ws;
        ws.onopen = () => ws.send(codec.encode({ t: 'hello', build, token }));
        ws.onmessage = (event) => {
          quiet = 0;
          const message = codec.decodeServer(event.data as Wire);
          if (!message) return;
          if (message.t === 'welcome') {
            welcome = message;
            near = createNear();
            retryNext = retryFirst;
            setState('open');
          } else if (message.t === 'refuse') {
            refusal = message;
            drop();
            setState('refused');
          } else if (state === 'open') {
            applySnap(near, message);
            for (const listener of [...snapListeners]) listener(message);
          }
        };
        ws.onclose = (event) => {
          if (ws !== socket) return;
          socket = null;
          // Another tab of the same player took over. Trying again would only throw that one out.
          if (event.code === CLOSE.replaced) setState('closed');
          else retryLater();
        };
        // An error is always followed by a close, which does the work.
        ws.onerror = () => undefined;
      })
      .catch(() => {
        // No token, or no socket could be made.
        if (mine === attempt) retryLater();
      });
  }

  return {
    get state() { return state; },
    get welcome() { return welcome; },
    get refusal() { return refusal; },
    get near() { return near; },
    get retryIn() { return state === 'waiting' ? retryIn : 0; },

    connect() {
      if (state === 'connecting' || state === 'open') return;
      refusal = null;
      retryNext = retryFirst;
      start();
    },

    send(input) {
      if (state !== 'open' || !socket) return 0;
      const n = ++sent;
      socket.send(codec.encode(input.acts && input.acts.length > 0
        ? { t: 'input', n, mx: input.mx, mz: input.mz, jump: input.jump, acts: input.acts }
        : { t: 'input', n, mx: input.mx, mz: input.mz, jump: input.jump }));
      return n;
    },

    onSnap(listener) {
      snapListeners.add(listener);
      return () => snapListeners.delete(listener);
    },

    onState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },

    update(dt) {
      if (state === 'waiting') {
        retryIn -= dt;
        if (retryIn <= 0) start();
      } else if (state === 'open' || state === 'connecting') {
        quiet += dt;
        // A connection that went silent is dead even when nobody said so, as on wifi that dropped.
        if (quiet > quietFor && socket) retryLater();
      }
    },

    close() {
      attempt++;
      drop();
      setState('closed');
    },

    dispose() {
      attempt++;
      drop();
      setState('closed');
      snapListeners.clear();
      stateListeners.clear();
    },
  };
}
