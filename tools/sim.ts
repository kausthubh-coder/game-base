// Fast play with no browser: the game's rules stepped in Bun, through the harness in src/game/play.
//
//   bun tools/sim.ts scenarios [name ...]             plays every scenario in src/game/scenarios, or the ones named
//   bun tools/sim.ts bot --seed <n> --steps <n>       a bot presses random valid inputs; --seed takes a list: 1,2,3
//   bun tools/sim.ts --replay <seed> --until <step>   plays that bot's game to the step before, prints the state, then plays the step
//
// It exits 1 when a scenario fails or a bot breaks an invariant. The rules, the bot and the invariants are
// .sim.ts files in src/game/play. This file only reads the command line, keeps time and prints.
import { startBot, type BotRun, type Failure } from '../src/game/play/bot.sim.ts';
import { describe } from '../src/game/play/inputs.sim.ts';
import { runScenario, type Scenario } from '../src/game/play/scenario.sim.ts';
import { STEPS } from '../src/game/play/script.ts';
import { summary } from '../src/game/play/state.sim.ts';
import { SCENARIOS } from '../src/game/scenarios/all.sim.ts';

const USAGE = `usage:
  bun tools/sim.ts scenarios [name ...]
  bun tools/sim.ts bot --seed <n>[,<n>...] --steps <n>
  bun tools/sim.ts --replay <seed> --until <step>`;

/** The first part, from a new game to its end: the steps of src/game/play/script.ts as one scenario. */
const ACT1: Scenario = {
  name: 'act1',
  about: 'The five quests of the first part, from a new game to act.ended.',
  seed: 7,
  inputs: STEPS.map((step) => ({ do: 'run', name: `${step.quest}: ${step.name}`, run: step.run })),
  expect: (p) => [['the first part has ended', p.game.flags.is('act1.ended')], ['every quest is done', p.sys.quests.all().every((quest) => quest.state === 'done')]],
};

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** The value after a flag such as `--seed`, or null when the flag is not there. */
function option(args: string[], name: string): string | null {
  const at = args.indexOf(name);
  if (at < 0) return null;
  return args[at + 1] ?? fail(`${name} needs a value\n${USAGE}`);
}

