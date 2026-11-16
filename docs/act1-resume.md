# Act 1 continuation, 2026-11-13

## Current instruction

Continue building the game. Use Astra for all 3D assets and GPT 6.1 Sol for subsequent implementation and checks. Commit completed slices as work proceeds. These choices replace older Claude assignments in the act briefs. Keep the helper count small and inspect actual renders.

## Recovered state

The integration checkout is `/Users/dabot/.t3/worktrees/game-base/act1`, branch `act1`, starting at `a69c53f8`. The main checkout is clean at `e427350b`. Do not rebuild the act on main or deploy as part of recovery.

The last integration fix renamed the place check severity type so the graphics-quality test no longer mistakes it for a quality table. Historical passes are not current verification.

The vault room branch `act1-rooms-models` ends at `f93c2754`. Its existing checkout is `/Users/dabot/.t3/worktrees/game-base/t3-5506ab82-a389d40f99ddf8e2`. It has modified evidence logs and costs from the interrupted final check. Preserve them. Its previous owner failed and has no active run. Its old report predates later model improvements and must be refreshed from current evidence.

## Next slices

1. Astra completes the vault room assets against the approved Pump House, Lamp Gallery and Seed Vault sheets. Read the existing branch and evidence, fix remaining visual defects, inspect new renders, and commit. No main push or merge.
2. GPT 6.1 Sol checks the resulting room interactions and integration, including stairs, keeper movement, gates and low graphics. The coordinator reviews the diff and evidence before merging into act1.
3. Recover the wilds branches, then north, Saltgate, farms and story. Existing branches preserve substantial unmerged work. Read each report and diff before assigning new work. Do not restart the old agent swarm.
4. Run verify-game on integrated slices. Fix regressions before taking another merge.

## Other pending request

Research patch.gg and whether it would improve this browser game. The earlier attempt failed before research began. Do not adopt it or migrate the game without evidence.

## Source documents

Read docs/act1.md, docs/act1-gaps.md, docs/act1-systems.md, docs/act1-models.md, and the local skills. For the design, use the handbook under /Users/dabot/dev/sandbox/game-look-test/design. Preserve the mystery and the separate kingdoms progression already agreed there.

## Vault rooms, latest recovery checkpoint

The room branch has reached `81728899`. Astra improved the Harvester joints. Sol fixed moving geometry when graphics detail changes and collision at the opened Gallery bars. Coordinator merged the existing severity type fix into the room branch and reran checks. Full verify passed before the final Gallery message correction; its targeted scenario passed afterward.

Sol then completed the Harvester through real input, earned the keystone, played both memory interactions and returned through the south door. The repeatable check is `.artifacts/rooms-gameplay/finish-harvester.mjs` in the room checkout. It starts at a progression fixture, not a fresh-character playthrough. The latest report is `.artifacts/rooms-gameplay/harvester-completion-report.md`.

Before integration, finish the remaining room art against approved sheets: Seed Vault overhead roots, Harvester surface shaping and shading, Gallery enclosure, and memory-scene actors hidden by masonry and lamps. Keep the verified movement, interaction, combat, reward and quality-change behavior. Check the memory scene after adding roots so that the new canopy does not introduce another obstruction. Astra owns this art pass, then Sol checks changed player paths. The coordinator reviews renders before accepting it.

## Integrated vault slice

Merged `act1-rooms-models` into `act1` as `e60ae714`. The integrated `bun run check` passes and lint exits zero with existing warnings. The coordinator inspected the final roots, Gallery arches, earned memory cast, and held-state views at high and low.

The optional low saddle was removed in `174ae5cd`: the concept notes explicitly allow its omission, and the disconnected prop falsely suggested physical support. Companion hold behavior and arm targets remain unchanged. The existing Stag idle sprite does not animate the narrated nose-touch, and low-detail models remain coarse.

Next, 6.1 Sol verifies the merged checkout, including quality changes during the memory and Gallery traversal below the new arches. After that, recover the marsh and forest branches before taking another integration merge. The old wilds lead did not merge its final placers; useful commits remain on `act1-wilds-marsh` and `act1-wilds-forest`.

## Wilds recovery checkpoint

Vault verification completed at `6f950139`; all default verify parts and focused Gallery/Harvester/memory paths pass. The vault return starts Calla dialogue with a fern over the hero. Evidence: `.artifacts/rooms-integrated/harvester/return-after.webp` and JSON. Fix that visibility problem in forest recovery.

Marsh checkout `/Users/dabot/.t3/worktrees/game-base/t3-6b91382c-534ae35e3ef2bdb7`, branch `act1-wilds-marsh`, is refreshed from act1 in `7195f186`. Doctor passes, port 5896, full check and lint pass. Existing changes include boardwalk/river/cave placements, dry-ground exclusion for water plants, shared quality rows for marsh lamps, and place checks. The old look contact was inspected; it is historical evidence, not a new capture. Cave-mouth and Pump House exterior models still need the previously planned concept pass. Astra handles models, then Sol checks placement and player routes before the coordinator integrates the branch.

