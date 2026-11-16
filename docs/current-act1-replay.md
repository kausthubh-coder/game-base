# Recover browser progression checks for current Act 1

Latest boundary, November 16: Water uphill progression and bounded presentation are accepted. Runtime `ed91c447`, evidence `724a4f8a`, closes the remaining sampled Maren/Hall rendering costs. Parent reviewed the culling changes, reran 31 prop/machine/landmark tests and inspected the accepted low Maren and high scene-11/16 pictures. All eight default verifier parts and six unchanged approvals pass. Earlier phone framing, terrain, labels, camera guards and Continue retain the scopes recorded in `.artifacts/story-cost-repair/report.md` and its linked prior reports. Raw next input remains `.artifacts/uphill-input/attempt-14/earned-uphill.save.json`, SHA256 `2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d`. Next is the bounded Lamp Gallery route in `docs/gallery-input.md`. Later stages remain unfinished.

The old tools/play-act1.mjs plays the removed six-quest story. It remains enabled and visibly red until its current-story replacement covers the intended journey. Do not report full Act 1 completion from a shorter replacement.

## Stages

1. Prove Grant day from a fresh title to the Greenhollow landing with browser input. Add tools/play-grantday.mjs and preserve a replayable earned landing save.
2. Extend from that earned state through Ground nobody wanted and the first night. Preserve the mystery and current scene order.
3. Continue the current quests and farm/companion progression toward the vaults, using the existing keeper replays only as local aids, not substituted rewards.
4. Complete keystones, Rootworks, Stag and the pilgrimage. Reconcile all old movement, crafting, farming, companion, voice and save/continue coverage against the current design before replacing the obsolete full runner.

Stages 1 and 2 have earned input replays. Stage 2 presentation remains open at the Custodian and grant stone; docs/first-night-framing.md specifies the next repair. The later stages record what remains; they are not assumed tested.

## Stage 1 contract

Use GPT 6.1 Sol in existing act1-wilds-forest. Read AGENTS.md, current opening content and system, docs/testing.md, docs/act1-resume.md, and the relevant handbook chapters. The rules-only grant-day scenario is a route/behavior reference. It teleports and directly invokes methods, so it is not browser proof. Existing rack-choice-clear and deed-continue-key recordings are useful local references.

Start with a fresh browser profile and no save. Click Begin. Exercise the opening film through its real skip control, then finish Hobb's wake dialogue through keys. Walk to the mirror, choose a look through its UI, eat breakfast, reach Dax's lock table and the map wall, choose a weapon at the rack, land the sparring hits with actual mouse/keyboard input, sign the deed, reach the quay and ride the ferry through its normal presentation to the landing. Let the landing dialogue complete and assert current quest/scene state, chosen look/name/weapon, expected one-time gifts, restored controls and no view errors.

No skipTo, teleport, give, direct flags, direct damage, swing(), filmDone(), ferryDone(), direct opening choice methods or clearing busy state after the run begins. Read-only debug observations and bounded clock/frame advancement are allowed, but do not use time stepping to bypass an interactive action or the ferry's normal end condition. Use real browser input for every measured action and wait on state. Record inputs and screenshots so failures name the actual step.

Exercise local save/Continue at a meaningful middle checkpoint, preferably during the spar, via normal save UI when available or the public save entry point with explicit disclosure. Assert the remaining guard/progression is preserved and earlier scenes/rewards do not repeat. Finish from that restored state. Do not supply an edited save. A final save artifact must be earned by this exact browser run.

Own the new runner and narrowly shared tools/play helpers, a new current-opening browser regression if needed, relevant verification docs, and .artifacts/grantday-input evidence. Narrow actual opening input, prompt, collision or progression bug fixes are authorized in src/game/opening and its view/input code with meaningful red-to-green proof. Preserve narrative text/order, balance and reward amounts. Model/asset or visual redesign belongs to Astra, not this task. If a fix needs another system beyond that scope, report the concrete cause and evidence. Do not weaken acceptance to route around a broken player action.

Keep tools/play-act1.mjs and verifier selection unchanged in this first stage. Document the new command in verify-game browser instructions and run it. Run focused opening/rules tests, typechecks and default verification with all six unchanged approved shots. The new real-input runner must pass from a fresh build and produce an unedited earned landing save. Inspect the decisive captures for prompt, actor and camera visibility. No full Act 1, cloud, Windows, weak-device or forest art claim.

Commit completed slices locally. No helpers, checkout changes, push, merge or deployment. Finish owned jobs and stop only owned browsers/servers. Report PASS/ISSUES/BLOCKED, exact tested/evidence SHAs, commands, input and save paths, inspected best/worst images, actual fixes and untested behavior.

