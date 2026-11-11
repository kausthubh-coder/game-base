// What a fight's record says about the experiments' checks. Each way to fight has its own checks, from
// research note 08, section 7. A check is a line of words, the number measured, and whether it passed. Some
// checks need more than one fight: how many tries the first calm took, how many layouts beat the boar.
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
const percent = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : 'none');

/**
 * The checks for one fight. `earlier` holds the fights before it, oldest first, for the checks that count
 * across fights.
 */
export function checksOf(record: FightRecord, earlier: readonly FightRecord[] = []): Check[] {
  const boar = record.enemy === 'boar', won = record.result === 'calmed';
  const same = earlier.filter((r) => r.way === record.way && r.enemy === record.enemy);
  const checks: Check[] = [];
  if (record.way === 'hero') {
    // Tries count until the first calm of this beast this way.
    const firstWin = same.findIndex((r) => r.result === 'calmed');
    const tries = firstWin >= 0 ? firstWin + 1 : same.length + 1;
    checks.push({ what: 'Tries until it was first calmed', got: firstWin >= 0 || won ? String(tries) : `${tries} so far`, want: 'at most 3', pass: firstWin >= 0 || won ? tries <= 3 : tries > 3 ? false : null });
    checks.push({ what: 'Swings that hit nothing', got: `${percent(record.whiffs, record.swings)} (${record.whiffs} of ${record.swings})`, want: 'under 25%', pass: record.swings > 0 ? record.whiffs / record.swings < 0.25 : null });
    checks.push(boar
      ? { what: 'Length of the fight', got: seconds(record.length), want: 'under 180 s', pass: won ? record.length < 180 : null }
      : { what: 'Length of the fight', got: seconds(record.length), want: '4 to 8 s', pass: won ? record.length >= 4 && record.length <= 8 : null });
  } else if (record.way === 'pet') {
    const rate = record.length > 0 ? (record.inputs / record.length) * 10 : 0;
    checks.push({ what: 'Useful presses in 10 seconds', got: rate.toFixed(1), want: 'at least 6', pass: record.length > 2 ? rate >= 6 : null });
    checks.push({ what: 'Longest stretch with no press', got: seconds(record.longestGap), want: 'at most 3 s', pass: record.length > 2 ? record.longestGap <= 3 : null });
    checks.push({ what: 'Orders with the pet at its target in 2 s', got: `${record.ordersInTime} of ${record.orders}`, want: 'at least 95%', pass: record.orders > 0 ? record.ordersInTime / record.orders >= 0.95 : null });
    if (boar) {
      checks.push({ what: 'Whistles', got: String(record.whistles), want: 'at least 1', pass: won ? record.whistles >= 1 : null });
      checks.push({ what: 'Times the pet fainted', got: String(record.petFaints), want: 'at most 1', pass: won ? record.petFaints <= 1 : record.petFaints > 1 ? false : null });
      checks.push({ what: 'Length of the fight', got: seconds(record.length), want: 'under 180 s', pass: won ? record.length < 180 : null });
    }
  } else {
    checks.push({ what: 'Setup', got: seconds(record.setup), want: boar ? 'under 90 s' : 'under 20 s', pass: record.rigsPlaced > 0 ? record.setup < (boar ? 90 : 20) : null });
    checks.push({ what: 'Rigs the beast set off', got: `${percent(record.rigsTriggered, record.rigsPlaced)} (${record.rigsTriggered} of ${record.rigsPlaced})`, want: 'at least 60%', pass: won && record.rigsPlaced > 0 ? record.rigsTriggered / record.rigsPlaced >= 0.6 : null });
    checks.push({ what: 'Share of the fight with a rig in the hand', got: percent(record.placing, record.length), want: 'under half', pass: record.length > 2 ? record.placing / record.length < 0.5 : null });
    if (boar) {
      const layouts = new Set([...same, record].filter((r) => r.result === 'calmed').map(layoutOf));
      checks.push({ what: 'Different layouts that beat the boar', got: String(layouts.size), want: 'at least 2', pass: layouts.size >= 2 ? true : null });
      checks.push({ what: 'Length of the fight', got: seconds(record.length), want: 'under 180 s', pass: won ? record.length < 180 : null });
    }
  }
  return checks;
}

/**
 * What makes two layouts the same: the same kinds of rig and the same number of crashes into the wall. Where
 * each rig stood is left out, since moving a snare one block is not a new idea.
 */
export function layoutOf(record: FightRecord): string {
  const kinds = record.layout.map((entry) => entry.split('@')[0] as string).sort();
  return `${kinds.join('+') || 'no rigs'}, ${record.crashes > 0 ? 'crashes' : 'no crashes'}`;
}
