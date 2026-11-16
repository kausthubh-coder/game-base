# Steady bees never dropped wax

A living bee box produced four honey and no wax over a productive day. That blocked ordinary switchable-lamp crafting when the player had no wax. The Light chapter found this before its earned replay.

## Reproduction

`bun tools/chapters/lights-bee-observation.mjs` uses a diagnostic rules stage with one bee box, grass, and the player away from pickups. It runs the daylight interval and dusk and totals actual `good.made` events. Before the fix it exited 1 with rate 4, honey 4, wax 0. The original failure is retained in `.artifacts/lights-chapter/bee-day-reproduction.log`. No earned save was edited.

`pay` rounded each payout separately with `ceil(count / 2)`. Steady payouts contain one item, so each became honey. The same daily total paid at dusk could produce wax, making the split depend on when it was paid.

## Repair

Split against the cumulative number already paid that day. Steady production passes the count before the current drop; dusk passes the count already paid. Take starts its own split. The existing saved `paid` field preserves the split through Continue. No save fields, rates or total quantities changed, and old inventory is not rewritten.

## Checks

Before the repair, three new regressions failed: steady production gave 4 honey/0 wax; one steady drop plus dusk gave 3/1; Continue after the first honey gave another honey. The Take regression passed before and after.

After the repair:

- The original reproduction exits 0 with 2 honey and 2 wax.
- `bun test src/game/farms` passes all 32 tests. The four new cases cover steady production, dusk remainder, a fresh-kernel Continue after an odd payout, and Take with repeat rejection.
- `bun tools/typecheck.mjs --paths src/game/farms` passes. An initial optional-method call in the new test failed types and was corrected to an optional call whose result must still equal true or false.
- `bun tools/sim.ts scenarios` passes all 31 scenarios.
- `git diff --check` passes.

Fresh browser production, switchable-lamp crafting and the full regression verifier remain assigned to the Light chapter run on a newly built runtime. Existing diagnostic preflight stays evidence of the old runtime only. The player's Tailscale preview remains on the immutable Gallery build until a verified replacement is ready.