## Stage 1 implementation checkpoint

Implementation `35ae5b1dcdd84630084d265679cd609963e03b3b` adds the separate
`PLAY_PORT=5559 bun tools/play-grantday.mjs` command. Its committed-source fresh
build replay passes through the normal ferry arrival after a mid-spar local
save and Continue. The raw earned landing save and trace are in
`.artifacts/grantday-input/earned-landing.save.json` and `replay.json`; read
`.artifacts/grantday-input/report.md` for commands, provenance and visual issues.
The saved title currently calls Continue "Begin" and labels it "Carries on from
your save." No game code or assets changed in this slice.

At that checkpoint stages 2-4 remained pending. Keep the old full runner and verifier selection.
That proof establishes stage 1 progression; it does not accept the unchanged
world sprite, crowded grant framing, quay cropping or ferry landmark art.

## Stage 2 implementation checkpoint

Source 665c4b42 adds the missing dry field, bramble progression, camp setup and tent sleep. Helper evidence de98c2e6 and coordinator repeat 0ebeb1e4 both earn the full landing-to-Tamsin route with middle Continue. The new command is `bun tools/play-firstnight.mjs --save <earned-landing.save.json> --out <new-directory>`.

The coordinator's unedited morning save is `.artifacts/first-night-review/input/earned-morning.save.json`. Its report discloses idle simulation advancement and coverage limits. Stage 2 presentation still needs the repair in docs/first-night-framing.md. Stages 3 and 4 remain pending. Grant/quay framing has since been repaired; mirror appearance and broader art remain open.

## November15 Echo acceptance and next vault

The complete earned Echo route is accepted at .artifacts/echo-review/report.md, including shrine choices, bees/honey, dinner choices, map persistence and Continue. Its exact raw boundary for the next stage is recorded in docs/pump-input.md. Later presentation repairs are also accepted separately: warm tent canvas evidencec10be621; labels/map evidence1ae18eb2; temporary memory fox, Custodian framing and warning-free browser evidence1fdda6e6 on runtimec930e092. All8 default verifier parts and6 unchanged approvals passed on the latest scene snapshot. These do not establish later vault victories.

Next is the bounded earned Pump House route in docs/pump-input.md. Preserve the obsolete full runner and current verifier selection until the entire journey has matching input coverage, as required above.

## November 15 Pump progression accepted, exit presentation pending

Parent review accepts attempt 11's earned progression on runtime `4f7507fd`. The next raw boundary is `.artifacts/pump-input/attempt-11/earned-pump.save.json`, SHA256 `00bfc093d7f1aecb61838f6314d59db27b329dcc235dd7376a6feb28032bdf10`. The parent read the runtime and audit changes, reran the strict raw audit and 51 focused tests, and inspected earned keeper, memory, Calla and home images. All eight default verifier parts and six unchanged approved comparisons passed in the retained helper evidence. Console warnings/errors are empty. Both Calla choices, Continue boundaries, rewards and living-home preservation are covered. The extra seeds and fiber reconcile with observed farm production, existing loose stock, mossling gifts and the bonded fox.

Presentation is not fully accepted. In `attempt-11/25-calla-shown-line-4.png`, the hero and Calla stand waist-deep in the river during scene 25. The earlier dry-bank sight fixture did not reproduce this earned exit position. Repair and check the actual pre-Calla checkpoint at high and low, both branches, before closing this presentation issue. Preserve the raw earned save; no whole-route rerun is needed solely for a staging repair if focused restore/reward/cleanup checks establish its scope. Keep the old woman's authored offscreen voice unchanged.

After that repair, continue Water uphill from the accepted Pump boundary: waterwheel, gearling pit and choice, frog slick, terrace yield, ledger and Maren's visit. Later vaults and stages 3-4 remain incomplete. Keep the obsolete full runner until its intended coverage is replaced.

## November 15 Pump exit presentation repaired

PASS on runtime `cb0cf19a` and tested runner `8e64509e`, evidence `c389a6bfc66e97f1e764e86cbe437d9d0a6c8fba`. The ordinary Pump exit now returns four metres south of the flooded landmark centre onto the existing dry approach. Its height uses authored terrain when the exterior chunks are unloaded. Scene 25's cast and all dialogue remain unchanged.

The exact raw `attempt-11/pre-calla.save.json` was imported unchanged through Continue and exited with E. Both choices pass at high and low, with dry-column, rendered-foot-height, swimming, framing, camera restoration, cleanup, companion, flags, inventory, quest and repeat-seal checks. Every visible line, choice, return and keyboard walk-away image was inspected at full size. Scene-25 sight passes at high and low. All eight default verifier parts and all six unchanged approved comparisons pass. See `.artifacts/pump-exit-staging/report.md` and `checks/final-facts.json` for commands, complete hashes, failed candidates and limits. All owned jobs are closed.

