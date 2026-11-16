# Camera visibility beta blockers

The first-person body fix is source-ready. Browser acceptance is pending the coordinator's resource release and an immutable combined runtime.

## First-person body

The reproduction uses the real story runner and actor drawing synchronizer. Start the Pump memory with a visible hero, enter first person while it plays, then finish the memory. Its cleanup restores `actor.visible` to true. Previously the drawing synchronizer copied that value directly to the sprite or model. The shell only hid it when the camera mode changed.

The regression was committed before the fix in `aba06f03`. Run `bun test src/game/shell/art.test.ts`.

Before the fix, both rendering choices failed at the restored hero assertion:

```text
Expected: false
Received: true
 0 pass
 2 fail
```

Commit `39505d12` combines story visibility with the actual camera mode when synchronizing drawings. It hides only the rendered player in first person. It does not write actor visibility. Free and tilt modes still respect story and fight hides. The regression exercises both sprites and models. `drawnAt` continues returning the smoothed position while hidden, as its documentation now states. Existing mark/ring consumers check visibility separately.

The mobile owner integrated the companion shell edit that removes `player.actor.visible = next !== 'first';` from `applyCamera`. That edit belongs to their commit. It prevents switching camera modes from restoring a hero hidden by a story or fight.

## Sight follow-up

The shell edit exposes a second owner assumption. `sight.frame` and `sight.report` previously treated the logically visible hero as a rendered body in first person. The regression in `1fb08ddb` fails on that report before the fix. Commit `2dbf790b` excludes the first-person player body from those two lists. A fight's separately drawn hero remains included. Nearby story speakers remain included. Free and tilt retain their previous behavior.

This change concerns the player's body clearance. It does not redesign roof lifting or globally disable sight cuts in free/first person.

## Exterior Hall

The supplied exterior image shows Ilara's Hall. Source inspection finds authored open geometry, rather than a missing roof asset. `src/game/content/region.ts` defines an open court at `COURT`. It builds four courses on the north wall, three on the west, and one visible course on the south/east walls. Invisible `barrier` cells occupy the upper south/east courses. No roof is authored. The model built by `hallDoorParts` in `src/features/props/builders/group-3.ts` supplies the door frame and leaves only.

The supplied view is consistent with that plan. This is a source diagnosis, not a browser-confirmed explanation of every missing surface in the image. No Hall geometry, terrain, prop builder or interior layout was changed. Enclosing it would require the coordinator's separate design decision and unowned content/model changes.

## Proof and remaining work

Focused checks cover actor drawing, sight and existing camera rules. Baseline camera/sight checks passed before editing. Red and green output is retained under `.artifacts/camera-blockers/`. No approved shots or saves were changed.

`tools/play-camera-blockers.mjs` is prepared for a released browser slot. It starts no build or server, requires an explicit runtime URL and active heavy-job count, rejects an existing output directory, and closes its own browser. It exercises the memory/mode cleanup trigger, inspects the actual hero sprite instance visibility, records sight/state, and captures first-person and exterior Hall images. The Hall capture records world cells and cutaway mode as diagnostic evidence. It does not claim that an absent roof was repaired.

Example after the coordinator releases a slot:

```sh
bun tools/play-camera-blockers.mjs --url http://127.0.0.1:5800/ --out .artifacts/camera-blockers/combined-after --active-heavy-jobs 1
```

Use a separately identified pre-fix runtime and new output directory for before evidence. The script's syntax and help command were checked. Its browser path has not run yet.

Remaining acceptance work includes the original down-look picture, the Hall camera angle, sprites/models in the combined runtime, full type/check verification, and existing scene 12/14/17/24 framing against the same built source. Existing scene evidence is preserved. No acceptance is claimed from an older snapshot.

No owned server, build or browser job is running. The protected preview at 5796, PID 92343, and `dist-gallery-resume-hud` were untouched.

## Independent combined browser verification

The first immutable runtime tested was `dist-mobile-6685bcf3`, source `6685bcf37d4223ac2fd88d87b90a508bfe9884db`. Its runtime manifest SHA256 is `7dea092977416159d84f04b2a62829f2f531b0ff257eb15dc5538235f0ff1bc9`. Evidence is retained in `.artifacts/beta-combined-input/`. `provenance-6685.json` verifies every emitted JS, CSS, HTML and JSON entry against the owner's runtime manifest. The separate static server used port 5798 and PID 24835. The existing preview and mobile-owned server were untouched.

The sprite memory cleanup trigger passes. The logical actor returns after the real memory ends, its sprite instance stays hidden when looking down in first person, and it returns to sight in free and tilt. Switching modes while the memory hides the hero preserves the story hide. Actual browser right drags, Escape and right release leave no pending look. The images were opened at full size. These are targeted diagnostic checks, not earned chapter progression.