Forest checkout `/Users/dabot/.t3/worktrees/game-base/t3-88bc25c2-3820bcdd572e4ec5`, branch `act1-wilds-forest`, had five dirty files left by its failed owner. Preserved them in `5cc03c8f`, explicitly WIP and unverified. They adjust wood cutout/dithering near the lens, grey-forest canopy opening, and look frames. Do not mistake this checkpoint for accepted work. The old forest and marsh owners have failed, with no active runs. Work one region at a time to avoid overlapping shared-land and sight edits.

## Marsh exterior handoff

Astra committed the Pump House, cave mouth and Gallery mouth model changes through `7f871ed6` on act1-wilds-marsh. They preserve entry transforms and wheel pivot but are not visually accepted yet. Coordinator inspected the close Pump House comparison and placed cave view. The cave approach has overlapping root dressing and a small faceted arch near the hero whose identity needs tracing.

Sol's next implementation slice is material wiring and placement. `world-landmarks.view.ts` creates a paint material with vertex colors and glow but no prop skin integration. `src/features/props/material.view.ts` has the existing skin-capable material, and props.view.ts owns texture loading/quality behavior. Reuse that contract through the feature's public API; avoid a copied shader or direct reach into feature internals. Preserve instancing, shadows, night glow, wind, moving parts and texture lifecycle. Then clear dressing from cave/Gallery approaches and prove actual player routes.

The old river screenshot failure reproduces before these new model changes. It remains an unresolved marsh-branch check, not permission to change its approved picture. Fresh material/placement evidence is required before a final Astra refinement or acceptance decision.

## Marsh materials and town-layout correction

Sol completed the shared prop-surface lifecycle and cleared cave/Gallery stand-ins in `a438a16b`. Report: marsh checkout `.artifacts/marsh-implementation/report.md`. The coordinator reviewed the API diff, reran its focused tests and inspected all three placed models. Skin quality switching, moving wheel and dark Gallery throat are covered. The branches remain separate pending art acceptance.

The coordinator traced the river screenshot failure to the marsh branch moving `waystone-pump`, which changed the town generator's reserved plots and then its sequential house placement. A fresh act1 capture passed; identical town renderer source and model files ruled out the earlier renderer diagnosis. Restoring only the waystone's original location restored the whole town plan. `82750090` restores it and routes the quay path through the gap between the eastern houses. The river approval and tolerances remain unchanged. Evidence: marsh `.artifacts/river-diagnosis/report.md`.

Next, Astra refines the cave/Gallery shell into uneven layered rock, replaces the ribbon-like roots with branching volumes, recesses the Gallery mirrors, and improves the Pump House's planar support forms against their approved sheets. Preserve the public surface lifecycle, entrance transforms, wheel pivot, original waystone location, corrected quay path and vault internals. Sol checks the resulting slice before integration. Missing standalone stalagmites and other kit stand-ins remain separate gaps, not a reason to cover the entrances again.

## Marsh model pass awaiting gameplay review

Astra's model pass is committed through `09f462b0` on act1-wilds-marsh, source through `21e2757e`. The coordinator inspected all three high comparisons, the placed cave and low Gallery, and the Pump bearing view, read the diff, and reran the passage/surface/placed-view contracts. Mirrors now follow the Gallery walls and the Pump bearings meet the axle. Art is still not accepted: the shell remains an obvious smooth arch, root tips point down instead of spreading along the ground, and masonry lacks the sheet's form variation.

Next Sol check covers normal input from the cave encounter through Gallery entry, plus moving-wheel clearance and live low/medium/high changes. Earlier cave routes stopped before victory and Gallery used a separate lantern-equipped fixture. Preserve that evidence limit rather than claiming a continuous journey already passed.

The next Astra correction must change the underlying shape, not just add ledges to the same arch. Keep the inner passage contract but break the exposed rock lip and exterior into asymmetric joined masses. Roots should turn outward along the soil into broad flattened feet; remove the hanging pointed-tip silhouette. Use broken moss on the rock surfaces instead of separate rounded caps. The approved sheets and notes remain the target. Do not spend another pass on decorative clutter while those primary forms remain wrong.

## Farm persistence and uphill traversal block progression

Sol fixed the rootsnare encounter inside the cave shell in a9007aea; evidence87d0c039 shows reachable targets, companion capture/freeing and live quality cycles. Coordinator reviewed and reran its fight regression. The same coordinates are now stored in the existing encounter content instead of a fight-8 exception in the rules. Full check and lint pass after this behavior-preserving correction.

The complete victory chain is still blocked. Coordinator independently reran the home/cave/home farm reproduction: unloading home terrain removes its farm eligibility and drops Heartstone reach. The next implementation is specified in marsh `docs/farms-away.md`. Give farm evaluation deliberate saved-terrain reads independent of rendering; do not force progression flags or keep all distant chunks loaded. Verify save/reload away, real farm removal/Take and bounded resources before replaying the rootsnare calm.

The onward cave path separately rises too sharply near world [237.9,-339.7]. Root sampled ground at x237: z -340/-341/-342/-343 yields 25/27/28/30. Diagnose final path grading and the High Road crossing after farm persistence, then replay the continuous walk, Gallery fight and earned reward. Neither traversal nor the reward chain is accepted yet. All outstanding cave/Pump model art findings remain open.

## Farms retain reach away; Gallery path is next

