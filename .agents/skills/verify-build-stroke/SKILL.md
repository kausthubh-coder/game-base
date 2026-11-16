---
name: verify-build-stroke
description: Recheck the build-mode stroke (press, drag, release, cancel, undo) against its TLA+ model. Use after changing src/game/build/index.sim.ts, the `letGo` and `use` presses in src/game/shell/keys.ts, how src/game/views/world-build.view.ts calls press, release or cancel, the touch hold/capture lifecycle in src/game/views/touch-controls.ts or ui-touch.view.ts, or when `bun test src/game/build` fails in model.test.ts.
---

# Verify the build stroke

A stroke is one press, drag and release in build mode. Its design is `docs/verify/build-stroke/Stroke.tla`. A model checker walks every order of the events in it. `src/game/build/model.test.ts` then holds the real code to that design.

## The rules, and the harm when one breaks

| Rule in Stroke.tla | In plain words | The harm |
|---|---|---|
| `NoStuckStroke` | A stroke exists only while a logical primary hold remains | A field gets tilled by a later click, long after the player let go |
| `OneStrokePerPress` | One press applies at most one stroke | A stroke lands twice and takes its items twice |
| `AppliedWithTheSameHand` | A stroke is applied only in build mode, with the player free, with the item it was pressed with | A rectangle drawn with the hoe plants seeds, or lands under an open panel |
| `BagInBounds` | The bag never goes below nothing or over what it holds | Seeds from nowhere, or a negative count |
| `SeedsConserved` | Every seed is in the bag or in the ground | A stroke or an undo makes or loses items |

Seeds stand for everything that costs one item a cell: blocks, fences and placeables spend the bag through the same lines of code.

## Does your change touch it

| Model action | The code it stands for |
|---|---|
| `ButtonDown` | Mouse `buttonDown` or `touch.primary(true)` in `shell/keys.ts`, then `build.press()` from `views/world-build.view.ts`. Repeated mouse presses are permitted by `ButtonDown`; an existing stroke ignores them |
| `ButtonUp`, `ExtraRelease`, `Release`, `Fits`, `Ok`, `Applicable` | The last mouse/touch holder releases with `letGo('up')` in `keys.ts`, then `release()`, `commit()`, `apply()` and `compute()` in `build/index.sim.ts`, and `judge` in `build/plan.sim.ts` |
| `ButtonLost`, `RightPress` | `letGo('lost')` in `keys.ts`, including Escape, blur, release and the last touch cancellation; a right click or camera drag: `build.cancel()` |
| `Drag` | `build.point()` |
| `ToggleMode`, `Step` | `setActive()` and the system's `step()` |
| `Undo` | `undo()` and `revert()` |
| `SwitchHand`, `BusyOn`, `BusyOff`, `World…`, `BagGains`, `BagLoses` | The rest of the game: the quick slots, a panel, crops, the bag |

The reviewed commit and covered paths live in `coverage.json` beside this skill. Run `bun tools/formal-sync.mjs` first. CI fails when those files differ from the reviewed commit. Read every covered change with `maintain-formal-verification-skill`, run this skill, then advance the commit only after the code and model agree. A missing history commit needs a fetch, not a weaker check.

## Check a change

1. Run `bun test src/game/build docs/verify/build-stroke/input-contract.test.ts`. It takes about 2 seconds. `model.test.ts` plays 1,500 random runs of 200 events on the real systems and compares the game with `Model`, which is Stroke.tla's actions in TypeScript.
2. Read a failure. It gives a seed, the rule or the difference, and the last events in words.
   - A rule's name (`NoStuckStroke: …`) means the code broke that rule. That is a bug in the change.
   - `the game and the model differ` means the code and the design disagree. Decide which is right. If you meant to change the design, go to "Change the design". If not, it is a bug in the change.
   - `the plan called N cells ok and the release changed M` means the picture under the pointer and the change to the world disagree. That is a bug in `compute()`, `judge` or `apply()`.
   - A count under `AT_LEAST` means the random runs stopped reaching a case. The events or their weights need another look, not the code.
3. Run `bun docs/verify/build-stroke/break-code.mjs`. It temporarily edits `index.sim.ts` nine ways, restores it in `finally`, and expects the test to catch each. Run it only when other checks of this checkout have drained, or in an isolated copy of `src/` and this script with `node_modules` linked. Compare source hashes before and after the isolated run. `GONE` means your change removed the text of a break: write that break again for the new code, so the test is still shown to fail.
4. Run `bun docs/verify/build-stroke/break-input.mjs <new-output-folder>`. It copies the input sources and harness into that new folder, links dependencies, then catches four adapter mutations. The checkout's product files stay untouched. Keep output under the task's new artifact folder.
5. Run `bun tools/play-build.mjs` when you changed `keys.ts` or a view. For touch routing or capture changes, also run `bun tools/play-touch.mjs`. Reuse a passing run only with matching covered source and preserved logs. The pure adapter harness checks real keys and build rules but supplies DOM events itself; browser runs check actual delivery and capture.