`camera-05` is RED evidence for a separate model loading defect. Selecting models requests `/assets/models/cast-hero.glb` and receives 404. The browser warns that models failed and keeps sprites. No toon model meshes appear. The model visibility assertions correctly fail rather than accepting the sprite fallback. The coordinator identified the loader's source-file URL as the cause: shipped assets use fingerprinted manifest URLs. Product commit `878ec1f8` changes model discovery to the shipped manifest. Acceptance of that repair needs a new immutable runtime; no old-runtime result is relabelled green.

The Hall exterior capture agrees with the authored open court diagnosis. Its free-camera cutaway is `open`, radius zero, and the sampled upper south/east cell is `barrier`; the sampled roof cell is `air`. The low walls and open top are visible in the full-size image. This does not prove exact correspondence to every surface in the originally supplied screenshot, and no Hall geometry repair is claimed.

Focused camera, sight and input checks passed 49 tests. Focused types initially failed because the new art test omitted required SpriteHandle members and the sight test's player omitted its position. The initial log remains. Authorized test-only commit `9d53276b` completes those doubles without changing assertions or runtime source. The affected six tests and focused typecheck then passed.

Legacy ditch recovery is separately diagnostic. `legacy-06/input-provenance.json` hashes the untouched earned landing and the preserved old primary diagnostic. After terrain loads, the runner reproduces the old diagnostic's ten air cells without hole records and supplies ten dirt representing the old excavation drops. It saves this as a new diagnostic checkpoint. Positioning and aiming use the debug door, while selecting dirt, right-click placement, selecting the spade and held primary excavation use actual browser input. All ten cells become wet registered holes; the objective advances to brambles. Saving and Continue preserve the exact holes and inventory. Original fixtures and earned saves remain unchanged. `legacy-01` through `legacy-05` preserve runner failures involving aiming, unloaded terrain, mouse API syntax and first-person cursor acquisition. None is claimed as a product regression.

The same 6685 runtime also passes `bun tools/test-camera-scenes.mjs http://127.0.0.1:5798/ .artifacts/beta-combined-input/scenes-6685`. Scenes 12, 14, 17 and 24 pass every line's sight checks and cleanup, with all 25 full-size line captures inspected. The hero and required speakers remain visible. These scene fixtures use diagnostic quest setup; they are not an earned whole-Act replay. Scene 17 still shows a navigation marker behind the dialogue tint, a presentation detail outside the camera-body blocker.

### Revised immutable runtime result

Final camera and desktop input checks PASS on source `38c42107f8a7a5f5eeff438eea8ea0e16f4c3974`, directory `dist-mobile-38c42107`. Runtime manifest SHA256 is `c8142befaeb9f85ba70597c5c750df9250b61c8a80d6cd6aecebed7d43caa9ec`; source before/after manifests both hash to `52fb7300f136e4afbd9e6e383f57119275d9d12e9a4b2dd11c013d67390aa2d7`. `provenance-38.json` records independent emitted runtime checks. The runtime includes the coordinator's `878ec1f8` model discovery fix.

Command: `bun tools/play-camera-blockers.mjs --url http://127.0.0.1:5798/ --out .artifacts/beta-combined-input/camera-38-green --active-heavy-jobs 1`. All 15 checks pass, with no console/page errors. Models load rather than falling back. After the memory cleans up in first person, the logical actor is visible, the actual hero body and outline have zero instances and are hidden, and sight excludes the player. Free and tilt render the model again. Browser Escape, right release and clicking Resume leave no pending look. Full-size down-look, restoration, Hall and input images were inspected.

`camera-38-final` retains one runner failure before the final pass. Its initial assertion counted a shadow-only proxy on layer `1073741824`, which the main camera on layer `1` cannot render. The final assertion checks actual camera-layer intersection and retains the proxy observation. No product source changed to resolve that runner error. `camera-05` remains the original packaged-model 404 RED.

After the loader repair, focused camera/sight/input tests pass 50 tests and the same focused typecheck passes. Scoped helper lint passes. Scene and legacy recovery results remain scoped to 6685; they were not rerun on 38. Fight-specific sight restoration is covered by focused source tests, without a separate live fight browser run. The full combined verifier, final immutable earned whole-Act replay and mobile acceptance belong to the coordinator. No chapter completion, shipping or deployment is claimed.

All own browsers closed. The final own server on 5798, PID 28894, was stopped. Mobile server 5800/PID 28765 and protected preview 5796/PID 92343 remain untouched. Resource admission and interval samples are retained. Original fixture hashes were rechecked unchanged.
