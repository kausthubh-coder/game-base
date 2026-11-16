# Make the mirror choice visible in play

The mirror offers Copper, Cropped, Fringe and Braid. All four save a distinct
`hero.look` value, but the player rig still selects `hero` and `hero-swing`.
The fight view and camp film also name Copper sheets directly. A palette tint
cannot supply the promised hair, face and build.

Use the approved four-option concept at
`assets-src/concept/people-home/hero.webp`. Its lower-right option D and pixel
mock define Braid: olive complexion, square face, athletic medium build,
long brown braid with closely cropped sides, pale sage jacket, cream shirt,
charcoal trousers, brown boots and satchel, brass key. Keep the sixteen-year-old
Guild Ward identity. The existing world hero defines pixel scale and rendering
style, not Braid's face or hair. No new design decision is needed.

## Sequence

1. Build Braid idle/walk and tool-use sheets together. Establish identity and
   action continuity before generating every pose. This is the current task.
2. Complete Braid's combat and camp sheets against that accepted base. Inventory
   `hero-cut`, `hero-cut-back`, `hero-moves`, `hero-call`, `hero-bow`,
   `hero-staff` and `hero-camp`, including actual animation names and directions.
3. Integrate the complete sprite family through one look resolver used by the
   player, fight and cutscene drawing paths. Preserve Copper defaults and old
   saves. Prove real mirror selection, immediate appearance, all actions and
   Continue. The optional 3D character setting needs explicit coverage and
   Astra-owned models; do not claim it is fixed by 2D assets.
4. Repeat the proven process for Cropped and Fringe. Preserve every choice and
   the approved art. Then resume the earned stage-2 progression replay.

Do not activate a partially finished Braid family in production, remove mirror
choices or disguise missing poses with Copper frames. Asset delivery alone
does not resolve the mirror bug.

## Current asset brief

Use GPT-6.1 Sol in the existing forest checkout, with no other writers.
Read AGENTS.md, make-sprite and verify-assets skills, docs/assets.md,
docs/style-sheet.md, art-style.json, art-contract.json, relevant handbook
guidance and existing hero builders. The user's current split reserves 3D
assets for Astra. This task creates 2D sprites only.

Own new Braid raw sources, prompts and attempt records under
`assets-src/hero-braid/`; a reproducible builder in `tools/sprites/`; append-only
entries in story-config, public manifest and art-contract; reviews for the
new names; and `.artifacts/hero-braid/`. Publish new names `hero-braid` and
`hero-braid-swing`, preserving all existing file hashes, atlas positions,
manifest values, baselines, review exceptions and approval images. Read the
frozen asset rules before touching manifest data. Do not change runtime game,
engine, UI, 3D models or existing sprites. Do not add dependencies.

Use an available image-generation tool with the actual approved references.
The built-in image_gen tool is available to the coordinator; discover callable
tools in your context. Read the imagegen skill when using that workflow. Do
not replace generation with hand-drawn or code-painted pixels. The sprite
skill permits slicing, alpha cleanup, palette snapping and alignment of the
generated figures. Retain generated raw output and prompt/reference provenance.
If your tool is genuinely unavailable, report the attempted discovery and the
exact blocker; do not claim that a tint or copied Copper frame is Braid.

First inspect the full existing hero/hero-swing sheets and their native-size
comparisons. Generate Braid's front, back and right-facing idle/walk in one
sheet so the character stays consistent. Use its accepted generated base as
the action reference for Braid's tool windup, strike and recovery. Match the
live idle/walk and tool frame/fps/direction contract, not a guessed grid. Keep
128-square frames, anchor [64,120], worldHeight 2 and the approved head/body
scale. No face in back views, clipped braid or tools, shrinking torso, white
fringe or painted floor shadow. Allow up to the skill's three attempts per
sheet, retaining useful evidence and reporting unresolved defects honestly.

Build and inspect every frame on green, front/back/right beside the approved
concept and world cast, and tool action followed by idle at native scale.
Use a local diagnostic showcase to observe the sprite animating in the game
renderer at high and low. The showcase may explicitly display the new sprite;
do not mislabel it as real mirror integration. Verify the existing approved
sprite family is unchanged. Capture both the best and weakest frame.

Run the two complete sprite checks, targeted art checks/review, asset verifier,
appropriate tools tests, production build and default verify including all six
unchanged shot approvals. Check baseline first. Preserve prior evidence and
earned saves. Do not blanket-refresh the art ledger or relax asset limits to
make the candidate pass. Review answers must describe the actual inspected
pixels. If the candidate fails visual acceptance, keep it as clearly labelled
source evidence and report which specific frame/trait fails instead of
publishing bad art as finished.

Commit completed source slices locally and evidence separately. Finish every
owned job and stop only your own servers/browsers. No helper agents, checkout
changes, push, merge or deployment. Report PASS/ISSUES/BLOCKED, exact tested
and evidence SHAs, rebuilt asset names, generation attempts, checks, inspected
image paths and limits. Provide the exact remaining pose inventory for the
next asset pass. No mirror bug, full Act 1, 3D-look, cloud or weak-device
acceptance claim from these first two sheets.
