# Story sprite delivery

ISSUES for visual reservations only. All six art sets exist and the complete asset check passes. The game build passes. The final repository check passes all 310 tests. The coordinator concurrently added second-icon-sheet support after the earlier manifest roundtrip failures.

## Five delivery checks

1. PASS. `bun tools/sprites/check.mjs --complete` exits 0. It runs the original checks plus story sizes, baseline and horizontal anchors, binary transparency, padding, palette, tile counts and file preservation checks. Output: `.artifacts/sprites/check-output-3-final.txt`.
2. PASS. All new manifest paths exist. `git diff -- public/assets/manifest.json` has additions only. The snapshot in `story-baseline-3.json` checks every old manifest value recursively and verifies the original five sprite sheets, icon sheet and block atlas by SHA-256. No old image changed.
3. PASS. Inspected all 18 PNGs listed in `.artifacts/sprites/preview-index-3.json`, including complete animation sheets, the portraits, crops, icons, interface art, stretched nine-slices and the old/new character overview. Re-inspected Gus after correcting source row boundaries and icons/button after cleanup.
4. PASS for identity and distinct silhouettes. All eight people retain their clothing, hair and equipment in front, back and right profile. Tamsin's small sprite face looks younger than sixty; her portrait shows her age more clearly. Back views hide faces. Walking is restrained, with repeated passing poses. Gus and Wren have three source walk poses; the fourth frame repeats the passing pose.
5. PASS with reservations. The old/new overview shares the same palette, warm outlines and proportions. Tamsin and Brack have denser shading, Odo is rounder, the leaftail is more fox than lizard, and portraits are more detailed than world sprites. The title roofs become subdued grey-green after palette snapping. Nine-slice panel center retains broad parchment color bands.

## Build and verification

Run from the repository root, using existing Bun and sharp:

```sh
bun tools/sprites/build-story.mjs
bun tools/sprites/build-story-extra.mjs portraits
bun tools/sprites/build-story-extra.mjs crops
bun tools/sprites/build-story-extra.mjs icons
bun tools/sprites/build-story-extra.mjs ui
bun tools/sprites/check.mjs --complete
bun tools/sprites/preview-story.mjs
bun run build --outDir .artifacts/sprites/game-build
```

The story builder adds only story sprite entries. The extra builder publishes one set at a time. Both read the current manifest just before atomic publication, preserving other entries. The original default block builder is unchanged. Do not use the legacy `--rebuild-original-set` option.

Asset checks and game builds ran after publishing people plus leaftail, portraits, completed creatures, crops, icons and interface art. Output files are `.artifacts/sprites/check-output-3-*.txt` and `game-build-3-*.txt`. The final result is authoritative after crop, Gus-layout, icon-speck and button-aspect corrections. The production build is only a compilation check; it does not prove story integration or gameplay.

`bun run check` passes in the final rerun: 310 pass, 0 fail. An earlier run failed two icon-manifest roundtrip tests. Concurrent loader changes resolved those failures and support `icons.sheets.story`. This task edited no engine code or engine tests. Final output: `.artifacts/sprites/repo-check-3.txt`.

## Manifest additions

- `sprites.tamsin`, `maren`, `odo`, `gus`, `mira`, `wren`, `juniper`, `brack`: 128-square frames, anchor [64,120], idle two and walk four in front/back/right directions.
- `sprites.leaftail`: 96-square frames, anchor [48,88], idle two and walk four in three directions.
- `sprites.lanternfly`: 96-square frames, anchor [48,88], flutter four, rows.front only.
- `portraits`: 128 tiles in a 3 by 3 atlas. Tamsin, Maren, Odo / Gus, Mira, Wren / Juniper, Brack, hero.
- `crops`: 32 tiles in a 4 by 4 atlas. Wheat, turnip and carrot each occupy one row with four stages. Berry bush without and with berries occupies [0,3] and [1,3]. Remaining cells are transparent.
- `icons.sheets.story`: tile 32, sheet `icons/icons-2.png`, sixteen names in brief order. Original `icons.tile`, `icons.sheet` and `icons.names` are unchanged. The nested entry is a second sheet, not a replacement for the old sheet.
- `ui.panel`, `ui.button`, `ui.title`: dimensions 96 by 96, 96 by 32 and 480 by 270. Nine-slice borders are 24 and 12 pixels respectively.

## Attempts and processing

Built-in image generation made all artwork. Raw PNGs are in `assets-src/raw/*-3.png`. Prompt records are `prompts-3.json`; the sprite base and subject descriptions record the production requirements. Each townsperson, leaftail, lanternfly, each portrait, each crop stage, each of sixteen icons, panel, button and title has one generation attempt, except Wren with two. Wren's second generation removes a white matte; the first is retained as `raw/wren-3-attempt-1.png`. Portraits, crops and icons were each generated together in their own atlas.

Sharp cleans alpha, removes background components, slices sources, uses nearest-neighbor scaling, aligns anchors, snaps colors and packs sheets. It draws no replacement artwork. Icons retain their largest connected component to discard cell-edge scraps. Crops use a shared scale per crop row and trim resampling margins before bottom alignment. Gus uses measured unequal source row edges [0,270,541,816,1084,1360] and directions in columns; Wren also has directions in columns. Source layouts differ from the runtime layout and are recorded in the builder.

No commits, dependency installations or edits outside the four allowed directories.