function whole(text: string, what: string): number {
  const n = text.trim() === '' ? NaN : Number(text);
  if (!Number.isInteger(n) || n < 0) fail(`${what} must be a whole number, not "${text}"\n${USAGE}`);
  return n;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)} s`;

function scenarios(names: string[]): number {
  const all = [ACT1, ...SCENARIOS];
  const unknown = names.filter((name) => !all.some((scenario) => scenario.name === name));
  if (unknown.length > 0) fail(`no scenario is called ${unknown.join(', ')}. There are: ${all.map((scenario) => scenario.name).join(', ')}`);
  const chosen = names.length > 0 ? all.filter((scenario) => names.includes(scenario.name)) : all;
  let failed = 0;
  const began = performance.now();
  for (const scenario of chosen) {
    const from = performance.now();
    const outcome = runScenario(scenario);
    const took = seconds(performance.now() - from);
    if (outcome.passed) {
      console.log(`pass  ${scenario.name.padEnd(22)} ${String(outcome.inputs).padStart(3)} inputs, ${String(outcome.steps).padStart(6)} steps, ${took}, state ${outcome.hash}`);
    } else {
      failed++;
      console.log(`FAIL  ${scenario.name.padEnd(22)} ${outcome.reason}`);
      console.log(`      ${scenario.about}`);
      console.log(`      again: bun tools/sim.ts scenarios ${scenario.name}`);
    }
  }
  console.log(`${chosen.length - failed} of ${chosen.length} scenarios passed in ${seconds(performance.now() - began)}`);
  return failed > 0 ? 1 : 0;
}

/** What the bot got done, as the events the rules sent most often. */
function deeds(run: BotRun): string {
  const names = ['block.broken', 'block.placed', 'tree.felled', 'placeable.placed', 'soil.tilled', 'crop.planted', 'crop.harvested', 'item.crafted', 'build.applied', 'talk.ended', 'pet.fed', 'slept', 'quest.step', 'reload'];
  return names.filter((name) => run.did[name]).map((name) => `${name} ${run.did[name]}`).join(', ') || 'nothing the rules sent an event for';
}

function bot(seeds: number[], steps: number): number {
  let failed = 0;
  for (const seed of seeds) {
    const run = startBot(seed);
    console.log(`bot seed ${seed}: ${run.start}`);
    // The clock runs over the steps only: the game's start is before it, the printing after it.
    const from = performance.now();
    run.advance(steps);
    const took = performance.now() - from;
    const failure = run.failure;
    if (failure) {
      failed++;
      console.log(`  FAIL  seed ${seed}, step ${failure.step}: ${failure.what}`);
      console.log(`        the input at that step: ${describe(failure.input)}`);
      console.log(`        replay: bun tools/sim.ts --replay ${seed} --until ${failure.step}`);
    } else {
      const clock = run.play.game.clock;
      console.log(`  ok    ${run.step} steps, nothing broke. It is day ${clock.day}, state ${summary(run.play).hash}`);
    }
    console.log(`  did   ${deeds(run)}`);
    console.log(`  speed ${Math.round(run.step / (took / 1000)).toLocaleString('en-US')} steps a second: ${run.step} steps in ${seconds(took)} of wall clock on this machine, one run, the invariants checked after every step`);
  }
  if (seeds.length > 1) console.log(`${seeds.length - failed} of ${seeds.length} bots finished with nothing broken`);
  return failed > 0 ? 1 : 0;
}

/** How many of the last inputs before the step a replay lists. */
const LAST_INPUTS = 12;

function replay(seed: number, until: number): number {
  if (until < 1) fail(`--until counts steps from 1\n${USAGE}`);
  const run = startBot(seed);
  // Read through a function, so the compiler does not take an earlier null for the answer.
  const failure = (): Failure | null => run.failure;
  console.log(`replay of bot seed ${seed}: ${run.start}`);
  const before = until - 1;
  run.advance(Math.max(0, before - LAST_INPUTS));
  const inputs: string[] = [];
  while (run.step < before && !failure()) {
    run.advance(1);
    if (run.last) inputs.push(`  step ${run.step}: ${describe(run.last)}`);
  }
  const early = failure();
  if (early) {
    console.log(`  FAIL  it broke earlier, at step ${early.step}: ${early.what}`);
    console.log(`        replay: bun tools/sim.ts --replay ${seed} --until ${early.step}`);
    return 1;
  }
  if (inputs.length > 0) console.log(`the last ${inputs.length} inputs before step ${until}:\n${inputs.join('\n')}`);
  console.log(`the state after step ${before}, before step ${until}:`);
  console.log(JSON.stringify(summary(run.play), null, 2));
  run.advance(1);
  console.log(`step ${until} presses ${run.last ? describe(run.last) : 'nothing'}`);
  const broke = failure();
  if (broke) {
    console.log(`  FAIL  seed ${seed}, step ${broke.step}: ${broke.what}`);
    return 1;
  }
  console.log(`  ok    nothing broke at step ${until}. The state after it is ${summary(run.play).hash}`);
  return 0;
}

const args = process.argv.slice(2);
if (args.includes('--replay')) {
  const seed = whole(option(args, '--replay') ?? '', 'the seed');
  const until = whole(option(args, '--until') ?? fail(`--replay needs --until <step>\n${USAGE}`), 'the step');
  process.exit(replay(seed, until));
} else if (args[0] === 'scenarios') {
  process.exit(scenarios(args.slice(1)));
} else if (args[0] === 'bot') {
  const seeds = (option(args, '--seed') ?? '1').split(',').map((text) => whole(text, 'a seed'));
  process.exit(bot(seeds, whole(option(args, '--steps') ?? '100000', 'the steps')));
} else {
  fail(USAGE);
}
