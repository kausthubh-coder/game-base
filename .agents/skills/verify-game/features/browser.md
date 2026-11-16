# The game in Chrome

The real page, built and served on this machine, in headless Chrome on the graphics chip.

## Sub-features

- `door`: reach any point of the game through `window.__game`.
- `human`: real keys and clicks only. A whole playtest in this mode is the `playtest-game` skill.
- `shots`: fixed scenes compared with approved pictures, with the draw budgets.

## How to get to it (user POV)

The player opens the page, presses New game, walks with W A S D, talks with E, opens the menu with Escape.

## Driving it with `bun tools/play.mjs`

Preconditions: `bun tools/doctor.mjs` is clean. Use the port it printed (`PLAY_PORT`).

- **Start:** `bun tools/play.mjs start --mode door` (or `--mode human`). It builds, serves and opens the game.
- **Read:** `bun tools/play.mjs state` prints the game's state as JSON: player, clock, quests, bag, talk, camera.
- **Act through the door:** `bun tools/play.mjs do '{"type":"door","method":"skipTo","args":["blessing"]}'`. Other methods: `teleport`, `give`, `setTime`, `step`, `interact`, `talkThrough`.
- **Act like a person:** `bun tools/play.mjs do '{"type":"hold","key":"KeyW","ms":250}'`, `'{"type":"press","key":"KeyE"}'`, `'{"type":"click","text":"New game"}'`.
- **Check:** `bun tools/play.mjs do '{"type":"check","path":"talk.npc","equals":"tamsin"}'` waits for the state and fails on timeout.
- **Look:** `bun tools/play.mjs act '<input>' <name>` plays an input and prints the picture's path, the interface as text, what looks wrong and what changed; `look` does the same with no input, `film '<input>'` shows motion as a sheet of frames. Open the picture. `shot <png>` is one picture outside the journal.
- **Keep it:** `bun tools/play.mjs record <name>`, play, `record stop`, and copy the file into `tools/play/scenarios/`. `bun tools/play.mjs replay <file>` runs it again and fails on a console error or a failed check.
- **Stop:** `bun tools/play.mjs stop`.
- **Pictures:** `bun tools/shots.mjs all --check`. Scenes are in `tools/shots/scenes.json`.

`tools/play/README.md` has every input.

## Gotchas

- Human mode refuses door inputs. Start a second session to mix them.
- `tools/play-smoke.mjs` and `play-ui.mjs` are the `slow` part. The `beta` part verifies the retained fresh Begin-to-Gallery chain described in `docs/beta-replay.md`. The old `play-act1.mjs` remains the explicit `legacy-act1` diagnostic; it is not current-story acceptance. A check in them waits for state, never for a count of frames (`tools/play/wait.mjs`); `tools/play/frame-checks.md` tells how frame-count waits once hid a real bug.
- Approved pictures are compared only with the same renderer. A different one warns and checks the budgets alone.
- The background cache does not register under automation. Add `?sw` to the address to test it.

## Dialogue scene fixtures

`PLAY_PORT=<your port> bun tools/play-sight.mjs scenes --shots` checks every scene from a fresh world. `--only 15,16,25,32` selects scenes without inheriting earlier scene state. The report tests the chest and sampled body points; inspect pictures as well, since those rays do not cover every sprite pixel.

A vault-return scene uses the exact region place used by `ruins.outOfVault`, including its height. Other approach fixtures start a few blocks short of their scene place. These are scripted scene checks, not earned progression or a replacement for a real-input vault return. `--no-build` reuses the retained `dist-sight` build; use it only when game source has not changed since that build.

## Current UI replay

`PLAY_PORT=<your port> bun tools/play-ui.mjs` builds afresh and runs desktop,
phone and world-title profiles. Inspect `.artifacts/play/ui-*.png` and `ui.json`.
The opening checks use Grant day and Hobb. Later interactions use a fresh,
explicitly supplied blessing fixture. Supplied items are not earned rewards.
`docs/ui-replay-coverage.md` maps every coverage area, including unresolved gaps.
The separate `play-act1.mjs` remains in the slow selection and still needs its
story migration. A UI replay result does not establish full Act 1 acceptance.

