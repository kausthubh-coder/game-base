# Hero briefly appears as an animal

State: the supplied video's abrupt darkening is reproduced and repaired. The hero sampled underground lighting while its drawing followed a smooth slope. An animal sheet replacing the hero was not observed. See the original-video section below for the failing and repaired real-input captures.

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

## Outstanding proof before the original video

A capture of the actual substitution must retain the triggering direction/action, player actor sprite/animation, selected instance data and GPU output at that instant. The walking and isolated pixel probes did not provide that failing instant. Shovel input in the reported location, every camera mode, source browser playback, and the combined `verify-game` run remain outstanding. No assets, raw saves, approved pictures or immutable preview files changed. The helper's server on 5797 and its browser jobs were stopped. The user's preview PID 92343 on 5796 was preserved.

## Original video and reproduced lighting failure

The user's supplied 1.8-second video contains 54 frames. Frames 11 through 17 show the same human walking drawing becoming dark, then returning to normal in frame 18. The hair, clothing and outline remain the hero's. The supplied file is preserved. Decoded originals and a contact sheet are in `.artifacts/hero-actual-frames/user-video/`.

The original runtime reproduces that visible blink on the west slope near the farm. Import the unedited earned `retry-03/03-home/earned-farm.save.json` checkpoint in a private browser, move the diagnostic starting point to x=-18.5, z=-217.5 at the world's physical ground height, then use ordinary keys to walk south to z=-213.5 and back. The teleport is a diagnostic setup step, not an earned progression claim.

`HERO_SLOPE=1 HERO_START=1 HERO_ASSERT_LIGHT=1 HERO_OUT=.artifacts/hero-actual-frames/slope-red-04 bun tools/capture-hero-actual-frames.mjs` exited 1 on unchanged `dist-grantday`. Seven captured outdoor frames sampled dark light while the physical feet had full sky light. A separate preceding pass reproduced the blink twice. Its frame 37 is bright, 38 is dark, and 41 is bright again. The actual uploaded GPU sprite attributes change sky light from 1 to 0 to 1. Sprite owner, atlas page and sheet bounds stay correct.

At the failing point, the painted drawing's feet are below the voxel surface. `readWorld` sampled light half a block above those drawn feet, inside solid ground. Sampling physical body height instead preserves outdoor light while the drawing follows the painted slope.

Commit `ace5e407` carries the physical lighting height from the player through the actor drawing to the sprite handle. Other callers can omit it. Stationary height changes, new tool-sheet handles, cave light and lamp light have regression checks. The two new checks failed on the original source, then the sprite and actor checks passed with 47 tests. The sprites type check passed. Built-runtime replay of the repair is still pending at this point in the log.

The broader real-input capture selected each of the four saved looks, walked in eight directions, and held the earned spade on actual ground blocks. The current runtime draws `hero` and `hero-swing` for all four look flags. This capture is retained in `run-03`, with every drawn crop paired with actor identity and the GPU instance-buffer readback. Runs `run-01` and `run-02` captured before the postprocessing output and contain blank crops; their pixels are invalid evidence. They remain preserved so they cannot be mistaken for successful visual checks.


## Repaired runtime replay

The same route passed against `dist-beta-sprite-ace5e407`, built from the repair. Run:

```sh
HERO_DIST=dist-beta-sprite-ace5e407 HERO_SLOPE=1 HERO_START=1 HERO_SLOPE_TOOLS=1 HERO_ASSERT_LIGHT=1 HERO_OUT=.artifacts/hero-actual-frames/slope-green-05 bun tools/capture-hero-actual-frames.mjs
```

The route captured 117 world frames. All seven frames whose old sample fell inside solid ground now retain full sky light in the actual GPU buffer. Frame 38 was opened at full size and remains bright. Four subsequent spade holds, one for each look flag, captured 649 frames including `hero-swing:tool` creation and return to `hero:idle`. None failed the physical-light check. GPU buffer and sheet ownership checks also passed. These are finite captures of the demonstrated failure and tool transitions, not a claim that every possible camera or device has been tested.

Evidence: `slope-red-04.log` and its `light-verdict.json`, `source-light-red.log`, `source-light-green.log`, `source-light-typecheck.log`, and `slope-green-05/` under `.artifacts/hero-actual-frames/`. Each frame pairs a crop taken after postprocessing with actor state, physical feet, sampled light, and the actual bound GPU instance data. `tested-runner.mjs` and input/build hashes retain the exact capture setup. The browser used a fresh private context at 1366×768 on the Apple M4 Metal renderer. Its server PID 88321 and browser were closed. The protected user preview was unchanged. The coordinator owns the full release verification and deployment.
