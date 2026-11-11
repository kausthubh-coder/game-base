// Plays the fight lab's rules with no browser: a bot fights each beast in each way, and the numbers the
// experiments' checks ask for come out as a table.
//
//   bun tools/fight-sim.ts                 every way against every beast
//   bun tools/fight-sim.ts pet boar        one way, one beast
//   bun tools/fight-sim.ts world boar wall the world way, baiting charges into the rock wall and setting no rigs
//   bun tools/fight-sim.ts --events hero thistlehog   the same, and every event as it happens
//   bun tools/fight-sim.ts stag            the Verdant Stag's hall, start to finish, with its numbers
//   bun tools/fight-sim.ts stag --seeds 20 the hall twenty times over, each with its own pods
import { BEASTS, STAG, WAYS, type Way } from '../src/game/content/fight.ts';
import { arenaStage } from '../src/game/fight/arena.sim.ts';
import { createBot } from '../src/game/fight/bot.sim.ts';
import { createFight, type FightRecord } from '../src/game/fight/fight.sim.ts';
import { createHall, createHallBot } from '../src/game/fight/hall.sim.ts';
import { hallStage } from '../src/game/fight/hall-layout.sim.ts';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const events = process.argv.includes('--events');
const DT = 1 / 60, LIMIT = 240;

export function play(way: Way, kind: string, layout: 'rigs' | 'wall' = 'rigs', log = false): FightRecord {
  const stage = arenaStage(0, 0);
  const fight = createFight(stage, { way });
  const bot = createBot(fight, stage, { layout });
  fight.bring(kind);
  for (let t = 0; t < LIMIT && fight.phase !== 'won'; t += DT) {
    bot.step(DT);
    fight.step(DT);
    if (log) for (const e of fight.events) console.log(`${fight.clock.toFixed(2).padStart(7)} ${e.type} ${e.text} ${e.n ? e.n.toFixed(2) : ''} at ${e.x.toFixed(1)}, ${e.z.toFixed(1)}`);
    fight.events.length = 0;
  }
  return { ...fight.record, length: fight.phase === 'won' ? fight.record.length : fight.clock };
}

// ---------------------------------------------------------------- the Stag's hall
/** A small repeatable random generator, one per seed. */
const seeded = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export function playHall(seed = 1, log = false, limit = 600): FightRecord {
  const stage = hallStage(0, 0);
  const fight = createFight(stage, { way: 'hero' });
  let ended: FightRecord | null = null;
  const hall = createHall(fight, stage, { random: seeded(seed), onEnd: (r) => { ended = r; } });
  const bot = createHallBot(fight, hall);
  for (let t = 0; t < limit && !hall.freed; t += DT) {
    bot.step(DT);
    fight.step(DT);
    hall.step(DT);
    if (log) {
      for (const e of fight.events) if (e.type !== 'guard') console.log(`${hall.clock.toFixed(2).padStart(7)} ${e.type} ${e.text} ${e.n ? e.n.toFixed(2) : ''} at ${e.x.toFixed(1)}, ${e.z.toFixed(1)}`);
      for (const e of hall.events) console.log(`${hall.clock.toFixed(2).padStart(7)} hall:${e.type} ${e.n} at ${e.x.toFixed(1)}, ${e.z.toFixed(1)}`);
    }
    fight.events.length = 0;
    hall.events.length = 0;
  }
  return ended ?? hall.record();
}

function hallRow(r: FightRecord, seed: number): Record<string, string | number> {
  const b = r.boss!;
  return {
    seed, result: r.result === 'calmed' ? 'freed' : r.result, seconds: +r.length.toFixed(1),
    ...Object.fromEntries(STAG.phases.map((name, i) => [name.replace('The ', ''), +(b.phases[i] ?? 0).toFixed(1)])),
    hits: r.hitsTaken, by: Object.entries(r.hitBy).map(([k, v]) => `${k} ${v}`).join(', ') || 'none', faints: r.faints,
    'quiet s': +b.quiet.toFixed(1), 'quiet by phase': b.quietByPhase.map((q) => q.toFixed(1)).join(' / '),
    pods: `${b.counts.podsCut ?? 0} cut, ${b.counts.podsBurst ?? 0} burst, ${b.counts.podsWithered ?? 0} withered`, falls: b.counts.falls ?? 0,
    attacks: `${b.counts.sweeps ?? 0} sweeps, ${b.counts.stamps ?? 0} stamps, ${b.counts.shakes ?? 0} shakes`,
  };
}

if (import.meta.main && args[0] === 'stag') {
  const at = process.argv.indexOf('--seeds'), seeds = at > 0 ? Number(process.argv[at + 1]) : 1;
  const rows: Record<string, string | number>[] = [];
  for (let seed = 1; seed <= seeds; seed++) rows.push(hallRow(playHall(seed, events && seeds === 1), seed));
  console.table(rows);
} else if (import.meta.main) {
  const ways = WAYS.filter((w) => args.length === 0 || args.includes(w));
  const kinds = BEASTS.map((b) => b.kind).filter((k) => !args.some((a) => BEASTS.some((b) => b.kind === a)) || args.includes(k));
  const layout = args.includes('wall') ? 'wall' : 'rigs';
  const rows: Record<string, string | number>[] = [];
  for (const way of ways) {
    for (const kind of kinds) {
      const r = play(way, kind, layout, events);
      rows.push({
        way, enemy: kind, result: r.result, seconds: +r.length.toFixed(1), setup: +r.setup.toFixed(1), hits: r.hitsTaken, faints: r.faints,
        swings: r.swings, whiffs: r.whiffs, 'inputs/10s': +(r.inputs / Math.max(1, r.length) * 10).toFixed(1), gap: +r.longestGap.toFixed(1),
        orders: `${r.ordersInTime}/${r.orders}`, whistles: r.whistles, petFaints: r.petFaints, rigs: `${r.rigsTriggered}/${r.rigsPlaced}`, crashes: r.crashes,
      });
    }
  }
  console.table(rows);
}
