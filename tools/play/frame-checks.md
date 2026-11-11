PASS

# Browser checks and rendered frames

The camera and typing failures came from the checks. Cancelling a bag drag also exposed a game bug.

The investigation used branch `t3/fix-browser-frame-rate-checks`, based on `54a98b1`, in
`/Users/dabot/.t3/worktrees/game-base/t3-245d5d66-7e24b33e5f15945b`.
The doctor passed all 803 tests and assigned port 5998. Nothing was pushed or merged.

## Causes and evidence

| Check | Cause and evidence | Side and fix |
|---|---|---|
| Smoke pointer | `settle()` waits for land loading. It does not wait for camera easing. The projected point moved between calculation and input, so the ray hit a neighboring cell. The focused probe missed 5/5 times. | Script. `fbc9d5e` waits for the camera's world and projection matrices to stop changing. The probe then hit 5/5 times. |
| Smoke breaking | The script held the pointer over a stale projection and inspected the original cell. It also bounded the hold by 30 rendered frames rather than by the block changing. The original Metal smoke run failed this check, 1/1. | Script. `fbc9d5e` settles the camera and waits for the target block to become air, with a timeout. |
| Smoke walking | Four rendered frames need not contain enough rule steps to walk half a block. The first five-trial probe fell short in 2/5 trials; the full original smoke run fell short too. | Script. `fbc9d5e` releases W when the player crosses the distance threshold. The fixed probe passed 5/5. |
| UI typing | Three frames can precede the first letter due on a voiced line. After the voice list was ready, the natural probe sampled empty text while the clip played in 5/5 trials; all later showed partial text. Delaying real mp3 responses by 300 ms also reproduced 5/5 misses. An earlier probe without the land-ready wait missed 0/5. | Script. `5ee1ca2` waits for partial text or completion before inspecting the sample. The controlled fixed probe passed 5/5. |
| Act 1 farm aim | Each unsuccessful attempt turned the camera again after a small frame count. The script then projected through a lens still moving toward its last turn. The full original play failed at step 16, 1/1. The exact farm-cell probe missed 5/5. | Script. `fbc9d5e` settles the lens before projecting. `f6763a1` keeps the exact farm-cell repro, which passes 5/5 with the state wait. |
| Bag click-to-move after Escape | Escape ended a drag and cleared click suppression with a zero-delay timer. A later mouse release delivered a click to the captured source slot and picked its stack back up. Subsequent clicks swapped stacks. Delayed-release probes failed at both 250 ms and 1000 ms; immediate release passed. The recorded human replay failed 1/1 before the fix with `held: "axe"`. | Game. `03bc4c4` keeps suppression until the release click or a new physical press. The same human replay passed after the fix with `held: null`. |
| UI gather during repetition | The UI also projected through a moving lens. One of two intermediate Metal runs left the inspected grass intact. | Script. `e2d82c3` waits for a stable lens and for the block state. |
| UI pictures and Act 1 voice validation | The build fingerprints filenames. Two UI assertions required unfingerprinted PNG names, and Act 1 fetched an obsolete voice-list URL and overlooked fingerprinted clip responses. | Scripts. `5ee1ca2` accepts fingerprinted PNGs. `e2d82c3` reads the voice-list path from the manifest and observes fingerprinted mp3 URLs. |

The game rules, shell clock and mouse aiming code needed no changes. The only game change is in `src/game/ui/drag.ui.ts`.

## Focused reproduction

Build with `bun run build`, then serve it with `bun tools/serve.mjs dist <port>`.
Set `PLAY_PORT` to that port for these commands. Stop that server by its printed PID.

```
bun tools/play/repro-frame-assumptions.mjs
bun tools/play/repro-frame-assumptions.mjs --fixed
bun tools/play/repro-frame-assumptions.mjs --farm
bun tools/play/repro-frame-assumptions.mjs --farm --fixed
bun tools/play/repro-typing.mjs
bun tools/play/repro-typing.mjs --fixed
```

The versions without `--fixed` intentionally reproduce the old script behavior and exit 1.
The typing probe delays real clip responses by 300 ms by default; it does not alter the game clock.
Set `TYPING_DELAY_MS=0` to reproduce with normal network responses. Both versions reproduced 5/5 misses, and both fixed versions passed 5/5.

The game regression is a human-mode recording. It obtains the axe through Tamsin's conversation,
opens the bag, drags, presses Escape, waits before releasing, and then moves the axe with clicks.
It closes the bag and checks that quick slot 1 is empty. It makes no door writes.

```
bun tools/play.mjs replay tools/play/scenarios/cancel-bag-drag.json
bun tools/play.mjs stop
```

The first software UI attempt exhausted the camera wait's 30-second deadline. Commit `632f47f` uses the scripts' existing 180-second deadline.

Raw reproduction and verification logs are in `.artifacts/metal/`.

## Implementation commits

```
fbc9d5e Wait for camera and player state in browser checks
5ee1ca2 Wait for dialogue typing state in the UI check
03bc4c4 Keep cancelled bag drags from picking stacks on release
e2d82c3 Use settled aim and fingerprinted voice assets in play checks
f6763a1 Keep a focused repro for the farm aiming failure
632f47f Allow the browser timeout for camera convergence
8853249 Expose the typing repro with normal clip responses
```

## Final Metal runs

Each command below used the defaults unless a separate build directory is shown.

Run 2, `.artifacts/metal/metal-smoke-2.log`:

```
PLAY_PORT=5997 bun tools/play-smoke.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 34 checks, no console errors
```