Marsh farm persistence is implemented in 8ab1b9e5, with the scenario corrected in 9ebccf6b and evidence in 1fd21753. Saved-terrain queries keep farm eligibility independent of rendered chunks and invalidate after edits and restore. The coordinator reviewed the diff, reran 31 focused tests and independently reproduced Heartstone 2 at home, cave and return. Evidence and route design are committed in marsh d5c929e4. Source and save formats remain unchanged during this review.

An interactive rootsnare calm awarded two vine rope with legitimate Heartstone 2. The separate timed replay failed to reproduce it. Keep those claims separate. The next continuous progression check should react to observed combat state and retain an earned save.

The coordinator also reproduced the onward traversal failure with real input at world [237.6585,-339.6999] and inspected the stuck capture. Marsh docs/gallery-route.md specifies the next implementation. Diagnose final terrain grading around the High Road, preserve its clearance and stairs, and prove the authored route in both directions before completing the Gallery lamps, keeper, earned keystone and return. This is the next 6.1 Sol task. Cave and Pump art remains unaccepted and belongs to a later Astra pass. Nothing pushed, merged into main or deployed.

## Gallery route and earned local progression verified

Sol implemented the terrain repair in marsh 2c635e99 and committed evidence3c05bdf3. The High Road clearance pass was undoing grading; the cave path now reserves clearance before slope propagation and retains its profile through final shaping. A short bend gives the descent room. All eight verify parts, unchanged six screenshots, local farm2/2/2 and scene28 sight pass in the implementation report.

The coordinator reviewed the diff, independently reran all 18 terrain tests and the normal-input outward/return/outward route at high and low, including Gallery entry. Both passed. Fresh review evidence is marsh .artifacts/gallery-coordinator/report.md. The recorded interactive progression separately earns rootsnare calm, two vine rope, all six eyes, Lamplighter victory, second keystone, scene28 and return outside. Its input log, reward state and pictures were inspected; the coordinator did not repeat the entire combat chain. Earlier gear, lantern and quest setup remain disclosed fixtures.

Next Astra task is deliberately limited to caveMouth/galleryMouth external shell and root form, as specified in marsh docs/cave-form.md. Their smooth regular arch, capped ledges and pointed root feet still fail the approved sheets. Preserve the now-verified terrain, farm persistence, entrance transforms, vaultRoots and crystals. Sol checks after Astra. Pump masonry remains a subsequent art slice, then forest recovery. No integration merge or deployment yet.

## Cave volume follow-up awaiting Sol

Astra's 3d6d4242 exterior candidate still read as a wedge and was not accepted. Coordinator inspected it and built a different local construction in marsh6c4e8c59: five overlapping rock volumes, rounded backs, smoother root curves, and the Gallery reveal behind its stone arch. All eight verify parts pass on that commit. A final foot/jamb correction is5550977d; props tests/typecheck, protected geometry, build and fresh high/low Gallery renders pass afterward. Evidence commit3e583b70, .artifacts/cave-masses/report.md.

Art remains unaccepted. The wedge is gone but the isolated cave still reads as separate masses, and low upper shoulders are coarse. The next step is independent6.1 Sol verification of the final geometry's route, entry, fight sight/target reach and quality transitions. No more art edits belong in that test slice. Pump masonry remains pending, then forest recovery. Do not merge the marsh branch on the strength of technical checks alone.

Patch's official landing page was inspected during this work. It advertises browser play, Windows desktop, an asset library and agent tools; its docs could not be fetched. This is only a research checkpoint in marsh .artifacts/cave-masses/patch-note.md, not a recommendation or adoption. The original compatibility and usefulness assessment remains open.

## Cave technical review complete; Pump masonry next

Sol tested final cave geometry5550977d and recorded evidence bfa3e96d. All eight default verify parts pass. Real-input high/low round trips, Gallery entry, rootsnare hits and companion freeing, quality changes, scene28 sight and earned-save persistence passed within the report's disclosed fixtures. No source fixes were needed. Coordinator inspected the rescue picture and independently reran the earned-save/home-cave-home persistence check successfully; fresh evidence is marsh .artifacts/cave-accepted-check/.

Decision: technical integration passes; art is still not accepted. Coarse upper shoulders and the assembled-mass appearance remain open. Do not turn that cave verdict into a merge approval. Continue the separate Pump masonry task with Astra using marsh docs/pump-masonry.md, then Sol checks. Preserve the large wheel, pivot and door, improve visible fixed stonework within the existing budget, and keep other group4 models unchanged. Forest recovery and the Patch assessment remain pending.


## Pump masonry reviewed; live landmark quality fix next

Astra improved fixed Pump courses in marsh f46d4777; evidence7a5ca695 records all eight verify parts and unchanged approved shots passing. Coordinator review003e7823 independently passes the three marsh model contracts and high/low quay walks into pump-upper. Fresh geometry measurements preserve protected hashes, bounds and pivot. Art remains unaccepted: shallow courses, plain gable and supports, insufficient softened stone depth.

