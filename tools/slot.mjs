// Runs a command once one of a few machine-wide slots is free, so a swarm of agents on the one Mac mini queues
// its heavy work instead of running twenty test suites at once. Two lanes, each first come, first served:
//   bun tools/slot.mjs -- <command ...>          the heavy lane: the full check, verify. 3 at once, stopped after
//                                                30 minutes.
//   bun tools/slot.mjs --look -- <command ...>   the look lane: one short job that makes pictures to look at. 2 at
//                                                once, stopped after 5 minutes, so nobody waits an hour to see
//                                                their own work behind somebody's verify.
//   bun tools/slot.mjs --status                  who holds each slot and who waits.
// SLOTS and LOOK_SLOTS set how many run at once. A command run inside a slot (verify calling check) does not take
// a second one. Each wait also stops headless Chromes left orphaned by a finished tool, which once held the
// machine at load 215.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.cache', 'game-base-slots');
const LOOK_SECONDS = Number(process.env.LOOK_SECONDS ?? 300);
// A heavy job is stopped after 30 minutes: on 2026-11-12 one picture batch held a heavy slot for 31 minutes while
// seventeen checks waited. The full verify takes about 15 on a busy machine.
const HEAVY_SECONDS = Number(process.env.HEAVY_SECONDS ?? 1800);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

// Bun may swallow the `--` itself, so everything after the flags is the command either way.
let rest = process.argv.slice(2);
if (rest[0] === '--status') {
  mkdirSync(DIR, { recursive: true });
  const age = (pid) => (spawnSync('ps', ['-o', 'etime=', '-p', String(pid)], { encoding: 'utf8' }).stdout ?? '').trim();
  const files = readdirSync(DIR).sort();
  for (const f of files.filter((n) => /^(slot|look)-\d+$/.test(n))) {
    const [pid, ...cmd] = readFileSync(join(DIR, f), 'utf8').split(' ');
    if (alive(Number(pid))) console.log(`${f.padEnd(7)} running ${age(pid).padStart(8)}  ${cmd.join(' ').slice(0, 100)}`);
  }
  for (const lane of ['look', 'slot']) {
    const waiting = files.filter((n) => (lane === 'look' ? /^lookwait-/ : /^wait-/).test(n) && alive(Number(n.split('-')[2])));
    console.log(`${lane === 'look' ? 'look lane' : 'heavy lane'}: ${waiting.length} waiting`);
  }
  process.exit(0);
}
const look = rest[0] === '--look';
if (look) rest = rest.slice(1);
const args = rest[0] === '--' ? rest.slice(1) : rest;
if (!args.length) {
  console.error('usage: bun tools/slot.mjs [--look] -- <command ...>   |   bun tools/slot.mjs --status');
  process.exit(2);
}
// A slot is for a job that ends. A server never ends, and held one of the three slots for 14 minutes on 2026-11-12
// while fifty jobs waited behind it: start servers outside the queue, on the port the doctor gave you.
const line = args.join(' ');
if (/\b(run dev|run server|run preview|vite( |$)(?!build)|wrangler dev|tools\/serve\.mjs|demo\.mjs dev|play\.mjs (start|--daemon))/.test(line)) {
  console.error(`slot: "${line}" is a server and never ends, so it does not run in a slot. Start it outside the queue.`);
  process.exit(2);
}
if (look && /\b(run check|run verify|tools\/verify\.mjs|bun test src( |$))/.test(line)) {
  console.error(`slot: "${line}" is a full check, not a look. Run it in the heavy lane, without --look.`);
  process.exit(2);
}

let held = null;
const release = () => {
  if (held) rmSync(held, { force: true });
  held = null;
};

const run = (limit) => {
  const child = spawn(args[0], args.slice(1), { stdio: 'inherit', detached: !!limit, env: { ...process.env, SLOT_HELD: '1' } });
  let late = false;
  const timer = limit
    ? setTimeout(() => {
        late = true;
        console.error(look ? `slot: the look lane stops a job after ${limit} s. Shoot fewer pictures in one job, or use the heavy lane.` : `slot: the heavy lane stops a job after ${limit} s. Split it: pictures go in the look lane a few at a time, and a check runs alone.`);
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {}
      }, limit * 1000)
    : null;
  child.on('exit', (code, signal) => {
    if (timer) clearTimeout(timer);
    release();
    process.exit(late ? 124 : (code ?? (signal ? 1 : 0)));
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
};

if (process.env.SLOT_HELD) run(0);
else {
  const name = look ? 'look' : 'slot';
  const waitName = look ? 'lookwait' : 'wait';
  const SLOTS = look ? Number(process.env.LOOK_SLOTS ?? 2) : Number(process.env.SLOTS ?? 3);
  mkdirSync(DIR, { recursive: true });

  // Headless Chromes whose parent has died (re-parented to launchd) and that have run for over 20 minutes.
  const reapOrphans = () => {
    const ps = spawnSync('ps', ['-Ao', 'pid=,ppid=,etime=,command='], { encoding: 'utf8' }).stdout ?? '';
    for (const row of ps.split('\n')) {
      const m = row.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
      if (!m || m[2] !== '1' || !/Google Chrome --.*--headless/.test(m[4]) || !m[4].includes('playwright')) continue;
      const parts = m[3].split(/[-:]/).map(Number);
      const minutes = m[3].includes('-') ? 1440 : parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0];
      if (minutes >= 20) {
        try {
          process.kill(Number(m[1]), 'SIGKILL');
          console.error(`slot: stopped an orphaned headless Chrome, pid ${m[1]}, up ${m[3]}`);
        } catch {}
      }
    }
  };

  const take = () => {
    for (let i = 0; i < SLOTS; i++) {
      const file = join(DIR, `${name}-${i}`);
      try {
        writeFileSync(file, `${process.pid} ${line}`, { flag: 'wx' });
        return file;
      } catch {
        const pid = Number(readFileSync(file, 'utf8').split(' ')[0]);
        if (!alive(pid)) rmSync(file, { force: true });
      }
    }
    return null;
  };

  // Waiters take a slot in the order they came. Without this the luckiest poll won, and a job could starve for
  // twenty minutes behind fifty others. Each waiter leaves a ticket; only the oldest live ticket may take.
  const ticket = join(DIR, `${waitName}-${Date.now()}-${process.pid}`);
  writeFileSync(ticket, line);
  const mine = new RegExp(`^${waitName}-(\\d+)-(\\d+)$`);
  const first = () => {
    let oldest = null;
    for (const f of readdirSync(DIR)) {
      const m = f.match(mine);
      if (!m) continue;
      if (!alive(Number(m[2]))) {
        rmSync(join(DIR, f), { force: true });
        continue;
      }
      const at = Number(m[1]);
      if (!oldest || at < oldest.at || (at === oldest.at && Number(m[2]) < oldest.pid)) oldest = { at, pid: Number(m[2]) };
    }
    return !oldest || oldest.pid === process.pid;
  };
  process.on('exit', () => rmSync(ticket, { force: true }));

  let waited = 0;
  const tryTake = () => {
    held = first() ? take() : null;
    if (held) {
      rmSync(ticket, { force: true });
      return run(look ? LOOK_SECONDS : HEAVY_SECONDS);
    }
    if (waited++ % 30 === 0) {
      reapOrphans();
      console.error(`slot: all ${SLOTS} ${look ? 'look' : 'heavy'} slots busy, waiting (${line})`);
    }
    setTimeout(tryTake, 2000);
  };
  process.on('exit', release);
  reapOrphans();
  tryTake();
}
