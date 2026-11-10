# Reading a failure from `bun tools/sprites/check.mjs --complete`

The script stops at its first failed assertion and prints `AssertionError: <message>`. The `OK` and `PASS`
lines above it are the parts that passed, in this order: the five original sprites, the block atlas, the
first icon sheet (`check.mjs`), then each story sprite, the frozen entries and files, portraits, crops,
the second icon sheet and the interface art (`check-story.mjs`). Fix the build step named below, rebuild
and run it again. Never edit a PNG to make an assertion pass.

| Message | What it means | Fix |
|---|---|---|
| `<name> baseline`, `<name> feet baseline` | A frame's lowest drawn pixel is not on the anchor's y. | A speck under the feet or a painted shadow survived. Generate again with `NO cast shadows, no ground`. |
| `crop baseline` | A crop does not stand on the bottom row of its cell. | Rebuild with `build-story-extra.mjs crops`, which trims and bottom-aligns. |
| `<name> horizontal anchor` | A frame's silhouette is off the anchor's x. | The frame was not placed by the builder. Rebuild it with `build-story.mjs`. |
| `<name> padding`, `<name> background`, `portrait padding`, `new icon padding`, `<name> transparent padding` | Drawn pixels touch the edge of a frame or a cell. | The drawing is too big or was cut by its cell. Lower `height` in the config entry, or generate again with `ample transparent padding`. |
| `<name> unused cell`, or `The expression evaluated to a falsy value` at `check-story.mjs:10` | A cell past the animation's frame count has pixels. | The frame counts in the config entry (`idle`, `walk`) are lower than what the sheet holds. |
| `<path> width`, `<path> height` | The sheet is not `cols x size` by `rows x size`. | Make `cols`, `rows` and `size` in the config entry match the sheet. |
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
