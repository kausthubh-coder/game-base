# Forest visibility and spawn regression

Continue on existing act1-wilds-forest at /Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5. Use GPT 6.1 Sol for this rendering and verification work. Astra retains 3D asset ownership. Read docs/forest-recovery.md, .artifacts/forest-recovery/report.md and .artifacts/forest-review/report.md. Preserve the clean committed work, including the diagnostic fix 77d92993 and title-test fix b0c9954c.

## Confirmed problems

The original fern at the earned vault return does not reproduce here. Current return framing is clear. At .artifacts/forest-recovery/path/grove-entry-high.webp, however, a giant root crosses the hero's torso. The report tests the chest only and says clear. Vertical dotted cut boundaries are also conspicuous. Reproduce on current runtime and identify whether the root's material opts out of sight cuts, the height/start guard protects it, CPU and shader differ, or the projected sprite body extends beyond the sampled chest. These are hypotheses, not established causes. Capture the real obstructed view before changing it.

The spawn approved screenshot also fails on this branch, before and after the diagnostic change. The helper measured 2.66 percent against the existing 2.5 percent limit. Compare .artifacts/forest-recovery/baseline-spawn.png and the approved spawn image with the same renderer. The helper suspects extra grant-stone dithering. Isolate the actual change against act1, especially the grove CPU/shader additions, rather than assuming the screenshot should be approved.

## Implementation

Keep all model builder and asset bytes unchanged. Fix sight/material integration or actor clearance narrowly. Preserve floor and held-item visibility, forest cover away from actors, near-camera transition, companion/keeper targets, and grove enter/leave easing. Do not globally hide roots or turn off forest dressing. Keep CPU and GLSL behavior aligned. Strengthen the visibility regression at the seam that actually fails; do not merely label a partially hidden actor as clear. Avoid per-frame allocation and retain the quality table and existing budgets.

You own relevant src/features/camera, src/features/painted, src/game/shell/sight.ts and tests; narrowly required view material metadata is allowed. Evidence and replay scripts belong in .artifacts/forest-visibility. No game story, combat, rewards, model resculpting, screenshot approval, tolerance, dependency or cloud changes. The coordinator owns integration.

## Acceptance

Reproduce root obstruction and the spawn screenshot failure first. Fix causes with red-to-green proof. Run all six unchanged shots, focused camera/painted/shell tests, typechecks and default verify-game. Run relevant sight scenes and replay the earned-save forest route at high and low with live medium/high switching. The existing .artifacts/forest-recovery/path.mjs accepts HARVESTER_OUT for fresh output; it loads the unchanged earned-before-return save. Inspect actual normal-HUD images at root crossing, grove entry/exit and Calla return. Keep every actor readable while preserving surrounding scenery. Record view errors and sample positions. Do not claim newly earned victory if using the saved replay fixture.

The slow UI and Act 1 runners still expect the old six-quest story. Coordinator repeated that failure and fixed only the title null dereference. Do not weaken, disable or migrate those runners in this visual slice. Record them as a separate known verification migration, not a visual PASS. All default verify parts must pass before technical acceptance of this slice. Forest art still requires separate Astra review.

Commit completed source slices and evidence locally. No helpers, new checkout, push, merge or deployment. Finish all owned jobs and close owned browsers/servers. Report PASS, ISSUES or BLOCKED with exact tested SHA, commands, best/worst inspected images, fixture limits and outstanding defects.
