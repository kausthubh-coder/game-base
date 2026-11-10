# Block texture repair

ISSUES. Automated checks pass. The strict visual rule does not pass for every changed tile.

## Rebuild and verify

```sh
bun tools/sprites/build.mjs --blocks-only
bun tools/sprites/check-banding.mjs
bun tools/sprites/check.mjs
bun tools/sprites/preview.mjs
```

The default build now builds blocks only too. The earlier complete build is behind the explicit `--rebuild-original-set` flag. Do not use that flag for this repair. It rebuilds characters and icons with the expanded palette.

The atlas is now 256 by 160, eight columns and five rows. Original cells keep their positions. The eight new names occupy the last row. `tilled_soil` and `path` remain available. `water` remains shader-only. The preview script reads atlas height and includes all forty cells.

The built-in image_gen tool generated 24 separate sources, one per requested tile or variant. Sources are `assets-src/raw/*-2.png`. Sand, stone and leaves include their variant number before the run number. Exact prompts are in `block-prompts-2.json`. `atlas-before-2.png` preserves the original atlas. `block-baseline-2.json` records the original manifest, color measurements and SHA-256 hashes of the approved sprite and icon files.

Postprocessing removes row and column illumination biases on natural surfaces, limits local contrast, snaps to material ramps, and averages opposite boundary pixels. Structured sources use filtered downsampling so thin frames survive. Existing generated textures outside the replacement list receive only line-bias correction when the new rule flags them. No new art was drawn in code.

The original palette colors remain intact for the sprites and icons. Additional three-color material ramps supply warm greys, muted roof teal and quieter surface shades. Bright lume teal is reserved for the crystal. Grass-side uses interspersed turf and soil instead of a top fringe, because the brief requires vertical repetition without a stripe.

## Five delivery checks

1. PASS. `bun tools/sprites/check.mjs` exits 0. The full output is `.artifacts/sprites/check-output.txt`.
2. PASS. Every name returned by `blockTileNames()` except `water` is in the manifest, with opaque cells inside the atlas.
3. FAIL under the strict wording. Inspected all ten `blocks-*.png` sheets, each containing four 6 by 6 grids. The replacement sand, stone, plaster, grass-side and three leaf variants have no visible boundary stripe. Glass, lamp_top and lamp_side deliberately show a thin pane/frame grid. Other changed tiles retain visible motifs: grass_top 1 has recurring flowers, tilled_soil has horizontal cultivation detail, path has diagonal clusters, oak_log_top has repeated endgrain circles, oak_plank and thatch have horizontal courses, and oak_log_side, birch_log_side and pine_log_side retain recurring bark grain. Stone brick and shingle retain faint courses. These are quieter but do not satisfy an absolute ban on stripes or repeats. The best retained result balances material recognition and quiet shading.
4. PASS for the requested color correction. Inspected the final `side-by-side.png`. Masonry reads grey and the roof reads muted teal. The generated replacements are quieter and less detailed than the older retained textures, so complete detail-density agreement remains a reservation.
5. PASS. Sprite and icon file SHA-256 hashes and their manifest entries equal the baseline. `git status --short public/assets/sprites public/assets/icons` is empty.

## Banding rule

The threshold is 18 RGB intensity levels out of 255. In an explicit 4 by 4 repetition, compute each RGB channel's whole-image mean, then every row and column mean. The largest absolute per-channel difference must be at most 18. No material is exempt. Exact opposite-edge equality, palette, transparency, padding and anchor checks remain active.

The regression fixture catches old sand 1/2/3, stone 1/3, plaster, glass, grass_side and oak_leaves 1/2/3. It also catches grass_top 1, tilled_soil, path, mossy_stone, cobble, stone_brick, oak_log_side/top, oak_plank, birch_log_side, pine_log_side, thatch and shingle. Old stone 2 passes this numeric rule but was replaced for color and visual quality. The rule detects average-color bands, not all repeated motifs. A passing numeric score does not override a failed visual review.

## Attempts

Generation attempts in this run: sand 1/2/3, stone 1/2/3, oak_leaves 1/2/3, grass_side, mossy_stone, cobble, stone_brick, shingle, plaster, glass, tilled_top, path_top, path_side, birch_log_top, pine_log_top, lume_crystal, lamp_top and lamp_side each have one. Including the earlier run, each replacement has two lifetime generations; the eight newly named tiles have one.

Processing candidates inspected: two for cobble, stone_brick, shingle, glass, birch_log_top, pine_log_top, lamp_top and lamp_side. The second keeps thin frames and reduces aliasing. All other changed cells have one processed candidate. No tile exceeds four attempts. Additional unchanged cells keep the earlier source and processing. Characters and icons have no new attempts.

The general repository check passed earlier in this run. Its final rerun fails in concurrently edited audio code, outside this brief: `src/features/audio/mixer.ts:59` has an unused `rig` property and `src/features/audio/rig.ts:80` assigns `string` to `OscillatorType`. The asset check still exits 0. No dependencies were installed and no commits were made.

## After the second run (coordinator, 2026-11-09)

The second run passed the banding rule by repainting every material on three near-equal colors. That
removed the banding and also the drawing: cobble, brick, shingle and leaves became flat noise.

`tools/sprites/compose-blocks.mjs` now runs at the end of `build-blocks.mjs`. It takes the shapes of 14
structured tiles from the first run's atlas and repaints them on a five-step ramp of the right color: grey
stone, teal roof, calmer leaves. Log tops for birch and pine reuse the oak rings.

Tiles that are striped on purpose are exempt from the banding rule, with the reason beside the list in
`tools/sprites/banding.mjs`: grass side, tilled soil, brick, shingle, mossy stone.
