# Chapter workflow integration

The active integration branch is `act1` in `/Users/dabot/.t3/worktrees/game-base/act1`.
The user requested local integration only. Do not deploy.

## Preserved history

- `4092eeb1` merges `tools/chapter-workflow`. The verifier keeps the existing art tool tests and adds workflow tests and fault checks.
- `1459725e` merges the current story branch, retaining the prior `act1` history.
- `8e7563b9` merges the Gallery safe handback through `f54a65fc`.

Both branches are ancestors of the integration commit. `src` and `public` match the story branch exactly at that commit. The existing end-to-end runner remains in `tools/play-act1.mjs`. Its copied navigation was replaced with the shared driver, while its story steps remain intact. Keep the final end-to-end Act 1 replay before accepting the whole act.

## Resume point

Use `.artifacts/gallery-input/attempt-33/rootsnare-ready-continued.save.json` unchanged.
Its SHA256 is `beaf194efbd23023cd666578e5c2f8a56c3a824ad0e381a2e8cdcf0a9973ff0b`.
This preserves the original earned chain through travel and lamp crafting. Rootsnare fight 8 remains unfinished. Attempt 32 is diagnostic and does not establish earned Gallery completion.

The safe handback manifest is `.artifacts/gallery-input/safe-handback.json`.
The predecessor accepted chapter save is `.artifacts/uphill-input/attempt-14/earned-uphill.save.json`, SHA256 `2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d`.

## Active work

Formal coverage review owns the build-stroke marker and its proof. It must review all covered changes and run the model comparison and fault checks before advancing the marker.

Gallery adoption owns the chapter module, shared real-time input driver, runner and focused tests. It must commit source before acceptance evidence, run rules, presentation and budget preflight, then resume the preserved earned checkpoint. Real-time replay must not advance simulation directly. Keep diagnostic passes separate from earned acceptance.

The updated `verify-chapter`, `verify-game` and `worktree-game` skills govern remaining work. The final chapter report must link its starting save, output save, Continue evidence, inventory audit and inspected desktop/phone views at high and low quality.

## Storage and setup

The checkout has normal source files and a sparse rule excluding `.artifacts`. Preserved evidence is copied with filesystem copy-on-write clones to avoid duplicate disk usage. Original evidence remains in the story checkout. The former act1 evidence is retained in the backup recorded by `.artifacts/workflow-integration/storage.json`. Never rewrite immutable historical evidence.

Setup and the read-only doctor passed with reserved port 5795. Setup removed deployment credentials from copied development configuration and kept the original in an ignored private backup. No backend was started or deployed.

Merge proof is `.artifacts/workflow-integration/merge-proof.json`. The baseline check log is `.artifacts/workflow-integration/baseline-check.log`. Integration does not itself accept Gallery or the whole act.

## Integration verification

The first baseline failed because the sparse merge removed a copied earned fixture. Its original bytes remained intact. Missing evidence was restored with copy-on-write clones without replacing existing files. The restored baseline passed `bun run check`, including all game and Convex tests. The parent also reran the build-stroke tests and formal sync successfully.

Formal review found only placeable orientation and sprinkler test changes within the covered paths. Stroke transitions, seed accounting and undo rules did not change. All nine deliberate faults were detected, including an isolated repeat. The marker now records reviewed source `8e7563b9`; bounded proof and limitations are in `.artifacts/chapter-formal/report.md`. Commit `51708055` contains both formal and integration evidence because their staged files overlapped during the parent commit. No edits were discarded.

The baseline has drained. The Gallery helper owns the single heavy-job slot, subject to a fresh admission probe before launch. Its adapter and replay remain in progress.

## Earned Gallery review

Attempt 06 has an accepted chapter report at `.artifacts/chapters/gallery-1794803002470-670683f6-66e1-4902-a951-6c2f52773b55.json`. Its invocation records source `6b79747c`, with the unchanged HUD runtime built from `0e753410`. Later `10867f2e` adds only a replay test.

The parent reran the complete transaction and preservation audit in an isolated copy. It passed. The parent checked every chapter evidence hash, the starting save hash, and the referenced raw presentation and image hashes. These passed. The parent inspected the final home image and the corrected phone scene images.

The earned result is `.artifacts/gallery-chapter/attempt-06/earned/earned-gallery.save.json`, SHA256 `1618cddda6e99fbd8185e916e27d3c0f3af9bd0a170a87e00325ebe7b840523d`. It records fights 8 and 9 won, keystones 1 and 2, scene 28, and Gallery complete. Keystone 3 remains unearned. The next active quest is Light that works, at the hatch step; Seeds remains at brass.

The original earned chain is preserved through the uphill boundary, attempt 33 Continue, attempt 04's won rootsnare checkpoint, and attempt 06. Failed attempts retain their reports. The route repair keeps waypoint heights and uses ordinary input to follow authored local legs.

Final default verification passes all nine parts in `.artifacts/gallery-chapter/final-verifier-02/verify.log`. All six approved comparisons passed unchanged. The recovery record reports exit 0, no interruption, and original fixed output directories restored with identical hashes. The first failed run remains preserved; `fca7e7c4` repaired its ambiguous mutation selector and added exact-target checking for both replay modes. Runtime behavior stayed unchanged, so the accepted chapter replay remains valid. The final end-to-end Act 1 replay remains required. Nothing has been deployed.

The chapter skill now explicitly requires the real-time driver and awaited browser input bridge for earned runs, with the Gallery implementation as its example. Legacy diagnostic mode remains available to the retained end-to-end runner.
