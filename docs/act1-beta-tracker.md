# Act 1 beta work queue

Coordinator owns this record. Release scope: the smallest first-half Act 1 beta, through Lamp Gallery, then stop. Only release blockers and final checks are active. Light and all later progression, improvements and experiments are deferred. The user has authorized shipping this beta. Weekly usage was reported at 29%; stop at 24% remaining. The available tools do not expose a current account meter.

## Beta blockers and active fixes

| Priority | Work | Owner | Status and acceptance |
|---|---|---|---|
| P0 | Digging from pond to dry field; water fails to flow; invisible obstacles | Irrigation repair helper | Source repair `dfa5dbb2` registers held spade excavation and lowers one invisible pond barrier. Coordinator reran 42 focused tests successfully. Earned primary-dig route and Continue passed in bounded evidence 6b34eb43. Coordinator inspected the continued ditch and phone-low images. Independent tester reports normal dirt placement and primary digging recovered ten old diagnostic trench cells and preserved water/bag through Continue. This is diagnostic recovery, not earned-chain proof. Combined verification passed on the sprite-only preview. Existing unregistered trenches need dirt replaced and re-dug once; new primary digs register normally. |
| P0 | Hero briefly becomes an animal while walking or using the shovel | Sprite diagnosis completed; follow-up reproduction queued | Source atlas and preview GPU probes did not reproduce the reported substitution. Diagnostics `6c753487` retained; coordinator reran the full-atlas ownership test. Root cause remains unknown. Shovel trigger and live frame history still need proof; no product fix claimed. |
| P1 | Escape/UI/right-drag cursor and continued camera rotation | Coordinator, then mobile owner | Input cancellation defect reproduced and repaired. Final runtime 38c42107 passed Resume UI, Escape and right-release browser checks with clean output; sprite-only runtime72ac28d4 independently passed them again and is on the private preview. |
| P1 | Mobile play without keyboard or mouse | Mobile helper | Final runtime 38c42107 passed 44 browser input, layout and cancellation checks in portrait and landscape, plus 15 focused tests. Coordinator inspected final images. Controls hide during the film, touch hints replace keyboard wording, held inputs cancel correctly. All44 browser checks also passed on the sprite-only preview runtime72ac28d4. Physical-phone and earned combat proof remain separate. |
| P1 | First-person hero body visible when looking down | Camera helper | Source `39505d12` moves concealment to rendering so scenes cannot overwrite it. Shell integration committed by mobile owner. Sight follow-up 2dbf790b and 38 focused checks pass in owner evidence. Independent browser checks on immutable 6685 passed sprite concealment and free/tilt restoration. Final runtime 38c42107 passed camera/input checks. User subsequently requested removal of model characters. Sprite-only runtime72ac28d4 passed independent concealment/restoration and is on the private preview. |
| P1 | Exterior walls/roof missing; NPC inside stone; floating hero | Camera helper for exterior; other placement checks queued | Hall source deliberately defines an open court without a roof and with upper invisible barriers. No geometry repair claimed. Combined browser diagnosis is assigned; NPC and floating-player checks remain queued. |
| P1 | Keep characters as 2D sprites | Coordinator | User explicitly requested removal of 3D avatars, NPCs and creatures. Removed the Settings choice, saved/query preference handling, character-model loader and renderer. World models remain. Focused types and sprite camera tests pass; Five compatibility checks, nine camera checks and all 44 touch checks pass on runtime72ac28d4; coordinator inspected screenshots. Combined checks pass across the initial run and the affected replay rerun after removing an obsolete Settings expectation. This supersedes the earlier model-loading repair. |
| P1 | Opening story overlaps background music or other activity | Coordinator | Original browser overlap reproduced with actual simultaneous world/film output. Repair017cf653 temporarily suppresses world output and cleans up film contexts, with67 focused tests and full code checks passing. Initial browser matrix passed after the opening settled, but a stricter first-audible-frame check found a short world tail from the mixer fade. Immediate output gate9b0c2ff9 passes68 focused tests and all four strict browser cases: Skip, natural completion, initial failure and delayed Skip. Not yet on the user preview. |
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

Preview: `https://mac-mini.taile36082.ts.net:15796/`, local server 5796, PID 34269, immutable `.artifacts/beta-preview-verification/sprite-only-01/new-output/dist` (source72ac28d4). Prior Gallery server was deliberately replaced after verification; its runtime and metadata remain preserved. Leave it running until a deliberate verified replacement. Save and evidence files are immutable. Helpers commit only their owned paths and report remaining gaps. Heavy jobs use live resource admission and assigned ports.

## Coordination and tooling queue

- Mobile and camera helpers have drained their jobs and released ports 5800 and 5798. Formal input coverage review is finishing; coordinator owns the sprite-only change and next combined verification. At most two heavy jobs, and only while fresh resource samples admit them. Each owner resamples during its run and stops its own processes.
- The Opus mobile launch failed before doing work because its provider account was unavailable. A fresh Codex helper replaced it. The Light helper ended with a preserved handoff and no earned acceptance.
- Reuse an immutable combined runtime only when its source and configuration hashes match. Do not build acceptance evidence from another helper's unfinished files. Preserve diagnostic builds and failed captures.
- Apply `correct`, `diagnosing-bugs` and `poteto-mode` to recurring defects and small verifiable repairs. Keep implementation with owners and review with the coordinator. `poteto-mode` is the engineering workflow, not a graphics setting.
- Run `maintain-verification-skill` against `.agents/skills/verify-game` after the changed input/browser flows stabilize. Source audit and live coverage are still pending; no clean maintenance verdict claimed. Update only that skill's owned documentation and harness during its maintenance run.
- Loading screen and startup measurements are the next independent implementation slot. Audio, NPC placement, bridge presentation and remaining player-facing issues follow the active blockers. Broader architecture experiments remain above in the deferred queue.
- Storage follow-up: coordinator read the completed cleanup thread and `/Users/dabot/box/reports/game-storage-after-2026-11-16.json`. The prior cleanup preserved paths and used APFS copy-on-write duplicate consolidation. Fresh local samples on this pass showed about 18 GiB free and admitted two jobs. The mobile owner subsequently removed only its newly created duplicate historical-artifact snapshot and empty failed outputs. Cleanup logs remain; the correct source snapshot and runtimes remain intact. Review branches and dependencies before further cleanup; never clear `.artifacts` as cache or use folder totals as physical allocated space.
