# Forest recovery and vault return visibility

Continue the game with GPT 6.1 Sol for implementation and verification. Astra retains ownership of new 3D art. This slice fixes the playable forest return and checks the interrupted visibility work. It does not approve or resculpt the forest models.

## Checked base

Use the existing act1-wilds-forest checkout at /Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5. The coordinator merged local act1 f99221ca into preserved forest 5cc03c8f as 686ed6ea. The merge was clean. `bun run check` and `bun run lint` pass; logs are .artifacts/forest-recovery/merge-check.log and merge-lint.log. Doctor --quick passed and assigned PORT=5559 PLAY_PORT=5559. Do not create or switch checkouts. No other writer owns this branch.

The forest branch holds substantial older unaccepted art and placement work, plus interrupted visibility changes in 5cc03c8f. Read their diffs against act1 before treating them as accepted. The merge brings verified vault behavior without bringing the marsh branch. Do not import marsh wholesale or disturb its separate worktree.

## Problem and diagnosis

The integrated vault replay captured a foreground fern hiding most of the hero when Calla speaks after the south-door exit. Read .artifacts/rooms-integrated/report.md and inspect .artifacts/rooms-integrated/harvester/return-after.webp and its JSON. The same folder's finish-harvester.mjs records the real earned return path. Reproduce on this forest branch before fixing: the older forest geometry and camera work may change which mesh blocks the actor.

Identify the actual occluder and whether the problem is authored placement, scattered dressing, camera targeting or sight cuts. Isolate it in the runtime and record the red capture. Do not globally remove forest dressing, move the conversation to bypass the exit, hide the HUD, weaken visibility checks, or fabricate earned progression. Prefer a small clearance or visibility fix that preserves unrelated placement and RNG. The separate marsh Gallery fix in 3f7af468 is useful read-only reference if the cause is wilds scatter; it is not a prerequisite merge.

## Ownership

You may change forest placement in src/game/content/wilds-forest.ts and src/game/region, relevant painted dressing and visibility code in src/features/painted, src/features/camera, src/game/shell/sight.ts, and tests beside those files. Tools may change only when needed to reproduce a genuine check, with existing callers preserved. Evidence belongs in .artifacts/forest-recovery and the report there. Keep source and evidence commits separate when practical.

Do not change model builders, 3D geometry, art palettes, sprites, protected vault models, room gameplay, reward rules, screenshot approvals, budgets, dependencies or cloud/deployment files. Preserve interrupted work unless a demonstrated regression warrants a narrow correction. Any model art defect belongs in the report for Astra.

## Proof

1. Reproduce and fix the post-vault fern obstruction with a regression that fails before the fix. Capture actors with normal HUD and actual conversation framing at high and low quality.
2. Walk with keyboard from the vault exit, finish Calla's dialogue through input, return along the forest approach and re-approach the entrance. Verify companion visibility, movement and interaction prompts. If starting from a saved earned fixture, disclose its source and every changed field. Setup can use the debug door; measured traversal uses real input.
3. Check visibility while quality switches low, medium, high, and while entering/leaving a forest grove. Compare the CPU sight rule and painted shader around the preserved 5cc03c8f changes. Add a meaningful regression only where necessary.
4. Run verify-game on final source. All existing approved screenshots and budgets must remain unchanged. Run focused camera/painted/forest tests and the relevant sight checks. Investigate failures rather than increasing tolerances or marking them passed.
5. Inspect every decisive before/after capture. Report any remaining forest art or visibility defects honestly. Do not claim an entire Act 1 playthrough from a local fixture.

Commit completed slices locally. No push, merge, main edit or deployment. No helpers. Finish all started jobs and close only your own browsers and servers. Report PASS, ISSUES or BLOCKED, tested and evidence SHAs, exact commands, inspected best and worst pictures, fixture limits and remaining work.
