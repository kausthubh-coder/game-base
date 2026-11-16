# Reading a failure

Two checks print failures. `bun tools/art/check.mjs` prints `FAIL <asset> <rule> <what it measured>`: find the rule
in the first table. `bun tools/sprites/check.mjs --complete` stops at an `AssertionError`: find its message in the
second. Fix the art or the build step and run again. Never edit a PNG by hand, raise a limit in
`assets-src/art-style.json` or add a fault to `assets-src/art-ledger.json` to pass.

## The art check's rules

| Rule | What it means | Fix |
|---|---|---|
| `review` | The sheet is new or changed and nobody has answered its rubric for this exact file. | `bun tools/art/review.mjs <sheet> --before HEAD`, open the picture, answer `assets-src/art-reviews/<sheet>.md`. |
| `contract` | The sheet is in no character of `assets-src/art-contract.json`, lacks an animation its kind requires, has an empty frame, or names an animation outside the `poses` list. | Add it to its character's `sheets` or `variants`; name animations from the list; ask the lead before adding a pose name. |
| `frame` | The frame size or anchor is not its kind's. | Build with the kind's frame from `assets-src/art-style.json`. |
| `scale` | It stands taller or shorter beside the hero than its concept sheet states. | `bun tools/art/repair.mjs <sheet> --height`. |
| `same-size` | It stands a different height from its character's first sheet, so the figure grows or shrinks when the game swaps sheets. | `bun tools/art/repair.mjs <sheet> --height`. |
| `density` | Its pixels are far larger or smaller than the hero's (`limits.density`). | Draw it larger or smaller inside its frame and let `--height` set `worldHeight`. For a giant, use the larger frame. |
| `identity` | A frame's colours differ from the first frame of its row, or the sheet's front differs from its character's first sheet: hair, skin or clothes changed colour. | Generate again with the character's own idle sheet attached, and snap to that sheet's colours as `tools/sprites/act1-hero.mjs` does. A sheet that shows two forms on purpose (a Blighted fight sheet ending on the well creature) goes in the character's `mixed` list. |
| `baseline` | A frame's lowest pixel is off the anchor's row: it floats or sinks. | `bun tools/art/repair.mjs <sheet> --anchor`. A flier has `"flies": true` in the contract. |
| `steady` | In a loop the body moves sideways between frames. Centring a frame's bounding box does this whenever an arm, a tool or a wing widens the box. | `bun tools/art/repair.mjs <sheet> --anchor`. |
| `jump` | One frame of a loop covers far more pixels than another: a frame at another scale, or cut from another sheet. | Scale every frame of a sheet by one number in the builder. If the source itself jumps, generate again. |
| `loop` | The last frame does not lead back to the first, or two neighbouring frames are the same picture. | Ask for the phases by name in the prompt (`feet apart / passing / opposite apart / passing`), or drop the repeated frame and lower `frames`. |
| `outline` | Much of the figure's edge has no dark outline pixel, or the outline is pure black. | Generate again with the outline clause of `prompts.md`. A glow that has no outline on purpose goes in the character's `glow` list. |
| `fringe` | A pale rim, a light ring over darker pixels, or half-transparent pixels: what a white background leaves. | `bun tools/art/repair.mjs <sheet> --defringe`. |
| `portrait` | A face's colours match many other sprites' heads better than its own sprite's. | The portrait or the sprite is another person. Compare both with the concept (`bun tools/art/see.mjs --only portraits --names <who>`) and redraw the one that is wrong. |
| `icon-margin` | An icon touches the edge of its cell. | Rebuild it through its set's builder, which fits it inside the margin. |
| `icon-outline` | An icon's edge is light and unlined, so it fades into the bag's parchment. | Generate again with a dark tinted outline and a darker body. |
| `icon-thin` | An icon's shorter side is under 15 pixels: a staff or a bow drawn upright is a sliver in its slot. | Draw a long thing on the diagonal, corner to corner, as the first icon sheet's sword and staff are. |
| `icon-twin` | Two icons of one set overlap and share colours: one mark at 32 pixels. | Give one a different silhouette: another angle, a second object, a cut-out. A colour change alone does not read. |
| `fixed` (not a failure) | A fault the ledger lists is gone. | When the sheet passes every rule, `bun tools/art/check.mjs --settle <sheet>`. |

## The sprite check's messages

The script stops at its first failed assertion and prints `AssertionError: <message>`. The `OK` and `PASS`
lines above it are the parts that passed, in this order: the five original sprites, the block atlas, the
first icon sheet (`check.mjs`), then each story sprite, the frozen entries and files, portraits, crops,
the second icon sheet and the interface art (`check-story.mjs`). Fix the build step named below, rebuild
and run it again. Never edit a PNG to make an assertion pass.

