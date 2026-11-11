# A bed, a fence or a workbench could be set down on a growing crop

Found by the bot on 2026-11-11. Fixed in the same branch. The scenario `nothing-set-down-on-a-crop` keeps it fixed.

## What happened

The hero tilled soil, planted wheat, then clicked the secondary button on that soil with a bed in hand. The
bed went down on top of the wheat. The wheat stayed in the crop list, under the bed, where nobody could
harvest it or see it.

The rules promise that the cell over a growing crop stays open. `place()` in `src/game/actions/index.sim.ts`
checked that for a block and not for a placed thing. Build mode already refused it, through `judge` in
`src/game/build/plan.sim.ts`.

The invariant that caught it: "a crop stands on tilled soil with nothing over it".

## Seed and step

| Seed | Step | What went down |
|---|---|---|
| 32 | 637 | A bed, on two cells of wheat |
| 21 | 54100 | A workbench |
| 39 | 87870 | A workbench |

```
the wheat at -70, 20, -240 has block 24 over it
```

Block 24 is the unseen barrier that fills a placed thing's cells.

## Replay

The fix is in this branch, so the replay fails only on the commit before it:

```
git checkout ec34cdc
bun tools/sim.ts --replay 32 --until 637
```

It prints the state after step 636, then step 637's click, then the failure.

## Fix

Three lines in `place()`: a placed thing is refused, with "There is no room for it here.", when a crop grows
under any of its cells.

`bun tools/sim.ts scenarios nothing-set-down-on-a-crop` failed at its eighth input before the fix and passes after.
