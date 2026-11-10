---
name: make-sprite
description: Add a generated sprite, creature, icon, portrait or block tile that fits this game's approved PNG set.
---

# Make a sprite

Read `docs/assets.md` and `docs/style-sheet.md`. Use an image generation tool with the approved PNG as a visual reference. Without one, report BLOCKED. Scripts may slice, clean alpha, scale, snap the palette and match tile edges. Drawing replacement pixels in code or by hand is outside this workflow.

## Freeze first

`assets-src/*baseline*.json` pins approved files and manifest values. Add new files and new names. Preserve those hashes and values, including `blocks.atlas`. Never refresh a baseline to silence a failure. `build-story.mjs` skips names already in the manifest. Keep `people` and existing atlas cell positions in order.

The world currently reads one frozen block atlas. A new standalone material can be published through `build-valley-tile.mjs` and `manifest.materials`, but that does not make a world block use it. Report the required loader extension to the coordinator. Changing only `blocks.ts` to an absent tile is not integration.

## Match the set

- Light comes from upper left. Highlights are warm cream; shadows are brown or violet.
- Use the locked `assets-src/palette.json`. Brown outline ramp is `#302529`, `#493335`, `#65453a`; wood is `#916534`, `#9b6f3e`, `#b78b5a`; leaves use `#3c5537`, `#516b3c`, `#6c8043`, `#8d9a4a`.
- A human uses a 128-square frame, anchor `[64,120]`, world height 2 blocks, roughly 106–110 drawn pixels tall. The hero's head including hair is roughly 50 wide by 42 high; compare the actual reference crop. Keep its head and torso dimensions within 2 pixels across action rows. Outline is 1–2 final pixels, never black or a pale halo.
- Creatures normally use 96-square frames, anchor `[48,88]`, roughly 68 drawn pixels tall. Compare the named creature before choosing world height.
- Transparent background, binary alpha, no floor shadow. Side faces right, back shows no face. Tools fit inside the frame without resizing the body.
- Tiles are 32-square. Preserve broad material structure: wood has 2–3 boards and 1-pixel joints; stones have visible separate shapes. Grain stays quieter than joints. Inspect a 6-by-6 repeat. Low contrast noise alone is not wood.
- Icons fit within 24 pixels of a 32-square cell, with 1–2 pixel tinted outlines and top-left highlights. Bright lume teal belongs to magic, muted roof teal belongs to town.

## Generate and publish

1. Run `bun tools/sprites/preview-story.mjs` and `bun tools/sprites/preview.mjs`. Open the subject's whole sheet and `side-by-side-3.png` before prompting. Use [prompts.md](prompts.md) for prompt patterns.
2. Record prompt, tool, reference and attempts in `assets-src/`. Save generated sources as `assets-src/raw/<name>-3.png` for sprites or `<name>-2.png` for tiles. Allow three attempts; retain the best and report defects.
3. Append a `storySprites` entry in `tools/sprites/story-config.mjs`. Specify size, anchor, height, worldHeight, cols, rows and animations. Example action sheet: `hero-swing`, 3 columns, 3 rows, `tool.rows={front:0,back:1,side:2}`. Build with `bun tools/sprites/build-story.mjs`. Existing entries stay frozen.
4. For icons, add a new set in `build-story-extra.mjs`, publish under `icons.sheets`, and extend its checks. Existing icon sheets are full. A second portrait sheet needs a loader contract first.
5. Run both sprite checks with `--complete`, then `bun tools/verify-assets.mjs`. Read [check-failures.md](check-failures.md) for failure meanings. Inspect the real result even when checks pass.

## Look before done

Open the entire new sheet on green, each direction beside the approved character, and every action at native size. Check head size, costume, hair, anchor, outline, clipped tools and pose continuity. Watch windup → strike → recovery beside idle; an action must remain the same person. Inspect all repeated tiles and all added icons at their shipped size. Preserve generated structure through palette snapping.

Today's failures: the approved hero tool row was larger and only right-facing. A generic new action prompt cannot preserve identity; reference the idle sheet and judge each direction. The plank became pink-orange noise after processing removed its board joints. Palette membership and seam checks did not catch either problem. Report visual defects explicitly, with before/after paths and the manifest names a caller can wire.
