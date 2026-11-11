// What the check and the memory test share: a world server on this machine that the script starts and
// stops itself, and fake players that talk to it through the game's own client, src/features/net.
//
// The server is `bunx wrangler dev` on its own port with its own storage folder, so a script never touches
// the storage of a server someone else has running. It is stopped by the pid this file started.
import { spawn, type Subprocess } from 'bun';
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Act } from '../../src/engine/net/messages.ts';
import { createNet, type Net } from '../../src/features/net/index.ts';
import type { DevCommand, DevResult } from '../dev.ts';
import type { WorldStats } from '../stats.ts';

export const ROOT = resolve(import.meta.dirname, '../..');
export const ARTIFACTS = resolve(ROOT, '.artifacts/server');

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

export interface LocalServer {
  readonly pid: number;
  readonly port: number;
  readonly inspectorPort: number;
  /** http://127.0.0.1:<port> */
  readonly http: string;
  /** ws://127.0.0.1:<port> */
  readonly ws: string;
  readonly logPath: string;
  /** Everything the server has printed so far. */
  log(): string;
  stats(world: string, reset?: boolean): Promise<WorldStats>;
  dev(world: string, command: DevCommand | { do: 'save' }): Promise<DevResult>;
  /** Stops it by its pid and waits until it is gone. */
  stop(): Promise<void>;
}

export interface ServerOptions {
  port: number;
  /** A name for its log and its storage folder under .artifacts/server. */
  name: string;
  /** Start from empty storage. False keeps what the last run with this name saved. */
  fresh: boolean;
  /** Variables for the server, over the dev defaults. An empty value switches a default off. */
  vars?: Record<string, string>;
}

/** Starts `wrangler dev` and waits until it answers. Dev tokens and the dev tools are switched on from the command line. */
export async function startServer(options: ServerOptions): Promise<LocalServer> {
  mkdirSync(ARTIFACTS, { recursive: true });
  const state = resolve(ARTIFACTS, `${options.name}-state`);
  if (options.fresh) rmSync(state, { recursive: true, force: true });
  const logPath = resolve(ARTIFACTS, `${options.name}.log`);
  const out = openSync(logPath, options.fresh ? 'w' : 'a');
  const inspectorPort = options.port + 1;
  // The variables go in a file only this user can read, not on the command line, where `ps` shows them:
  // a real run's WORLD_SERVER_SECRET was once printed that way.
  const varsPath = resolve(ARTIFACTS, `${options.name}.vars`);
  const all = { DEV_TOKENS: '1', DEV_TOOLS: '1', WORLD_SERVER_SECRET: 'dev-secret-not-real', ...options.vars };
  writeFileSync(varsPath, Object.entries(all).map(([name, value]) => `${name}=${JSON.stringify(value)}\n`).join(''), { mode: 0o600 });
  const vars = ['--env-file', varsPath];
  const child: Subprocess = spawn({
    // The project's own wrangler, as `bunx wrangler` finds it. Run directly, so the pid is wrangler's own.
    cmd: [
      resolve(ROOT, 'node_modules/.bin/wrangler'), 'dev', '--ip', '127.0.0.1', '--port', String(options.port), '--inspector-port', String(inspectorPort),
      '--persist-to', state, ...vars,
    ],
    cwd: ROOT,
    stdout: out,
    stderr: out,
    stdin: 'ignore',
  });
  const http = `http://127.0.0.1:${options.port}`;
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null) throw new Error(`wrangler dev stopped with code ${child.exitCode}. Its log: ${logPath}`);
    try {
      if ((await fetch(`${http}/world/ready/stats`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {
      // Not up yet.
    }
    if (Date.now() - started > 60_000) {
      child.kill();
      throw new Error(`wrangler dev did not answer on port ${options.port} within a minute. Its log: ${logPath}`);
    }
    await sleep(250);
  }

  const json = async <T>(response: Response): Promise<T> => {
    if (!response.ok) throw new Error(`${response.url} answered ${response.status}`);
    return (await response.json()) as T;
  };
  return {
    pid: child.pid, port: options.port, inspectorPort, http, ws: `ws://127.0.0.1:${options.port}`, logPath,
    log: () => readFileSync(logPath, 'utf8'),
    stats: async (world, reset = false) => json<WorldStats>(await fetch(`${http}/world/${world}/stats${reset ? '?reset' : ''}`)),
    dev: async (world, command) => json<DevResult>(await fetch(`${http}/world/${world}/dev`, { method: 'POST', body: JSON.stringify(command) })),
    async stop() {
      child.kill();
      await child.exited;
    },
  };
}

export interface FakePlayer {
  readonly net: Net;
  /** Messages and bytes received since it connected. All but the first message, the welcome, are snaps. */
  readonly messages: number;
  readonly bytes: number;
  /** Sends one input now. */
  send(mx: number, mz: number, acts?: Act[]): number;
  /** Sends this input 20 times a second until `stop()` or the next `walk`. */
  walk(mx: number, mz: number): void;
  stop(): void;
  /** Resolves when `done()` holds, checked after every snap. Throws after `ms`. */
  until(done: () => boolean, ms: number, what: string): Promise<void>;
  /** Closes the connection and waits a moment for the server to notice. */
  leave(): Promise<void>;
}

/**
 * Connects a fake player with a dev token and waits for the welcome or the refusal. `build` and `token`
 * are for the checks that the server refuses a wrong one.
 */
export async function join(server: LocalServer, world: string, name: string, options: { build?: string; token?: string } = {}): Promise<FakePlayer> {
  let messages = 0, bytes = 0;
  const net = createNet(null, {
    url: `${server.ws}/world/${world}`,
    token: () => options.token ?? `dev:${name}`,
    build: options.build,
    socket: (url) => {
      const socket = new WebSocket(url);
      socket.addEventListener('message', (event) => {
        messages++;
        bytes += typeof event.data === 'string' ? event.data.length : 0;
      });
      return socket as never;
    },
  });
  const frames = setInterval(() => net.update(0.05, null as never), 50);
  let walking: ReturnType<typeof setInterval> | null = null;
  const stop = (): void => {
    if (walking !== null) clearInterval(walking);
    walking = null;
  };

  await new Promise<void>((done, fail) => {
    const timeout = setTimeout(() => fail(new Error(`${name} got no answer from ${world} in 10 seconds`)), 10_000);
    net.onState((state) => {
      if (state !== 'open' && state !== 'refused') return;
      clearTimeout(timeout);
      done();
    });
    net.connect();
  });

  return {
    net,
    get messages() { return messages; },
    get bytes() { return bytes; },
    send: (mx, mz, acts) => net.send({ mx, mz, jump: false, acts }),
    walk(mx, mz) {
      stop();
      walking = setInterval(() => net.send({ mx, mz, jump: false }), 50);
    },
    stop,
    until(done, ms, what) {
      return new Promise<void>((resolveIt, fail) => {
        if (done()) return resolveIt();
        const timeout = setTimeout(() => {
          off();
          fail(new Error(`waited ${ms} ms for: ${what}`));
        }, ms);
        const off = net.onSnap(() => {
          if (!done()) return;
          clearTimeout(timeout);
          off();
          resolveIt();
        });
      });
    },
    async leave() {
      stop();
      clearInterval(frames);
      net.dispose();
      await sleep(300);
    },
  };
}
