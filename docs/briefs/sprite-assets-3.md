# Brief: the people, creatures, crops, icons and interface art for the first part of the story

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters. By 6 am he wants a playable first part of the story: a crew takes a plot of land near the
farming town of Hollowmere, builds a home, befriends a pet, grows wheat for a young queen and joins the
harvest festival. You make the 2D art that part needs, with your image generation tool and the pipeline
you already wrote in `tools/sprites/`.

Read first: `AGENTS.md`, `docs/style-sheet.md`, `docs/assets.md`, `assets-src/NOTES.md` and `NOTES-2.md`,
and look at `.artifacts/sprites/side-by-side.png` so the new art matches what exists. The hero, the two
villagers, the pet and the critter are good and must not change.

## What you own

- `tools/sprites/`, `assets-src/`, `public/assets/` (new files, and new entries in `manifest.json`)
- `.artifacts/sprites/` for preview sheets

Do not change existing sprites, icons, the block atlas or their manifest entries. Other agents read the
manifest while you work, so add entries and never rename one.

## What to make

1. **Eight people**, each from the front, the back and the side (facing right), 128 by 128 frames, idle 2
   and walk 4 in each direction, same build and scale as `villager-a`. Manifest names in brackets.
   - `tamsin`: a retired explorer in her sixties. Grey braid, weathered long coat, a trowel on her belt.
   - `maren`: a queen of 19 who works for a living. A thin gold circlet, a green dress with a work apron, tired eyes.
   - `odo`: a round, cheerful baker. Flour on his apron, rolled sleeves.
   - `gus`: a farmer. Straw hat, overalls, soil on his hands.
   - `mira`: a carpenter. Tool belt, a pencil behind her ear.
   - `wren`: a pet keeper. Pockets full of treats, a small bird on one shoulder.
   - `juniper`: a child of about eight. Patched cloak, a slingshot.
   - `brack`: a ferryman. A wide reed hat, a fishing rod on his back.
2. **Portraits**, one sheet `portraits/portraits.png` of 128 by 128 tiles, head and shoulders, facing
   slightly left, for each of the eight people plus the hero. Add `"portraits": { "tile": 128, "sheet":
   ..., "names": { "tamsin": [col, row], ... } }` to the manifest.
3. **Two small creatures**, 96 by 96 frames:
   - `leaftail`: a small green lizard-fox with a big leaf for a tail. Idle 2 and walk 4 in each of the three directions. This is the first pet of the story.
   - `lanternfly`: a round glowing bug. One direction, a 4-frame flutter. Use `rows.front` only.
4. **Crops**, one sheet `crops/crops.png` of 32 by 32 tiles on a transparent background, each plant seen
   from the side and standing on the bottom edge: wheat in 4 growth stages, turnip in 4, carrot in 4, and
   a berry bush with and without berries. Add `"crops": { "tile": 32, "sheet": ..., "names": { "wheat":
   [[col,row] x4], ... } }` to the manifest.
5. **Sixteen more icons** appended to the icon sheet's free cells or a second sheet `icons/icons-2.png`
   (then list both under `icons` in a way that keeps the old names working, and say what you did):
   plank, fiber, moss_tuft, bread, wheat_seeds, hoe, watering_can, shovel, hammer, workbench, bed, chest,
   lamp, treat, map, heart.
6. **Interface art** in `ui/`:
   - `panel.png`: a 96 by 96 parchment panel with ink edges and small brass corners, drawn to be stretched as a nine-slice with 24 pixel borders.
   - `button.png`: a 96 by 32 parchment button in the same style, nine-slice with 12 pixel borders.
   - `title.png`: a 480 by 270 pixel-art picture for the title screen. A meadow at dawn, a small plot with a half-built cottage, a town with teal roofs in the distance, a river, and a long shadow coming in from the left. No text.
   Add `"ui": { "panel": "ui/panel.png", "button": "ui/button.png", "title": "ui/title.png" }` to the manifest.

## Done: every line passes or fails

1. `bun tools/sprites/check.mjs` exits 0, extended to cover the new sets (sizes, anchors, transparency, palette).
2. Every new manifest path exists, and no old entry changed (`git diff` on the manifest shows additions only).
3. You looked at every new preview PNG.
4. Each of the eight people is plainly the same person from all three sides, and no two could be confused at game size. Up to three attempts each.
5. The side-by-side preview with old and new art together looks like one game.

When a line still fails after the attempts, keep the best result and say which and why.

## Limits

- Other agents are building in this repo. Write only in the folders above. Do not commit, and do not run `bun install` or `bun add`.
- Speed matters: this art feeds a build due at 6 am. Deliver the people and the leaftail first, then the rest.
- If you have no image generation tool, report BLOCKED and stop.
- Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`.
- Do the work yourself. Start no subagents.

## Report

Your last message: PASS, ISSUES or BLOCKED, the check output, attempts per asset, the manifest entries you
added, and anything that still looks off.