For Settings displacement, run `PLAY_PORT=<your port> bun tools/play-ui.mjs --only layout --repeat 5`. This builds afresh, uses the real Settings controls, checks the opening hint and records focus, scroll and container bounds in `ui.json`. Finish with the complete UI replay. The tracker check completes the current pump choice through dialogue input and checks its visible progress again after Continue. Production has no numeric quest step, so numeric browser coverage is unavailable; numeric unit tests remain.

## Grant day with browser input

`PLAY_PORT=<your port> bun tools/play-grantday.mjs` builds a fresh copy and starts
an empty browser context. It clicks Begin and the opening film's skip control,
walks with browser keys, chooses the mirror look and rack weapon, spars with F
and a mouse click, signs the deed, and waits for the normal ferry presentation.
It records its actions and captures in `.artifacts/grantday-input/`.
Use `--out .artifacts/grantday-review` for an independent replay that preserves
the earlier captures and earned saves. `--out` requires a directory argument.

For grant/quay framing, use `--quality high` and `--quality low`. The runner
records entry, approach, settled and each dialogue turn in `framing.json`, with
actual `saltgate:` and `stage:` actor positions and projected body samples.
It fails for missing cast, samples below the film bars, or a face/chest covered
by another actor's central body bounds. Inspect the PNGs too: these sampled
bounds do not test every sprite pixel. `sight()` omits Saltgate sprites and
ignores sprite occlusion, so its green result alone is insufficient here.

`PLAY_PORT=<your port> bun tools/play-grantday-framing.mjs --quality low --out .artifacts/grantday-framing/focused-low`
uses the existing `dist-grantday` build for a short diagnostic fixture. It loads
the original unedited mid-spar save, sets scene 4 complete and teleports to the
two scenes. This is framing coverage only; finish with the fresh input runner.

The middle checkpoint uses the public `window.__game.save()` entry point,
reloads, clicks Begin under "Carries on from your save", and compares guard, flags and bag before continuing.
`mid-spar.save.json` and `earned-landing.save.json` are unedited local-storage
exports. Inspect the decisive captures and `replay.json`; a failed run does not
establish landing coverage. This command covers stage 1 only. Keep the old
`play-act1.mjs` and the verifier's slow selection until all migration stages in
`docs/current-act1-replay.md` are complete. Run this separately from verification
because both use the worktree's port.

## First night from the earned landing

`PLAY_PORT=<your port> bun tools/play-firstnight.mjs --save .artifacts/grantday-framing-review/input/earned-landing.save.json --out .artifacts/first-night-input/review`
builds a fresh production copy. The required `--save` imports the exact stage boundary once, then the title's Continue flow starts play. `--out` preserves earlier runs in separate directories. The runner records real movement, pointer aiming, camera keys, digging, gathering, camp setup, dialogue and sleep, plus read-only observations and public saves. It saves and Continues after irrigation. Its bounded one-second `advance` calls are disclosed idle waiting for dusk after all ground work; they never replace required actions or set the time or weather.

Inspect the milestone PNGs and `replay.json`. A failed run retains its last capture and trace. Only a successful complete run produces `earned-morning.save.json`. This is stage 2 coverage only; keep `play-act1.mjs` and the default verification selections enabled.

## Earned blessing and homestead

`PLAY_PORT=<your port> bun tools/play-homestead.mjs --save <unedited-earned-morning.save.json> --out <new-evidence-directory>` imports the raw stage boundary and enters through Continue. `--running` tests the independent running-pump choice and stops after scene 17; the default leaves it crated and continues toward the kitchen. Each invocation requires a new output directory. Read `replay.json` for the actual verdict and last earned checkpoint. An incomplete route is BLOCKED, even when earlier milestones passed. Check the report before treating this command as full kitchen coverage.

The runner uses ordinary movement, dialogue choice keys, mouse gathering, bag crafting and placement, and resident panels. It records read-only state observations and public saves. Resume an interrupted run only from its unedited earned checkpoint and retain the complete input-hash chain. A final acceptance run starts at the earned morning. Keep the default verifier selection and legacy Act 1 runner unchanged.

