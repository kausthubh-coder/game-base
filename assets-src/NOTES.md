# Sprite asset experiment

ISSUES. All files and automated checks pass. The strict visual no-seams check fails for some block textures.

Built with the built-in image_gen.imagegen tool. Raw generated PNGs are in `assets-src/raw/`. The exact prompts are in `prompts.json` and `clay-prompt.txt`. No artwork was drawn in code. Sharp performs slicing, cleanup, alignment, palette conversion, edge blending and packing.

Run from the repo root:

```sh
bun tools/sprites/palette.mjs
bun tools/sprites/build.mjs
bun tools/sprites/check.mjs
bun tools/sprites/preview.mjs
```

`palette.mjs` needs the two local reference JPEGs named in `palette.json`. Normal builds need only this repo, Bun and the already installed sharp. The build replaces the complete manifest, which belongs to this pipeline. Future assets should be registered in `tools/sprites/config.mjs` before rebuilding.

## Six delivery checks

1. PASS. `bun tools/sprites/check.mjs` exits 0. Full output is in `.artifacts/sprites/check-output.txt`.
2. PASS. Version 1 manifest, five character sheets, every requested animation and direction, every requested block variant and icon. All paths exist. No extra generated water cells enter the manifest.
3. PASS. Inspected all 15 preview PNGs listed in `.artifacts/sprites/preview-index.json`. Re-inspected hero and the overview after fixing hero crop boundaries. The other final previews have unchanged pixels.
4. PASS. Each character stays recognizable in all three directions. Hero keeps chestnut hair, ochre cloak, cream collar and satchel. Villager A keeps red headscarf, braid, burgundy dress and cream apron. Villager B keeps olive cap and vest, silver beard and rust trousers. Pet keeps orange and cream fur, pointed ears and leaf-tipped tail. Critter keeps moss body, round ears, root feet, amber eyes and two-leaf sprout. Back views hide faces and side views face right. Fine cloak folds, hair highlights and apron details drift slightly. Walk stride shapes repeat, and idle motion is very subtle; this is a static sheet review, not playback verification.
5. FAIL visually. All 32 opposite tile edges match exactly, but matching boundary pixels does not prove a seamless-looking field. Inspected a 6 by 6 grid of every tile. Sand 1, stone 1, plaster, glass and oak leaves 1 show horizontal bands or recognizable cell boundaries. Grass side deliberately repeats its fringe vertically, which also reads as a stripe. Flowers, rings and leafy clusters repeat visibly. Bark, dirt and tilled soil are less distracting. The best generated result is retained; clay was separately regenerated because the atlas drew roof tiles in its place.
6. PASS with reservations. The grass-ground overview reads as one warm, outlined cozy game. The shared ochre, burgundy, olive and brown colors connect people, creatures and items. Pale plaster and glass stand out, and stone shifts toward lavender. The pet is flatter and bolder than the people. Palette snapping helps color agreement but cannot fix differences in drawing detail or repeated texture motifs.

## The three questions

1. Yes for identity. All five characters pass across front, back and right profile. Minor detail drift remains within animations.
2. Partly. The atlas packs correctly and its opposite edges match exactly after processing. Several repetition previews still expose bands. The generated source alone was not reliably seamless. Materials mostly sit together, though pale glass/plaster and lavender stone need art direction.
3. Yes for color agreement, partly for style. All visible output pixels use the same locked palette. Warm clothes, orange pet, moss creature and brass items belong together. A palette cannot normalize pixel cluster size, shading density or silhouette detail. Treat the no-seams claim as failed despite the automatic check passing.

## Attempts

Hero 1, villager A 1, villager B 1, pet 1, critter 1. All pass identity, so no character retries. Block atlas 1. Clay 2 including the rejected atlas clay cell and the replacement. Each other tile and variant 1. Each of 16 icons 1, generated together in one sheet. Palette is sampled, not generated. Two pipeline inspection rounds; these do not count as image generation attempts.

## Defaults

- Hero has chestnut hair and an ochre cloak, cream shirt and collar, brown trousers, boots and satchel. Ordinary clothes avoid lume teal. Villager A wears a red headscarf and apron; villager B is a stocky older man in an olive cap and vest. Pet is an orange fox; critter is a moss ball with ears and a sprout. Hero tool is a hoe. Staff gem is the sole intentional luminous teal item.
- People use anchor [64,120], frame [128,128], worldHeight 2. Small ones use [48,88], [96,96], worldHeight 0.85. Reference visible heights are 110 and 68 pixels; one scale per whole sheet preserves pose proportions. Feet bottom equals anchor y, with the silhouette centered on anchor x. World height follows the brief's frame-height definition.
- Idle is 4 fps, walk 10 fps, tool 8 fps. Rows 0/1/2 are idle front/back/side; rows 3/4/5 are walk front/back/side. Hero row 6 contains three right-facing tool poses. The contract requires a single-direction action to list `front`, so its key is `tool.rows.front`; the artwork is right-facing. Do not interpret that key as a physical front view for tool.
- Sprite sheets have six columns for hero and four for the others. Unused cells remain transparent. Atlas uses eight columns and four rows; icons use four by four. Tile variants are named by one shared manifest key and multiple cells.
- Alpha is binary at threshold 210. Connected background specks smaller than five pixels or 0.5 percent of the largest component are removed. Transparent RGB is cleared. No sprite ground shadows. Icons fit within 26 pixels with transparent padding. Glass and foliage are opaque painted block faces, pending a material/transparency contract.
- Resizing uses nearest neighbor without dithering. The hero source uses explicit measured row edges because the generator did not place all rows evenly. Other sources use equal grid cells. The build assumes these recorded source layouts; a new generation must have its layout inspected.
- Palette contains 48 actual RGB samples from the two mood reference JPEGs. Balanced target ramps select skin, cloth, wood, stone, foliage, water, warm light and teal. Stored JSON colors are authoritative. Snapping uses weighted RGB distance, with no added colors or dithering.
- Opposite tile edges are blended across four pixels before palette snapping. This is reproducible cleanup, not proof of visual seamlessness. The checker uses exact opposite-edge equality as its numeric threshold. Every block grid is still reviewed by eye.
- Preview background is slate for labeled sheets and grass green for the overview. Final preview index is the inspection inventory. Extra water cells requested only to fill the generated atlas's last row are discarded.

## Changes recommended for the contracts

For the style sheet, add named material ramps, a fixed lume hex, an explicit source pixel density, silhouette height targets, permitted texture contrast, and examples of acceptable 6 by 6 repetition. Define whether grass-side faces must tile vertically. Separate material color agreement from shading/detail agreement. Reserve quieter grass variants without flowers.

For the manifest, let single-direction actions declare their actual direction, so tool can say `side`. Add per-material opacity/cutout behavior and tiling axes. State whether anchor x means the center of the full silhouette or the feet. Clarify frame worldHeight versus visible body height. Version source crop rectangles separately from the runtime manifest. Keep the runtime file free of generation-specific crop information.

The full repo check also passed after the asset build. No commits or dependency changes were made. No source files outside the four owned folders were written.
