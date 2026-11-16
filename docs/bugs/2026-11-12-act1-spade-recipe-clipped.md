# The spade recipe clips its required plank count

Priority: P2, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Opened Bag, By hand, Spade at 1366x768.

Only the tops of Plank and 0/2 are visible. The detail panel clips 54 percent of both labels.

Expected: The ditch in chapter 27 quest 2 requires a spade. The recipe must show the materials and count without hiding the ingredient row.

## Reproduction and limits

Original route plus two clean replays: 3/3. Both replay attempts fail the clean assertion on Plank and 0/2.

```sh
bun tools/play.mjs replay tools/play/scenarios/spade-recipe.json
```

## Pictures

- `.artifacts/playtest-1/025-spade-recipe.png`
- `.artifacts/playtest-1/spade-repro.png`

State: fixed. Fixed on `act1-camera`: the detail column's picture gives way on a short screen, so the needs are never cut (`src/game/ui/styles.ui.ts`). Check: `tools/play/scenarios/spade-recipe.json` (this recording, moved), which fails without the fix and passes with it.
