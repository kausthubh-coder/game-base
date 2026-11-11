---
name: test-game
description: Add a check for a feature or a bug in the game - a scenario, a bot rule, a browser recording, an approved picture, a two-player check. Use when asked to test something, when a bug is reported, and before fixing any bug.
---

# Test the game

Pick the cheapest check that can fail for the thing you care about. Then see it fail once.

| The thing | The check | Where it lives | Run it |
|---|---|---|---|
| A rule: farming, crafting, building, quests, pets | A scenario: a seed, inputs as data, what must be true | `src/game/scenarios/<name>.sim.ts`, listed in `all.sim.ts` | `bun tools/sim.ts scenarios <name>` |
| Something that must hold always (no count below zero, nothing floating) | An invariant the bots check after every step | `src/game/play/invariants.sim.ts` | `bun tools/sim.ts bot --seed 1,2,3 --steps 100000` |
| One function's answers | A unit test beside the code | `<file>.test.ts` | `bun test <path>` |
| What a player hits in a browser: a prompt, a panel, a drag | A recording in human mode, real keys and clicks only. `see` and `gone` assert on what the screen shows, `check` on the state. | `tools/play/scenarios/<name>.json` | `bun tools/play.mjs replay <file>`, or `replay all` |
| How a place looks, and its draw calls and triangles | A scene with an approved picture | `tools/shots/scenes.json`, `docs/shots/approved/` | `bun tools/shots.mjs <scene> --check` |
| Two players in one world | A step in the two-browser check | `tools/play-together.mjs` | `bun tools/play-together.mjs` |
| Sign-in, the invite link, the live database | A step in the signed-in check | `tools/play-together-signed-in.mjs` | `bun tools/play-together-signed-in.mjs` |
| The world server alone | A server test or a step of its check | `server/test/` | `bun test server`, `bun server/test/check.ts` |
| The database's functions and who may call them | A Convex test, with the refusals | `convex/*.test.ts` | `bunx vitest run --root convex` |
| Every order of events in a small design | A model | The `formal-game` skill | |

`src/game/scenarios/README.md` has the scenario inputs. `tools/play/README.md` has the browser inputs.

A check finds only what it asserts. To find what nobody asserted (how it looks, what a new player misses), play it with the `playtest-game` skill, then turn each bug it finds into a check from this table. `docs/testing.md` says how scripts, playtests and models fit together.

## Rules for a check

- **See it fail.** Break the rule on purpose, run the check, see it fail, undo the break. A check that cannot fail proves nothing. The town scenario once stood on paving nobody can dig, and passed with the town's rule removed.
- **Wait for state, never for a count of frames or a sleep.** `tools/play/wait.mjs` has the waits. Frame counts hid a real bug for a day (`tools/play/frame-checks.md`).
- **Never weaken a check to make a run pass.** A failing check with a clear reason is the result.
- **Draw calls, triangles and shader counts are exact here.** Never report a frame rate from this Mac.

## A bug

1. Make it happen on demand: a scenario that fails, a bot's replay command, or a recording that fails. Say how often it fails out of how many tries.
2. Write it to `docs/bugs/<date>-<name>.md`: what you did, what you expected, what happened, the seed and step or the recording, the replay command. Read the files there first, so the same bug is not filed twice.
3. A check that fails until the fix would turn `bun run verify` red for everyone, so until then a failing recording lives beside its bug file as `docs/bugs/<date>-<name>.json` (`bun tools/play.mjs replay <file>` takes any path), and a failing scenario is written into the bug file.
4. The fix makes the check pass and moves it to its home (`tools/play/scenarios/`, `src/game/scenarios/`), where it stays.

A tester reports and does not fix game code, unless the brief says so. The fix goes to whoever builds.

## When you are done

`bun run verify` passes, with `--full` when you touched a browser check. Give the commands and their last lines, and what you did not check.