This closes the earned exit's river-placement issue only. Attempt 11's accepted earned Pump raw boundary remains byte-for-byte unchanged, SHA256 `00bfc093d7f1aecb61838f6314d59db27b329dcc235dd7376a6feb28032bdf10`. The pre-Calla SHA256 remains `b0605b4257ed43df95c13dad746d59d8be79a5382afb220d5d2fba902147b06d`. All original proof remains intact. Next planned work is Water uphill from the accepted Pump boundary; it was not started here. Whole Act 1, cloud, Windows and device performance remain unclaimed.

## November 15 Water uphill earned, presentation issues retained

Attempt 14 completes the bounded route from the exact accepted Pump bytes through a turning waterwheel, productive unlit pit, both gearling choices, actual frog slick, a terrace harvest, the granary ledger and Maren's scene 27. Give is the main ending. Both choices import the same unedited pre-choice checkpoint. Middle and final Continue pass. The raw next boundary is `.artifacts/uphill-input/attempt-14/earned-uphill.save.json`, SHA256 `2e87196658d91e6cace033284b2b218414e242c4a4e1214d791ed999abdb771d`.

Runtime `da4617aa4af4c8d1a2a3179e0fcf36fe86283636` fixes unreachable farm panels by registering their interaction position at ground height. The regression fails before that fix and passes after it. Source `1868b89ef041def124016d5552bd0c8c3c3d0ac3` contains the runner and strict context-local transaction audit. Attempt 14 records its exact tested runner bytes and source patch separately. Run `PLAY_PORT=5575 bun tools/play-uphill.mjs --save .artifacts/pump-input/attempt-11/earned-pump.save.json --out <new-directory> --dist dist-uphill-input --no-build --active-heavy-jobs 0` only after coordinating the resource slot. The retained build must match its full provenance manifest.

The replay harvested 40 wheat against the pumped field's 36, delivered the remaining 26 wheat to the existing granary progress, and completed exactly one ledger section. Raw audits reconcile costs, crafting, production, transported loose goods, pickups and repeats without material allowances. Original buildings, crop identities, fox bond, jobs, equipment and prior choices are preserved. Only keystone 1 is earned; later quests remain unfinished and vault/Rootworks state is unchanged. Browser warnings and errors are empty. All eight default verifier parts, six unchanged approved comparisons, 31 scenarios, focused tests, scoped types and scene-27 high/low sight checks pass.

The handback is ISSUES because full-size image review still finds crowded farm labels, hillside occlusion beside the pit, and tent overlap in the scene-27 sight fixture. The actual earned Maren scene keeps the speakers visible. These presentation issues remain with the parent's art work. Read `.artifacts/uphill-input/report.md`, `checks/final-facts.json` and `inspected-images.json` for exact commands, hashes, red/green proof, images, resource samples and limits. All owned jobs are closed and the reserved slot is released. Keep the obsolete full runner and verifier selection. Whole Act 1, later vaults, cloud, Windows and device performance remain unclaimed.


## November 15 Gallery chapter accepted

The original uphill chain now earns fight 8, the Gallery lamps, Lamplighter, second keystone and memory 28, then returns home with middle and final Continue. The next raw save is `.artifacts/gallery-chapter/attempt-06/earned/earned-gallery.save.json`, SHA256 `1618cddda6e99fbd8185e916e27d3c0f3af9bd0a170a87e00325ebe7b840523d`. The chapter report is `.artifacts/chapters/gallery-1794803002470-670683f6-66e1-4902-a951-6c2f52773b55.json`; `.artifacts/gallery-chapter/report.md` retains the source/build distinction, exact original checkpoint chain, inventory audit, failed attempts and inspected pictures.

The runner adopts the chapter interface and shared real-time input driver. Both route directions preserve the authored floor. Fresh desktop/phone, high/low scenes 25 and 28 pass framing, HUD hide/no-hit/restore and actual quality budgets. The original input already saw Calla, so the earned exit verifies no repeated conversation. All nine final default verifier parts and six unchanged approved comparisons pass. Original fixed verifier outputs are restored with identical hashes. No owned process remains.

Light that works is available next. Seed Vault, Rootworks and later Act 1 stages remain incomplete. Keep the final `tools/play-act1.mjs` end-to-end story and its slow verifier entry until the full journey has matching earned input coverage. No full Act 1, cloud, Windows, device-performance or deployment claim is made.