Fresh review also reproduces a functional quality bug: installed landmark geometry stays at startup propDetail while materials and selection budgets change. High-start stationary Pump stays4312 triangles after low (expected3328); low-start stays3328 after high. Rotor behaves the same way. The red assertion and scene records are in marsh .artifacts/pump-review/. docs/landmark-quality.md briefs the next6.1 Sol implementation and independent integration review. Refresh geometry in place when effective detail changes, preserving wheel/door state, shared near/far geometry, cavity fits, disposal and skins. No model resculpting belongs in this fix. Keep cave/Pump art issues open and do not merge marsh yet. Forest recovery and Patch assessment remain pending.


## Live landmark geometry switching accepted; Pump stone form next

Sol implementation4b33f421 refreshes installed geometry when effective detail changes, preserving moving objects, material identity, near/far sharing and throat fit. Evidence9d6132f0 records all eight verify parts and unchanged six screenshots passing, plus high/low Pump entry. Coordinator independently repeated all four view tests and the actual-browser cycles from both startup levels successfully. Fresh evidence is marsh .artifacts/landmark-review/, committed270e364f with a follow-up clarifying the banner-obscured capture. This accepts tested rendering behavior, not art or full earned progression.

The next Astra slice is docs/pump-stone-form.md: correct the blank gable, flat masonry and continuous slab supports with visible structural depth and softened principal corners at low quality. Preserve rotor, envelope, entry, protected models and the now-accepted geometry lifecycle. Reallocate existing triangle budget, do not raise it. Sol checks after the art candidate. Cave form still remains unaccepted, then forest recovery and Patch assessment. Nothing pushed, merged into main or deployed.


## Pump stone form ready for independent integration review

Astra source4d6a452a and evidenced44d147c replace the blank gable with recessed coursing and fixed support slabs with stepped piers and bevelled caps. Coordinator read the diff, inspected the high comparison, low placed view and low-selected close bearing, then independently passed four marsh-model tests, static/runtime geometry equivalence and fresh protected hash/bounds/pivot/budget checks. Evidence is marsh .artifacts/pump-form-review/.

The structural improvement is visible. Art residuals remain: regular stone/support shapes and the low annex's strongly contrasting bevel grid. The builder's eight verification parts pass across a full run and isolated check retry after concurrent-browser timeout. Next6.1 Sol checks exact final-source traversal/return, swept rotor/support clearance, gable oblique views and live quality changes using docs/pump-form-verification.md. Run verification without competing browser jobs. Cave form remains unaccepted; do not infer a whole-marsh merge decision from this review. Nothing pushed or deployed.


## Pump joint regressions repaired; cave shell is next

Sol evidence7fe936f3 passed Pump integration and all eight verification parts but found new sky openings at grazing gable angles, plus an older wall/roof spring seam. Coordinator reproduced the red probes and fixed the missing recessed backing in3a637c32. The ordinary return view exposed the same cause in annex wall courses; a separate failing probe led to64aad1e2. Both gable ends, spring seam and annex wall now have a regression checking actual ray coverage. Protected model/rotor hashes, bounds, pivot and budgets still pass.

Final-source64aad1e2 passed all eight verify parts in one run, fresh high/low normal-key entry and return, installed geometry/motion/ownership cycles and both targeted sight runs. Coordinator opened final grazing and return captures; the holes are closed. Evidence7bb0073e in marsh .artifacts/pump-joint-repair/ preserves the red failures and distinguishes the earlier gable-only run from final proof. No further Pump resculpting is planned in the next slice. Uniform stone and strong low-quality bevel contrast remain recorded art limitations, not reference parity.

Next Astra task uses docs/cave-continuous-form.md. Replace the cave/Gallery shell's separate faceted masses with a continuous rounded rock hill around the unchanged bore; keep roots attached and grounded, inspect oblique coverage as well as front views, preserve vaultRoots/crystals and all gameplay/paths. Sol verifies afterward. Whole-marsh art and integration decision is still pending; forest recovery follows.

Patch research is updated in marsh docs/patch-assessment.md, commit9fb2cd72. Official docs now readable distinguish Mac-capable CLI from Windows Desktop tests; optional asset discovery may help, but no visual upgrade from platform adoption is established. No tool installation, account connection, repo upload or publishing was done. Exact X demo and a bounded asset trial remain unverified. Nothing pushed, merged into main or deployed.


## Joined cave shell awaits Sol; cave depth shading is next

Astra final model5a325016 and evidence3d953d82 replace the five rock masses with one joined shell and attached interior wall. Final reveal/reveal-verified folders are authoritative; earlier folders named final and verified are superseded and explicitly labeled in the report. All eight verify parts and final staged routes/targeting/sight pass in the author's report. Coordinator read the complete diff, independently passed six marsh-model tests and protected vaultRoots/crystals hashes, and inspected final high oblique, low placed and night views. Evidence is marsh .artifacts/cave-continuous-review/.

Art remains unaccepted: the low front is too smooth and regular, roots too simple and upright, and broad eroded ledges are missing. The night throat is also visibly pale lavender. Code inspection suggests its fixed MeshBasicMaterial gradient has no ambient response. Next6.1 Sol task follows docs/cave-depth-verification.md: independently verify the unchanged model and diagnose/fix that local view-layer depth problem, preserving model bytes and the existing quality lifecycle. Do not resculpt during verification. No full earned victory or progression replay is claimed for this asset pass. Nothing pushed or deployed.


## Cave night shading accepted; Gallery threshold repair next