| Message | What it means | Fix |
|---|---|---|
| `<name> baseline`, `<name> feet baseline` | A frame's lowest drawn pixel is not on the anchor's y. | A speck under the feet or a painted shadow survived. Generate again with `NO cast shadows, no ground`. |
| `crop baseline` | A crop does not stand on the bottom row of its cell. | Rebuild with `build-story-extra.mjs crops`, which trims and bottom-aligns. |
| `<name> horizontal anchor` | A frame's box is more than 6 pixels off the anchor's column. | The frame was not placed by the builder. Rebuild it, then `bun tools/art/repair.mjs <sheet> --anchor`. |
| `<name> padding`, `<name> background`, `portrait padding`, `new icon padding`, `<name> transparent padding` | Drawn pixels touch the edge of a frame or a cell. | The drawing is too big or was cut by its cell. Lower `height` in the config entry, or generate again with `ample transparent padding`. |
| `<name> unused cell`, or `The expression evaluated to a falsy value` at `check-story.mjs:10` | A cell past the animation's frame count has pixels. | The frame counts in the config entry (`idle`, `walk`) are lower than what the sheet holds. |
| `<path> width`, `<path> height` | The sheet is not `cols x size` by `rows x size`. | Make `cols`, `rows` and `size` in the config entry match the sheet. |
| `<name> pale fringe: <n>% of its outline is near white` | The figure was cut out of a white background, and a pale rim is left outside its dark outline. It shows as a white glow round the character. | Run `bun tools/sprites/defringe.mjs public/assets/sprites/<name>.png`, look at the sheet on green, then run `bun tools/sprite-fringe.mjs <name>`. For a new sprite, ask for a transparent background first (see `prompts.md`). |
| `<path> binary alpha`, `alpha must be binary` | A pixel is half transparent. | The image skipped `clean()`, or was resized with a soft kernel after it. |
| `<path> palette`, `outside locked palette: <hex>` | A color is not in `assets-src/palette.json`. | The image skipped `snap()` or was edited after the build. Rebuild it. Never add a color to the palette by hand. |
| `Expected values to be strictly deep-equal` | Two values that must match differ. `actual` is the manifest or the image, `expected` is the config or the baseline. The `at` line names the assertion. | For a new sprite: its manifest entry and its config entry disagree. Rebuild it. |
| `Existing entry differs: <name>` (from `build-story.mjs`) | You changed the config entry of a sprite that is already in the manifest. | Restore the entry. To redo that sprite, register it under a new name. |
| `<name> opaque tile`, `opaque title` | An image that must be solid has a transparent pixel. | Generate again with `full-bleed`, `fills canvas edge to edge`. |
| `<name> horizontal seam`, `vertical seam` | A tile's opposite edges differ. | The tile was pasted in after `periodic()` ran in `build-blocks.mjs`. In `compose-blocks.mjs`, take shapes only from a tile whose edges match. |
| `<name> banding 23.41 exceeds 18` | One row or column of the tile is more than 18 levels lighter or darker than the tile's average. A field of it shows stripes. | See "A banding failure". |
| `missing content tile <name>` | `src/content/blocks.ts` uses a tile name with no cell in the atlas. | Make the tile, or correct the name in blocks.ts. |
| `old file changed blocks/atlas.png` | The atlas differs from the hash run three recorded. | Expected after you add a tile. Replace that one hash, as the block tile paragraph in `SKILL.md` says. |
| `old file changed <other path>`, `<path> unchanged` | An approved sheet's bytes changed. | `git checkout public/assets/sprites public/assets/icons`. Something ran `--rebuild-original-set`. |
| `changed old <key>`, `missing old <key>`, `original sprite unchanged <name>`, `original icon entry unchanged <key>`, `missing original <name>` | A manifest entry from an earlier run changed or is gone. | `git diff public/assets/manifest.json` must show additions only. Restore the old lines. |
| `missing <name>` (only with `--complete`) | A story set the game ships is not in the manifest. | Rebuild that set (`NOTES-3.md` lists the commands). |
| `Empty generated cell` (from a build) | A cell that should hold a frame or an icon is empty. | Open the raw image. Its rows are uneven or in another order. Generate again. |
| `ENOENT ... assets-src/raw/...` | A raw source is missing. Git ignores `assets-src/raw`. | Copy the folder from the checkout that generated the art (`git worktree list`). |
| `ENOENT ... .artifacts/sprites/...` | The output folder is missing. `check.mjs` printed its `PASS` line and then had nowhere to write its result. | `mkdir -p .artifacts/sprites`. `bun tools/verify-assets.mjs` does this for you. |

## A banding failure

Find the cause in `.artifacts/sprites/blocks-<n>.png`, where each tile is repeated 6 by 6.

- A light or dark side, as if lit: the generator shaded the tile. `quiet()` in `build-blocks.mjs` removes that for tiles outside its `structured` list. If it still shows, generate again with the `Uniform average brightness` sentence.
- Rows that belong to the material (brick courses, furrows, a grass lip over dirt): add the tile to `bandExempt` in `tools/sprites/banding.mjs` with the reason, as the six there have.
- Any other stripe: generate again. Lowering the contrast until the number passes is the mistake of the second run (`SKILL.md`).
