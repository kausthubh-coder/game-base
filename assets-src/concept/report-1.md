# High Road and terraces concept handoff

PASS for the requested delivery checks. Nine model sheets cover every model and variant in groups 1 and 2. Two vistas show their valley setting. All eleven saved WebPs were opened after conversion and visually checked against the map pieces and approved game shots. Each image is 1600 pixels wide and below 600,000 bytes. Only assets-src/concept files changed from world/greenhollow at f1698a7. Nothing was pushed.

## Sheets

| Path | Coverage | Nominal blocks, width x depth x height |
|---|---|---|
| 1-high-road/highRoadArch.webp | dark, lit, broken; three views per state; deck section and end joints | 12 x 7 x 14 |
| 1-high-road/roadStair.webp | three views, cutaway, climb plan and deck connection | 8 x 8 x 15 |
| 1-high-road/roadPylon.webp | three views, dormant crystal and lit inset | 6 x 6 x 30 |
| 1-high-road/fallenSpan.webp | three views, debris layout and fragment shapes | 14 x 8 x 5 |
| 1-high-road/vista.webp | meadow, High Road, stair, pylon, collapsed span, grey forest | valley vista |
| 2-terraces/terraceWall.webp | three views, soil section, side-by-side joint | 12 x 3 x 6 |
| 2-terraces/terraceStair.webp | three views, step section, upper and lower joins | 10 x 12 x 6 rise |
| 2-terraces/oldGate.webp | three views, three empty sockets, backing section | 14 x 5 x 14 |
| 2-terraces/colossus.webp | three views, overhead, burial section and shape breakdown | 30 x 10 x 8 |
| 2-terraces/giantRoot.webp | arch, low, curl; three views per variant; curl overhead | 16 x 4 x 7 maximum |
| 2-terraces/vista.webp | tiered walls, stair, gate, fallen colossus, roots and distant Dawn | valley vista |

## Shared material

Hearth limestone is warm pale honey cream with lavender-grey shade. Broad ashlar is roughly 2 x 1 x 1 blocks, with rounded bevels and shallow leaf-and-channel carving. Sage moss sits in damp joints and on upward ledges. Cart-thick ochre roots lie over masonry and pry a few joints apart. Teal caps and old brass are small accents. Gold is reserved for active lume. stone.md gives colour defaults for the other painters and builders.

## Builder corrections to generated annotations

The paintings establish silhouettes and assembly. They are not dimensionally exact CAD drawings. Use the world-plan bounds, the 1.8-block hero, and these corrections when generating geometry.

- highRoadArch: 12 is the total module length, not the clear opening. The deck surface is at y=13 and parapets reach y=14. Road travel follows X, with open joints at x=-6 and x=6. The side elevation represents an end section, so its drawn parapet band must not become an end wall. Match channel and walking lanes across the seam. DARK and LIT must share identical geometry. The broken end has no floating unsupported extra blocks.
- roadStair: the sheet's 44 risers at 0.30 would rise 13.2. Use 44 risers at 13/44 blocks to land exactly at y=13. Split flights 16/14/14, with rises 4.7273/4.1364/4.1364. The small cutaway simplifies the turn; use the plan's path around the central opening. Fit flight runs and landings inside 8 x 8. Stair railings can be about 0.9 above the treads, with the tallest end posts reaching the nominal y=15.
- roadPylon: its ghosted High Road is labelled deck 14. Correct deck level to 13; parapet top is 14. Base remains 6 x 6, crystal summit 30. Four prongs are intended, including the hidden rear prongs.
- fallenSpan: there are FIVE major chunks, three arch pieces, one deck slab and one fallen pier. Ignore the generated four-chunk headings. These are parts of ONE prop, not five separately budgeted 6,000-triangle models. Reuse and rotate partial arch geometry from the intact span. Do not build three complete new arches.
- terraceWall: ignore the three-courses height arithmetic in its exploded inset. Keep overall height 6 including plinth/coping, and about five broad seam rows on the face. At a tiled seam share or halve the end buttress so two faces do not produce a double-width post. Roots stay away from lateral joins.
- terraceStair: use 20 risers of 0.30 for the 6-block terrace rise and a nominal 12-block run. The 0.8-high cheek coping may project above the nominal rise, as the plan's dimensions are rough. The decorative arch behind the large three-quarter view is setting, not part of this prop. The vista shows several flights in succession; do not enlarge one flight to match the entire hill.
- colossus: 30 is its horizontal body length, not a standing height. Follow the overhead body layout and long elevation. The end view is illustrative and foreshortened. Fit the whole fallen statue to 30 x 10 x 8. Earth covers the back and one side; the face looks upward. Use one 6,000-triangle budget for all body parts together. Broad cheek planes and robe wedges take priority over carved fingers or hair strands.
- giantRoot: arch fits 16 x 4 x 7, low 16 x 4 x 3, curl 16 x 4 x 5. The curl turns horizontally as shown in its top inset. Underground anchors are placement overlap, not additional exposed height. Root tubes, not boxes or arch-ring stone, are the intended build method despite the generic shape list on the sheet.

## Defaults and uncertainties

The colossus's identity is unspecified. I chose an unnamed calm human companion in a broad robe with a leaf clasp, without assigning a named champion or god. The Old Gate is a closed split disk with three round empty sockets at 10, 12 and 2 o'clock. Its exact opening mechanism is unspecified. Low and curl roots use shorter heights inside the plan's maximum bounds. The High Road vista uses the paler, bare-branched grey-forest option; choosing the fuller-crown option later does not change these landmarks. Vistas establish mood and relative placement, not final terrain coordinates. Pylons have a warm gold lit state, though the main High Road vista keeps the near crystal dormant for contrast.

## References and verification

Read docs/greenhollow-world.md, docs/painted-world.md and the complete 04d-new-story.md in game-look-test/design. Opened high-road.png, high-road-lit.png, terraces.png, dawn.png and design/img/v1/greenhollow-map.png. Opened approved spawn.png and town.png, plus the game's rock.webp, bark.webp and meadow.webp paintings. The concepts retain the map's honey stone, teal caps and roots while using broad painterly colour and lavender shade from the game. The terraces intentionally show less lush growth than the map icon because the world plan places them inside the grey forest.

bun tools/doctor.mjs passed before painting, including the existing checks. bun run verify check passed after the concept files were added. These are source references only; no shipped asset, manifest, runtime code or approved screenshot changed. No dev server was needed. All eleven generated outputs were retained as final sheets, so there were no rejected draft images to delete.

Generated with the built-in image_gen tool. prompts-1.json contains the complete final prompt for each image. WebP conversion used cwebp at quality 86 and width 1600. All saved WebPs were reopened for inspection.