Marsh source ffdc0e18 makes retained cave and Gallery throat materials respond to the day/night clock. Sol evidence4b6ef180 records all eight verify parts, unchanged six approved shots, focused tests, quality cycles and staged routes passing. Coordinator independently repeated the five view tests and fixed-camera high/low daylight/night pixel checks. The dark recess retains depth. No newly earned victory is claimed.

Coordinator isolation also identifies the Gallery threshold defect as two terrain intrusions: the upper polygon disappears when painted land is hidden; an additional low-quality polygon disappears when far-land is hidden. Root evidence is marsh .artifacts/cave-depth-review/. The renderer layers are proven; their sampling cause still needs diagnosis. Next 6.1 Sol implementation uses docs/gallery-threshold.md to repair the terrain integration and verify normal input entry/return and the cave route. Preserve model bytes, accepted night shading, farm-away reach and screenshot approvals. Cave sculpture remains unaccepted. Nothing pushed, merged into main or deployed.


## Gallery terrain accepted; cave sculpture resumes

Sol repaired near-bank smoothing in19128393 and far-terrain sampling in dce99107, with evidence ac1d7992. Coordinator repeated the geometric checks, found missing explicit GPU buffer retirement during sheet rebuilds and fixed it in72515509 with a red-to-green regression. All eight verification parts pass on that final source, including unchanged six approved shots. Fresh fixed-camera comparisons clear both original terrain patches. Normal keyboard cave/Gallery round trips, E entry/return and low/medium/high geometry cycles pass from both high and low starts, with no view errors. Evidence is marsh .artifacts/gallery-threshold-review/. These are disclosed progression fixtures, not newly earned victories.

A loose wilds scree stone still occupies the low Gallery recess after return. Treat it as a scenery-clearance issue alongside the known fern at the forest exit; do not call the doorway visually finished. The continuous cave shell also still looks molded and its roots lack branching. Next Astra uses marsh docs/cave-sculpture-finish.md: finish caveMouth's broad unequal rock planes and roots first, inspect high/low against its approved sheet, then adapt the candidate to Gallery. Preserve all terrain/night/quality repairs and protected geometry. Sol checks after the art pass. Whole-marsh art approval and integration remain pending, followed by forest recovery. Everything remains local; nothing pushed or deployed.


## Cave sculpture remains rejected; change its construction

Astra study4dbb188c and evidence9eaed16e changed caveMouth only. It still fails the approved sheet: arch-like rock, weak shoulder projection and angular roots at low. Gallery remains unchanged. Only props checks and protected hashes were completed; the earlier full runtime proof does not apply to this new study. Coordinator inspected the latest high/low comparisons and independently repeated all44 props tests and protected hashes successfully, without accepting the art.

Coordinator marsh14b22879 adds an isolated volume prototype and docs/cave-solid-construction.md. The old shell grows an annular band from its bore. The next Astra pass should instead form unequal connected rock slabs and cut the fixed passage. The prototype proves only an affordable topology option. Its first clay render is inflated; its second is still blocky, and neither is accepted. Keep the production paint pipeline, budgets and integration protections. A failed visual stage means iterate, not stop after a few rejected drafts. Finish caveMouth, adapt Gallery, then run final integration proof and Sol verification. All jobs are stopped and everything remains local. Scenery clearance, whole-marsh integration and forest recovery remain pending.


## Solid cave resumed proof completed; Sol integration and dressing next

Astra evidencecf285d76 completes fresh verification for source391df420. Its authoritative cave-solid-finish/resume directory includes all eight verification parts, unchanged approved shots and fresh fixture-based routes/combat visibility/scene28/quality changes. Coordinator independently repeated46 props tests and protected hashes and inspected the final low Gallery side comparison. Tall smooth slabs and sparse roots remain unaccepted art limitations.

Next Sol follows marsh docs/gallery-dressing-clearance.md: independently check the integrated models and implement narrow authored clearance for the separate wilds scree intrusion in the Gallery doorway. Keep model bytes and all terrain/night/quality fixes intact. Forest fern work remains for the forest recovery branch. Everything stays local; no main merge, push or deployment is authorized by this checkpoint.


## Gallery dressing accepted; forest recovery starts

Sol source 3f7af468 and evidence 664f3e99 clear authored Gallery doorway bounds from scattered dressing. Coordinator review 03e1ad58 independently repeats both regression tests and a fresh runtime matrix comparison against the retained build. Exactly two obstructing placements are removed; retained matrices match. Inspected before/after images show the cleared threshold. Cave slabs and sparse roots remain unaccepted art limitations. The helper records all eight verify parts and unchanged approved shots passing; the coordinator did not repeat the entire suite.

The coordinator merged local act1 into the preserved forest branch as 686ed6ea. Check and lint pass. The next Sol slice follows forest docs/forest-recovery.md: reproduce the fern obscuring the hero during Calla's post-vault conversation, repair its actual cause, and check normal-input forest return and quality changes. Preserve older forest models and interrupted visibility work unless a demonstrated regression requires a narrow fix. Astra retains new 3D art work. Neither marsh nor forest has been merged back into act1. No push, main merge or deployment.


## Forest return checked; root visibility and replay migration remain

