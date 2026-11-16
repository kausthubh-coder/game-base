# Spade excavation bypasses water flow; a pond rock has invisible collision above its mesh

Source diagnosis on shared branch `act1`, starting HEAD `f1e546c6748cea04d8fbf3e0c83b450e6f495634`. Product code remains unchanged by this test task. No browser, build, server, cloud service or saved chapter was opened or changed. The preview on port 5796, PID 92343, remains untouched.

## Irrigation reproduction

Run from the checkout root:

```sh
bun tools/play-irrigation-blocker.mjs primary
```

Expected exit 1 before repair:

```text
AssertionError: spade excavation must register flow-capable ditch cells
0 !== 10
```

The harness uses the real seed-1 world, all game systems, eye raycast, actions, machine flow and quest flag. It aims at the authored grass cells `(8..17,21,-229)` from the bank and holds primary with a spade. All ten grass blocks become air. None becomes a registered machine hole. No pond water flows, and `step.ground.ditch` remains false.

Control command:

```sh
bun tools/play-irrigation-blocker.mjs secondary
```

Expected exit 0. The same aims with secondary use create ten wet holes, complete the objective, and retain both after Continue. The spade count stays one. Both commands produced the same respective verdicts on three runs, including the initial reproduction.

This is diagnostic setup. The harness supplies one spade, positions the hero beside each target and opens the ditch quest step. It never injects water, holes, excavated blocks or a completion flag. This proves the action/flow defect, not earned opening progression or browser input delivery.

## Exact irrigation cause

`src/game/machines/index.sim.ts`, function `dig`, accepts only `context.button === 'secondary'`. It removes the block, registers the hole and invokes `flow()`.

Primary with the same tool falls through to `src/game/actions/index.sim.ts`, functions `hold` and `breakBlock`. This removes the block and gives its drop but never registers a machine hole. `flow()` visits only registered holes, so physically connected primary excavation never carries water. The completion check requires a wet registered hole beside tilled soil at the same height.

The secondary control rules out a disconnected authored pond and a broken quest check on this route. The existing first-night and machines tests pass because they use secondary `use`, which misses this player failure. The older 12 November report concerns finding/crafting the spade and remains a separate guidance issue.

Smallest proposed repair: route primary use of a spade on eligible bare ground through the machine excavation handler as well. The existing handler-claimed-primary mechanism prevents the generic breaker from running afterward. Retain secondary behavior, protected ground, crop refusal and busy-player checks. Review the intended hold duration with the input owner before choosing an instant primary action. Another valid repair is registering spade-broken eligible ground through the existing held break path. That retains timing but needs enough block/tool information at that boundary.

Do not assume this repairs already excavated saves. Old primary trenches contain air with no hole records. Preserve those saves and test an explicit recovery route separately; no save migration is implemented here.

## Invisible pond collision reproduction

```sh
bun tools/play-irrigation-blocker.mjs collision
```

Expected exit 1 before repair:

```text
AssertionError: the centre of every top collision cell must lie below the visible rock top
```

This runs the actual painted land builder and actual instanced boulder geometry without WebGL. It reads the authored prop positions, rotation, variant and scale. It applies the shell's placement lift and the painted rock stand-in's `0.78` scale, then raycasts down onto the real triangles.

At `(4.5,-228.5)`, land is y=22, the visible rock top at the centre is y=22.8701494072334, and the collision top is y=24. The centre of the upper barrier cell at y=23.5 is visibly empty. The other two pond rocks have collision top y=23; their centre top gaps are less than half a block. Repeated source runs return the same geometry results.

`src/game/content/region.ts` stamps `BOULDERS` as barrier columns, including two cells at `(4,22..23,-229)`. The prop's scale derives from the authored height, but its actual mesh shape is selected separately in `src/features/painted/scatter.ts`. The painted stand-in reduces the scale further in `world-painted.view.ts`. The two-cell collision column extends above the rendered rock. Barriers have no visible voxel faces. A hero can collide with or stand on the invisible upper part.

Smallest proposed repair for this demonstrated case: remove the upper collision cell from that boulder while retaining its visible mesh. Then inspect its full footprint against the hero body before claiming all rock collision is fixed. Prefer one authored geometry/collision definition for a later systematic repair. Camera cutaway and general smooth-ground collision are separate work owned by the coordinator.

