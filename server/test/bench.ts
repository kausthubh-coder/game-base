// The 128 MB test: does one world fit in a Durable Object, and how long does a step take?
//   bun server/test/bench.ts                 five runs of 30 seconds
//   bun server/test/bench.ts --runs 1        one run, a ballpark
//   bun server/test/bench.ts --profile       one run under the CPU profiler, to see where the time goes
//   bun server/test/bench.ts --spread        the players walk apart, eight ways: the most land in memory
//
// One run: a fresh `wrangler dev` on port 5544 with empty storage. Eight fake players join one world
// through the game's own client. The test tool adds 300 creatures and 3,000 placed things (sprinklers,
// fences and chests in turn: the rules have no machines yet). Every player then sends an input 20 times a
// second and walks a square, for a warm-up and then the timed seconds.
//
// What is measured, and how:
//   - Step time: `performance.now()` around the rules' step and around making and sending the snaps,
//     inside the Durable Object, read from /world/bench/stats. workerd's clock ticks in whole
//     milliseconds here, so the mean is sound and the percentiles are 0 or whole numbers.
//   - CPU: the CPU time `ps` reports for the workerd processes over the timed seconds. It counts
//     everything: the rules, JSON, the sockets, the garbage collector.
//   - Memory: `Runtime.getHeapUsage` of the Worker's isolate over wrangler's inspector port, once a
//     second, and once more after a forced collection. And the resident memory of the workerd process.
//   - Round trip: from a player sending an input to the snap that says it was used.
//
// This is local workerd on this Mac. It is the same runtime Cloudflare runs, but it does not enforce
// the 128 MB limit, and the machine is not theirs. See server/README.md for what the numbers prove.
import { cpus, loadavg } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { WorldStats } from '../stats.ts';
import { ARTIFACTS, join, sleep, startServer, type FakePlayer, type LocalServer } from './local.ts';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number): number => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};
const PROFILE = args.includes('--profile');
const SPREAD = args.includes('--spread');
const RUNS = PROFILE ? 1 : flag('runs', 5);
const SECONDS = flag('seconds', 30);
const WARM_UP = flag('warm-up', 8);
const PLAYERS = flag('players', 8);
const CREATURES = flag('creatures', 300);
const PLACED = flag('placed', 3000);
const PORT = 5544;
const WORLD = 'bench';
const MB = 1024 * 1024;

interface Heap {
  usedSize: number;
  totalSize: number;
  embedderHeapUsedSize: number;
  backingStorageSize: number;
}

/** The inspector of the Worker's isolate: the Chrome DevTools protocol over a WebSocket. */
async function inspect(server: LocalServer): Promise<{ call<T>(method: string, params?: object): Promise<T>; close(): void }> {
  const targets = (await (await fetch(`http://127.0.0.1:${server.inspectorPort}/json`)).json()) as { webSocketDebuggerUrl: string }[];
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((done, fail) => {
    ws.addEventListener('open', done);
    ws.addEventListener('error', fail);
  });
  let next = 0;
  const waiting = new Map<number, { done: (value: unknown) => void; fail: (error: Error) => void }>();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data as string) as { id?: number; result?: unknown; error?: { message: string } };
    const wait = message.id === undefined ? undefined : waiting.get(message.id);
    if (!wait) return;
    waiting.delete(message.id as number);
    if (message.error) wait.fail(new Error(message.error.message));
    else wait.done(message.result);
  });
  return {
    // A call that gets no answer in ten seconds fails, so a run never sits waiting on the inspector.
    call: <T>(method: string, params: object = {}) => new Promise<T>((done, fail) => {
      const id = ++next;
      const timeout = setTimeout(() => {
        waiting.delete(id);
        fail(new Error(`the inspector did not answer ${method} in 10 seconds`));
      }, 10_000);
      waiting.set(id, {
        done: (value) => { clearTimeout(timeout); done(value as T); },
        fail: (error) => { clearTimeout(timeout); fail(error); },
      });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    close: () => ws.close(),
  };
}

/** The workerd processes under this server: pid, resident memory in bytes and CPU seconds used so far. */
function workerd(server: LocalServer): { pid: number; rss: number; cpu: number }[] {
  const rows = Bun.spawnSync(['ps', '-axo', 'pid=,ppid=,rss=,time=,comm=']).stdout.toString().trim().split('\n')
    .map((line) => line.trim().split(/\s+/))
    .map(([pid, ppid, rss, time, ...comm]) => ({ pid: Number(pid), ppid: Number(ppid), rss: Number(rss) * 1024, time, comm: comm.join(' ') }));
  const mine = new Set([server.pid]);
  // The tree is wrangler, then node, then workerd: a few passes reach the grandchildren.
  for (let pass = 0; pass < 3; pass++) for (const row of rows) if (mine.has(row.ppid)) mine.add(row.pid);
  const seconds = (time: string): number => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
  return rows.filter((row) => mine.has(row.pid) && row.comm.endsWith('workerd')).map((row) => ({ pid: row.pid, rss: row.rss, cpu: seconds(row.time) }));
}

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const OUTWARD = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]] as const;

