# Sacred and water concept handoff

Painted with the built-in image generation tool on 2026-11-12. Eight model sheets and two vistas are exported as 1600-pixel-wide WebP files. The shrine sheet includes both dormant and restored states. All final exports were opened and compared with the map pieces, story scenes and approved town and river shots. No runtime assets or code changed.

## Build defaults

Use the dimensions in `docs/greenhollow-world.md` as the model bounds. The sheets are painted construction references, not measured CAD drawings. The small elevations guide assembly; the large views guide materials and silhouette. Individual detail insets have independent scales. Keep the hero at 1.8 blocks in code.

| Key | Width x depth x height in blocks | Construction decision |
| --- | --- | --- |
| hallDoor | 9 x 3 x 8 | Five-block circular door, two thick half-disc leaves, segmented stone frame, swept roots. Hill and tree crown are environment. |
| shrine | 5 x 5 x 5 | Five-block base diameter, three-block basin opening. Two 0.5-block steps, 3.4-block drum and 0.6-block bowl. Both states share geometry. |
| waystone | 2 x 2 x 4 | Chamfered plinth and tapered shaft, leaf recess, brass palm inset. Set the touch inset at about 1.3 blocks above ground. |
| standingStones | 14 x 14 x 5 | Eight slabs, 3 to 5 blocks high, around an eight-block clear centre. One entrance gap. |
| pumpHouse | 22 x 16 x 16 | Bounds include wheel and piers. Wheel diameter 12, thickness 2, centre 7 above model bottom. |
| weir | 24 x 4 x 4 | Low solid dam, rounded crest and sloping downstream apron. Water is a separate surface. |
| oldMill | 10 x 8 x 9 | Bounds include six-block still oak wheel and outboard pier. Cream plaster and walnut frame match Hollowmere. |
| jetty | 4 x 12 x 3 | Six pairs of piles, two lengthwise beams, cross braces and plank deck. Three-block height is above deck; buried piles extend to the riverbed as the site needs. |

The Pump House wheel is a separate rotating assembly containing both rims, all spokes, hub and paddles. Twelve spokes and 24 paddles are the chosen construction counts. Rotate around its horizontal centre axis. The building, axle and both bearing supports stay fixed. The image's small label "Bearing Pier to Rim" is misleading: the bearing supports the axle at the HUB, never the rim. Leave clearance between wheel and both supports.

The standing-stone top inset accidentally depicts seven positions despite the eight-stone annotation and main view. Build eight, distributed around the ring with a wider entrance gap. The sacred vista adds decorative teal diamond inserts and a paved central medallion that are absent from the model sheet. Use the model sheet's unlit carved slabs and grassy centre. Vistas show mood and group scale, not exact positions or extra model variants.

Painted human sizes and dimensional proportions vary slightly between views, including the corrected shrine sheet. The numerical dimensions above settle those differences for the builder. The Pump House keeper and interior belong to later work; this sheet specifies the exterior vault entrance.

## Prompt set

All generation prompts requested soft painterly, cozy Genshin-like colour, warm golden light, cream presentation paper, honey limestone with lavender shadows, brass and restrained teal living magic. Model sheets requested three-quarter, front and side views, material names, dimension lines, a 1.8-block hero and construction from simple extrusions, cylinders and sweeps within the future 6,000-triangle budget. This is a design target, not a measured triangle count.

- `3-sacred/hallDoor.webp`: circular split door with radial brass bands, rooted arch and worn steps; exploded door leaves and wedge frame.
- `3-sacred/shrine.webp`: dry dormant and teal restored cylindrical basin shrine, matching geometry, front and side for both, bowl section. A targeted edit reduced the oversized heroes.
- `3-sacred/waystone.webp`: leaf-carved touch stone, sleeping body and waking teal inset, plinth and shaft assembly.
- `3-sacred/standingStones.webp`: eight carved slabs on a hill, elevations and top plan, moss at feet, no lintels.
- `3-sacred/vista.webp`: sacred group on the hills near the plot, High Road in the distance, golden hour and open valley scale.
- `4-water/pumpHouse.webp`: ancient arched river vault, monumental separate brass wheel, exploded rotation axis and fixed bearings.
- `4-water/weir.webp`: broad low stone dam, spilling water, upstream-to-downstream section and separate water overlay.
- `4-water/oldMill.webp`: ruined town-style mill, still wooden wheel, roof remnants and exposed beam joins.
- `4-water/jetty.webp`: plank deck, pile pairs, mooring post and amber lamp, underside joints and town backdrop.
- `4-water/vista.webp`: the Mere near Hollowmere, Pump House dominant, old mill upstream, weir and jetty among reeds.

## Verification

The worktree doctor passed in quick mode. Each final WebP was opened successfully. A filesystem byte check passed all ten files against the stricter decimal limit of 600,000 bytes. Runtime tests were not run for these unregistered concept references. Before committing, only `assets-src/concept/` was changed. No server was started and no branch was pushed.