Run 3, `.artifacts/metal/metal-smoke-3.log`:

```
PLAY_PORT=5997 bun tools/play-smoke.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 34 checks, no console errors
```

Run 4, `.artifacts/metal/metal-smoke-4.log`:

```
PLAY_PORT=5998 bun tools/play-smoke.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 34 checks, no console errors
```

Run 3, `.artifacts/metal/metal-ui-3.log`:

```
PLAY_PORT=5997 bun tools/play-ui.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
108 of 108 checks pass. 26 screenshots in .artifacts/play/. Report: .artifacts/play/ui.json
```

Run 4, `.artifacts/metal/metal-ui-4.log`:

```
PLAY_PORT=5998 bun tools/play-ui.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
108 of 108 checks pass. 26 screenshots in .artifacts/play/. Report: .artifacts/play/ui.json
```

Run 5, `.artifacts/metal/metal-ui-5.log`:

```
PLAY_PORT=5998 bun tools/play-ui.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
108 of 108 checks pass. 26 screenshots in .artifacts/play/. Report: .artifacts/play/ui.json
```

Run 2, `.artifacts/metal/metal-build-2.log`:

```
PLAY_PORT=5997 bun tools/play-build.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
38 of 38 checks passed. Screenshots are in /Users/dabot/.t3/worktrees/game-base/t3-245d5d66-7e24b33e5f15945b/.artifacts/build.
```

Run 3, `.artifacts/metal/metal-build-3.log`:

```
PLAY_PORT=5997 bun tools/play-build.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
38 of 38 checks passed. Screenshots are in /Users/dabot/.t3/worktrees/game-base/t3-245d5d66-7e24b33e5f15945b/.artifacts/build.
```

Run 4, `.artifacts/metal/metal-build-4.log`:

```
PLAY_PORT=5998 bun tools/play-build.mjs --dist .artifacts/metal/site-build-4
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
38 of 38 checks passed. Screenshots are in /Users/dabot/.t3/worktrees/game-base/t3-245d5d66-7e24b33e5f15945b/.artifacts/build.
```

Run 2, `.artifacts/metal/metal-drag-2.log`:

```
PLAY_PORT=5997 bun tools/play-drag.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 46 of 46 drag checks
```

Run 3, `.artifacts/metal/metal-drag-3.log`:

```
PLAY_PORT=5997 bun tools/play-drag.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 46 of 46 drag checks
```

Run 4, `.artifacts/metal/metal-drag-4.log`:

```
PLAY_PORT=5998 bun tools/play-drag.mjs --dist .artifacts/metal/site-drag-4
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 46 of 46 drag checks
```

Run 2, `.artifacts/metal/metal-act1-2.log`:

```
PLAY_PORT=5997 bun tools/play-act1.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: tilt camera, 24 steps, 0 console errors, 0 camera turns to aim, 2.5 minutes
```

Run 3, `.artifacts/metal/metal-act1-3.log`:

```
PLAY_PORT=5997 bun tools/play-act1.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: tilt camera, 24 steps, 0 console errors, 0 camera turns to aim, 2.5 minutes
```

Run 4, `.artifacts/metal/metal-act1-4.log`:

```
PLAY_PORT=5998 bun tools/play-act1.mjs --dist .artifacts/metal/site-act1-4
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: tilt camera, 24 steps, 0 console errors, 0 camera turns to aim, 2.6 minutes
```

## Final software runs

`.artifacts/metal/software-smoke-1.log`:

```
PLAY_PORT=5997 CHROME_SOFTWARE=1 bun tools/play-smoke.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
PASS: 34 checks, no console errors
```

`.artifacts/metal/software-ui-2.log`:

```
PLAY_PORT=5998 CHROME_SOFTWARE=1 bun tools/play-ui.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
108 of 108 checks pass. 26 screenshots in .artifacts/play/. Report: .artifacts/play/ui.json
```

`.artifacts/metal/software-build-1.log`:

```
PLAY_PORT=5997 CHROME_SOFTWARE=1 bun tools/play-build.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
38 of 38 checks passed. Screenshots are in /Users/dabot/.t3/worktrees/game-base/t3-245d5d66-7e24b33e5f15945b/.artifacts/build.
```

`.artifacts/metal/software-drag-1.log`:

```
PLAY_PORT=5998 CHROME_SOFTWARE=1 bun tools/play-drag.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
PASS: 46 of 46 drag checks
```

`.artifacts/metal/software-act1-1.log`:

```
PLAY_PORT=5998 CHROME_SOFTWARE=1 bun tools/play-act1.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
PASS: tilt camera, 24 steps, 0 console errors, 0 camera turns to aim, 10.8 minutes
```

## Other verification

```
bun run check
803 pass
0 fail

bun tools/sim.ts scenarios
10 of 10 scenarios passed

SHOTS_PORT=5993 bun tools/shots.mjs all --check
PASS: 6 scenes

bun tools/typecheck.mjs --paths src/game/ui
exit 0, no output

bun tools/play.mjs replay tools/play/scenarios/cancel-bag-drag.json
pass: true, inputs: 62, held: null
```

The human replay failed before `03bc4c4` with a timeout waiting for `held: null`.
The saved state had `held: "axe"`. The same recording passed after the fix.
The play session and the temporary probe servers were stopped.

Not checked: Windows, physical weak devices, full human-mode act 1, or full act 1 with the free and first-person cameras.
Build and drag checked their existing camera flows. No rule-step bug was found in these failures.