interface Walker {
  player: FakePlayer;
  /** Milliseconds from sending an input to the snap that acknowledges it. */
  roundTrips: number[];
  sent: number;
  stop(): void;
}

/**
 * A player who sends an input 20 times a second. In the usual run they turn a corner every two seconds and
 * so walk a square. With `--spread` each walks straight out, one of eight ways, so the land in memory grows.
 */
function walk(player: FakePlayer, index: number): Walker {
  const sentAt = new Map<number, number>();
  const walker: Walker = { player, roundTrips: [], sent: 0, stop: () => { clearInterval(timer); off(); } };
  let count = 0, acked = 0;
  const began = performance.now();
  const timer = setInterval(() => {
    // By the clock, not by the timer: a late timer sends the input it missed, so the rate holds at 20.
    const due = Math.floor((performance.now() - began) / 50);
    for (let sends = 0; count < due && sends < 2; sends++) {
      const [mx, mz] = SPREAD ? OUTWARD[index % 8] : DIRECTIONS[(index + Math.floor(count / 40)) % 4];
      count++;
      const n = player.send(mx, mz);
      if (n === 0) continue;
      sentAt.set(n, performance.now());
      walker.sent++;
    }
  }, 25);
  const off = player.net.onSnap((snap) => {
    const now = performance.now();
    for (let n = acked + 1; n <= snap.ack; n++) {
      const at = sentAt.get(n);
      if (at !== undefined) walker.roundTrips.push(now - at);
      sentAt.delete(n);
    }
    acked = Math.max(acked, snap.ack);
  });
  return walker;
}