Sol source 77d92993 fixes diagnostic rays ignoring wild dressing. Evidence through e9d916fa records earned vault return, Calla dialogue and keyboard forest round trips with quality switching. The historical fern did not reproduce on recovered forest geometry. Coordinator repeated nine focused tests and inspected the clear return and the root crossing the hero at grove entry. Chest-only reports still miss partial body obstruction.

Coordinator b0c9954c fixes the UI runner's absent Continue-button dereference, with a red run followed by passing title assertions. The replay then fails on obsolete plot/bread progression; current content starts with grantday and Hobb. The old full Act 1 runner has the same story mismatch. Migrate those runners in a separate planned slice without silently dropping coverage. Default verification also remains red on the unchanged spawn screenshot. Next Sol task follows forest docs/forest-visibility.md to repair actual root occlusion and diagnose the spawn visual regression while preserving assets and approvals. Forest/marsh art remains unaccepted. No main merge, push or deployment.


## Root clearance checked; broader scene visibility remains open

Forest source bf9f21dc clears tree roots around actors and samples lower-body occlusion. Helper 8d05e095 records all eight default verification parts and unchanged approved shots passing. Coordinator independently repeated the focused tests and CPU/GLSL comparison, then ran every dialogue scene. That broader run exposed scene 15 Tamsin behind stone, scene 16 Calla behind a crate, scene 19 framing dependent on earlier scenes, and scene 32 terrace obstruction. Restoring the prior masonry width in an isolated comparison did not fix 15,16,32.

Coordinator forest 7f1fa639 isolates each scene's test world and places vault-return fixtures at the exact production exit point. All scenes at high and selected scenes at low now agree: 15,16,32 remain red; 19 and 25 pass. Scene 25's fixture reward banners still cover faces and must settle through normal UI before visual acceptance. Next Sol follows forest docs/scene-visibility-recovery.md for real approach checks and staging repairs. Dotted forest seams, art approval and obsolete UI/Act 1 runner migration remain pending. No main merge, push or deployment.


## Scene visibility accepted; interface replay migration next

Forest source ae3a0d99 uses an authored Tamsin stand-in, relocates the blessing hero and crate, and frames the terrace upper landing. Evidence 3b34d7b6 records all 37 dialogue scenes high/low, standalone repeats, actual approaches and default verification passing. Coordinator review d5aa2252 repeats the story tests and scenes 15,16,32 and inspects fresh captures plus normal-input evidence. The tested scene slice is accepted; crowd overlaps and forest art remain open. No whole-act playthrough is claimed.

Next Sol follows forest docs/ui-replay-migration.md. Inventory and preserve interface-test coverage while replacing obsolete plot/bread fixtures with current Grant day and later content. Keep full Act 1 runner migration separate and do not disable its failure. All work remains local, with no main merge, push or deployment.


## UI migration runs; desktop layout recovery next

Forest 426123ea updates UI fixtures to current Grant day and later content; ae51f0c4 records 125/129 full UI checks and default verification passing. Coordinator repeats desktop 114/118 with the same offscreen hint and obsolete numeric-counter failure. Coordinator 79cf897d corrects stale shipped rock triangle expectations from independently checked raw GLB accessors; all 85 tools tests now pass. No model bytes changed.

Next Sol follows forest docs/ui-layout-recovery.md to diagnose actual Settings/hint displacement and replace removed bread numeric coverage with real current quest tracker progress. Existing numeric unit tests remain; do not invent a quest to make the browser test pass. Whole UI acceptance, legacy Act 1 replay migration and forest art remain open. No main merge, push or deployment.


## UI repair accepted; fresh-character Grant day next

Forest source 84643ddc prevents focus from scrolling the outer UI while retaining Settings body scroll. Full UI replay passes in helper evidence 80d6b021. Coordinator repeats three focused runs with all 136 assertions passing and inspects the corrected hint/Settings. Current pump-choice tracker progress and Continue replace the obsolete bread counter; numeric unit tests remain.

Next Sol implements stage 1 of forest docs/current-act1-replay.md: start a fresh character through real Begin/film-skip, mirror/breakfast, lock/map, rack/spar, deed and ferry to the landing, with a real save/Continue checkpoint and unedited earned landing save. Later story stages are explicit pending work. The old Act 1 runner stays enabled; no full Act 1 or forest art acceptance. No main merge, push or deployment.


## Grant day progression repeated; cast framing next

Forest source 35ae5b1d adds the fresh-character input replay; helper evidence ca6427da passes through normal ferry arrival after a mid-spar save/Continue. Coordinator independently repeats the fresh build successfully, including real combat hits, exact gifts and scenes 1 through 7 once. The unedited earned landing save is preserved in both grantday-input and grantday-review artifacts. Coordinator 2066242b adds separate replay output directories; tools tests pass. Game code is unchanged.

Forest docs/grantday-framing.md, committed in b993b6f1, scopes the next Sol repair. Fresh captures show the hero obscured by the grant crowd and Dax cropped during the quay transition. Confirm settled framing before deciding on the quay fix. Keep the public crowd and story, fix narrow placement or proven framing logic, then repeat high/low and fresh input progression. The mirror look remains a separate asset/runtime gap: Braid persists in state but the world still uses the copper-haired sprite. After those opening issues, continue stage 2 from the earned landing save. Full Act 1, marsh/forest art and integration remain pending. Everything stays local; no push or deployment.