Done when the tests, nine build mutations and four adapter mutations pass, plus the applicable browser checks. Compare covered product source hashes before and after mutations. Commit harness changes before advancing `coverage.json`: the guard also covers `docs/verify/build-stroke`, so its marker must name a commit containing the reviewed harness, not only the earlier product commit.

## Change the design

1. Change `Stroke.tla` first. Give every new rule as an INVARIANT in `Stroke.cfg` and `StrokeChart.cfg`.
2. Check it with the `/statechart` skill. Give it `Stroke.tla`, `Stroke.cfg` and `view.ts` from `docs/verify/build-stroke`. Read the result with that skill: it tells each broken rule as its shortest path in plain words. Every rule must hold. A rule that breaks is a finding about the design: fix the design, and never weaken the rule to make it pass.
3. For the picture, check `StrokeChart.cfg` the same way. It is one cell and the hoe, small enough to draw.
4. Run `bun docs/verify/build-stroke/break-model.mjs <a folder outside the repo>` and check each copy it writes with `/statechart`. Each must break the rule the script names for it. Add a break for each new rule.
5. Change `Model` in `model.test.ts` to match, then the code, then run "Check a change".
6. Move the commit in `coverage.json` forward, after you read the table against the new code and it is still true.

## What it covers and what it leaves out

Checked for every order of events, within these bounds: two cells, two tools, a bag of at most 3 seeds, and other systems giving or taking a seed at most twice. 47,432 states, about 2 seconds.

Checked on 1,500 random runs of the real code: that the code does what the design says after every event, and that the plan's `ok` count equals what a release changes.

Left out:

- Picking a placed thing up with a press, and turning a piece. `build.test.ts` tests both by example.
- Which cells a stroke covers and each cell's verdict. `build.test.ts` tests them by example.
- That a commit is one step. The model applies a whole stroke at once. The code applies it cell by cell and sends events as it goes, so a listener that changed the bag or a cell of the stroke in the middle would be outside the model. `apply()` counts the bag again for each cell for that reason.
- The browser's own events. The model starts at logical `use` and `letGo`, with `primary = mousePrimary || touchPrimary`. `input-contract.test.ts` checks 1,296 four-event hold sequences and targeted real-build cancellations; it does not exhaust browser event orders. `tools/play-build.mjs` checks that a right click, a lost window, the pause menu and a release over the quick slots reach the build system as the model assumes. It found one case the model could not: the pause menu took the keys before the view heard of it, and left a stroke with no button. `world-build.view.ts` now also drops, each frame, a stroke whose button is not down.


## Scope of the latest sync

Reviewed product commit: `61d7905939fed1a1f7473d7930b19edc85402bc5`, from marker `8e7563b940d7ac962618f1126ebbaa80b912fbb0`. The only previously covered product diff is `keys.ts`. Also reviewed every change to the new `views/touch-controls.ts` and `views/ui-touch.view.ts`; coverage now tracks both paths. Details and preserved test logs are in `.artifacts/beta-input-formal/report.md`.

Touch adds holders upstream of the same logical press/release/cancel actions. The adapter harness now checks both hold orders, both final-release orders, direct touch cancellation with a mouse held, Escape, blur, release, freeCursor and capture loss. `touchPointer` ownership and disposal are checked through its real exported function. All-finger teardown through the actual UI is browser evidence, not an exhaustive model claim. The original TLA+ model, invariants and two-cell/two-tool/bag-3 bounds are unchanged. TLC was not rerun because the model design did not change.

Mixed input has deliberate limits in the mapping. A touch-first mouse press emits a second `use`; `ButtonDown` already permits repeats and `build.press()` ignores an active stroke. Direct touch cancellation preserves a mouse hold. A native touch `pointercancel` bubbles to an unfiltered window handler and can cancel that mouse hold too. This is a conservative `ButtonLost`, not preservation of independent physical holds. Likewise `freeCursor(true)` alone clears touch but leaves an unlocked mouse held; the shell's `release()` supplies the full loss. The model proves stroke safety given these logical actions, not physical device independence or one use per physical press.

Story progression, navigation, combat, scene framing and inventory gains from other systems need their own checks. A build-stroke pass is never chapter acceptance.
