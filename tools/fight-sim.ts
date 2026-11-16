// Plays the fight lab's rules with no browser and prints how hard each fight is.
//
//   bun tools/fight-sim.ts                          the difficulty table: each weapon (with the leaftail) and each companion
//                                                   (with the sword) against each beast and each pair, by the perfect, middle
//                                                   and clumsy players, over 20 seeds
//   bun tools/fight-sim.ts --level middle --beast boar    one player, one beast (or a pair, as boar+gearling)
//   bun tools/fight-sim.ts --all                    every weapon with every companion, not only the two rows above
//   bun tools/fight-sim.ts --seeds 5                fewer seeds, for a quick look
//   bun tools/fight-sim.ts one bow lanternfly boar [--level middle] [--seed 3] [--events]   one fight, and every event as it happens
//   bun tools/fight-sim.ts traps                    the traps against every beast, with rigs and with the rock wall
//   bun tools/fight-sim.ts stag [--seeds 20]        the Verdant Stag's hall, start to finish, with its numbers
import { BEASTS, COMPANIONS, STAG, WEAPONS, type WeaponKind } from '../src/game/content/fight.ts';
import { arenaStage } from '../src/game/fight/arena.sim.ts';
import { createBot, type BotLevel } from '../src/game/fight/bot.sim.ts';
import { createFight, type FightRecord } from '../src/game/fight/fight.sim.ts';
import { createStagHall, createHallBot } from '../src/game/fight/stag-hall.sim.ts';
import { hallStage } from '../src/game/fight/hall-layout.sim.ts';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = argv.indexOf(`--${name}`); return i < 0 ? undefined : argv[i + 1]; };
const words = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && (argv[i - 1] as string).startsWith('--') && !['--all', '--events'].includes(argv[i - 1] as string)));
const events = argv.includes('--events');
const DT = 1 / 60, LIMIT = 300;
/** A small repeatable random generator, one per seed. */
const seeded = (seed: number) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export interface Loadout { weapon: WeaponKind; companion: string; level: BotLevel; gentle?: boolean }

/** One fight against one beast or a pair (`boar+gearling`), by a rule-made player, with a seed for its slips and the beasts' choices. */
export function play(foes: string, loadout: Loadout, seed = 1, log = false): FightRecord {
  const stage = arenaStage(0, 0);
  const fight = createFight(stage, { way: 'hero', weapon: loadout.weapon, companion: loadout.companion, gentle: loadout.gentle, random: seeded(seed * 7919) });
  const bot = createBot(fight, stage, { level: loadout.level, random: seeded(seed) });
  const [first, second] = foes.split('+') as [string, string | undefined];
  fight.bring(first, second);
  for (let t = 0; t < LIMIT && fight.phase !== 'won'; t += DT) {
    bot.step(DT);
    fight.step(DT);
    if (log) for (const e of fight.events) if (e.type !== 'guard') console.log(`${fight.clock.toFixed(2).padStart(7)} ${e.type} ${e.text} ${e.n ? e.n.toFixed(2) : ''} at ${e.x.toFixed(1)}, ${e.z.toFixed(1)}`);
    fight.events.length = 0;
  }
  return { ...fight.record, length: fight.phase === 'won' ? fight.record.length : fight.clock, healthLeft: fight.hero.health };
}

/** The traps, as at milestone 3: the perfect player sets three rigs, or none and baits charges into the wall. */
export function playTraps(kind: string, layout: 'rigs' | 'wall' = 'rigs', log = false): FightRecord {
  const stage = arenaStage(0, 0);
  const fight = createFight(stage, { way: 'world' });
  const bot = createBot(fight, stage, { layout });
  fight.bring(kind);
  for (let t = 0; t < 240 && fight.phase !== 'won'; t += DT) {
    bot.step(DT);
    fight.step(DT);
    if (log) for (const e of fight.events) console.log(`${fight.clock.toFixed(2).padStart(7)} ${e.type} ${e.text}`);
    fight.events.length = 0;
  }
  return { ...fight.record, length: fight.phase === 'won' ? fight.record.length : fight.clock };
}

/** Every beast alone, then two of a kind, then one each of two kinds. */
export const FOES: readonly string[] = [
  ...BEASTS.map((b) => b.kind),
  ...BEASTS.map((b) => `${b.kind}+${b.kind}`),
  ...BEASTS.flatMap((a, i) => BEASTS.slice(i + 1).map((b) => `${a.kind}+${b.kind}`)),
];

const mean = (list: number[]): number => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
const median = (list: number[]): number => { const s = [...list].sort((a, b) => a - b); return s.length ? (s[Math.floor((s.length - 1) / 2)] as number + (s[Math.ceil((s.length - 1) / 2)] as number)) / 2 : NaN; };

