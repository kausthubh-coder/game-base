# Act 1 beta work queue

Coordinator owns this record. Release scope: the smallest first-half Act 1 beta, through Lamp Gallery, then stop. Only release blockers and final checks are active. Light and all later progression, improvements and experiments are deferred. The user has authorized shipping this beta. The user withdrew the weekly usage stop constraint. Continue until this release is complete, then stop.

## Current release status

Private playtest: https://mac-mini.taile36082.ts.net:15796/ on Tailscale. It now serves immutable runtime `dist-beta-help-58446565`, including farm instructions, campfire Wait until dusk, corrected dry-field guidance, real opening practice and prior fixes. Local and HTTPS index bytes match. Preview PID 19523 serves port5796. Browser saves were not changed. Opening checks pass within the bounded scope below. Final story preflight is accepted. The continuous release replay remains incomplete; this is a private candidate, not release acceptance.

The user's video revealed a lighting blink rather than an animal sheet in those captured frames. Actual walking reproduced the dark frames. The corrected route and shovel captures passed, and all six approved scene comparisons stayed unchanged. The post-fight reload repair passed both preserved failing-save recovery and a new actual victory followed by ordinary pagehide and Continue, without repeated rewards.

The combined candidate now uses real weapon combat in the opening and shows equipped gear in the bag. The ditch objective points to the actual dry field, with temporary pond and field markers. The lit campfire offers "Wait until dusk" while the first-night objective is waiting. This advances the same day without sleep rewards. Focused rules and normal-input browser checks pass. The current combined runtime is `dist-beta-help-58446565`. These changes are now on the private preview. The user withdrew the separate tent/fire instruction request, so that interaction stays unchanged.

The final continuous replay passed fresh Begin through the first morning on the previous build. Homestead gameplay completed, but its Dax approach needed a runner correction, now proven separately. These earlier records remain preserved. The new combined build is complete. Its final first-half replay is still required before publication. Later chapters remain outside this release. No reliable completion time is available yet.

The first-farm objective also omitted its required fence. Its text now names the fence and pond stones; its hint explains the recipe, placement and farm panel. The refreshed candidate passes the full code check. Desktop and phone screenshots show the instructions; ordinary fence placement consumed one fence and created the living farm. Final combined browser acceptance remains in progress.

## Beta blockers and active fixes

