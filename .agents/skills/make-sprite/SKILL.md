---
name: make-sprite
description: Add or redo one 2D asset for this game with an image generation tool so it fits the existing set. Use for a character or creature seen from the front, back and side, a block tile, an icon or a portrait, and when `bun tools/verify-assets.mjs` reports a sprite, icon, portrait or tile name that is not in the manifest.
---

# Make a sprite

A generated image becomes a game asset through the scripts in `tools/sprites/`, and the scripts are what
make it fit. They cut the image into cells, stand each figure on its anchor, repaint every pixel in the
locked palette and list the file in `public/assets/manifest.json`, the only place the game looks. You
write the prompt, run the scripts and judge the result by eye. You never draw or retouch pixels, by hand
or in code.

## Before you start

- You need an image generation tool. Without one, report BLOCKED.
- Read `docs/style-sheet.md` and `docs/assets.md`. Run `bun tools/sprites/preview-story.mjs` and open `.artifacts/sprites/side-by-side-3.png`. Those characters are the set yours joins.
- `ls assets-src/raw`. Git ignores that folder, so a fresh worktree has none. A character needs only its own new image. A block tile needs every source in it, because the atlas is rebuilt whole. Copy the folder from the checkout that has it (`git worktree list`), or report that it is missing.

## What is frozen

Every sheet and manifest entry from an earlier run is approved. `assets-src/block-baseline-2.json` and
`assets-src/story-baseline-3.json` hold their SHA-256 hashes and their manifest values, and the check
fails when one moves.

- Add files and entries. Rename and rebuild nothing that exists, because game code reads the manifest by name.
- Lists in `tools/sprites/config.mjs` and `story-config.mjs` are positions in a sheet. Append to them.
- Two commands rewrite approved files and are never part of this job: `bun tools/sprites/build.mjs --rebuild-original-set` and `bun tools/sprites/palette.mjs` (it resets `palette.json` to 48 colors and drops the ramps every block and story sheet uses).

## Steps

1. **Register** the asset as the table below says.
2. **Write the prompt** from the pattern for its kind in [prompts.md](prompts.md) and generate. Every view of one character comes from one image. Allow three attempts and keep the best.
3. **Save and look.** Save the image under the raw name in the table and add its prompt to `assets-src/prompts-3.json`. Open the raw image: the grid has the columns and rows you asked for, in order and evenly spaced, on a truly transparent background. If it does not, generate again. That is cheaper than teaching the builder a new layout.
4. **Build** with the command in the table.
5. **Check.** `bun tools/sprites/check.mjs --complete`, then `bun tools/verify-assets.mjs`. Both exit 0. [check-failures.md](check-failures.md) maps each message to its fix.
6. **Preview and look.** Run the preview command, open every sheet your change touched, and judge it against "Look before you say done". A passing check says nothing about how it looks.
7. **Report** the attempts for each asset, the manifest entries you added and whatever still looks off.

| Kind | Register | Raw image | Build | Preview |
|---|---|---|---|---|
| Person or creature | Append one line to `tools/sprites/story-config.mjs` (below) | `assets-src/raw/<name>-3.png`: one sheet, 4 columns by 6 rows, the largest size the tool offers | `bun tools/sprites/build-story.mjs` | `bun tools/sprites/preview-story.mjs` |
| Block tile | Append to `extraTiles` in `config.mjs`, add its middle color to `ramps` in `build-blocks.mjs`, use the name in `src/content/blocks.ts` | `assets-src/raw/<name>-2.png`: one square image for each tile | `bun tools/sprites/build.mjs` | `bun tools/sprites/preview.mjs` |
| Icon or portrait | A new set in `build-story-extra.mjs` (below) | `assets-src/raw/<set>-3.png`: one square sheet of objects in a grid | `bun tools/sprites/build-story-extra.mjs <set>` | Open the built PNG |

**A person or a creature.** Add the line after the `storySprites` declaration. `people` stays as it is: it also numbers the portrait cells.

```js
storySprites.<name>={size:128,anchor:[64,120],height:110,worldHeight:2,idle:2,walk:4,cols:4,rows:6}; // a person
storySprites.<name>={size:96,anchor:[48,88],height:68,worldHeight:.85,idle:2,walk:4,cols:4,rows:6};  // a pet or creature
```

`build-story.mjs` builds every registered name that has a raw file and adds `sprites.<name>` to the
manifest. A creature seen from one side copies the `lanternfly` entry, which carries its own `animations`.

