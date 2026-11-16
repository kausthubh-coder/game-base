# Keep the speakers visible in Act 1 scenes

Continue on the existing act1-wilds-forest checkout. Use GPT 6.1 Sol for staging and verification; Astra owns 3D assets. This slice keeps scene actors readable without changing the story or rewriting the models.

## Reviewed work

Source bf9f21dc fixes the root crossing the hero's torso, distinguishes wood from other solid materials and expands diagnostic rays below the chest. Coordinator independently repeated all 43 focused tests and the real WebGL/CPU comparison. Inspected the corrected root view and Calla return. Default verify passed all eight parts in the helper's evidence. Forest art still has conspicuous seams and sparse dressing.

A full coordinator scene run found failures missed by the helper's selected scenes. Source was temporarily changed to restore the former masonry width, with both CPU and GLSL coefficients changed together. Selected scenes 15, 16 and 32 still failed. The comparison restored both source files exactly. Do not attribute all failures to the new narrower masonry width or broaden every material until one screenshot passes.

The coordinator also corrected tools/play-sight.mjs. Each scene now begins in a fresh world. Previously scene 19 failed in the full sequence but passed alone; scene 25 did the reverse. Vault-start scenes now use the exact region place and height used by ruins.outOfVault, instead of a generic diagonal approach that placed the hero in water. Scene 25 passes on the corrected fixture. This is a framing fixture, not newly earned progression. The runner and verification skill describe the distinction. Preserve this isolation and the body samples.

## Failures to resolve

Read .artifacts/forest-visibility-review/report.md and its final logs before editing. Inspect the saved images. Reward notifications from skipTo can cover faces in the fixture; let those expire or dismiss them through their real UI before measured scene playback, with a bounded state wait. Do not remove or hide the DOM to make acceptance captures look clean. Expected remaining cases from the selected run:

- Scene 15, The morning after: Tamsin's body is partly behind a boulder/grant stone. The existing sim stage reuses a nearby real NPC when within six metres of the authored cast point, and the view clears only stand-ins. Determine whether that is the actual cause.
- Scene 16, The blessing: the revealed crate covers Calla's body from line seven onward. Check authored prop placement and when actor clearance runs relative to a newly revealed prop.
- Scene 32, Three keystones: the hero is obscured by terrace wall/terrain in the approach fixture. Compare a real keyboard approach and scene trigger with the fixture before changing staging or terrain. Use the actual entrance, not an arbitrary safe replacement position.

Treat these as visual failures, not permission to omit speakers or ignore their lower body. If the full isolated run finds another related failure, diagnose it within the same scene presentation scope. Distinguish genuine game defects from invalid fixture setup and preserve a red-to-green check for each.

## Ownership and constraints

Own src/game/views/story-stage.view.ts, src/game/story/scenes.sim.ts, relevant tests, and narrow staging data in src/game/content/scenes.ts. tools/play-sight.mjs may change only to match actual player setup and assert the same visibility contract. The coordinator delegates these files explicitly. Do not change narrative text, scene/reward flags, quest order, combat or opening behavior. Do not change model builders, assets, shader width, screenshot approvals, tolerances, budgets, dependencies or cloud files.

Prefer local staging corrections. A real NPC must keep its schedule and position after the scene; stand-ins must be cleaned up. The hero's camera and control must restore after dialogue. Do not globally remove scenery, disable a prop, hide HUD notifications in acceptance captures, bypass the normal scene trigger, or silently turn an earned-path check into direct scene playback. Fixtures may reach the start of a local test, with exact disclosures.

## Done

Run every dialogue scene at high and low in isolation using the updated runner, plus focused standalone runs of the repaired cases. Compare their results to the complete sequence. Inspect normal-HUD images on every affected line and verify the actor and prop placement remains coherent. Reproduce each affected scene by normal approach/interaction after disclosed progression setup. Scene 25's exact-exit fixture should also be compared to a real Pump exit, without claiming a newly earned keeper win if reward flags were supplied.

Run default verify-game with all six unchanged approved images, focused story/view tests and relevant typechecks. Recheck the saved forest route at high/low if a shared camera or staging method changes. Keep the accepted tree-root clearance and Calla vault return.

The old UI/full Act 1 slow runners still expect obsolete plot/bread quests. Their planned migration is separate; do not disable or weaken them here. Passing this scene slice is not a complete Act 1 playthrough or forest art acceptance.

Commit source slices and evidence locally. Evidence belongs in .artifacts/scene-visibility. No helpers, checkout changes, push, merge or deployment. Finish owned jobs, stop only your own browser/server processes. Report tested and evidence SHAs, exact commands, inspected best/worst images, fixture limits and all unresolved failures.
