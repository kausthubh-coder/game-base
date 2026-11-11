// Plays the fight lab's rules with no browser: a bot fights each beast in each way, and the numbers the
// experiments' checks ask for come out as a table.
//
//   bun tools/fight-sim.ts                 every way against every beast
//   bun tools/fight-sim.ts pet boar        one way, one beast
//   bun tools/fight-sim.ts world boar wall the world way, baiting charges into the rock wall and setting no rigs
//   bun tools/fight-sim.ts --events hero thistlehog   the same, and every event as it happens
import { BEASTS, WAYS, type Way } from '../src/game/content/fight.ts';
import { arenaStage } from '../src/game/fight/arena.sim.ts';
import { createBot } from '../src/game/fight/bot.sim.ts';
import { createFight, type FightRecord } from '../src/game/fight/fight.sim.ts';

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

if (import.meta.main) {
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