**An icon or a portrait.** `icons/icons.png`, `icons/icons-2.png` (16 each) and `portraits/portraits.png`
(9) are full, so a new one starts a new sheet. In `build-story-extra.mjs`, copy the `if(set==='icons')`
line with a new set name, raw name, name list and file, and publish it as `icons.sheets.<set>` beside
`icons.sheets.story`. Copy the `icons.sheets?.story` line in `check-story.mjs` for it. Then confirm the
loader reads your sheet: `rg -n sheets src/features/assets/manifest.ts`. A second portrait sheet has no
manifest shape yet. Report that instead of inventing one.

**A block tile.** Run three recorded the atlas hash, so after a rebuild the check stops at
`old file changed blocks/atlas.png`. When every `OK blocks` line above it passes and you have looked at
the tile's preview, replace that one hash in `assets-src/story-baseline-3.json` with the output of
`shasum -a 256 public/assets/blocks/atlas.png`. `preview.mjs` currently stops at the first story sprite
(`c.size` of undefined): in both of its loops change `Object.entries(m.sprites)` to
`Object.entries(m.sprites).filter(([n])=>sprites[n])`.

## How the build makes it fit

- **Slice.** `cell()` in `tools/sprites/lib.mjs` cuts the image into equal cells, row by row in manifest order.
- **Clean.** `clean()` makes every pixel solid or clear (alpha 210 and up is solid) and deletes loose specks. An icon keeps only its largest connected piece.
- **One scale.** A character's median idle pose becomes `height` pixels tall (110 in a 128 frame, 68 in a 96 frame) and every other pose uses that scale, so proportions hold. An icon is fitted to 24 px in a 32 px cell, a portrait to 120 px in a 128 px tile. Resizing is nearest neighbor, so pixels stay hard.
- **Snap.** `snap()` moves each pixel to the nearest color in `assets-src/palette.json`.
- **Stand.** The lowest drawn pixel sits on the anchor's y and the silhouette is centered on the anchor's x.
- **List.** The script reads the manifest at that moment, adds its entries and writes it back in one move.

`build-blocks.mjs` resizes each tile source to 32 px, removes light that runs along a row or a column
(`quiet()`), repaints it on its ramp, makes opposite edges equal (`periodic()`), writes `manifest.blocks`
and then runs `compose-blocks.mjs`.

## The lesson of the second run

The second run passed the banding rule by repainting every material on three near-equal colors: its
middle color and 8 levels either side. The stripes went, and so did the drawing. Cobble, brick, shingle
and leaves became flat noise. Structure now has its own step:

- A plain surface (sand, plaster, packed earth) takes the three-color ramp in `build-blocks.mjs`. That is right for it.
- A tile with drawn structure (stones, bricks, courses, rings, leaves) also needs a job in `compose-blocks.mjs`. A job takes the tile's shapes from a source that still has them and repaints them on a five-step ramp: `STRONG` (36 below to 20 above the middle color) for bricks, shingle and leaves, `MID` for cobble, `SOFT` for stone and log tops. The jobs there read shapes from atlas cells. For a new tile, load its raw source, resize it to 32 px with `lanczos3` and use those pixels as the job's shape.
- A banding failure is fixed at its cause (check-failures.md). Lowering contrast until the number passes repeats the second run.

## Look before you say done

Open each PNG in `.artifacts/sprites/` with the Read tool.

- **`story-<name>.png`**, the whole sheet on green. The same person in all three views: hair, headwear, garment colors, the carried thing. The back shows no face and the side faces right. Feet sit on one line along a row, walk frames alternate feet, and the head stays one size from row to row. No limb is cut.
- **A pale fringe around the outline** means the background was white, not transparent. Wren's first attempt had it, and Juniper's hair and cloak still show it. Fix it with the retry prompt in prompts.md.
- **`side-by-side-3.png`**. Yours beside the others: the same height as its kind, the same outline weight, the same size of pixel clusters, the same warmth. Teal appears on magic only.
- **`blocks-<n>.png`**, each tile repeated 6 by 6. No line where copies meet, no stripe along a row or a column, and no single mark (a flower, a knot) that turns into a grid of dots. A structured tile still shows its drawing. Compare it with cobble and stone_brick, which do.
- **Icons and portraits** (`story-icons-2.png` and `story-portraits.png` show the existing ones enlarged). Each icon reads as its object at 32 px and weighs about the same as its neighbors. A portrait is the same person as its sprite.

Done means both commands in step 5 exit 0 and every sheet you touched passes this list, or your report names the line it fails.