| Priority | Work | Owner | Status and acceptance |
|---|---|---|---|
| P0 | Digging from pond to dry field; water fails to flow; invisible obstacles | Irrigation repair helper | Source repair `dfa5dbb2` registers held spade excavation and lowers one invisible pond barrier. Coordinator reran 42 focused tests successfully. Earned primary-dig route and Continue passed in bounded evidence 6b34eb43. Coordinator inspected the continued ditch and phone-low images. Independent tester reports normal dirt placement and primary digging recovered ten old diagnostic trench cells and preserved water/bag through Continue. This is diagnostic recovery, not earned-chain proof. Combined verification passed on the sprite-only preview. Existing unregistered trenches need dirt replaced and re-dug once; new primary digs register normally. |
| P0 | Player flashes dark while walking or using the shovel | Sprite helper, verified by coordinator | User video decoded frame by frame. Actual slope walking reproduced solid-ground light samples. Source ace5e407 separates physical lighting height from painted drawing height. The original route and shovel transitions pass; six approved scene comparisons remain unchanged. This fixes the demonstrated darkening, without claiming an unseen animal-sheet substitution was reproduced. The fix is on the private preview. |
| P1 | Escape/UI/right-drag cursor and continued camera rotation | Coordinator, then mobile owner | Input cancellation defect reproduced and repaired. Final runtime 38c42107 passed Resume UI, Escape and right-release browser checks with clean output; sprite-only runtime72ac28d4 independently passed them again and is on the private preview. |
| P1 | Mobile play without keyboard or mouse | Mobile helper | Final runtime 38c42107 passed 44 browser input, layout and cancellation checks in portrait and landscape, plus 15 focused tests. Coordinator inspected final images. Controls hide during the film, touch hints replace keyboard wording, held inputs cancel correctly. All44 browser checks also passed on the sprite-only preview runtime72ac28d4. Physical-phone and earned combat proof remain separate. |
| P1 | First-person hero body visible when looking down | Camera helper | Source `39505d12` moves concealment to rendering so scenes cannot overwrite it. Shell integration committed by mobile owner. Sight follow-up 2dbf790b and 38 focused checks pass in owner evidence. Independent browser checks on immutable 6685 passed sprite concealment and free/tilt restoration. Final runtime 38c42107 passed camera/input checks. User subsequently requested removal of model characters. Sprite-only runtime72ac28d4 passed independent concealment/restoration and is on the private preview. |
| P1 | Exterior walls/roof missing; NPC inside stone; floating hero | Camera helper for exterior; other placement checks queued | Hall source deliberately defines an open court without a roof and with upper invisible barriers. No geometry repair claimed. Combined browser diagnosis is assigned; NPC and floating-player checks remain queued. |
| P1 | Keep characters as 2D sprites | Coordinator | User explicitly requested removal of 3D avatars, NPCs and creatures. Removed the Settings choice, saved/query preference handling, character-model loader and renderer. World models remain. Focused types and sprite camera tests pass; Five compatibility checks, nine camera checks and all 44 touch checks pass on runtime72ac28d4; coordinator inspected screenshots. Combined checks pass across the initial run and the affected replay rerun after removing an obsolete Settings expectation. This supersedes the earlier model-loading repair. |
| P1 | Opening story overlaps background music or other activity | Coordinator | Original browser overlap reproduced with actual simultaneous world/film output. Repair017cf653 temporarily suppresses world output and cleans up film contexts, with67 focused tests and full code checks passing. Initial browser matrix passed after the opening settled, but a stricter first-audible-frame check found a short world tail from the mixer fade. Immediate output gate9b0c2ff9 passes68 focused tests and all four strict browser cases: Skip, natural completion, initial failure and delayed Skip. Included in the current private preview. |
| P1 | Water and bridge rendering artifacts | Irrigation helper diagnosis, coordinator integration | Screenshots retained. Test under the user's camera modes. |
| P1 | Startup assets, loading performance and loading screen | Loading source-audit helper | Source audit 80312dca found image-only progress reaches 100% before world/views finish, and the existing measurement bypasses the real opening. Truthful stages/retry and corrected measurement endpoints are next. No browser slot granted yet. Measure cold/warm load and request failures before speed claims; no cloud deployment. |
| P1 | Phone arrival notice overlaps HUD | Mobile helper | Coordinator inspected fresh failing image. Container query cannot reach HUD siblings. Narrow viewport rule has owner browser proof of hide, no-hit and restoration, including reproduction with the old query. Coordinator inspected old, fixed and restored screenshots and confirmed the diagnostic visual correction. Earned Light acceptance remains separate. |
| P1 | Updated private playtest | Coordinator | Updated private preview to verified sprite-only runtime72ac28d4, including mobile, irrigation and camera fixes. HTTPS index matches runtime. Same origin retained; no player saves were edited. Audio repair remains outside this preview. |

## Act 1 completion queue

| Stage | State |
|---|---|
| Camp, Echo, Pump House, Water uphill, Lamp Gallery | Accepted earned evidence exists; retained. |
| Light that works | Held for early-game blockers. No earned acceptance. Resume exact Gallery save, SHA256 `1618cddda6e99fbd8185e916e27d3c0f3af9bd0a170a87e00325ebe7b840523d`. |
| Seed Vault | Tools and tests prepared; browser route and earned proof pending accepted Light. |
| Later settlement, Rootworks, Stag and remaining Act 1 | Pending progression and acceptance. |
| Final replay of the released first half | Required before release. Retain full Act 1 replay for the later full release. Never relabel isolated chapter diagnostics as one end-to-end run. |
| Beta release checks | Combined verifier, unchanged approved comparisons, player-facing playtest, mobile control proof and scoped load measurements. First-half public beta release now authorized; do not claim later chapter acceptance. |

## Improvements and experiments after blockers

