# Farm creature sprites

Generated with the built-in `image_gen.imagegen` tool from the five concept turnarounds and the approved critter or lanternfly sprite. Exact prompts and attempts are in `critters-prompts.json`. Retained sources are `raw/<name>-3.png`, with `lanternfly-world` as the lanternfly source name.

Rebuild with `bun tools/sprites/critters.mjs`. This slices, hardens alpha, removes disconnected specks, snaps the locked palette and scales whole figures. The frog source puts directions in columns, so the rebuild transposes its pose sequence. Diving reverses the generated surfacing frames. Settling mosslings get a whole-figure scale correction to keep their body consistent beside idle. No replacement pixels are drawn.

## Manifest names

All sheets use 96-square cells and anchor [48,88]. Directions are front, back, right side, in that order.

- `mossling`: idle rows 0-2, walk 3-5, settle on stone 6-8.
- `burrower`: idle 0-2, walk 3-5, surface 6-8, dive 9-11. The underground endpoint keeps the head above the soil; the caller should hide the actor after diving.
- `frog`: idle 0-2, hop through `walk` 3-5, fly catch 6-8.
- `bee`: hover through `idle` 0-2, flight through `walk` 3-5.
- `lanternfly-world`: hover through `idle` 0-2, flight through `walk` 3-5.
- `lanternfly-glow`: amber abdomen mask registered exactly to `lanternfly-world`. Draw it additively at the same frame and position for night light. Body light is separate from wings and antenna tips.
- `lanternfly`: replaced as requested, retaining its original four-column, one-row `flutter`, frame, anchor and world height. The other frozen assets and baselines are untouched.

Ground creature frame heights default to the concept's occupied world height divided by the occupied fraction of a cell. Bees remain exaggerated for visibility. Lanternfly keeps its existing world height. These are art defaults, not farm rule changes.

## Review and evidence

Opened all concept sheets and the approved cast overview, every shipped creature sheet, each `beside` comparison including native and half-size rows, and the actual meadow captures. Fronts, faceless backs and right profiles retain their identity. Mossling flowers, bee pollen and frog spots are simplified into clusters. Burrower claws and the frog throat survive reduction. Idle and moving rows are subtle loops; they are not new farm AI.

`bun tools/sprites/beside.mjs <name> --sheet assets-src/concept/creatures/<concept>.webp` produces comparisons under `.artifacts/sprites/`. Existing evidence uses cropped turnarounds. Names are mossling, burrower, frog, bee, lanternfly-world and lanternfly.

`bun tools/critters-crowd.mjs http://localhost:<worktree-port>` renders these sheets through the real sprite system on the painted meadow, using its ground surface and default high camera. It writes `.artifacts/critters/crowd-mixed.png`, twenty-creature pictures per species, and four action frames in three directions for each farm action. It returns every action to idle. It changes no game rules or runtime code.

Checks passed: both complete sprite checks, `bun tools/verify-assets.mjs`, `bun run check`, `bun run verify assets build shots`, and `bun run verify tools`. Assets, build and shots also passed before the changes. The existing uikit documentation warning remains.

Not checked: actual farm routing, night glow rendering in gameplay, devices other than this Mac, or the full slow browser suite. The coordinator must connect the new sprite names, one-shot actions and glow mask to the farm runtime.
