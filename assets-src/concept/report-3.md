# Order and ruins concept handoff

PASS. Ten model sheets and two golden-hour vistas are in `5-order/` and `6-ruins/`. Every image is 1600 pixels wide and below 600,000 bytes. Built-in image generation painted the sheets; Sharp only resized and encoded the final WebP files. `prompts-3.json` records the initial prompts and selected source paths.

I opened every painting and compared it with the chapel, Dawn, ruin, dead-garden and lit-road map pieces, the whole Greenhollow map, the opening film's `m3-friends.jpg`, the approved town shot, and the game's meadow and rock paintings. The white chapel, teal roof and gilded apse keep the town's visual language. The ruined tower keeps the map piece's round body and broken brass instrument. The dead garden follows the newer plan's roofless cottage rather than the map icon's surviving roof.

## Sheets

| Model | File | Width × depth × height, blocks |
|---|---|---|
| chapel | `5-order/chapel.webp` | 10 × 14 × 13 |
| orderPump | `5-order/orderPump.webp` | 3 × 3 × 4 |
| orderEngine | `5-order/orderEngine.webp` | 12 × 8 × 10 |
| watchPost | `5-order/watchPost.webp` | 6 × 6 × 10 |
| dawnDome | `5-order/dawnDome.webp` | 120 × 120 × 60 |
| sunkTower | `6-ruins/sunkTower.webp` | 8 × 8 × 12 |
| forestStair | `6-ruins/forestStair.webp` | 6 × 10 × 3 descent |
| muralWall | `6-ruins/muralWall.webp` | 16 × 2 × 6 |
| deadCottage | `6-ruins/deadCottage.webp` | 9 × 7 × 6 |
| colonnade | `6-ruins/colonnade.webp` | 18 × 6 × 8 |
| Order vista | `5-order/vista.webp` | Composition reference |
| Ruins vista | `6-ruins/vista.webp` | Composition reference |

## Build decisions and uncertainties

- The Dawn's unspecified height defaults to 60, a hemisphere over the 120-wide footprint. Its six bands are meridional sectors around the shell, one per realm. The view from 400 blocks or more needs only glow and a city silhouette. The foreground hero in that view stands much closer to the camera; the elevations provide the shared scale.
- The sunk tower's 12-block envelope includes the brass ring fragment. Bury the rear base in the slope. Its hollow interior is one room with no intermediate floors. The painting's embedded-base diagrams describe placement, not a requirement to model another 12 blocks underground.
- The stair descends from ground level to -3 and stops at soil and roots. Fit about twelve steps into its ten-block run. Do not turn the terminal earth into a doorway.
- The mural has eight positions: Auren, Elowen, Ramose, Mahina, Anant, Yeshe, Halvar, then the scraped-out Ilara. Seven intact painted figures and one bare-stone silhouette. Use the individual sheet for the figure order; the vista only establishes the wall in the landscape. Faded ochre pigment is unlit paint.
- The colonnade has four upright positions, two full-height columns sharing a lintel, one short stump and one medium broken column, plus two fallen columns. Use the corrected sheet's four upright positions. The wider vista suggests more ruins beyond this individual prop.
- Every Order half-sun emblem must have exactly six rays. Some painted small emblems simplify that count. Build the six rays from the story specification. The roof finials use the half sun too.
- Use the labelled dimensions for all models. Painted hero proportions and orthographic details are approximate. The cottage's low walls should be roughly 1 to 1.5 blocks tall; ignore the generated annotation that calls three blocks waist height. Its rear chimney-gable reaches six.
- The engine's platform and road in its main view are context. The machine alone occupies its listed dimensions. Relight only the next road stretch, leaving the other side dark.
- The vistas suggest lighting and scale across the valley. Place the models from the map data rather than copying the vista's distances or road width. Keep the chapel on Hollowmere's north side. Keep grey grass immediately around the pump and beneath lit road sections.
- `stone-3.md` records the proposed shared stone colours, matched against concept-1's Hearth limestone. The coordinator can consolidate it into `stone.md`.

The sheets describe models to build. Their printed triangle-budget labels are design targets, not measurements of models that exist yet.

## Verification

`bun tools/doctor.mjs` passed before painting. After painting, `bun run verify check assets build shots` passed all four parts, including all six approved scenes. A separate file check decoded all twelve WebP files, checked width 1600 and required each size to be below 600,000 bytes. The final images range from 133,972 to 342,584 bytes. No runtime assets or source code changed.
