# Act 1 inventory icons

PASS. `bun run verify check assets build shots` passes. Both complete sprite checks and the assets feature typecheck pass. All six game-size icon comparisons and both real inventory pictures were opened.

63 icons in six new 32-pixel atlases. All use the locked palette, binary alpha and a maximum 24-pixel silhouette. Originals and baseline files are unchanged. Sources are lossless WebPs in `sources/`; prompts and generation attempts are beside this report. Rebuild each set with `bun tools/sprites/build-story-extra.mjs <set>`.

## Names for the item helper

- `act1-farm`: wheat, carrot, sunroot, seeds, moss-fiber, quills, copper, gear-spring, frog-slick, honey, wax, glow-dust, vine-rope, tusk-tip, shed-pelt.
- `act1-kit`: quill-strip, lamp-post, slick-patch, clapper, pusher-plate, salve.
- `act1-story`: brass-key, pump-house-keystone, lamp-gallery-keystone, seed-vault-keystone, memory-stone, blessing-stone, queens-charter, road-writ.
- `act1-found`: old-brass, heartwood, plank, hobbs-meal, travel-meal, bread, coin.
- `act1-weapons`: sword, sword-copper, sword-brass, sword-tusk, bow, bow-copper, bow-spring, bow-tusk, staff, staff-copper, staff-brass, staff-rootwood.
- `act1-equipment`: canvas-jacket, padded-jacket, quill-coat, root-weave, quill-edge, padded-grip, spring-hilt, glow-cap, slick-sheath, honey-binding, axe, hoe, spade, watering-can, saw.

Additional compatibility aliases: fiber=moss-fiber, wheat_seeds=seeds, seed=seeds, key=brass-key, watering_can=watering-can, shovel=spade. Every listed name and compatibility alias also has an `act1-` prefixed alias. These aliases use the same cells, with no duplicate image data. The interface selects that alias first so old content gets the replacement art despite the asset loader's first-sheet-wins rule. A caller using `Assets.icon` directly should use the prefixed alias for a name already present in an older atlas. New item content using the normal interface can use the plain names above.

## Picture evidence

Opened every final `beside` image, including all icons at 64 and 32 on both navy and parchment:

- `.artifacts/sprites/beside-icons-act1-farm.png`
- `.artifacts/sprites/beside-icons-act1-kit.png`
- `.artifacts/sprites/beside-icons-act1-story.png`
- `.artifacts/sprites/beside-icons-act1-found.png`
- `.artifacts/sprites/beside-icons-act1-weapons.png`
- `.artifacts/sprites/beside-icons-act1-equipment.png`

Original atlases for comparison: `.artifacts/sprites/beside-icons-main.png` and `.artifacts/sprites/beside-icons-story.png`.

Real inventory captures, opened and inspected: `.artifacts/act1-icons/inventory/bag-1440.png` and `bag-390.png`. They show the new axe, wheat and three-board plank stack in the existing bag. The capture script closes its Chrome and server when finished.

## Visual decisions and limits

The generation retries removed concept-sheet captions, parchment and an unwanted background haze; alpha cleanup removes remaining soft haze. The first weapon atlas was too thin at 32 pixels and was replaced with chunky silhouettes. The final edit restores silver iron on the brass sword blade. Its irregular source row boundaries are recorded in the slicer so staff crowns stay whole. The final masters are farm attempt 1, kit attempt 3, story attempt 1, found attempt 2, weapons attempt 3 and equipment attempt 2.

At 32 pixels, seals, quill texture, stitches and bowstrings simplify to a few marks. The three keystones retain triangular, tall hexagonal and round outlines. The clapper is shown cocked with a spring gap; its boards close to make the sound. No deployed kit, animation or new item rules were added. The item helper owns availability and recipes for new items; those future flows were not checked. The inventory picture contains existing items, not all 63 newly registered icons. No remote deployment or Windows playtest was performed.

Checks and logs are in `.artifacts/act1-icons/`: `check.log`, `assets.log`, `final-sprites.log`, `final-story.log`, `typecheck.log`, `final-verify.log`, `inventory.log`. The first screenshot-suite attempt collided with the simultaneous inventory capture on port 5804; retrying separately on 5805 passed. The asset verifier's existing `uikit` documentation warning remains; `docs/assets.md` already has an interface-kit description. No baseline was refreshed.
