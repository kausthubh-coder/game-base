# Opening sprites

ISSUES. All numerical checks pass. These are usable lab candidates with the visual limits below, not final art approval.

Branch: `lab/opening-sprites`, based on local `lab/opening` at `8e12a9f`. Nothing pushed or merged. Only `demos/opening/engine/sprites/` is committed.

## Files and integration

Four transparent PNG sheets and `sprites.json`. All cells are 128 square, with anchor `[64,120]`. Unused cells are transparent. `animations` uses the game's existing rows/frames/fps contract. `actions` additionally lists explicit `[column,row]` sequences and whether they loop. Raise, turn and bed are one-shot actions: hold their last frame when finished. The review page repeats them for inspection.

- button-child: idle 2 frames, raise 4, hold 2, turn 2; back three-quarter view.
- hobb: idle 4 frames, bed 3; front three-quarter view.
- grey-coat: walk 6 frames, idle 1; back view only.
- basket: breathe 2 frames; front names the fixed elevated view.

`heightMetres` is the requested visible standing height: 1.0, 1.6, 1.75, 0.45. The game's `worldHeight` means the whole transparent frame, so it is larger to account for padding. Use `worldHeight` for the billboard, and anchor normally; do not scale it again by `heightMetres`. `referenceDrawnHeight` records the standing silhouette used in that conversion. The child's raised candle extends above his standing head.

No light spill is painted into the candle sheet. Use a separate scene light. Filter these PNGs with nearest-neighbour sampling. Files can move unchanged into the game's sprite folder later; that requires manifest entries and is outside this lab task.

## What I saw

Opened all frames on dark, light and green backgrounds, alongside the approved hero at the same pixel scale. Opened the world-scale comparison too. The grey-coat walk strip shows alternating feet, opposing arms and moving coat hem. The animated review and GIF are supplied as additional evidence.

- Child: the hair ramp, tousled silhouette, warm skin and large head connect him to the approved hero. The nightshirt, bare feet and smaller world size read younger. His head and torso shift slightly during the raise; silhouette centring moves his feet sideways a little, though their baseline stays fixed. His head turn is subtle. Identity from the back is a visual judgement, not proved by the palette check.
- Hobb: accepted the second attempt. Grey temples, eyelids, forehead creases, nose and cheeks now read past fifty. The first attempt looked young and is retained as rejected. Her idle has a noticeable shoulder sway; the apron marks read as flour/scorch patches rather than clearly burns at native size.
- Grey coat: no face. The walk reads as a short cautious walk with visible alternating boots. The stride is small, and the hem is stylised rather than realistic wet fabric. It will need modest scene translation speed.
- Basket: key, wicker and sleeping baby are readable. Breathing is very subtle. The baby's round face can read older than a newborn. There is a slight change of blanket/key contour between frames.

No pale halo, leftover background, stray specks or clipped tools were visible in the processed sheets. Feet/base sit on y=120 in every used cell. A single common scale per source sheet preserves generated proportions; no replacement character pixels were drawn in code.

## Rebuild and checks

Built-in `image_gen.imagegen` made each source with approved PNG references. `src/prompts.json` keeps every prompt and the rejected attempt. `src/references/` keeps the actual hero sheet and planning portraits used. Generated raw PNGs are retained under `src/`. The sources can be processed again with:

```
bun demos/opening/engine/sprites/src/build.mjs
bun demos/opening/engine/sprites/src/check.mjs
bun demos/opening/engine/sprites/src/preview.mjs
```

Observed commands and output:

- `bun tools/doctor.mjs --quick`: dependencies and env ok; Chrome starts; port 5748.
- `bun tools/sprites/preview-story.mjs` and `bun tools/sprites/preview.mjs`: built the existing reference previews after creating `.artifacts/sprites/`. The initial story preview failed because that output directory did not yet exist; rerun succeeded.
- Local `src/build.mjs`: BUILT all four sheets.
- Local `src/check.mjs`: PASS each sprite for sizes, anchors, binary alpha, palette, padding and empty unused cells; PASS opening sprites: 26 frames. Calls the game's actual `fringe()` function: child 0.0% of 3800 rim pixels; Hobb 0.0% of 2284; grey coat 0.0% of 2082; basket 0.0% of 409.
- `bun tools/sprites/check.mjs --complete`: PASS 105 original sprite frames, 40 block tiles, 16 icons; story PASS 319 frames, original files and entries unchanged; PASS all six story sets complete.
- `bun tools/sprites/check-story.mjs --complete`: PASS 319 frames and all six story sets complete.
- `bun tools/verify-assets.mjs`: TOTAL PASS: 9 checks, 9 passed, 0 failed, 1 warning. Existing warning: the uikit section is not described in docs/assets.md. This checks game assets; the local script above checks the new lab sheets because they deliberately are not in the game manifest.
- `bun run verify assets build shots`: 3 parts passed, nothing failed. Approved game pictures and draw budgets unchanged.
- `bun run check`: 880 tests pass, 0 fail; Convex 5 files and 32 tests pass. Types and boundary check passed.
- `bun tools/typecheck.mjs opening`: exit 0, no diagnostics.
- `bunx biome lint demos/opening`: exit 0, no fixes.
- `bun run lint`: exit 0, 931 files checked, 3 existing warnings elsewhere in the repo.
- ffmpeg built `.artifacts/opening/sprites/grey-walk.gif` from the six processed walk frames, exit 0.

These checks do not register or publish anything. The lab-local assertions mirror check-story's relevant human sprite rules and reuse the real fringe implementation. They cannot prove age, identity or motion quality.

## Evidence

All paths below are relative to the checkout:

- `.artifacts/opening/sprites/all-frames-dark.png`
- `.artifacts/opening/sprites/all-frames-light.png`
- `.artifacts/opening/sprites/all-frames-green.png`
- `.artifacts/opening/sprites/world-scale-dark.png`
- `.artifacts/opening/sprites/world-scale-light.png`
- `.artifacts/opening/sprites/grey-walk.gif`
- `.artifacts/opening/sprites/review.html`
- Logs beside them: `assets.log`, `check-game.log`, `sprite-check.log`, `story-check.log`, `lab-check.log`, `verify-before.log`, `lint.log`.

Not checked: these sprites standing on the other helper's 3D sets; camera-facing/billboard orientation in the final engine cut; candle lighting, occlusion, film timing, audio sync or device performance. The engine cut is still a placeholder in this base checkout. No server was needed or left running.
