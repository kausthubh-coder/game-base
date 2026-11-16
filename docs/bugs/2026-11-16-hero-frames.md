# Hero briefly appears as an animal

State: ISSUES. The reported substitution is not reproduced. No product repair is justified by the observations below.

The user reports an animal appearing briefly in place of the hero while walking or using the shovel. The supplied screenshot shows a large hero beside a separate green creature. It does not establish that the hero's frame changed owner.

## Earlier repair

Commit `8f11356e` added facing hysteresis. Its report described diagonal movement wobbling between the hero's front, side and back drawings. It did not reproduce an animal sheet being sampled. The existing regression still passes, but cannot establish that this newer report has the same cause. `e93bba40` concerns projected framing bounds, not sprite frame ownership.

## Checks and observations

- `bun test src/features/sprites` passed before adding the probe, with 43 tests. After adding `ownership.test.ts`, 44 tests pass.
- `bun test src/features/sprites/ownership.test.ts` loads the full shipped sprite atlas. It exercises all hero and hero-swing animations, all eight facings, every frame, and unrelated frog/mossling replacement that can move packed instance slots. It checks the selected page, sheet bounds and actual atlas bytes against the source sheet. It passes unchanged product source.
- `bun tools/typecheck.mjs sprites` passes.
- The source and immutable preview use identical hero/hero-swing metadata and decoded image pixels. Both contain the same GLSL frame calculation. Every frame of both source sheets was visually inspected; none depicts an animal.
- `bun tools/check-hero-gpu-modulo.mjs` tests the shipped `mod(frame, frames)` calculation on the M4 GPU for integer ticks 0 through 5999 with counts 3, 4 and 6. All results agree with integer remainder. This is a timing arithmetic probe, not an end-to-end frame ownership check.
- `bun tools/check-hero-rendered-frames.mjs --url http://127.0.0.1:5797/` compares the immutable preview's rendered opaque hero pixels with its source sheet. All 128 animation, facing and frame combinations pass with unrelated creature removal/addition. This isolates the real preview sprite renderer and full atlas; it does not drive the game's shovel action or prove the reported transient cannot happen.
- A fresh browser context imported the unedited `attempt-14/middle-pit.save.json` earned checkpoint and used real W/A/S/D input. The probe retained 193 drawn instance-buffer observations with player actor identity. The reviewed before/after captures show the hero. This is finite walking evidence, not a successful reproduction or complete action replay.

## Sensitivity check, not the original bug

The ownership test was run with the hero handle's definition deliberately replaced by the frog's definition. It failed with an out-of-sheet selection, then passed after restoring the pristine test. The exact mutation and logs are retained. This establishes that the assertions can detect a wrong owner. It does **not** establish how the reported bug occurs and is not an original-error red/green repair.

Evidence is under `.artifacts/hero-frame-repair/`: `source-green.log`, `typecheck.log`, `synthetic-owner-mutation.diff`, `synthetic-owner-red.log`, `ownership-restored-green.log`, `preview-source-comparison.json`, `gpu-modulo-original.json`, `preview-rendered-frames.json`, `preview-walk.json`, and the reviewed `preview-farm-before.png`/`preview-farm-after.png`.

## Outstanding proof

A capture of the actual substitution must retain the triggering direction/action, player actor sprite/animation, selected instance data and GPU output at that instant. The walking and isolated pixel probes did not provide that failing instant. Shovel input in the reported location, every camera mode, source browser playback, and the combined `verify-game` run remain outstanding. No assets, raw saves, approved pictures or immutable preview files changed. The helper's server on 5797 and its browser jobs were stopped. The user's preview PID 92343 on 5796 was preserved.
