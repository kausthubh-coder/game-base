# Update the interface replay for the current story

Use GPT 6.1 Sol in the existing act1-wilds-forest checkout. This is a verification-tool migration, not a new story or interface design. Read the current game content before choosing fixtures.

## Why

The coordinator reproduced tools/play-ui.mjs failing first on an absent Continue button, corrected in b0c9954c. It then treated Hobb's Grant day dialogue as Tamsin's old meeting, expected the former plot tracker and attempted skipTo('bread'), a quest that no longer exists. The current story starts with Grant day and has different quest and conversation IDs. See .artifacts/forest-review/ui-before.log and ui-after.log. The separate tools/play-act1.mjs also assumes the previous six quests; migrating that end-to-end story runner is a later slice.

## Plan

Before changing the replay, inventory its assertions in docs/ui-replay-coverage.md. Map every coverage area to the current behavior and a real content fixture. Retain title with/without a save, Settings and graphics/debug controls, opening/HUD/quest tracker, typing/voice/portraits and dialogue progression keys, choices, gains/toasts, quick slots, inventory drag/split/swap/keyboard operations and tooltips, panel transitions, map, movement/camera/build inputs, end-card presentation, save/Continue, phone layout and world title. If a behavior was intentionally removed, cite current source/design and provide its replacement coverage. Do not silently delete checks or accept any value returned by the implementation.

Use the actual Grant day opening for the new-game/HUD assertions. Treat later UI interactions as explicit independent setup fixtures where necessary. A UI test may use the debug door to reach a current quest or give inventory, but must use real input for the UI behavior it claims to test. Do not claim rewards were earned or story progression was completed from supplied state. Check conversation identity before and during dialogue, and let setup banners settle through their lifecycle. Do not clear busy flags to bypass active scenes, hide DOM/HUD, or replace a meaningful interaction with direct state mutation.

Choose current dialogue with choices and a real numeric quest tracker. Assert actual content and the intended state change, including unchanged quick-slot selection while a number chooses dialogue. Retain voice/typing checks; don't mute or skip a failing audio assertion. Keep restore semantics for Save/Continue and assert the current quest plus concrete persisted inventory rather than the removed bread ID.

## Ownership

Own tools/play-ui.mjs, narrowly needed tools/play helpers/tests, docs/ui-replay-coverage.md, and the relevant verify-game browser instructions. Put evidence in .artifacts/ui-replay-migration. Do not change tools/play-act1.mjs, verify part selection, gameplay/story content, UI design, assets/models, screenshot baselines, budgets, dependencies, account or cloud code. If the updated replay reveals a real game defect, reproduce and report it with its evidence instead of weakening the assertion. Small test-driver fixes belong here; product changes need a separately scoped follow-up.

## Acceptance

Run the old replay first to retain the actual red result. Complete the desktop, phone and world-title modes using current content. Run tools tests, lint, and default verify-game with the six unchanged approved pictures. Run the entire updated play-ui command from a fresh build and inspect its resulting screenshots for clipping/overlap and dialogue clarity. State which wider slow checks remain red because the legacy Act 1 runner is still pending; never report a full slow-suite pass from UI alone.

The previous scene visibility source ae3a0d99 and coordinator review are preserved. Forest art and end-to-end Act 1 acceptance remain separate. Commit source slices and evidence locally. No helpers, checkout changes, push, merge or deployment. Finish all owned jobs and close only owned browsers and servers. Report PASS/ISSUES/BLOCKED, tested/evidence SHAs, coverage mapping, commands, decisive images and all missing coverage or real game defects.
