# Brief: fix the weak block textures and add the missing tiles

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters. An earlier run made the first generated assets and the script that builds them. Its characters
and icons are good and stay as they are. Its block textures are the weak part: several show bands or
repeat visibly when tiled, some colors are off, and some tile names the game uses are missing.

You fix the block textures with your image generation tool. He looks at the result in the morning, in a
world made of these blocks, so a texture that stripes across a field is the first thing he will see.

Read first: `AGENTS.md` (the rules), `docs/style-sheet.md`, `docs/assets.md` (the manifest format),
`assets-src/NOTES.md` (what the earlier run did and why), `tools/sprites/` (the pipeline it wrote) and
`src/content/blocks.ts` (the tile names the game asks for). Look at `.artifacts/sprites/side-by-side.png`
and the `blocks-*.png` grids there to see the current state.

## What you own

- `tools/sprites/`, `assets-src/`, `public/assets/blocks/`, the `blocks` entry of `public/assets/manifest.json`
- `.artifacts/sprites/` for preview sheets

Do not change the sprites, the icons or their manifest entries.

## What to fix

1. **Tiles that band or repeat.** `sand` (all 3), `stone` (all 3), `plaster`, `glass`, `grass_side` and any
   `oak_leaves` variant that shows a seam or a stripe in a 6 by 6 grid. A natural texture should read as
   an even field with small detail, with no line along an edge and no large shape that makes a pattern.
2. **Colors.**
   - `stone`, `cobble`, `stone_brick` and `mossy_stone` are a neutral grey with a slight warm cast. They lean lavender now.
   - `shingle` is teal. Roofs in this game are teal.
   - `plaster` is a warm off-white with very quiet shading.
   - `glass` is a pale pane with a thin frame, readable as a window from far away.
   - If the palette lacks the greys or the teal roof color, add them to `assets-src/palette.json` and
     `palette.png`, and keep the lume teal reserved for magic.
3. **Names the game uses.** `src/content/blocks.ts` asks for tile names the manifest does not have. Add or
   rename so that every name there exists, except `water`, which is drawn by a shader:
   `tilled_top`, `path_top`, `path_side`, `birch_log_top`, `pine_log_top`, `lume_crystal`, `lamp_top`,
   `lamp_side`. Keep `tilled_soil` and `path` too if other code may use them.
4. **Make the check see what the eye sees.** Edges that match exactly are not enough. Extend
   `tools/sprites/check.mjs` so a tile fails when, tiled 4 by 4, it has a row or column whose average
   color differs from the tile's average by more than a small threshold you choose. Say what threshold you
   picked and which old tiles it catches.

## Done: every line passes or fails

1. `bun tools/sprites/check.mjs` exits 0, including the new banding rule.
2. Every tile name used in `src/content/blocks.ts`, except `water`, is in the manifest, and its cells exist in the atlas.
3. You looked at a 6 by 6 grid of every tile you changed or added. None shows a seam, a stripe or an obvious repeat. Up to four attempts per tile.
4. You looked at the new side-by-side preview. Stone is grey, the roof is teal, and the blocks look like one set.
5. The sprites and icons are byte-for-byte unchanged (`git status` shows no change under `public/assets/sprites` or `public/assets/icons`).

When a line still fails after the attempts, keep the best result and say which tile failed and why.

## Limits

- Other agents are building features in this repo. Write only in the folders above. Do not commit, and do
  not run `bun install` or `bun add`.
- If you have no image generation tool, report BLOCKED and stop.
- Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the attempt count per tile, the
threshold you chose, and any tile that still fails by eye.