| Queue | Idea | Decision retained |
|---|---|---|
| Art | Custom guild and distinctive important buildings | User likes much of the city; initial guild needs attention. Avoid a blanket city redesign. |
| Interiors | Animated entry doors and separate rooms | Explore 2D rooms and roofless 3D rooms with dark exterior space; return through the door to the same world position. Show options before committing to a direction. |
| Writing | Natural dialogue, distinct personalities and regional voice | Rewrite after beta blockers. Accents through vocabulary and rhythm; avoid caricature. |
| World tools | Smooth/block terrain setting | Requested. Evaluate save compatibility and digging clarity before implementation. |
| World architecture | Authored 3D assets mixed with editable block terrain | Compare a fully modeled city with block-based wilderness, modeled landmark buildings only, and a broader hybrid world. Keep shader quality and authoring effort in the comparison. |
| Player building | Modular 3D pieces versus individual blocks | Try placing attractive room/building pieces, traditional blocks, and a mixed approach. Check freedom, ease of construction, terrain edits and save behavior before choosing. |
| Creature taming | A capture tool with aiming and sustained alignment | Experiment with an active skill challenge instead of food-only taming. Earn the first tool through play, then craft or earn improved versions. Confirm the exact tool shape and creature scope during design; do not replace current pet progression during beta repairs. |
| Selection | Less intrusive tree outlines | Reported as distracting during ditch digging; address earlier if it obstructs targeting. |
| Water | Better water appearance and bridge art | Correctness first, broader art exploration later. |
| Performance | Wider device and cloud/asset delivery improvements | Record real measurements and limitations. Do not infer laptop or phone performance from the Mac. |

## Protected state

Historical preview before the current 58446565 handoff: local server 5796, PID 89745, immutable release-checkout `dist-beta-sprite-ace5e407` (source ace5e407). This PID was replaced by 19523; use the current release status above. The former PID 34269 was deliberately stopped after runtime hash verification. Latest handoff proof is `.artifacts/preview-handoff-ace5e407/` in the release checkout. Prior Gallery server was deliberately replaced after verification; its runtime and metadata remain preserved. Leave it running until a deliberate verified replacement. Save and evidence files are immutable. Helpers commit only their owned paths and report remaining gaps. Heavy jobs use live resource admission and assigned ports.

## Coordination and tooling queue

- Mobile and camera helpers have drained their jobs and released ports 5800 and 5798. Formal input coverage review is finishing; coordinator owns the sprite-only change and next combined verification. At most two heavy jobs, and only while fresh resource samples admit them. Each owner resamples during its run and stops its own processes.
- The Opus mobile launch failed before doing work because its provider account was unavailable. A fresh Codex helper replaced it. The Light helper ended with a preserved handoff and no earned acceptance.
- Reuse an immutable combined runtime only when its source and configuration hashes match. Do not build acceptance evidence from another helper's unfinished files. Preserve diagnostic builds and failed captures.
- Apply `correct`, `diagnosing-bugs` and `poteto-mode` to recurring defects and small verifiable repairs. Keep implementation with owners and review with the coordinator. `poteto-mode` is the engineering workflow, not a graphics setting.
- Run `maintain-verification-skill` against `.agents/skills/verify-game` after the changed input/browser flows stabilize. Source audit and live coverage are still pending; no clean maintenance verdict claimed. Update only that skill's owned documentation and harness during its maintenance run.
- Loading screen improvements, startup optimization, water/bridge art and broader architecture experiments stay deferred. Current work is only final scene acceptance, the continuous first-half replay and release checks.
- Storage follow-up: coordinator read the completed cleanup thread and `/Users/dabot/box/reports/game-storage-after-2026-11-16.json`. The prior cleanup preserved paths and used APFS copy-on-write duplicate consolidation. Fresh local samples on this pass showed about 18 GiB free and admitted two jobs. The mobile owner subsequently removed only its newly created duplicate historical-artifact snapshot and empty failed outputs. Cleanup logs remain; the correct source snapshot and runtimes remain intact. Review branches and dependencies before further cleanup; never clear `.artifacts` as cache or use folder totals as physical allocated space.