/** The numbers of one loadout against one set of foes, over `seeds` seeds. */
export function measure(foes: string, loadout: Loadout, seeds: number): Record<string, string | number> {
  const runs = Array.from({ length: seeds }, (_, i) => play(foes, loadout, i + 1));
  const won = runs.filter((r) => r.result === 'calmed'), secs = won.map((r) => r.length);
  return {
    player: loadout.level, weapon: loadout.weapon, companion: loadout.companion, foes, won: `${won.length}/${runs.length}`,
    'mean s': +mean(secs).toFixed(1), 'median s': +median(secs).toFixed(1), 'slowest s': +Math.max(...secs, 0).toFixed(1),
    'hits': +mean(runs.map((r) => r.hitsTaken)).toFixed(1), 'health lost': +mean(runs.map((r) => r.healthLost)).toFixed(0),
    'faints': +mean(runs.map((r) => r.faints)).toFixed(2), 'seeds that fainted': `${runs.filter((r) => r.faints > 0).length}/${runs.length}`,
  };
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

export function playHall(seed = 1, log = false, limit = 600, weapon: WeaponKind = 'sword'): FightRecord {
  const stage = hallStage(0, 0);
  const fight = createFight(stage, { way: 'hero', weapon });
  let ended: FightRecord | null = null;
  const hall = createStagHall(fight, stage, { random: seeded(seed), onEnd: (r) => { ended = r; } });
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

if (import.meta.main) {
  const seeds = Number(opt('seeds') ?? 20);
  if (words[0] === 'stag') {
    const weapon = (opt('weapon') ?? 'sword') as WeaponKind;
    const rows: Record<string, string | number>[] = [];
    for (let seed = 1; seed <= Number(opt('seeds') ?? 1); seed++) rows.push(hallRow(playHall(seed, events && seeds === 1, 600, weapon), seed));
    console.table(rows);
  } else if (words[0] === 'traps') {
    const rows: Record<string, string | number>[] = [];
    for (const layout of ['rigs', 'wall'] as const) {
      for (const beast of BEASTS) {
        const r = playTraps(beast.kind, layout, events);
        rows.push({ layout, enemy: beast.kind, result: r.result, seconds: +r.length.toFixed(1), setup: +r.setup.toFixed(1), hits: r.hitsTaken, faints: r.faints, rigs: `${r.rigsTriggered}/${r.rigsPlaced}`, crashes: r.crashes });
      }
    }
    console.table(rows);
  } else if (words[0] === 'one') {
    const [, weapon = 'sword', companion = 'leaftail', foes = 'boar'] = words;
    const r = play(foes, { weapon: weapon as WeaponKind, companion, level: (opt('level') ?? 'middle') as BotLevel }, Number(opt('seed') ?? 1), events);
    console.log(JSON.stringify({ result: r.result, seconds: +r.length.toFixed(1), hits: r.hitsTaken, hitBy: r.hitBy, lost: Math.round(r.healthLost), faints: r.faints, swings: r.swings, whiffs: r.whiffs, shots: r.shots, shotHits: r.shotHits, healed: Math.round(r.healed), blocks: r.blocks, guarded: r.guarded, strongHits: r.strongHits, skills: r.skills }));
  } else {
    const levels = (opt('level') ? [opt('level')] : ['perfect', 'middle', 'clumsy']) as BotLevel[];
    const foes = opt('beast') ? [opt('beast') as string] : FOES;
    const loadouts: { weapon: WeaponKind; companion: string }[] = argv.includes('--all')
      ? WEAPONS.flatMap((w) => COMPANIONS.map((c) => ({ weapon: w.kind, companion: c.kind })))
      : [...WEAPONS.map((w) => ({ weapon: w.kind, companion: 'leaftail' })), ...COMPANIONS.slice(1).map((c) => ({ weapon: 'sword' as WeaponKind, companion: c.kind }))];
    for (const level of levels) {
      const rows: Record<string, string | number>[] = [];
      for (const f of foes) for (const l of loadouts) rows.push(measure(f, { ...l, level }, seeds));
      console.log(`\n${level} player, ${seeds} seeds`);
      console.table(rows);
    }
    if (!opt('level') && !opt('beast')) {
      // Gentle, for the middle player against the boar.
      const rows = WEAPONS.map((w) => measure('boar', { weapon: w.kind, companion: 'leaftail', level: 'middle', gentle: true }, seeds));
      console.log(`\ngentle, middle player against the boar, ${seeds} seeds`);
      console.table(rows);
    }
  }
}