const quantile = (values: number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const round = (n: number, places = 2): number => Math.round(n * 10 ** places) / 10 ** places;

interface Run {
  load: number;
  // What was really in the world: the claim is only about this.
  players: number;
  creatures: number;
  creaturesAwake: number;
  placed: number;
  chunks: number;
  // Steps.
  stepsPerSecond: number;
  stepMeanMs: number;
  stepP99Ms: number;
  stepMaxMs: number;
  snapMeanMs: number;
  snapMaxMs: number;
  cpuPercent: number;
  // Memory, in MB.
  heapUsedPeak: number;
  heapTotalPeak: number;
  buffersPeak: number;
  heapUsedAfterGc: number;
  buffersAfterGc: number;
  heapBaseline: number;
  rss: number;
  rssBaseline: number;
  // The wire.
  inputsPerSecond: number;
  /** Inputs the server used, by the numbers its snaps answered with. It should be the inputs sent. */
  inputsUsedPerSecond: number;
  kbOutPerPlayerSecond: number;
  roundTripP50Ms: number;
  roundTripP95Ms: number;
  // Saving.
  saveMs: number;
  saveKb: number;
  // Things that must be zero.
  stepsLost: number;
  inputsDropped: number;
  stepErrors: number;
  profile?: { fn: string; percent: number }[];
}

async function run(index: number): Promise<Run> {
  const server = await startServer({ port: PORT, name: 'bench', fresh: true });
  const players: FakePlayer[] = [];
  const walkers: Walker[] = [];
  try {
    const inspector = await inspect(server);
    const heap = async (): Promise<Heap> => inspector.call<Heap>('Runtime.getHeapUsage');
    // The collection runs the next time the isolate runs anything. A request makes sure it does, in a world
    // that is not stepping.
    const collect = async (): Promise<Heap> => {
      const collected = inspector.call('HeapProfiler.collectGarbage');
      await server.stats(WORLD);
      await collected;
      return heap();
    };
    const baseline = await collect();
    const rssBaseline = Math.max(...workerd(server).map((p) => p.rss));

    for (let i = 0; i < PLAYERS; i++) players.push(await join(server, WORLD, `p${i}`));
    if (players.some((p) => p.net.state !== 'open')) throw new Error('a player was refused');
    await sleep(500);
    const fill = await server.dev(WORLD, { do: 'fill', creatures: CREATURES, placed: PLACED });
    if (!fill.ok) throw new Error('the fill did not run');
    players.forEach((player, i) => walkers.push(walk(player, i)));
    await sleep(WARM_UP * 1000);

    // The timed seconds.
    if (PROFILE) {
      await inspector.call('Profiler.enable');
      await inspector.call('Profiler.start');
    }
    const before = await server.stats(WORLD, true);
    const cpuBefore = workerd(server);
    const bytesBefore = players.map((p) => p.bytes);
    for (const walker of walkers) { walker.roundTrips.length = 0; walker.sent = 0; }
    const acksBefore = players.map((p) => p.net.near.ack);
    let usedPeak = 0, totalPeak = 0, buffersPeak = 0;
    const started = performance.now();
    while (performance.now() - started < SECONDS * 1000) {
      await sleep(1000);
      const now = await heap();
      usedPeak = Math.max(usedPeak, now.usedSize);
      totalPeak = Math.max(totalPeak, now.totalSize);
      buffersPeak = Math.max(buffersPeak, now.backingStorageSize + now.embedderHeapUsedSize);
    }
    const elapsed = (performance.now() - started) / 1000;
    const after: WorldStats = await server.stats(WORLD);
    const cpuAfter = workerd(server);
    const used = players.reduce((sum, p, i) => sum + (p.net.near.ack - acksBefore[i]), 0);
    const bytesOut = players.reduce((sum, p, i) => sum + (p.bytes - bytesBefore[i]), 0);

    let profile: Run['profile'];
    if (PROFILE) {
      const result = await inspector.call<{ profile: { nodes: { callFrame: { functionName: string; url: string; lineNumber: number }; hitCount?: number }[] } }>('Profiler.stop');
      const byFn = new Map<string, number>();
      let total = 0;
      for (const node of result.profile.nodes) {
        const hits = node.hitCount ?? 0;
        total += hits;
        const frame = node.callFrame;
        const fn = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop() ?? ''}:${frame.lineNumber + 1}`;
        byFn.set(fn, (byFn.get(fn) ?? 0) + hits);
      }
      profile = [...byFn].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([fn, hits]) => ({ fn, percent: round((hits / total) * 100, 1) }));
    }

    // After the timed seconds: one save on demand, the live memory after a collection, and the errors.
    await server.dev(WORLD, { do: 'save' });
    const saved = await server.stats(WORLD);
    const live = await collect();
    const rss = Math.max(...workerd(server).map((p) => p.rss));
    const cpu = Math.max(...cpuAfter.map((p) => p.cpu - (cpuBefore.find((b) => b.pid === p.pid)?.cpu ?? 0)));
    const roundTrips = walkers.flatMap((walker) => walker.roundTrips);
    const stepErrors = server.log().split('a step threw').length - 1;
    inspector.close();

    return {
      load: round(loadavg()[0]),
      players: after.players ?? 0, creatures: after.creatures ?? 0, creaturesAwake: after.creaturesAwake ?? 0, placed: after.placed ?? 0, chunks: after.chunks ?? 0,
      stepsPerSecond: round(((after.steps ?? 0) - (before.steps ?? 0)) / elapsed, 1),
      stepMeanMs: after.stepMs.mean, stepP99Ms: after.stepMs.p99, stepMaxMs: after.stepMs.max,
      snapMeanMs: after.snapMs.mean, snapMaxMs: after.snapMs.max,
      cpuPercent: round((cpu / elapsed) * 100, 1),
      heapUsedPeak: round(usedPeak / MB, 1), heapTotalPeak: round(totalPeak / MB, 1), buffersPeak: round(buffersPeak / MB, 1),
      heapUsedAfterGc: round(live.usedSize / MB, 1), buffersAfterGc: round((live.backingStorageSize + live.embedderHeapUsedSize) / MB, 1),
      heapBaseline: round((baseline.usedSize + baseline.backingStorageSize + baseline.embedderHeapUsedSize) / MB, 1),
      rss: round(rss / MB), rssBaseline: round(rssBaseline / MB),
      inputsPerSecond: round((after.messagesIn - before.messagesIn) / elapsed, 1),
      inputsUsedPerSecond: round(used / elapsed, 1),
      kbOutPerPlayerSecond: round(bytesOut / 1024 / PLAYERS / elapsed, 1),
      roundTripP50Ms: round(quantile(roundTrips, 0.5), 1), roundTripP95Ms: round(quantile(roundTrips, 0.95), 1),
      saveMs: saved.lastSave?.ms ?? -1, saveKb: round((saved.lastSave?.bytes ?? 0) / 1024),
      stepsLost: after.stepsLost - before.stepsLost,
      inputsDropped: (after.inputsDropped ?? 0) - (before.inputsDropped ?? 0),
      stepErrors,
      profile,
    };
  } finally {
    for (const walker of walkers) walker.stop();
    for (const player of players) await player.leave().catch(() => undefined);
    await server.stop();
    console.log(`run ${index + 1} of ${RUNS} done`);
  }
}

console.log(`${cpus().length} cores, load average ${loadavg().map((n) => n.toFixed(2)).join(' ')}`);
console.log(`${RUNS} run${RUNS === 1 ? '' : 's'}: ${PLAYERS} players, ${CREATURES} creatures, ${PLACED} placed things, ${WARM_UP} s warm-up, ${SECONDS} s timed${SPREAD ? ', players walking apart' : ''}${PROFILE ? ', under the profiler (do not report these times)' : ''}\n`);

const runs: Run[] = [];
for (let i = 0; i < RUNS; i++) runs.push(await run(i));

const keys = Object.keys(runs[0]).filter((key) => key !== 'profile') as (keyof Omit<Run, 'profile'>)[];
const width = Math.max(...keys.map((key) => key.length));
console.log(`\n${'what'.padEnd(width)}  ${'median'.padStart(8)}  ${'least'.padStart(8)}  ${'most'.padStart(8)}   each run`);
for (const key of keys) {
  const values = runs.map((r) => r[key]);
  console.log(`${key.padEnd(width)}  ${String(quantile(values, 0.5)).padStart(8)}  ${String(Math.min(...values)).padStart(8)}  ${String(Math.max(...values)).padStart(8)}   ${values.join(' ')}`);
}
if (runs[0].profile) {
  console.log('\nWhere the isolate spent its time, by function (self time):');
  for (const row of runs[0].profile) console.log(`${String(row.percent).padStart(6)}%  ${row.fn}`);
}

mkdirSync(ARTIFACTS, { recursive: true });
const out = resolve(ARTIFACTS, PROFILE ? 'bench-profile.json' : SPREAD ? 'bench-spread.json' : 'bench.json');
writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), cores: cpus().length, seconds: SECONDS, warmUp: WARM_UP, runs }, null, 2));
console.log(`\nwritten to ${out}`);

// With `--spread` the host walks away from the creatures, and the rules stop stepping the ones left behind.
const wrong = runs.filter((r) => r.players !== PLAYERS || r.creatures < CREATURES || (!SPREAD && r.creaturesAwake < CREATURES) || r.placed < PLACED || r.stepErrors > 0);
if (wrong.length > 0) {
  console.error(`\n${wrong.length} run(s) did not hold what the test asks for, or threw in a step. The numbers above are not the claim.`);
  process.exit(1);
}
