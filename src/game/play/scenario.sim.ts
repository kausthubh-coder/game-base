// A scenario: a seed, where the game starts, a list of inputs, and what must be true at the end. The files in
// src/game/scenarios each hold one. `runScenario` plays it through the real rules with no page, checks the
// invariants after every kernel step, and says whether it passed and why not. Only `keys`, `hold` and the
// verbs that say so let time pass: a scenario that wants a pause asks for one with `wait`.

import type { ItemId, QuestId } from '../api.sim.ts';
import { STEP } from '../kernel.sim.ts';
import { newPlay, type Play } from './harness.sim.ts';
import { describe, press, type Input } from './inputs.sim.ts';
import { createInvariants } from './invariants.sim.ts';
import { stateHash } from './state.sim.ts';

/** Where a game stands before its first input. Both parts are what the debug door does, and neither is play. */
export interface Start {
  /** `quests.skipTo`: the quests before this one are passed over, with what finishing them would have left. */
  quest?: QuestId;
  /** Items put in the bag. A tool the bag already holds is not given twice. */
  give?: Readonly<Record<ItemId, number>>;
}

/** Something that must be true, and whether it is. */
export type Fact = readonly [what: string, holds: boolean];

export interface Scenario {
  /** The file's name without `.sim.ts`. */
  name: string;
  /** One sentence: what is played and what must come of it. */
  about: string;
  /** The kernel's seed, for `game.random()`. */
  seed: number;
  start?: Start;
  inputs: readonly Input[];
  /** What must be true at the end. */
  expect(p: Play): Fact[];
}

export interface Outcome {
  name: string;
  passed: boolean;
  /** Why it failed, or an empty string. */
  reason: string;
  /** Inputs played, and kernel steps. */
  inputs: number;
  steps: number;
  /** The state at the end, or where it stopped. */
  hash: string;
}

/** A new game on this seed, brought to its start. */
export function begin(seed: number, start?: Start, remember?: number): Play {
  const p = newPlay({ seed, remember });
  // Half a second lets the quest system start the first quest, as every test of the first part does.
  p.advance(0.5);
  if (start?.quest) {
    p.sys.quests.skipTo(start.quest);
    p.advance(0.5);
  }
  for (const [id, count] of Object.entries(start?.give ?? {})) {
    if (p.sys.items.get(id).tool && p.count(id) > 0) continue;
    if (p.sys.inventory.add(id, count) > 0) throw new Error(`the bag has no room for ${count} ${id} at the start`);
  }
  return p;
}

/**
 * Hears what the rules write to `console.error` and `console.warn`. The quests, the story and the
 * conversations catch what they throw and log it there, so a caught throw is still a throw to the bot.
 */
export function listenForErrors(): { readonly heard: string[]; stop(): void } {
  const heard: string[] = [];
  const error = console.error, warn = console.warn;
  const note = (...parts: unknown[]): void => {
    heard.push(parts.map((part) => (part instanceof Error ? part.message : typeof part === 'string' ? part : JSON.stringify(part))).join(' '));
  };
  console.error = note;
  console.warn = note;
  return {
    heard,
    stop() {
      console.error = error;
      console.warn = warn;
    },
  };
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function runScenario(scenario: Scenario): Outcome {
  const invariants = createInvariants();
  const ears = listenForErrors();
  let p: Play | null = null;
  let played = 0;
  const done = (reason: string): Outcome => ({ name: scenario.name, passed: reason === '', reason, inputs: played, steps: p?.steps ?? 0, hash: p ? stateHash(p) : '' });
  /** Checks what must always hold after every kernel step of this play. */
  const watch = (play: Play): void => {
    play.onStep(() => {
      const broken = invariants.check(play);
      if (broken) throw new Error(`after step ${play.steps}: ${broken}`);
    });
  };
  try {
    try {
      p = begin(scenario.seed, scenario.start);
      watch(p);
    } catch (error) {
      return done(`before the first input: ${messageOf(error)}`);
    }
    for (const input of scenario.inputs) {
      try {
        const next = press(p, input);
        if (next !== p) {
          watch(next);
          // The first frame after Continue steps the rules before the player can press anything. Crops, placed
          // things and the story add their click handlers on that step.
          next.advance(STEP);
        }
        p = next;
      } catch (error) {
        return done(`input ${played + 1} of ${scenario.inputs.length}, ${describe(input)}: ${messageOf(error)}`);
      }
      played++;
      if (ears.heard.length > 0) return done(`after input ${played} of ${scenario.inputs.length}, ${describe(input)}, a system logged an error: ${ears.heard[0]}`);
    }
    let facts: Fact[];
    try {
      facts = scenario.expect(p);
    } catch (error) {
      return done(`at the end, the check threw: ${messageOf(error)}`);
    }
    const wrong = facts.filter(([, holds]) => !holds).map(([what]) => what);
    return done(wrong.length > 0 ? `at the end this does not hold: ${wrong.join('; ')}` : '');
  } finally {
    ears.stop();
  }
}