## Source versus immutable preview

Read-only inspection of both `dist-gallery-resume-hud/assets/fingerprinted/index-B3P0SsUu.js` and `index-CsQptdTl.js` finds the same secondary-only spade gate, hole insertion and flow call. The preview also contains the same pond boulder coordinates/heights and prop-scale expression. Bundle hashes and the exact spade excerpts are retained in `.artifacts/irrigation-blocker/preview-source.json`.

This establishes the irrigation code defect in the preview snapshot. It does not establish how the user's mouse gesture was delivered. Collision measurements above execute current source, not the preview bundle. Confirm preview mesh transforms in a browser before asserting identical numeric collision gaps there.

Both supplied screenshots were inspected from the attachment paths ending `2d5818e0-fb62-48b4-b31e-29c8c5c9b2a5.png` and `7e498479-b8e7-42c1-abfa-099c82bed08f.png`. They show the ditch objective and terrain/prop presentation near a plank crossing. They do not include world coordinates, a selected tool action trace or a collision overlay. They cannot identify the exact collision cell or establish the player's mouse button. The source reproductions demonstrate defects consistent with the report without claiming that correspondence is proven.

The source already supports URL looks `smooth`, `steps` and `blocks`. A player-facing toggle is deferred as requested.

## Validation and evidence

- `bun test src/game/region/firstnight.test.ts src/game/machines/machines.test.ts src/game/actions/actions.test.ts`: 38 pass, 0 fail, 802 assertions.
- `bun tools/sim.ts scenarios workbench-crafting`: 1 of 1 scenarios passed.
- `.artifacts/irrigation-blocker/primary.json` and `primary.log`: failing excavation and completion.
- `.artifacts/irrigation-blocker/secondary.json` and `secondary.log`: wet ditch control with Continue assertions.
- `.artifacts/irrigation-blocker/collision.json` and `collision.log`: actual geometry/collision mismatch.

The red loop remains outside the default suite until a repair passes it. No production fix or chapter acceptance is claimed. Full verification was not launched because the brief reserves builds and browsers for an explicit parent slot.

## Required browser proof after repair

1. Obtain the parent browser slot and run `bun tools/resource-status.mjs` before launching. Use a separate build/output/port. Keep PID 92343 and port 5796 intact.
2. Preserve the nearest earned chapter save bytes and hash. Use a separate opening playtest profile/save. Start a new game or resume the nearest earned opening checkpoint before the ditch. Earn the spade through ordinary input.
3. Use the realtime replay driver with awaited browser keyboard and mouse bindings. Walk the bank through ordinary movement. Select the spade, aim at each authored target and hold primary. Record actual target hits and mouse events. Do not use debug clicks, teleports, world edits, injected inventory or simulated advancement as earned proof.
4. Capture the first excavation, pond connection and final wet cell beside the dry field. Require ten wet holes and the tracker advancing from ditch to the next step. Record inventory costs and the spade count. Save to a new file, reload with Continue, and assert the wet ditch and progression persist.
5. As a separate diagnostic, approach the tall pond rock from every side at foot level and at the former upper barrier level. Capture hero/body coordinates, aim hit, rendered rock and barrier coordinates together. Require no collision in the demonstrably empty upper cell. Confirm the hero neither stands above the rock nor passes through its visible centre.
6. Inspect desktop and phone pictures at high and low quality. Repeat the same primary and secondary gestures in the preserved preview if comparison is needed, using isolated local storage. Retain failed attempts. Run combined verification after the parent integrates all repairs.

## Lean repair, 16 November

Primary spade excavation now registers the hole on the synchronous `block.broken` event when the selected item is the spade and the removed block is eligible exposed ground. The actions system retains its hold meter, minimum duration and item drops. The machine handler refuses protected or growing ground for both buttons; secondary retains its existing instant excavation. Registration is idempotent, so secondary's event cannot duplicate a hole.

Existing trenches can be recovered through normal play: select dirt, place it back into each empty trench cell, select the spade, then hold primary to dig those cells again. Primary excavation returns the dirt. No save bytes or old hole records are migrated. The focused regression executes placement and held excavation against an unregistered empty cell.