## Opening cast framing accepted; mirror sprite family next

Forest a5881132 moves the public grant queue clear of the hero and places the quay cast on flat paving. Shared camera logic stays unchanged. Helper b5849ce6 proves high/low speaking lines, full input and default verification with unchanged approvals. Coordinator baa4aab6 repeats fresh-build Grant day through ferry landing, real combat and mid-spar Continue, plus the retained-build low framing fixture and focused tests. Inspected fresh high/low grant and quay pictures keep the cast visible.

Next Sol follows forest docs/hero-mirror-looks.md for Braid idle/walk and tool-use assets against approved option D. This first asset pass must preserve existing sprites/baselines and does not activate a partial look. Combat/camp poses and shared runtime resolution follow before the mirror bug can be accepted. Cropped/Fringe and optional Astra 3D models remain separate. Then resume stage 2 from the preserved earned landing state. No full Act 1, forest/marsh art, push or deployment claim.


## Braid candidates rejected; portrait checker fixed

Sol retained Braid base and tool candidates at 015cae99, final FAIL review e72d45d4 and evidence 72c2dc23. Full-silhouette alignment shifts the torso as the axe moves; both remain unpublished. The coordinator reproduced the candidate builds byte for byte and inspected the native sheets and foot-anchor experiment.

Forest f14013e8 fixes an independent portrait-ranking bug: action and variant sheets counted one character several times. The checker and contact report now count contract identities, retaining the strongest competitor head and the portrait's own base similarity. Limits, ledger and all asset pixels remain unchanged. Real-asset regressions fail before and pass after, with distinct-character and poor-own-match negative controls. Candidate registration no longer adds Ilara's numeric fault; Aldric's old numeric rank fault also drops out without a visual repair claim. All eight default verification parts and unchanged approved shots pass.

Next Sol follows docs/hero-braid-anchor-repair.md to repair stance alignment, inspect full motion, use remaining generation attempts if needed, and publish the two core sheets only after visual/global checks pass. Mirror runtime stays inactive until the remaining combat/camp family is complete. Everything remains local; no main merge, push or deployment.


## Braid stance repaired; support validation and publication next

Forest 31515f61 aligns boot-pair stance without changing any generated pixels or the walking stride; helper evidence e9494dc5 keeps both sheets unpublished. Coordinator 2ead470f repeats the real-pixel regression and inspects native front/right timelines. The remaining six-pixel geometry gate measures the complete silhouette, so it rejects the stationary body when the axe or braid extends sideways.

Next Sol follows docs/sprite-ground-anchor.md. This explicitly authorizes a narrow offline validation contract for measured foot/support regions, with old shifted-body and clipping negative controls. Existing no-metadata geometry checks, numeric limits, ledger, other art and approvals stay unchanged. Register the two core sheets only after all visual and global checks pass. Mirror mapping, combat/camp assets and full Act 1 remain pending. No push, merge or deployment.


## Braid core sheets accepted; complete the action family

Forest 802dc7f4 publishes hero-braid and hero-braid-swing with explicit pixel-measured ground contacts; evidence 6b0aaf5b. Existing no-metadata geometry checks and numeric limits remain unchanged. Coordinator repeats all nine geometry/stance tests, global assets, fresh rebuild comparisons and append-aware preservation checks successfully, and inspects both contact sheets and the high side timeline. The similar side strike/recovery is an accepted limitation of the core tool sheet.

Next Sol follows forest docs/hero-braid-actions.md to complete six combat/utility sheets and the camp sheet against the accepted Braid base. Keep all existing assets and core sprites intact, require per-sheet visual and numeric acceptance, and preserve exact Braid idle endpoints after camp rise. The full family must exist before the shared mirror/player/fight/camp resolver is activated. Normal play still draws Copper. Full Act 1, other looks, 3D, forest/marsh art and integration remain pending. Everything stays local; no push or deployment.


## Braid actions rejected; resume the earned first night

Forest source 1dd38a06 and evidence 233046b7 retain seven rejected action sheets. Each exhausted its three generation attempts. None was published. Coordinator review df317898 repeats the focused tests and all candidate rebuild comparisons, and inspects representative call and camp timelines. Camp still changes face proportions. The two accepted core sheets remain inactive in normal play. Further action generation needs a different art approach.

Forest brief 134a5015, docs/first-night-input.md, resumes stage 2 from the coordinator's unedited earned landing save. Sol must earn land preparation, the Shut Door sequence and Tamsin's morning visit with real input, exercise a middle Continue, fix confirmed blockers and preserve an earned morning save. Initial search found ditch completion but no equivalent brambles/camp writes; this remains a suspicion to reproduce. Preserve the legacy full runner and all accepted assets, scenes and approvals. Full Act 1 and art acceptance remain open. Everything stays local.


## First night earned; repair the two remaining scene overlaps

Forest source 665c4b42 implements the missing dry field, bramble progression, persisted material-based camp setup and tent sleep. Helper evidence de98c2e6 passes the earned landing-to-Tamsin route, focused checks and all default verification. Coordinator 0ebeb1e4 repeats a fresh production route and focused tests successfully. Its unedited morning save is .artifacts/first-night-review/input/earned-morning.save.json. The repeat discloses 422 one-second idle simulation advances after the ground quest. Required player actions remain earned.

