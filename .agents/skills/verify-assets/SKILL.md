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

1. One line for each check, each `PASS` or `FAIL` with a summary.
2. A size table of every file in `public/assets`.
3. `FAILED <check>` with every failure of the first failing check and its usual fix. Later failing checks are only counted (`Also failing: ...`), because an early failure often causes them. Fix the first, run again.
4. `Warnings`, which do not fail the run.
5. `TOTAL PASS` or `TOTAL FAIL`, with the first failing check. Read this line first.

An asset task is done when the total says PASS, every warning is one you can explain in your report, and
you have looked at the preview sheets under "What it cannot see".

## The checks

| Check | What it compares | A failure looks like | Usual fix |
|---|---|---|---|
| `manifest` | `public/assets/manifest.json` against the example in `docs/assets.md` and the files on disk: required keys, every path, every cell inside its image, every animation row inside its sheet | `sprites.odo.sheet is "sprites/Odo.png" and the file is "sprites/odo.png"`, `icons.names.hoe: cell [0, 4] of 32 px tiles is outside ...`, `sprites.x has no "worldHeight"` | The manifest is written by the build scripts. Rebuild the asset with the script that owns it. Correct a path by hand only when the file is right and the name is wrong. |
| `sprite-check` | Runs `bun tools/sprites/check.mjs --complete`: sizes, anchors, transparency, the locked palette, tile seams and banding, and that no approved sheet or entry changed | `AssertionError: gus baseline`, then a `means:` line | Find the message in `.agents/skills/make-sprite/check-failures.md`. That script stops at its first problem, so run it alone until it passes. |
| `art` | Runs `bun tools/art/check.mjs`: every sprite sheet, portrait and icon against `assets-src/art-style.json` and `art-contract.json`. A sheet that matches its entry in `assets-src/art-ledger.json` may break the rules listed there; a new or changed one passes all of them and has an answered review | `hero-staff identity front colours match hero's by 0.89`, `calla scale 0.97 heroes tall; its sheet says 1.16`, `frog review no review` | The rule's row in `.agents/skills/make-sprite/check-failures.md`. Never add a fault to the ledger to pass. |
| `names` | Every `sprite: '...'`, `icon: '...'`, `portrait: '...'` and `picture: '...'` in `src/game/content/**/*.ts` against the manifest. A missing name is a warning, and a failure with `--strict`. | `src/game/content/items.ts:13  icon 'plank' is not in manifest.icons.names ...` | A typo: correct the content file. A name nobody has drawn: make it with the `make-sprite` skill, or point the content at an asset that exists and say so. |
| `block-tiles` | Every tile name in `src/content/blocks.ts`, except `water`, against `manifest.blocks.tiles` | `tile 'reed_top' (block reeds) has no cell in manifest.blocks.tiles` | Correct the name in blocks.ts, or make the tile with `make-sprite`. Until then the block draws as a flat color. |
| `props` | If `src/content/props.ts` exists: builds every variant of every prop and counts triangles against the budget its entry declares | `oak variant 2: 1734 triangles, and its entry allows 1500` | Simplify the builder: fewer segments, merged faces. Raise a budget only inside `docs/style-sheet.md` (300 small prop, 1,500 tree, 6,000 building). |
| `palettes` | Every palette in `src/content/palettes/`: a root, a scale, a tempo, and an instrument in every layer another palette has | `forge: no bass layer, and meadow, desert ... have one`, `coast: melody.night is not an instrument` | Add the field or layer, copying its shape from `src/content/palettes/meadow.ts`. A layer left out on purpose goes in `LAYER_EXEMPT` in `tools/verify-assets.mjs` with the reason, as `center` is. |
| `sizes` | No PNG over 1 MB, the folder under 30 MB | `public/assets/ui/title.png is 1310.2 KB (1920 x 1080)` | A palette-snapped sheet is tens of KB. A heavy one skipped the pipeline or is far too large in pixels. Rebuild it through `tools/sprites`. |

## The warnings

- `<file>:<line> <kind> '<name>' is not in ...`: the `names` check. The game will draw nothing or a placeholder there.
- `manifest.json has a "<section>" ... that docs/assets.md does not describe`: the manifest has grown past its contract. Add the section's shape to `docs/assets.md`.
- `<asset> <rule> no longer broken`: a fault the art ledger lists is gone. When the asset passes every rule, `bun tools/art/check.mjs --settle <asset>`.
- `public/assets/<file> is not in manifest.json`: the game never loads the file. List it or delete it.
- `palette <id> is in no list in index.ts`: the sound engine never plays it. `palettes` (the starting lands) and `greenhollowPalettes` (the game's regions) both count.

## What it cannot see

The command checks numbers. These need your eyes. Build the pictures, then open each PNG with the Read tool.

| Question | Build | Open |
|---|---|---|
| Is a sheet the same person as its character in every frame, the right size beside the hero, true to its concept? | `bun tools/art/review.mjs <sheet> --before HEAD` | `.artifacts/art/review/<sheet>.png`, and answer `assets-src/art-reviews/<sheet>.md` |
| Does everything still belong together? | `bun tools/art/see.mjs` | `.artifacts/art/see/sprites-<n>.png`, `portraits-<n>.png`, `icons-<n>.png`, `kit-<n>.png` |
| How does it look in the game? | `bun run dev` outside the queue, then `bun tools/slot.mjs --look -- bun tools/art/see.mjs --only world --url http://localhost:$PORT` (and `--only talk`) | `world-<n>.png` (each figure at the game's camera beside the hero), `talk-<n>.png` (each portrait in the dialogue box) |
| Does a tile repeat visibly: a line where copies meet, a stripe, a grid of dots? | `bun tools/sprites/preview.mjs` | `.artifacts/sprites/blocks-<n>.png`, each tile 6 by 6 |
| Do the panel and button stretch cleanly? | `bun tools/sprites/preview-story.mjs` | `.artifacts/sprites/story-nine-slice.png` |

The `make-sprite` skill's sections 2 and 6 list what to look for.

It also cannot see:

- A name set from a variable (`picture: id`) or built outside `src/game/content`. The `names` line counts the ones it skipped.
- Whether the loader reads a section. The check reads the JSON. `src/features/assets/manifest.ts` decides what the game receives.
- How a prop looks or a palette sounds. It counts triangles and fields. For a prop's look, `bun tools/props-beside.mjs <kind>` puts it beside its concept sheet in the game's light.
- A real `src/content/props.ts`: none existed when this was written. If its entries use other field names, the check fails and says to add them to `PROP_KEYS` in the script.
