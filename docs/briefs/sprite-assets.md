# Brief: the first sprites, textures and icons, and the script that makes them

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera. He cannot draw, so image generation makes every 2D asset.
He asked for a solid base to build the game on, including "sprites and how they work", an asset system,
and assets that "all fit a theme" with variation.

You make the first set of generic assets with your image generation tool, and the script that turns raw
generated images into game-ready files. Nothing here depends on the story, which is not settled: make a
plain adventurer, plain villagers, a cute pet and a small creature.

This run also answers three questions nobody has tested yet:

1. Does a character stay the same character from the front, the back and the side?
2. Do generated block textures tile and sit well next to each other?
3. Does snapping every image to one locked palette make them look like one game?

Read first: `AGENTS.md` (the rules), `docs/style-sheet.md` (the look, with reference images to open) and
`docs/assets.md` (the manifest format the game reads). Your earlier scripts from the first test are in
`/Users/dabot/dev/sandbox/game-25d-test/assets-src/` (`build.mjs`, `check.mjs`, `preview.mjs`, `NOTES.md`,
`PROMPTS.md`). Start from them.

## What you own

- `tools/sprites/` (the pipeline scripts)
- `assets-src/` (raw images, prompts, the palette)
- `public/assets/` (finished files and `manifest.json`)
- `.artifacts/sprites/` for preview sheets

## What to make

1. **The palette.** `assets-src/palette.png` and `assets-src/palette.json`: about 48 colors taken from the
   reference images, covering skin, cloth, wood, stone, leaves, water, warm light and the lume teal.
2. **The pipeline** in `tools/sprites/`, run with bun, using `sharp` (already installed):
   - `build.mjs` slices a raw sheet into frames, removes the background, aligns each frame's feet to the
     anchor, snaps colors to the palette, and writes the sheet plus its entry in `public/assets/manifest.json`.
   - It does the same for block tiles (into one atlas) and icons (into one sheet).
   - `check.mjs` fails when a frame has the wrong size, an anchor is off by more than 2 pixels, a
     background is not transparent, a color is outside the palette, or a block tile's edges do not match
     its opposite edges closely enough to tile.
   - `preview.mjs` writes one PNG per asset set, with every frame labeled, and one PNG that puts every
     asset side by side on a grass-green ground.
3. **Characters**, each from the front, the back and the side (facing right), in 128 by 128 frames:
   - `hero`: a young adventurer with a cloak and a satchel. Idle 4 frames and walk 6 frames in each
     direction. Use tool 3 frames, from the side.
   - `villager-a` and `villager-b`: two townspeople who look different at a glance. Idle 2 and walk 4 in
     each direction.
4. **Small ones**, in 96 by 96 frames, idle 2 and walk 4 in each direction:
   - `pet`: a small, round, friendly animal with a leaf-shaped tail.
   - `critter`: a mossy creature the size of a cat.
5. **Block textures**, 32 by 32, each tiling with itself: grass top (3 variants), grass side, dirt (3),
   tilled soil, path, sand (3), clay, stone (3), mossy stone, cobble, stone brick, oak log side, oak log
   top, oak plank, birch log side, pine log side, thatch, shingle, plaster, glass, oak leaves (3), pine
   needles. Use the tile names in `docs/assets.md` style: `grass_top`, `grass_side`, `dirt`, `oak_log_side`
   and so on.
6. **Icons**, 32 by 32: wood, stone, seed, wheat, berry, fish, pickaxe, axe, sword, bow, staff, potion,
   coin, key, book, lantern.

## Done: every line passes or fails

1. `bun tools/sprites/check.mjs` exits 0.
2. `public/assets/manifest.json` matches `docs/assets.md` and lists every asset above. Every path in it exists.
3. You looked at every preview PNG in `.artifacts/sprites/`.
4. For each character, the front, back and side views are plainly the same character: same clothes, same
   colors, same proportions. Say for each one whether it passes, and try again when it fails, up to four
   attempts per character.
5. A 6 by 6 grid of each block tile, drawn by `preview.mjs`, shows no seams.
6. The side-by-side preview looks like one game. Say what stands out if it does not.

When a line still fails after the attempts, keep the best result and say which line failed and why.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`.
- If you have no image generation tool, report BLOCKED and stop.
- Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the answer to each of the three
questions with what you saw, the attempt count per asset, every default you picked, and what you would
change in the style sheet or the manifest format after doing this.