The boulder at `(4,-229)` keeps its authored prop size, variant, rotation and solid base. Only its second barrier cell is removed. The remaining pond rocks are unchanged.

Before product edits, the primary and collision diagnostic commands failed again, and the primary timing/reward and recovery regressions failed with missing wet holes. New logs live in `.artifacts/irrigation-repair/`; the original `.artifacts/irrigation-blocker/` evidence is untouched. The diagnostic tool now writes a timestamped directory for every invocation.

Focused green command: `bun test src/game/machines/machines.test.ts src/game/region/irrigation.test.ts src/game/actions/actions.test.ts src/game/region/firstnight.test.ts`, 42 pass, 0 fail. Primary and secondary source diagnostics both pass wet ditch, objective and Continue. The actual-mesh collision diagnostic passes with the lower barrier. Browser proof and combined verification are tracked separately below.

### Earned browser replay and collision diagnostic

Repair commit `dfa5dbb2` was built into the new immutable directory `dist-irrigation-repair-20261116-0628`. Resource admission samples precede the build and every browser launch in `.artifacts/irrigation-repair/`. This shared-checkout build also includes coordinator edits present during bundling; the commit alone does not identify every input. `provenance.json` records owned-source SHA256 hashes and every emitted JS, CSS and HTML hash. The runtime-manifest digest is `acf50b818564454d7f7547bad65be9ce598b7b28e7dc543f123573d94a27d8c3`.

The browser imported the unchanged earned landing save at `.artifacts/grantday-framing-review/input/earned-landing.save.json`, SHA256 `d4a256063566d0cb2193de07c4390fdec798d4fe15d67c10886795ed8e542c60`. Its recorded grantday replay establishes the earned boundary. It already contains one axe and one spade. `.artifacts/irrigation-repair/earned-01/replay.json` records awaited browser key inputs through the realtime replay driver, ordinary walking to the bank, actual aim hits, held left mouse excavations, saving and Continue. There were no teleports, supplied items, world edits or flag changes on this earned segment.

All ten excavations became wet holes. The tracker advanced to `quest.ground.step=brambles` with `step.ground.ditch=true`. Continue preserved the flags, bag and exact holes. Final inventory contains one axe, one spade, ten dirt, three fiber and three moss fiber. Dirt and fiber came from excavation drops; moss fiber was an automatic nearby pickup during travel. The new checkpoint `.artifacts/irrigation-repair/earned-01/mid-ditch.save.json` has SHA256 `51cd9dfc7c191a66e197145412d7c85684e1cca1c31f379ff4134632ba9f7189`.

`.artifacts/irrigation-repair/diagnostic-04/report.json` is a separate diagnostic with disclosed positioning. Four approaches retain body samples and pictures. East, north and south approaches step onto the remaining one-block rock at y=23 without penetrating its solid base. The west approach also crosses the adjacent oak at `(3,-229)` and can stand at y=24 while the body overlaps that tree; this is not support from the removed rock cell. A centre drop settles at y=23, and direct reads confirm barrier at `(4,22,-229)` and air at `(4,23,-229)`. The tree remains intact.

The first two diagnostic attempts failed because the runner incorrectly assumed a flat west approach and required the hero to stop beside the rock. Those reports remain preserved. The corrected check accounts for ordinary stepping and the adjacent tree, samples body penetration, and checks the removed cell separately. No product change followed those runner failures.

The final diagnostic reloads each viewport and applies the actual settings quality API. All four desktop/phone high/low images were inspected. The earlier `earned-01` images labelled low did not actually change quality, and the early diagnostic resize-only phone captures caught unsettled rendering; use `diagnostic-04` for the presentation matrix. This is viewport inspection, not proof of touch controls.

Validation also passed `bun run check`, focused machine typechecking, scoped Biome lint and the standard three 20,000-step bots. Full combined `bun run verify --full`, approved comparisons and later chapter acceptance remain coordinator work. No claim is made that general terrain collision, water/bridge artwork, camera modes or all rocks are repaired. The preview at PID 92343 / port 5796 remains untouched. All browsers and servers started by this repair were closed; port 5798 is released.