## First-half release checkpoint

Stopped at the user's budget boundary request on 16 November. The last user-provided weekly reading was 29%; the requested stop is 24% remaining. No current meter is exposed by the available tools, and the follow-up reading is unanswered. No claim that the account reached 24% is made.

No public push or deployment occurred. The existing private preview remains running unchanged. Local release candidate `release/act1-first-half-beta` is in `/Users/dabot/.t3/worktrees/game-base/act1-beta-release`; the complete story history and evidence remain on `act1`.

- Opening audio: immediate output gate9b0c2ff9 passes68 focused checks and four strict browser cases, including natural completion, Skip, initial load failure and delayed Skip.
- First-half beta label:620d8323 identifies the supported story boundary as Lamp Gallery. It does not hard-lock later content; later chapters are explicitly unfinished.
- Full verification: nine ordinary parts passed on the audio/title build; cloud, sight and slow checks failed. All six approved comparisons remained unchanged and the wrapper restored every protected output directory byte-for-byte.
- Visitor duplication: e64f6dca keeps original NPCs hidden while their scene stand-ins speak, including arrivals during the scene. Original regression failed;13 story tests and scene18 browser checks now pass. Focused scenes5/6 pass after the checker recognizes their real deed/ferry handoffs.
- Hall threshold: still fails body visibility. Camera settling does not fix it. The captured ray intersects the Hall frame mesh within the sight rule's0.9m guard, at body heights0.4/0.7. Model steps/ring overlap the walk height. No geometry or global cutaway change was made.
- Cloud checker: skipping the opening film alone is insufficient; the first Hobb conversation still owns input. Preserve the failure and finish that actual conversation before retrying Account. No account implementation defect established.
- UI movement checker: its supplied workbench obstructs a later movement probe. Owned-fixture cleanup was added in e64f6dca but has not been reverified.
- Final end-to-end replay remains required. The old `play-act1.mjs` still assumes control at the grant immediately after the opening; do not label it as a current whole-first-half proof. Existing earned chapter evidence through Gallery remains intact.

Release preparation excludes the large local artifact archive while preserving origin/main evidence and the raw test fixtures. The release marker points at a new source-identical baseline whose covered paths were compared byte-for-byte against the existing formal review. Candidate product source matches e64f6dca; formal-sync and checkout doctor pass. No release acceptance is claimed. All owned test/build/browser jobs ended; the protected private preview remains.

Evidence: `.artifacts/first-half-beta-release/`, `.artifacts/opening-audio-browser/immediate-gate-final/`, `.artifacts/beta-preview-verification/first-half-release-01/`, and the release checkout's `.artifacts/cloud-save/`.


## Release resumed, 16 November

The user authorized finishing and releasing the first-half beta. The user then explicitly withdrew the weekly-meter stop constraint: "just ignore the weekly meter". Continue to the release boundary.

Cloud save now passes all four actual two-browser cases after the checker finishes Hobb's wake conversation with E. Account and cloud product code did not change. Evidence is `.artifacts/cloud-save/` on act1. An attempted Bun syntax check ran the tool because Bun does not support Node's `--check`; that invocation built and ran the diagnostic, and its owned server/browser closed normally. Immutable release runtimes and the private preview were untouched.

Hall repair b1b07359 removes raised stone across the flat walking entrance. The original sight checker passes all three places; the coordinator inspected the Hall image and reran the four focused geometry checks.

UI movement diagnosis: the old probe crosses the pitched tent, not a missing movement binding. The actual A trace stalls near x=-15.3, z=-232.5; `clearCampTent` resolves (-16.3,22,-232.5) to (-15.3019,22,-232.6508). The supplied UI fixture now checks movement on clear ground east/north of the tent with the same distance assertions. Red traces are in the release checkout's `.artifacts/ui-movement-red/` and `ui-movement-probe.log`.

A fresh title-to-Gallery chain is being connected from the existing ten earned-input runners. Every stage must consume the preceding stage's new raw save. No accepted historical checkpoint will substitute for this final chain. Full Act 1 beyond Gallery remains unfinished.


