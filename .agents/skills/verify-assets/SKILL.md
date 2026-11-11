---
name: verify-assets
description: Check every asset the game ships with one command, `bun tools/verify-assets.mjs`. Use after adding or changing any sprite, block tile, icon, portrait, prop or music palette, after changing an asset name in `src/game/content`, and before saying an asset task is done.
---

# Verify assets

```sh
bun tools/verify-assets.mjs            # exit 0: every check passed
bun tools/verify-assets.mjs --strict   # warnings fail too. Use this before a release.
bun tools/verify-assets.mjs --all      # list the failures of every failing check, not only the first
```

Run it from the repo root. It changes no asset and is quick enough to run after every change.

## Reading the output

1. Seven lines, one for each check, each `PASS` or `FAIL` with a summary.
2. A size table of every file in `public/assets`.
3. `FAILED <check>` with every failure of the first failing check and its usual fix. Later failing checks are only counted (`Also failing: ...`), because an early failure often causes them. Fix the first, run again.
4. `Warnings`, which do not fail the run.
5. `TOTAL PASS` or `TOTAL FAIL`, with the first failing check. Read this line first.

An asset task is done when the total says PASS, every warning is one you can explain in your report, and
you have looked at the preview sheets under "What it cannot see".

## The seven checks

| Check | What it compares | A failure looks like | Usual fix |
|---|---|---|---|
| `manifest` | `public/assets/manifest.json` against the example in `docs/assets.md` and the files on disk: required keys, every path, every cell inside its image, every animation row inside its sheet | `sprites.odo.sheet is "sprites/Odo.png" and the file is "sprites/odo.png"`, `icons.names.hoe: cell [0, 4] of 32 px tiles is outside ...`, `sprites.x has no "worldHeight"` | The manifest is written by the build scripts. Rebuild the asset with the script that owns it. Correct a path by hand only when the file is right and the name is wrong. |
| `sprite-check` | Runs `bun tools/sprites/check.mjs --complete`: sizes, anchors, transparency, the locked palette, tile seams and banding, and that no approved sheet or entry changed | `AssertionError: gus baseline`, then a `means:` line | Find the message in `.agents/skills/make-sprite/check-failures.md`. That script stops at its first problem, so run it alone until it passes. |
| `names` | Every `sprite: '...'`, `icon: '...'`, `portrait: '...'` and `picture: '...'` in `src/game/content/**/*.ts` against the manifest. A missing name is a warning, and a failure with `--strict`. | `src/game/content/items.ts:13  icon 'plank' is not in manifest.icons.names ...` | A typo: correct the content file. A name nobody has drawn: make it with the `make-sprite` skill, or point the content at an asset that exists and say so. |
| `block-tiles` | Every tile name in `src/content/blocks.ts`, except `water`, against `manifest.blocks.tiles` | `tile 'reed_top' (block reeds) has no cell in manifest.blocks.tiles` | Correct the name in blocks.ts, or make the tile with `make-sprite`. Until then the block draws as a flat color. |
| `props` | If `src/content/props.ts` exists: builds every variant of every prop and counts triangles against the budget its entry declares | `oak variant 2: 1734 triangles, and its entry allows 1500` | Simplify the builder: fewer segments, merged faces. Raise a budget only inside `docs/style-sheet.md` (300 small prop, 1,500 tree, 6,000 building). |
| `palettes` | Every palette in `src/content/palettes/`: a root, a scale, a tempo, and an instrument in every layer another palette has | `forge: no bass layer, and meadow, desert ... have one`, `coast: melody.night is not an instrument` | Add the field or layer, copying its shape from `src/content/palettes/meadow.ts`. A layer left out on purpose goes in `LAYER_EXEMPT` in `tools/verify-assets.mjs` with the reason, as `center` is. |
| `sizes` | No PNG over 1 MB, the folder under 24 MB | `public/assets/ui/title.png is 1310.2 KB (1920 x 1080)` | A palette-snapped sheet is tens of KB. A heavy one skipped the pipeline or is far too large in pixels. Rebuild it through `tools/sprites`. |

## The warnings

- `<file>:<line> <kind> '<name>' is not in ...`: the `names` check. The game will draw nothing or a placeholder there.
- `manifest.json has a "<section>" ... that docs/assets.md does not describe`: the manifest has grown past its contract. Add the section's shape to `docs/assets.md`. Four of these stand today: `icons.sheets`, `portraits`, `crops`, `ui`.
- `public/assets/<file> is not in manifest.json`: the game never loads the file. List it or delete it.
- `palette <id> is not in the list in index.ts`: the sound engine never plays it.

## What it cannot see

The command checks numbers. These need your eyes. Build the sheets, then open each PNG with the Read tool.

| Question | Build | Open in `.artifacts/sprites/` |
|---|---|---|
| Is a character the same person from the front, the back and the side? Any cut limb, pale fringe or stray speck? | `bun tools/sprites/preview-story.mjs` | `story-<name>.png` |
| Does a new character or creature belong with the others in height, outline and color? | the same | `side-by-side-3.png` |
| Does a tile repeat visibly: a line where copies meet, a stripe, a mark that becomes a grid of dots? Did it keep its drawing? | `bun tools/sprites/preview.mjs` | `blocks-<n>.png`, each tile 6 by 6 |
| Does an icon read at 32 px? Is a portrait the same person as the sprite? | `bun tools/sprites/preview-story.mjs` | `story-icons-2.png`, `icons.png`, `story-portraits.png` |
| Do the panel and button stretch cleanly? | the same | `story-nine-slice.png` |

`preview.mjs` stops at the first story sprite today. The block tile paragraph of
`.agents/skills/make-sprite/SKILL.md` has the two-place fix. That skill's last section lists what to look for.

It also cannot see:

- A name set from a variable (`picture: id`) or built outside `src/game/content`. The `names` line counts the ones it skipped.
- Whether the loader reads a section. The check reads the JSON. `src/features/assets/manifest.ts` decides what the game receives.
- How a prop looks or a palette sounds. It counts triangles and fields.
- A real `src/content/props.ts`: none existed when this was written. If its entries use other field names, the check fails and says to add them to `PROP_KEYS` in the script.