For the recurring field exit specifically, run `bun test tools/lib/field-exit.test.ts`, then the complete first-night command above. Its field-return and field-outward captures prove both keyboard directions in the production browser.

`--guidance-only` checks the current quest log from an earned pre-thistlehog checkpoint, without attempting the journey. It asserts that the log names the attack input and held F calm input. Its PASS proves guidance only.

## Grey wood from the earned homestead

`PLAY_PORT=<your port> bun tools/play-greywood.mjs --save .artifacts/homestead-input/proven-homestead/earned-homestead.save.json --out <new-evidence-directory>` requires the historical homestead hash from `docs/greywood-input.md`. It builds production, imports the bytes once through title Continue, walks to Wren, saves and Continues before the unfinished fox pack, fights with state-responsive browser inputs, offers the Mark to the boar, hears scene 21 and returns home. It records public saves and read-only observations. Inspect its per-line PNGs, `replay.json`, middle exports and raw `earned-greywood.save.json`. A raw save retained by a failed run is earned progress, not acceptance.

For blessing presentation only, add `--blessing-only` to the homestead runner. `INCOMING_TURNS=0..3` rotates the incoming camera with real Q presses; R restores that heading before entering the Hall. Repeat at high and low quality and with `--running`. `tools/play-sight.mjs scenes --only 16,18,19,20,21 --shots --bodies` adds separate actor-body checks to the diagnostic scene fixtures. Keep default verification and the legacy full Act 1 runner unchanged.

## Earned workbench and copper

`PLAY_PORT=<your port> bun tools/play-bench-copper.mjs --save .artifacts/greywood-input/final-earned/earned-greywood.save.json --out <empty-directory>` verifies the exact input hash, imports through title Continue and uses browser controls for workbench, posts, kit, gathering, hedge, irrigation and carrots. Growth waits use bounded one-second idle advancement after planting and irrigation; read its recorded trace. Middle Continue compares stable progression and companion identity/bond. The fox's running seed timer can advance during reload.

Both choice branches import identical raw earned pre-choice bytes in independent contexts. The final path uses Give. `--resume-earned-choice` accepts only the retained garden-attempt checkpoint hash for diagnosis; it is not a fresh complete acceptance run. Inspect the raw saves, decisive PNGs and actual replay verdict. A retained partial save or an interrupted output is not completion evidence.

For complete dialogue coverage, run `bun tools/play-sight.mjs scenes --shots --bodies --quality high --out <empty-directory>` and repeat with `--quality low --dist dist-sight-low`. The explicit output option refuses nonempty folders. Keep results from both qualities, including failures. Frame JSON accompanies each body check. Memory scenes hide the present-day hero intentionally; their visible past cast still receives the same body and scenery checks.

After an earned copper replay passes, run `bun tools/audit-bench-copper.mjs <run-directory>`. It requires the historical input hash, strict middle persistence, both imports of the same pre-choice bytes, the consumed strip, a registered fitting dodge and the exact quest boundary. Then use `bun tools/continue-copper.mjs --save <raw-outcome.save.json> --out <empty-directory>` for Take, Give and the final home export. This reuses `dist-bench-copper`; finish the main production build first. It checks settled modes, residents, world edits and once-only rewards without editing the import.

For the copper return's moving resident regression, add `--recover-dax` and use the exact coordinator checkpoint `.artifacts/bench-copper-review/input/last-earned-checkpoint.save.json`. The hash guard accepts only those raw bytes. This reduced replay restores watch, assigns yard, then restores watch again through the resident panel. Inspect `dax-approach` observations and all three transition captures. It proves recovery only; run the full historical greywood route, raw audit and final Continue for acceptance.

## Earned Gold on the arches

`PLAY_PORT=<your port> bun tools/play-gold-arches.mjs --save .artifacts/copper-return-recovery/final-earned/earned-copper.save.json --out <empty-directory>` requires the exact historical copper boundary. It records normal UI movement, Maren's gifts, planting, watering, harvest, trading, ledger choice, the road lighting, combat and home Continue. Read the actual `replay.json` verdict and the report under `.artifacts/gold-arches-input` before claiming coverage. A failed or diagnostic recovery is not a complete route. Growth alone uses bounded one-second idle advances after real planting and watering. Public saves and read-only navigation/projection are disclosed in the trace. The default verifier, old runner and six approvals remain unchanged.

