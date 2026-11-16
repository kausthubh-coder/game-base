---
name: verify-chapter
description: Verify a story chapter, resume an earned progression replay, repair its runner, or decide whether a chapter is accepted.
---

# Verify a chapter

One chapter ends at a named player-visible result, such as earning the Gallery keystone. Its starting save is preserved. A diagnostic fixture can test a repair but cannot establish earned progression.

## Prepare

1. Name the chapter's start, final result, scene ids, choices, inventory changes and Continue check. Keep later chapters outside this acceptance scope.
2. Create or reuse a tracked chapter module under `tools/chapters/`. Export `id`, `requirements` for additional evidence names, and `async play(run)`. Run it with `bun tools/chapter.mjs tools/chapters/<id>.mjs <starting-save>`. The module receives preserved save bytes as `run.startingSave`. For the opening only, omit the save and start a new game.
3. Commit the repair and chapter module before collecting final acceptance evidence. The attempt records HEAD, its starting checkpoint hash and a unique report path. Keep failed reports and checkpoints.

## Preflight before the earned replay

Call `await run.preflight([{ name: 'rules', run: checkRules }, { name: 'presentation', run: checkPresentation }, { name: 'budgets', run: checkBudgets }])`. Each callback runs its check and returns exactly `true` only on success. The module rejects missing checks and stops on failure.

- `rules` runs the chapter's rules scenarios and focused regressions.
- `presentation` uses diagnostic fixtures for each chapter scene. On Act 1, use `bun tools/play-sight.mjs scenes --only <ids> --shots` where that tool exists. Check desktop and phone, at high and low, including the last dialogue line and scene cleanup. Inspect the images. On a checkout without the scene tool, write a focused browser check before proceeding. Generic approved shots do not cover these scenes.
- `budgets` reads actual draw calls and triangles for those views against the one quality table. Keep raw values with the images. A camera repair gets another budget check before replay.

Fix each failed check with its focused reproduction, then repeat preflight. Use one browser job at a time when resources require it. Source review and rules checks can proceed independently.

## Earn and accept

1. For earned play, expose an async `window.__replayInput(key, down)` bridge with `page.exposeFunction`. Map its movement keys to browser keyboard codes and await `page.keyboard.down` or `page.keyboard.up`; record inputs and track held keys. Then call `await page.evaluate(installReplayDriver, { mode: 'realtime' })` from `tools/workflow/replay.mjs` after the debug door is ready. Reinstall the driver after reload, reusing the page's binding, and install a binding for each new page. See `installDriver` in `tools/play-gallery.mjs` for the working bridge. The default mode uses debug keys and simulation advancement for legacy diagnostics, including `tools/play-act1.mjs`; it is not an earned-input installation.
2. Await `window.__replay.walk(goal, options)` and require `result.ok === true`. Supply the actual entrance height. `via` contains block coordinates and may include `y`. Preserve each authored waypoint's height, including passages below bridges; `heightAt` can select an upper floor. For a verified authored local route, `{ authored: true }` follows the supplied leg with ordinary input and retains the same arrival checks. A route on another floor is not arrival. Diagnose a stalled route with read-only rules queries, then validate it with ordinary movement. Change terrain only after reproducing an unreachable player route.
3. Await `window.__replay.act(target, { reach, aim, press, done })` for a targeted action. Supply the authored reach and exact target. Bridge `aim` and `press` to awaited browser mouse and keyboard input. Await `done`, which returns exactly `true` only after observing the requested result. See `targeted` in `tools/play-gallery.mjs`. Combat tactics remain chapter-specific; targeting and reach go through this method.
4. Wrap each earned milestone in `await run.step(name, action, verify)`. `verify` returns exactly `true` only for the expected observed result. An exception or false result writes a failed attempt immediately.
5. Save the earned result to a new file. Record files with `run.evidence(name, path)` for `earned-save`, `state`, `continue`, `inventory`, `desktop-high`, `desktop-low`, `phone-high`, `phone-low`, and each additional declared requirement. Continue evidence comes from saving, reloading and observing the same progression. Inventory evidence accounts for costs, automatic pickups and companion gifts.
6. Call `run.accept()`. It rejects failed or absent replay, missing or changed evidence and edits to the starting save. Evidence presence does not judge its contents. The chapter's assertions and image review do that.
7. Run the appropriate `verify-game` regression checks. Retain a final end-to-end Act 1 replay before calling the whole act complete.

## Adoption in an existing thread

Read this skill from the workflow checkout, then integrate its commits into the story branch at a safe checkpoint. Resolve `tools/play-act1.mjs` by retaining the current story and replacing only its copied navigation helper with the shared driver. Port the active chapter runner from `.artifacts/` into `tools/chapters/` and use the interface above. Commit the adapter, run preflight, then resume the nearest preserved earned save. Keep diagnostic evidence labelled as diagnostic. A skill on another branch does not automatically change a running agent's context.

## Report

Give the accepted report path, starting checkpoint, earned result and remaining chapters. Separate game failures, runner failures and diagnostic-only passes. Give a completion estimate only when the remaining scope and measured work support one.
