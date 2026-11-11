# The rules, with no browser

Everything a `.sim.ts` file decides can be played in Bun: the same kernel and systems the game runs, stepped 20 times a game second.

## Sub-features

- `scenario`: a seed, a list of inputs and what must be true at the end.
- `bot`: random valid inputs under a seed, with the rules that must always hold checked after every step.
- `replay`: the same game again, up to the step before a failure.

## How to get to it (user POV)

A player does these with keys and clicks. A scenario presses the same inputs as data, so it covers the rule, not the picture.

## Driving it with `bun tools/sim.ts`

Preconditions: none. No build, no server.

- **All scenarios:** `bun tools/sim.ts scenarios` prints `pass` or `fail` for each, with the reason.
- **One bot:** `bun tools/sim.ts bot --seed 7 --steps 100000` ends with `ok ... nothing broke` or `FAIL seed 7, step N` and the replay command.
- **Replay:** `bun tools/sim.ts --replay <seed> --until <step>` prints the last inputs and the state before the failing step.
- **A new scenario:** copy a file in `src/game/scenarios/`, add it to `all.sim.ts`, and read `src/game/scenarios/README.md` for the inputs it can press.

Proof for a rule change: the scenario's line from `scenarios`, and a clean bot run of at least three seeds.

## Gotchas

- The bot clicks along a ray from the hero's eyes. The game casts from the camera, so a bot cannot find a camera bug.
- Bugs the bots found and nobody fixed are in `docs/bugs/`. Read them before filing the same one.
- Break the rule on purpose once and see your scenario fail. A scenario that cannot fail proves nothing.