## Release preflight follow-up

The UI movement replay now passes all 134 checks after its fixture moved outside the tent. The fresh Begin route also passes through the ferry landing on the release build. Its new raw save will start the remaining first-half chain.

Phone scene inspection found two cosmetic issues for the post-beta queue: the first Maren film speaker name clips at the right edge in scene 27, and foreground cutaway dithering remains visible in scene 22. The captions and required characters remain readable. These do not block progression, so this minimal release does not expand into a dialogue-layout or scenery redesign.

Automatic-film checker repairs preserve the real scene timing and verify every captured line against the actual dialogue log. Failed diagnostics stay separate from passing scene evidence. No final replay or public release is claimed by this checkpoint.

## Current bounded checks, 21 November

Runtime `dist-beta-help-58446565` includes first-farm help and all candidate repairs. Full `bun run check` passes in `.artifacts/beta-final/attempt-05/check.log`. The campfire wait has passing normal-input and Continue evidence in attempt-04/camp-dusk; later product changes only add quest instructions. The coordinator inspected its visible prompt and continued night scene.

Opening combat diagnostics pass desktop sword and bow and phone sword so far. The phone practice view shows duplicate instruction text behind the readable hint bubble. This cosmetic overlap is queued for after the minimal beta; hero, target and controls remain visible. No final opening, story preflight or continuous first-half replay acceptance is claimed yet.

### Resume checkpoint

Current source candidate is `58446565`; later commits change tools or records only. Runtime `dist-beta-help-58446565` is protected by `.artifacts/beta-final/attempt-05/runtime-manifest.json`, SHA256 `6440e95a4ecb8e1e0e196ec4fd3bb1cef6fab5be9f9116ddae25588e6051d5e7`. Private preview is PID19523 on5796. Do not rebuild its directory.

Farm, ditch labels and camp wait proof is consolidated in `.artifacts/beta-final/attempt-05/farm-guidance-review.json`. The coordinator inspected the farm Quest panel, HUD, completed pen, phone field marker, camp wait prompt and continued night, and independently recalculated guide budget checks. Opening case reports live under `.artifacts/opening-practice/`; high-attempt03 is an overall failed navigation attempt with four passing cases, high-attempt04 supplies the remaining two. Keep this distinction. Low and settled closing checks continue separately. Story preflight runs under attempt-05/scenes on5843.

Next: finish and inspect the current-build scene matrix, bind the reviewed preflight to the runtime, then start `tools/play-beta.mjs` from fresh Begin through Gallery. Old df7 prefixes cannot substitute for the new source. Run the preserved-output verifier wrapper with the accepted beta report and `--full`, then push only this lean release branch to main. The original act1 branch contains extensive local history and must not be pushed. Check the live game and cloud save after deployment.

Opening functional proof is complete in `.artifacts/opening-practice/review-summary.json`: all three weapons at desktop/phone high/low, real hit/miss, held attack, Dodge, Bag, Continue and exactly-once completion. Failed attempts remain failed; the aggregate names only completed passing cases. The remaining cosmetic limits are duplicated practice help and slight Dax edge cropping in phone bow/staff closing views. These are deferred under the requested minimal beta scope. All opening helper processes have closed.

The final four-view scene matrix completed its automated checks on the current runtime. Phone scene 17 exposed an Almanac card triggered by diagnostic `skipTo`, not scene 17 rewards. Its original overlapping images remain preserved. A bounded four-view replay waits for the card to dismiss through its normal lifecycle before starting the conversation. No game code or reward behavior changed. Acceptance awaits image review and exact runner attribution.

Current scene preflight is accepted in `.artifacts/beta-final/attempt-05/preflight.json`. The coordinator independently rehashed the runtime, imported helpers, selected raw frames and reviewed images. Scene 17 uses the focused natural-dismissal capture; the other scenes keep their original measurements. The final sight tool differs from the focused tool only by releasing its observation listener. The fresh Begin-to-Gallery chain is now assigned to port5838 with the same immutable runtime. No public release yet.
