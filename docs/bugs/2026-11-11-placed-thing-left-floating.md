# Taking back a placed thing left the one standing on it in the air

Found by the bot on 2026-11-11. Fixed in the same branch. The scenario `nothing-left-floating` keeps it fixed.

## What happened

A fence stood on the ground with a second fence on top of it. The hero took the lower fence back into the
bag. The upper fence stayed where it was, with nothing under it.

The rules already keep a block in place while a station stands on it, "so the station never floats"
(`hold()` in `src/game/actions/index.sim.ts`). Nothing did the same for a placed thing under another placed
thing. Three ways took the lower one away:

| Way | Code | How it was found |
|---|---|---|
| A press on it in build mode | `lift()` in `src/game/build/index.sim.ts` | Bot seed 8, step 90386 |
| The primary button held on it | `hold()` and `pickUp()` in `src/game/actions/index.sim.ts` | An earlier draft of the bot, with two workbenches. The scenario reproduces it. |
| Undo of the stroke that set it down | `revert()` in `src/game/build/index.sim.ts` | Reading the code after the first two. The scenario reproduces it. |

The invariant that caught it: "a placed thing has solid ground under every cell".

```
the fence at 19, 24, -224 has no solid ground under 19, -224
```

## Replay

The fix is in this branch, so the replay fails only on the commit before it:

```
git checkout ec34cdc
bun tools/sim.ts --replay 8 --until 90386
```

It prints the state after step 90385, then step 90386's press, then the failure.

## Fix

`carriesAnother(placeables, placed)` in `src/game/actions/index.sim.ts` says whether another placed thing
stands on this one. `hold()`, `lift()` and `revert()` each ask it and leave the lower thing where it is. The
upper one can still be taken back first.

`bun tools/sim.ts scenarios nothing-left-floating` failed at its sixth input before the fix. With only the
first way fixed it failed at the tenth, and with two fixed at the last. It passes with all three.

`src/game/build/index.sim.ts` changed, so the checks of `.agents/skills/verify-build-stroke` were run:
`bun test src/game/build` passes, and `bun docs/verify/build-stroke/break-code.mjs` caught all 9 breaks. The
skill's "last confirmed at commit" line still names `4f03e93`.

## Not fixed

A plain block set on top of a placed thing still stays in the air when the thing is taken back. Blocks have
no gravity anywhere in the game, so no rule is broken.