`--resume-maren`, `--resume-field` and `--resume-crops` accept only specific unedited checkpoints retained in that report. They diagnose the failed route without replaying its prior inputs. Their successful verdict is RECOVERY, never full acceptance. Use the full copper-boundary command with a new production build for acceptance.

The runner captures each restored save through a disclosed public-save observer immediately after the Continue click, before the next simulation frame. This keeps the crop and wet timers exactly comparable without stopping or editing the simulation. Later settled captures still run at ordinary elapsed time. Further diagnostic flags `--resume-harvest` and `--resume-counter` accept only the retained raw harvest and pre-sale hashes. They also report RECOVERY. Run `bun tools/audit-gold-arches.mjs <successful-full-run-directory>` only after a full PASS; it rejects partial and diagnostic runs.

The lynx requires Heartstone 3. The earned runner stocks Hobb's larder with gathered wild berries before supper, crafts a lamp from owned materials and places it by the saved home's actual door. It then attends the lighting, sleeps, and verifies the earned level before returning to the arches. `--resume-needs` accepts only the retained fed-road morning checkpoint and diagnoses the food/light prerequisite. It may observe the grass later than the immediate next morning, so it is RECOVERY only.

Checkpoint exports now press the normal Pause key before saving and reloading, preventing page-hide autosave from replacing the checkpoint with a later simulation tick. `--resume-final` accepts only the retained supper-lamp home export and checks that exact final Continue independently. Keep its RECOVERY verdict separate from full copper-boundary acceptance.

`--continue-earned` independently imports the exact accepted Gold export, waits for the visible Heartstone and farms to settle, then runs the paused checkpoint comparison. The final capture also waits for the HUD's rise animation to end. The full earned trace remains separate; this command is a final Continue check, not another full route.

## Echo from earned Gold

`PLAY_PORT=<your port> bun tools/play-echo.mjs --save .artifacts/gold-arches-input/accepted-earned/earned-gold.save.json --out <empty-directory>` requires the historical Gold hash in `docs/echo-input.md`. Acquire the shared heavy-browser lock before building or running it. It imports raw bytes through title Continue, uses browser keys and clicks, and exports public saves without editing them. Independent choice contexts import identical raw earned pre-choice bytes. Read the actual replay verdict and retained failure before claiming coverage. Honey production and evening use ordinary elapsed waits, recorded separately from interactive inputs. Both shrine paths and both dinner paths reload identical raw earned pre-choice bytes. Preserve the legacy runner, verifier selection and six approvals.

After a full Echo PASS, run `bun tools/audit-echo.mjs <earned-run-directory>`.
It rejects partial runs, checks raw Continue pairs, identical choice imports,
rewards and the pre-keeper quest boundary, and writes the raw export hashes.

`ECHO_DIST=<fresh-production-folder> PLAY_PORT=<your port> bun tools/check-echo-presentation.mjs <earned-run-directory> <new-output-directory>`
reuses a known production build. It imports unedited earned checkpoints for
high/low map, dinner and home captures. Inspect those PNGs and use
`play-sight.mjs scenes --only 24 --shots --bodies --quality high` and its low
counterpart for the full memory cast. Keep this presentation replay separate
from earned progression. Acquire the shared heavy-browser lock for each job.

## Sprite-only characters

The hero, NPCs and creatures always use sprites. The former Settings character switch, `setCharacters()` and `?chars=models` renderer option are removed. Old saved preferences and URLs must still load sprites. Run `bun tools/chars-swap.mjs --url <served-build> --out <new-directory>` (the historical command now checks this compatibility behavior), then `bun tools/play-camera-blockers.mjs --url <served-build> --out <new-directory> --active-heavy-jobs <0-or-1>` for first-person concealment, story cleanup and desktop cancellation. Inspect the screenshots; retain historical model evidence without treating it as current acceptance. Environment models and separate art experiments are unchanged.
