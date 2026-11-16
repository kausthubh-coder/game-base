// What a fight's record says. `summaryOf` is the few lines a player cares about after a fight: how long it took,
// what hit them and how often, and how much health was left. `checksOf` is the Stag's hall's pass checks, from
// research note 08: a giant fails when it stops attacking you.
import { BEASTS, COMPANIONS, STAG, WEAPONS } from '../content/fight.ts';
import type { FightRecord } from './fight.sim.ts';

export interface Check {
  /** What was measured, as a short line. */
  what: string;
  /** The number, with its unit. */
  got: string;
  /** What passes. */
  want: string;
  /** Null when this fight cannot answer it. */
  pass: boolean | null;
}

const seconds = (n: number): string => `${n.toFixed(1)} s`;
const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

/** The name of a beast kind, without "the" or "Blighted": "thistlehog", "gearling", "boar". */
function shortName(kind: string): string {
  return (BEASTS.find((b) => b.kind === kind)?.name ?? kind).replace(/^(The )?(Blighted )?/i, '').toLowerCase();
}

/** Who was fought, in words: "the boar", "two gearlings", "the thistlehog and the boar". */
export function foesOf(record: FightRecord): string {
  if (record.way === 'stag') return STAG.name;
  const kinds = record.enemy.split('+');
  if (kinds.length === 2 && kinds[0] === kinds[1]) return `two ${shortName(kinds[0] as string)}s`;
  return kinds.map((k) => `the ${shortName(k)}`).join(' and ');
}

/** The word for how a fight ended: a beast is calmed, a machine shut down, and the Stag freed. */
export function endedWord(record: FightRecord): string {
  if (record.result !== 'calmed') return record.result;
  if (record.way === 'stag') return 'freed';
  const kinds = record.enemy.split('+');
  return kinds.every((k) => BEASTS.find((b) => b.kind === k)?.machine) ? 'shut down' : 'calmed';
}

/** A few plain lines on a fight that ended: how long, what with, what hit the hero and how often, and the health left. */
export function summaryOf(record: FightRecord): string[] {
  const lines: string[] = [];
  const foes = foesOf(record), word = endedWord(record);
  const first = foes.charAt(0).toUpperCase() + foes.slice(1);
  if (record.way === 'world') {
    lines.push(`${first}, ${word} in ${seconds(record.length)} with the traps. ${record.rigsTriggered} of ${record.rigsPlaced} rigs went off${record.crashes ? `, and it ran into the wall ${times(record.crashes)}` : ''}.`);
  } else {
    const weapon = WEAPONS.find((w) => w.kind === record.weapon)?.name.toLowerCase() ?? record.weapon;
    const others = record.weapons.filter((w) => w !== record.weapon).map((w) => WEAPONS.find((d) => d.kind === w)?.name.toLowerCase() ?? w);
    const companion = (COMPANIONS.find((c) => c.kind === record.companion)?.name ?? record.companion).toLowerCase();
    const hand = record.way === 'stag' ? '' : ` with the ${weapon}${others.length ? ` (and the ${others.join(' and the ')})` : ''} and the ${companion}`;
    lines.push(`${first}, ${word} in ${seconds(record.length)}${hand}.`);
  }
  // A follow-up counts with what it follows: `quills2` is more quills.
  const merged: Record<string, number> = {};
  for (const [attack, n] of Object.entries(record.hitBy)) { const name = attack.replace(/\d+$/, ''); merged[name] = (merged[name] ?? 0) + n; }
  const by = Object.entries(merged).sort((a, b) => b[1] - a[1]).map(([attack, n]) => `${attack} ${times(n)}`);
  lines.push(record.hitsTaken === 0 ? 'Nothing hit you.' : `It hit you ${times(record.hitsTaken)}: ${by.join(', ')}.`);
  const left = Math.round(record.healthLeft), lost = Math.round(record.healthLost);
  if (record.faints > 0) lines.push(`You fainted ${times(record.faints)}, lost ${lost} health in all, and ended with ${left} of 100.`);
  else if (lost > 0) lines.push(`You lost ${lost} health in all and ended with ${left} of 100. At your lowest you had ${Math.round(record.lowest)}.`);
  else lines.push('You ended with all your health.');
  const help: string[] = [];
  if (record.healed >= 1) help.push(`mended ${Math.round(record.healed)} health`);
  if (record.blocks > 0) help.push(`took ${record.blocks === 1 ? 'an attack' : `${record.blocks} attacks`} for you`);
  if (record.guarded > 0) help.push(`took half of ${times(record.guarded)}`);
  if (record.strongHits > 0) help.push(`gave you ${record.strongHits} strong hit${record.strongHits > 1 ? 's' : ''}`);
  if (help.length) lines.push(`Your companion ${help.join(', ')}.`);
  return lines;
}

/** The Stag's hall's checks, for its card. Any other fight has none. */
export function checksOf(record: FightRecord): Check[] {
  if (record.way !== 'stag') return [];
  const boss = record.boss, freed = record.result === 'calmed';
  const checks: Check[] = [];
  for (const [i, name] of STAG.phases.entries()) {
    checks.push({ what: `${name}: seconds, and the longest wait for an attack`, got: `${seconds(boss?.phases[i] ?? 0)}, ${seconds(boss?.quietByPhase[i] ?? 0)}`, want: 'a wait of at most 4 s', pass: (boss?.phases[i] ?? 0) > 0 ? (boss?.quietByPhase[i] ?? 0) <= 4 : null });
  }
  const by = Object.entries(record.hitBy).map(([attack, n]) => `${attack} ${n}`).join(', ');
  checks.push({ what: 'Hits taken, by attack', got: `${record.hitsTaken}${by ? ` (${by})` : ''}`, want: 'any', pass: null });
  checks.push({ what: 'Faints, and falls from the vines', got: `${record.faints}, ${boss?.counts.falls ?? 0}`, want: 'any', pass: null });
  checks.push({ what: 'Length of the fight', got: seconds(record.length), want: 'under 300 s', pass: freed ? record.length < 300 : null });
  return checks;
}
