# scenarios

Each file here is one scenario: a seed, where the game starts, a list of inputs, and what must be true at
the end. They play through the real rules in Bun, with no browser, in about a second for all of them.

```
bun tools/sim.ts scenarios                        every scenario, and the first part as one more
bun tools/sim.ts scenarios build-stroke           one by name
bun tools/sim.ts bot --seed 1,2,3 --steps 100000  bots that press random valid inputs
bun tools/sim.ts --replay 8 --until 90386         a bot's game to the step before, the state there, then the step
```

`bun run check` runs the scenarios too, through `scenarios.test.ts`, with short bot runs.

## The scenarios

| File | What it plays |
|---|---|
| `wheat-three-nights` | A bed and a roof, wheat planted at dusk, three nights, a harvest of 12 |
| `wheat-save-load` | The same, saved and loaded after the first night and before the harvest |
| `build-stroke` | Build mode: a stroke tills 12 cells, 10 seeds plant 10, a stroke waters, 6 fences go down, come back with undo and go down again |
| `workbench-crafting` | Logs to planks to a workbench, then 8 fences and a sprinkler, which keeps soil wet for 200 seconds |
| `fell-a-tree` | A tree felled with the axe, one by hand, and an oak over the mossy rocks that refuses |
| `befriend-a-pet` | A run startles the leaftail, three berries bond it, and it follows |
| `town-is-protected` | On the town's grass nothing is placed, dug, tilled or built |
| `nothing-set-down-on-a-crop` | A bug a bot found: a bed could be set down on wheat |
| `nothing-left-floating` | A bug a bot found: taking back a fence left the fence on top of it in the air |

## Write one

```ts
import type { Scenario } from '../play/scenario.sim.ts';

export const plankOnTheMeadow: Scenario = {
  name: 'plank-on-the-meadow',                    // the file's name
  about: 'A plank set down on the meadow leaves one in the bag.',
  seed: 21,                                       // the kernel's seed, for game.random()
  start: { quest: 'roof', give: { plank: 2 } },   // skipTo and gifts, as the debug door does them
  inputs: [
    { do: 'teleport', to: { place: 'grant.center', dz: 3 } },
    { do: 'take', item: 'plank' },
    { do: 'use', at: { place: 'grant.center' } }, // the ground block the place stands on
  ],
  expect: (p) => [['one plank is left', p.count('plank') === 1]],
};
```

Then add it to `all.sim.ts`. A test fails when a file here is missing from that list.

- The inputs are in `src/game/play/inputs.sim.ts`. A verb such as `use`, `walk` or `make` throws when the game
  refuses, and the scenario fails with that input and where the game was. `fails: true` expects the refusal.
- A place is a name from `src/game/content/region.ts`. A block is counted from the block the place stands in:
  `dx` east, `dz` south, and `dy` up, which is -1 when left out, the ground.
- Only `wait`, `walk`, `dig`, `fell`, `feed`, `keys` and `hold` let time pass. One step follows a `reload`, as the first frame after Continue does.
- `check` asserts something in the middle. `run` takes a function of the play for what the list has no word for.
- The invariants of `src/game/play/invariants.sim.ts` are checked after every kernel step.
- No file here is called `index.sim.ts`. `src/game/systems.ts` would install the folder as a system of the game.

Break the rule your scenario is about and run it. If it still passes, it checks something else. The town
scenario first stood on paving, which nobody can dig anywhere, and passed with the town's rule removed.

## A bug fix starts here

1. Get a failure you can run again: a scenario that fails, or a bot's replay command.
2. Write the bug to `docs/bugs/<date>-<name>.md`: what happened, the seed and the step, the replay command.
3. Fix it. The scenario passes, or the replay goes through.
4. Keep the scenario. A replay alone does not last, because a change to the rules or to the bot changes what
   a seed plays.

## The bot

One bot step is one press and one kernel step, with the hero's own body stepping. A seed decides the whole
game: the kernel's seed, the bot's choices, and where it starts.

| Seed, modulo 5 | Start |
|---|---|
| 0 | A new game with an empty bag |
| 1, 2, 3, 4 | The start of `roof`, `leaftail`, `bread`, `festival`, with every tool, seeds, planks, fences, a bed and the like |

The same seed twice gives the same state hash. A test asks for that, and the bot's last line prints the hash.

A failure prints its seed, its step and its replay command. The replay plays the same game to the step
before, prints the last twelve inputs and the state, then plays the step.

The steps a second on the bot's last line is wall-clock time for the steps alone, from one run, with the
invariants checked after every step. It changes with what the bot does: a bot that stands in a conversation
steps faster than one that fells trees.

## What this does not cover

- Nothing is drawn. A sprite at the wrong height or a missing texture passes here.
- A scenario's `walk` moves the hero along a nav path and skips the hero's own body. The bot uses the body.
- A click names a block in a scenario, and comes from a ray out of the hero's eyes in the bot. The game casts
  its ray from the camera, so a block hidden from the camera can be clicked here and not there.
- "Every started quest can still finish" checks that the people, places and items a quest needs still exist
  or can be had. It does not play the quest to its end. `src/game/play/act1.test.ts` does that for a clean game.
- The bot rarely reaches the town and rarely sleeps. The `did` line of a run shows what it got done.