The coordinator inspected irrigation, camp, Custodian and Tamsin captures. Actor overlap and the stone obscuring the hero reproduce in early dialogue frames; settling and every-line checks remain necessary. Next Sol follows docs/first-night-framing.md to repair actual persistent faults and prove the earned path remains intact. Sprite-to-sprite overlap needs a separate offline observation because sight reports deliberately ignore sprites. Stage 3 follows after this repair; full Act 1, Braid, art acceptance and integration remain open. No push, merge or deployment.


## First-night framing reviewed; recurring field exit blocks the repeat

Forest source 501d8a08 and helper evidence a1223370 repair first-night marks in scenes 11, 12, 13 and 15. Helper high/low earned routes and heading checks pass. Coordinator ce13ae9f inspects the Custodian and morning images and repeats 61 focused tests successfully, but its fresh full input replay stops while leaving the arrival field for camp materials. It reproduces the helper's earlier intermittent field-edge failure at x17.721353,z-230.6999. This is not an independently passed full replay.

Next Sol follows forest docs/homestead-input.md. First diagnose and fix that recurring traversal fault, prove the full first-night path, then continue from an unedited earned morning save through both blessing choices and the main kitchen/farm/thistlehog journey. Preserve all failed and passing evidence. Framing acceptance awaits the complete repeat. Full Act 1, Braid and broad art remain open; no push, merge or deployment.


## Homestead independently earned; blessing framing and grey wood next

Forest helper source 11a0bcbe, final guards 558e637d and evidence 79f2c0d7 repair field-exit steering, old-oak felling and missing F guidance. Coordinator .artifacts/homestead-review repeats the fresh morning-to-homestead production path and 43 focused tests successfully. Gathering, construction, living moss farm, resident assignments, middle Continue, meal, real guard break/calm and scene 19 pass. The raw earned homestead has Heartstone 2, four quills and grey wood available. Idle advancement after homestead work is disclosed. Running-pump and first-night evidence remain helper proof, not repeated here.

The coordinator's fresh blessing capture reproduces significant slope/crowd occlusion. Next Sol follows docs/greywood-input.md: repair blessing framing with actual approaches/headings, preserve both choices, then earn Wren's encounter, three foxes, the boar's intended denial and the companion bond, with middle Continue and return-home persistence. Full Act 1, Braid and broad art remain open. No push, merge or deployment.


## Grey wood independently earned; workbench and copper next

Forest game source 661a0f1c, observation fix cacacea5 and evidence 7f21be06 complete the resumed grey-wood slice. Coordinator .artifacts/greywood-review independently repeats the fresh production route successfully, with middle Continue, Wren assistance, pack calm, intended boar denial, bond and home return. Serialized audit confirms three shed pelts, bench available, preserved home and Heartstone 2. The known immediate derived-state drop after Continue reproduces and recovers by home; exact immediate derived persistence is not claimed.

Next Sol follows docs/bench-copper-input.md: earn the jacket, quill farm/strip, fox hedge, burrower observation/bait farm, both Give/Take consequences and copper fitting. Preserve exact earned saves. The shared staging change's remaining all-dialogue high/low coverage is explicitly required, since the resumed helper ran 12 scenes. Full Act 1, Braid and broad art remain open. Nothing pushed, merged or deployed.

## Copper review needs Dax return recovery

Forest helper 5e4c78e9 reports earned bench/copper and both choices. Coordinator fresh replay reached both quests and both visitor fights but failed restoring Dax to watch: Stock the larder appeared instead of Talk to Dax. Preserve .artifacts/bench-copper-review; focused tests and separate Take Continue pass. docs/copper-return-recovery.md specifies diagnosis, normal-input recovery and a full fresh replay before acceptance. docs/gold-arches-input.md is drafted but deferred. No merge, push or deployment.

## Copper recovery independently passed

Forest tested 67af0a36. Coordinator fresh production replay, strict raw audit, Dax watch-yard-watch recovery and final home Continue all pass. The runner follows Dax's current position and lures the visitor across the strip; game source is unchanged. Review and raw exports live in .artifacts/copper-return-review. Independent earned copper hash: d60e8532461740edfb6f337c7b5c0ec71c3586f020d9b377c9c7c40add5588a2. Next is docs/gold-arches-input.md, using the helper's fully audited earned copper boundary. Broad art and full Act 1 remain open. No merge, push or deployment.

## Gold accepted; parallel Echo and tent work

Coordinator fresh production Gold route and strict raw audit pass at 198a482b, including final Continue. Independent earned hash a2c2469ed39bd2d6de6cc2a14f9f16254d528b1603d16601b5c586067f94b7c0. Focused 84 tests pass. Evidence in .artifacts/gold-arches-review. Initial ENOSPC build remains preserved; completed disposable build output was cleared. User now requests resource-aware parallel work. Sol will earn Echo and implement missing map marks/stone interaction; Astra will repair the tent model and sleep approach. Disjoint ownership and one shared heavy-browser lock are specified in docs/echo-input.md and docs/camp-tent-repair.md. Residents/labels, broad art and full Act 1 remain open. Nothing pushed or deployed.
