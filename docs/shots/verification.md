ISSUES

The browser tools are implemented and all five play scripts pass through the shared launcher. Smoke, UI and act 1 retain software because their existing assertions fail on Metal. High-quality farm and rain exceeded the geometry budget; the approved set uses medium quality.

Branch: `t3/browser-game-tools`. Worktree: `/Users/dabot/.t3/worktrees/game-base/t3-d124fb8f-8245fffe23ed578d`. Base: `8764e67`. Nothing was pushed or merged.

Implementation commits:

```
6cc6e3c Use a shared Chrome launcher with GPU drawing by default
32de608 Add a persistent browser play session and human quest replay
dff6ed3 Keep the persistent play build separate from other browser checks
49d6e80 Add approved scene pictures with renderer and geometry checks
cde8c79 Keep a door replay for the harvest festival
8f4bf00 Route the remaining play tools through Chrome and preserve timing checks
e9de9d8 Allow replay to reset a session after console errors
b8be4c3 Preserve software rendering for the UI timing scenario
abf5e30 Keep scene capture ports inside the assigned range
410f9d2 Document working door commands and keep session mode current
435712b Save an active named recording when the play session stops
4b69d0f Clarify which world picture scripts the scene tool covers
e2a0205 Store scene geometry budgets without frame timing samples
63913dd Freeze scene animation before comparing approved pictures
f30a2cb Allow the worktree bootstrap to supply browser tool ports
9efb4ed Give scene captures a separate port from the live play session
```

Each command below includes the final renderer and the script's last result line. All scripts also reported zero console errors.

```
PLAY_PORT=5527 bun tools/play-smoke.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
PASS: 34 checks, no console errors
```

```
PLAY_PORT=5527 bun tools/play-ui.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
108 of 108 checks pass. 26 screenshots in .artifacts/play/. Report: .artifacts/play/ui.json
```

```
PLAY_PORT=5528 bun tools/play-drag.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS: 46 of 46 drag checks
```

```
PLAY_PORT=5528 bun tools/play-build.mjs
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
38 of 38 checks passed. Screenshots are in /Users/dabot/.t3/worktrees/game-base/t3-d124fb8f-8245fffe23ed578d/.artifacts/build.
```

```
PLAY_PORT=5527 bun tools/play-act1.mjs
Chrome renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
PASS: tilt camera, 24 steps, 0 console errors, 0 camera turns to aim, 10.0 minutes
```

Observed script wall times, in seconds:

| Script | Original software source | First Metal attempt | Final passing run |
|---|---:|---:|---:|
| play-smoke | 78.63 | 7.89 | 103.65 |
| play-ui | 845.75 | 29.04 | 335.30 |
| play-drag | 173.43 | 9.68 | 24.25 |
| play-build | 286.53 | 17.20 | 17.20 |
| play-act1 | 740.65 | 127.69 | 600.72 |

These are one observation per case, including build, server and browser work. The host was heavily loaded by concurrent software Chrome processes. Interrupted runs were discarded. There were no five-run alternating samples, so the performance comparison is inconclusive and no speedup is claimed.

Smoke and UI references ran before migration. Drag, build and act-1 reference runs used original `8764e67` scripts in temporary files, with only paths adjusted for relocation. The copies were removed after verification.

The first Metal smoke attempt passed 31/34 checks; its pointer target, breaking and fixed-frame walking checks failed. UI passed 107/108, missing its typewriter sample. Command delays fixed that sample but exposed a click-to-move failure, so UI retains software. Act 1 stopped at farm-cell aiming after 15 steps. Comments beside their launch options explain the software exceptions. Drag initially passed 43/46; spacing browser commands by 250 ms lets quarter-turn easing finish and gives 46/46 on Metal. Build passed 38/38 on Metal.

The persistent player was verified with:

```
bun tools/play.mjs replay tools/play/scenarios/first-talk.json
bun tools/play.mjs replay tools/play/scenarios/first-talk.json
PASS: both fresh contexts sent seven inputs and opened Tamsin's conversation
bun tools/play.mjs replay tools/play/scenarios/festival.json
PASS: six inputs, tracked quest festival
bun tools/play.mjs shot .artifacts/browser-tools/festival-final.png
bun tools/play.mjs stop
```

Human mode sends real keys and mouse events and rejects door writes. Automatic recordings include attempted inputs. Named recording stop and session stop both saved inputs. A replay with an intentionally false state check exited 1; a subsequent human replay recovered successfully. Building shots alongside a live player left that session readable. Each tool serves its own build directory and its own port.

I inspected `.artifacts/browser-tools/festival-final.png`. It shows Hollowmere at dusk, the hero with the leaftail, the harvest-festival tracker asking for a river lamp, and the Almanac notification.

Scene commands and results:

```
bun tools/shots.mjs all --approve
PASS: 6 scenes
bun tools/shots.mjs all --check
PASS: 6 scenes
```

Two consecutive checks after fixed animation capture differed by at most 0.07% and 0.05% of pixels respectively. All six approved pictures were inspected: meadow, town, tilled farm, riverbank, night town and rain meadow. Each contains visible land.

| Approved scene, medium quality | Draw calls | Triangles |
|---|---:|---:|
| spawn | 86 | 341,194 |
| town | 75 | 278,357 |
| farm | 104 | 397,508 |
| river | 87 | 323,303 |
| night | 75 | 278,392 |
| rain | 86 | 342,580 |

Limits are 150 draw calls and 400,000 triangles. Initial high-quality farm and rain checks correctly failed at 443,285 and 401,447 triangles. No game rendering code was changed to reduce those costs.

Changing only spawn's time from 0.5 to 0.9, then running `bun tools/shots.mjs spawn --check`, exited 1:

```
spawn: 99.15% pixels differ
FAIL spawn: 99.15% pixels differ, limit 2.5%
FAIL spawn: scene settings differ from approval
FAIL: 2 scene checks
```

The scene data was restored and the complete six-scene check passed again. An intentionally different approved renderer produced a warning and a passing scene budget check, without comparing pixels. `--software` and `CHROME_SOFTWARE=1` both reported SwiftShader.

Built JavaScript totals 2,372,161 bytes; the application entry script is 1,480,689 bytes. There is no agreed script-size limit, so size is reported rather than gated. Geometry budgets are gated.

The six scenes cover subsets of `painted-shots.mjs`, `cam-shots.mjs`, `view-shots.mjs` and `town-shots.mjs`. Those scripts were kept. The remaining browser scripts received mechanical launcher changes and were not all run individually.

```
bun run check
738 pass
0 fail
```

An earlier concurrent check hit the existing build-model test's five-second timeout; a later unmodified check passed all 738 tests. There were no changes in `src/`, `package.json`, `AGENTS.md`, `.github/` or `tools/doctor.mjs`. No extra door read was needed.

Proposed rule 7:

> **Chrome uses the graphics chip by default.** Browser tools print their renderer; `--software` or `CHROME_SOFTWARE=1` selects software. Compare approved pictures only with the same renderer. Never infer Chromebook performance from a frame rate measured on this Mac.

Not checked: Windows, physical weak devices, player frame rate, every old one-scene tool, and full human-mode act 1. The kept human recording reaches the first quest giver; the full legacy act-1 browser run uses the door as its existing script does.
