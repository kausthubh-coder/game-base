# Hollowmere city concept package

Proposed for Kausthubh's approval, 12 November 2026. These are concept paintings and a build list for Astra. They do not change the game or authorize new world placements.

Hollowmere is the valley's crowded civic and trading centre. Teal roofs gather around the Hollow Oak, with a working riverfront below and fields at its edge. Old houses have repaired plaster and mismatched shutters. Maren's inherited hall is broad and public. The Order's small white chapel is the newest building. Three thin harvests show in patched cloth, modest market stocks and pumps with grey grass around them.

## Pictures

| File | Purpose and inspection |
|---|---|
| [vista-wide.webp](vista-wide.webp) | Oak hill across the Mere. Dense roof layers, green, hall, north chapel, working quay and pumped edge fields. Corrected the first draft's treehouse to a natural hollow. |
| [vista-street.webp](vista-street.webp) | Daily market street. Bakery, repair work, balconies and the oak at the end of the route. |
| [vista-night.webp](vista-night.webp) | Quay to green at blue hour. Amber lamps lead to the oak's hanging lanterns. |
| [vista-marketday.webp](vista-marketday.webp) | Every seventh day. Two stall rows, honey, fiber, bread and fish. The green stays open. |
| [plan.webp](plan.webp) | District relationships, river, quay, green, chapel, homes and fields. Dimensions are proposals; see the placement limits below. |
| [kit-buildings.webp](kit-buildings.webp) | B01 through B16, with three-quarter views and footprint and height labels. |
| [kit-parts.webp](kit-parts.webp) | P01 through P16, with footprint diagrams and an assembly sketch. Corrected P06 to a six-block gable. |
| [kit-street.webp](kit-street.webp) | S01 through S16. Dimensions above each view give footprint and height. |
| [kit-quay.webp](kit-quay.webp) | Q01 through Q12, with footprint diagrams. Corrected the crane's boom to stay within its footprint. |

Every final WebP was opened after export and checked against the current town screenshot, the Hollow Oak layout, the approved chapel, pump, ruined mill and jetty sheets, and the two map paintings. All nine are 1600 pixels wide and below 600,000 bytes. The package is unshipped concept art; no runtime asset, manifest or game code changed. The verify-game skill was read; its runtime/build checks do not exercise these unreferenced concepts. Verification here is visual inspection, file decoding, dimensions, byte limits, catalogue coverage and Git scope.

## Scale and placement

One block is one metre. The hero is 1.8 high. All catalogue sizes are width x depth x maximum height, in blocks, including roofs and projections. A height rounded to a whole block is an envelope, not an instruction to stretch an existing model. Existing models retain their current mesh dimensions unless a row explicitly proposes a rebuild.

The proposed survey envelope is **240 east-west x 220 north-south**, including the river margin and edge fields. The built core is **180 x 160**. Keep the current **75 x 75** oak nucleus and its walking connections as the starting anchor. Lantern Green is 44 x 40; quay promenade is 96 x 8. Main civic streets have 8 blocks clear, secondary streets 6, alleys 4. These widths exclude stalls, steps and balconies. Keep an 8-block route through the market on market day.

North is up on the plan, east is right. The city is east of the Mere, with the quay along its west/southwest side. Water flows south to Saltgate. Chapel quarter is north of the green; the queen's hall is northeast; granary southeast; trades south; homes east; fields east and southeast. Keep the existing oak at world x=173.5, z=-151.5. Do not derive world coordinates from this painting. The land coordinator must fit the expanded envelope around existing bridge, High Road, chapel road, regional landmarks and marsh before placing it. This package moves none of them.

The plan's building icons, footprint examples and scale bar are illustrative, not a measured CAD layout. The B catalogue controls building dimensions, including B15 at 20 x 14 rather than the plan legend's generic civic example. Perspective vistas establish massing, light and materials; their camera arrangements do not override the north-up plan. In particular the market-day chapel appears on the opposite side of the composition.

## Building catalogue

Existing means the named model is in `src/content/town-kit.ts`; it does not mean its mesh already matches every new painted detail. Grow those silhouettes rather than discard the kit. New pieces are proposals to build after approval.

| ID | Piece | W x D x H | Existing or new | Build note |
|---|---|---|---|---|
| B01 | Cottage | 7 x 6 x 6 | Existing `house-a` | Edge homes; keep low silhouette. |
| B02 | Family house | 9 x 8 x 7 | Existing `house-b` | Shutters, porch and shared gardens. |
| B03 | Long house | 10 x 7 x 6 | Existing `house-c` | Weaver or fish seller through signs and dressing. |
| B04 | Tall house | 8 x 8 x 9 | Existing `house-d` | Dense street corners. |
| B05 | Merchant row house | 6 x 10 x 12 | New | Three storeys; plain party walls; repeat in terraces. |
| B06 | Corner shop | 10 x 10 x 11 | New | Two shop faces and a shared upper home. |
| B07 | Bakery | 10 x 8 x 7 | Existing `bakery` | Keep oven silhouette; sacks stay sparse. |
| B08 | Guild lodge | 12 x 10 x 9 | Existing `lodge` | Tamsin's town base, not Saltgate's guild hall. |
| B09 | Workshop | 10 x 8 x 7 | Existing `workshop` | Cooper, smith or carpenter dressing variants. |
| B10 | Granary | 14 x 12 x 14 | Existing `granary-hall`, proposed rebuild | Keep loading front and civic importance; separate grain store from queen's hall. Existing mesh has 7,714 triangles, above the new cap; simplify rather than copy its count. |
| B11 | Warehouse | 12 x 16 x 11 | New | Quay doors, hoist beam, broad roof. |
| B12 | Lamp house | 8 x 8 x 8 | New | Lamp repair porch and amber glass storage. |
| B13 | Wheelwright's yard | 14 x 12 x 8 | New | Envelope includes shed, wheel rack and open yard. |
| B14 | Working town mill | 14 x 12 x 12 | New | Includes wheel projection. Intact mill for the ledger; separate from ruined `oldMill` north of town. Wheel is a separate turning part. |
| B15 | Queen Maren's hall | 20 x 14 x 16 | New | Inherited timber/stone civic seat, one grand roof; ledger porch faces green. No new fortress. |
| B16 | Courtyard homes | 14 x 14 x 12 | New | U-shaped assembly, 6 x 6 open court, shared stairs and balconies. |

## Modular parts

All sixteen are **new reusable interfaces**. Today's GLBs contain similar forms but do not expose these parts for assembly. Snap part origins and structural joins to whole blocks. Insets, bevels, roof thickness and clear openings may use fractions. Front is +z, y is up, base y=0; wall face starts at z=0.

| ID | Piece | W x D x H | Join and construction |
|---|---|---|---|
| P01 | Stone plinth | 4 x 1 x 1 | Straight foundation strip; paint most seams. |
| P02 | Timber plaster wall | 4 x 1 x 3 | Plain wall bay; shared end posts must not double. |
| P03 | Window wall | 4 x 1 x 3 | Same bay with P11 inset. |
| P04 | Door wall | 4 x 1 x 3 | Clear opening 2 wide x 2.4 high. |
| P05 | Corner post | 1 x 1 x 3 | Joins perpendicular wall bays. |
| P06 | Gable infill | 6 x 1 x 2 | Six-block eave span, two-block rise; end of paired P07 roof. |
| P07 | Roof slope | 4 x 3 x 2 | Ridge runs along the four-block axis. Mirror across ridge to cover 4 x 6; rotate over P06. |
| P08 | Ridge cap | 4 x 1 x 1 | Includes clearance envelope; visible cap about 0.3 high. |
| P09 | Roof hip | 3 x 3 x 2 | Corner/hip transition; pair only at matching eave height and pitch. |
| P10 | Chimney | 1 x 1 x 3 | Extend below roof when needed; no floating base. |
| P11 | Shutter window | 2 x 1 x 2 | Window and open shutter envelope; recess glass. |
| P12 | Arched door insert | 2 x 1 x 3 | H3 includes surround; actual leaf and clear opening H2.4. Surround mounts on wall face. |
| P13 | Balcony | 4 x 2 x 1 | Local floor at y=0; mount at upper-floor height. Rails about 1 high. |
| P14 | Stair flight | 2 x 4 x 3 | Connects three-block storeys; use small treads, not the painting's exaggerated risers. Collision needs its own walkable ramp/steps. |
| P15 | Arcade arch | 4 x 1 x 3 | Clear arch at least 2 wide and 2.4 high. |
| P16 | Lean-to awning | 4 x 2 x 1 | Local top assembly; mount so low edge clears 2.4. |

Parameterize P01-P04 to integer lengths 1-4 for closing odd-width legacy footprints. Parameterize P06-P09 to the matching roof span and pitch; keep the same painted silhouette. A four-block run uses one P07 pair and one P08. Longer roofs repeat those runs. Use straight infill, plain party walls and three-block storeys to assemble B05/B06/B16. Compose a whole building offline into an instanced model; do not render every bay as an independent draw call. The footer is an assembly sketch, not a complete measured house blueprint.

## Street catalogue

| ID | Piece | W x D x H | Existing or new |
|---|---|---|---|
| S01 | Saffron market stall | 3 x 3 x 3 | Existing `market-stall-a` |
| S02 | Cream produce stall | 3 x 3 x 3 | Existing `market-stall-b` |
| S03 | Handcart | 3 x 4 x 2 | Existing `cart` |
| S04 | Individual crate | 1 x 1 x 1 | New standalone extraction; existing `barrels-crates` is a combined 3 x 2 cluster. |
| S05 | Individual barrel | 1 x 1 x 1 | New standalone extraction from the same visual family. |
| S06 | Bench | 3 x 2 x 2 | Existing `bench`; actual seat about 0.5 high, existing total mesh H1.28. |
| S07 | Amber lamp post | 3 x 2 x 3 | Existing `lamp-post` |
| S08 | Hanging shop sign | 2 x 1 x 2 | New wall-mounted variant; existing `signpost` stays for routes. Size is local sign/bracket envelope. |
| S09 | Banner pole | 2 x 2 x 4 | Existing `banner-pole` |
| S10 | Roofed town well | 6 x 6 x 6 | Existing `town-well` |
| S11 | Civic fountain | 6 x 6 x 3 | New; shallow basin, simple leaf relief, separate water surface. |
| S12 | Planter | 3 x 2 x 2 | Existing `flower-planter` |
| S13 | Straight fence | 3 x 1 x 2 | Existing `fence-straight`; keep actual rails around 0.35 and 0.8. |
| S14 | Corner fence | 3 x 3 x 2 | Existing `fence-corner` |
| S15 | Paving edge | 4 x 1 x 1 | New envelope; exposed kerb only 0.15 high, remainder buried. |
| S16 | String lights | 6 x 2 x 4 | Existing `string-lights`; keep clearance above routes. |

Honey, moss fiber, quills and other sale goods belong to the separate `goods` concept package. Use that kit as stall inserts, not individually modelled background piles. Produce, flower and cloth variants share the same stall frames. Civic banners use leaf or grain motifs; reserve the half-sun seal and concentrated gold for the Order.

## Quay catalogue

| ID | Piece | W x D x H | Existing or new | Build note |
|---|---|---|---|---|
| Q01 | Retaining wall | 4 x 2 x 4 | New | Straight seams, broad coping, sparse moss at waterline. |
| Q02 | Outside corner | 4 x 4 x 4 | New | L footprint, same wall profile. Mirror for inside bends. |
| Q03 | Quay steps | 4 x 6 x 3 | New | Descend from promenade to landing. |
| Q04 | Rope bollard | 1 x 1 x 1 | New standalone | Jetty already has a mooring post; reuse its form. |
| Q05 | Dock module | 3 x 3 x 1 | Existing `dock-segment` | Keep its current posts and plank divisions. |
| Q06 | Rowing skiff | 2 x 6 x 2 | New | Swept hull, thick gunwale, few ribs. |
| Q07 | Shallow cargo boat | 4 x 12 x 5 | New | Low mast, furled sail, river craft. |
| Q08 | Net drying rack | 4 x 2 x 3 | New | Sparse painted net/card or broad strands, no dense mesh lattice. |
| Q09 | Timber hand crane | 4 x 4 x 6 | New | Entire boom and suspended load stay within footprint; fixed pose first. |
| Q10 | Gangplank | 2 x 6 x 1 | New | Local envelope includes shallow rise; no tall warehouse wall attached. |
| Q11 | Quay parapet | 4 x 1 x 1 | New | Place on Q01 coping; omit beside loading bays. |
| Q12 | Long jetty | 4 x 12 x 3 | Existing approved `jetty` | Reuse `4-water/jetty.webp` as authority; sheet's optional ropes do not replace approved post layout. |

Q01/Q02 ground datum is riverbed, top at local y4. Proposed water surface is y1 and promenade y4, so Q03 drops to a landing at y1. Adjust buried footing depth to actual site, not exposed coping height. Q05 thickness is 1; place its deck at the landing elevation. Q12 H3 is maximum **above deck**, as in its approved sheet; piles extend below and must reach the bed. Boat H includes shallow draft and mast, origin on keel, translate to waterline by draft. Walkable decks, stairs and bridge surfaces need explicit collision; a painted or modelled surface supplies none.

## Preserve from today's town and approved landmarks

The 27 existing town model keys remain usable. The numbered rows account for the four homes, bakery, lodge, workshop, granary, stalls, cart, clutter, bench, lamps, lights, banner, well, planter, fences and dock. Keep these additional keys too:

| Existing piece | Footprint and height envelope | Use |
|---|---|---|
| `rootworks-gate` | 12 x 8 x 8 | Preserve current role; do not turn it into a new city wall. |
| `kennel` | 10 x 8 x 7 | South artisan edge. |
| `ferry-house` | 10 x 10 x 7 | Beside ferry landing, not replaced by warehouse. |
| `signpost` | 3 x 2 x 3 | Route forks. |
| `stone-bridge` | 6 x 3 x 2 | Existing small town crossing; does not define the regional approach bridge. |
| `statue-gardener-warden` | 3 x 3 x 3 | Keep the game's Gardener Warden statue at the oak. Painted human statue is a mood cue, not a replacement sculpture. |

Retain the Hollow Oak, broken pillar ring, hedge entrance and stone lantern walk from `src/game/content/town/b.ts`. They are already separate from the 27-model town kit. Keep the living oak's existing size and identity; do not scale its mesh from the vistas. Preserve its hollow and visible roots. No rooms, windows or queen's residence inside it.

Reuse the approved `chapel` at 10 x 14 x 13 and `orderPump` at 3 x 3 x 4. Keep chapel bellcote, small gilded rear half-dome, amber windows and white plaster. The incidental chapel in the quay sheet's banner is not a redesign. The pumps in the broad paintings are simplified silhouettes; the approved paired brass U-pipes control their build. Every edge field gets a pump and grey ring during the pumped story state. Remove pumps and let grey recover when the ledger progresses.

Retain `oldMill` at 10 x 8 x 9, ruined north of town, and the existing regional approach bridge. Vistas suggest a stone civic bridge for grandeur; **default to the story's existing plank approach bridge** until a replacement is approved. No new bridge model is authorized by this package.

## Material and modelling rules

Use the town kit's muted teal roofs, cream plaster and brown beams. Ancient pillars and new quay masonry share `../stone.md`: honey cream #DEC398, light #F4DEB2, lavender-grey shade #9C91A7, sparse sage moss. Wood follows the prop palette, dark/mid/light #916534/#9b6f3e/#b78b5a with supports #664930. Town roof paint does not glow. Lamps are amber; saturated luminous teal belongs to magic.

Build with bevelled boxes, simple arches, low-sided round forms and smooth swept profiles. Paint seams and roof courses instead of modelling every brick and shingle. Keep roots and hulls smooth enough to read at the game's 35-degree camera. Avoid the faceted stand-in look noted in `docs/act1.md`.

Maximum 6,000 triangles per complete landmark, including attached roof and dressing. Target 1,200-2,400 per repeated house, 40-240 per repeated wall/roof part, 60-300 per small street piece. Large boats, crane and well can use 600-1,800; do not treat their envelopes as permission for landmark budgets. These are design budgets, not measured models. Retain existing models until rebuilt and verified; several old street props exceed the new small-piece target. City density needs instancing, distance simplification and occlusion planning against the game's scene budget. No performance claim is made by a painting.

## People and story spots

Tamsin waits at B08's porch and the grant route by the hedge gate. Maren receives ledger deliveries at B15's public porch beside B10's queue. Aldric works at the chapel door. Calla can stand where the north road meets the green. Gus uses the field entrance and granary queue. Brack waits at Q12 by the ferry house. Juniper has an open sightline between market and oak. Citizens sit at the green edge, repair wheels at B13 and sell goods from S01/S02. Keep dialogue spots outside cart routes and stair landings.

## Defaults and unresolved approval choices

- City extent is a proposal. The handbook describes a market town and today's world plan preserves its columns; Kausthubh's latest request asks for a city. Default to the larger envelope around the fixed oak, pending the coordinator's terrain fit and approval. Do not move other landmarks to make it fit.
- The earlier granary-hall combines civic roles. Default to a separate grain store B10 and inherited queen's hall B15. Maren's story mentions a palace; this design interprets it as a modest old civic hall rather than a castle complex.
- B14 is the ledger's functioning town mill. The ruined northern `oldMill` remains a separate quest location. Its working channel is a proposal, not a change to the river simulation.
- The plan is not orthographic survey data. Roof heights, household counts, exact parcel packing, flood levels and the enlarged city's regional collision bounds still need implementation design. Default to mixed two-storey homes, three storeys in row-house streets, and no defensive ring wall.
- Generated paint compresses or exaggerates dimensions, crowd size, stair risers and flower detail. The written catalogue and approved landmark sheets control construction. Human figures in the paintings are scale/mood references; character sprites come from their own approved sheets.
- The broad vistas imply more roof layers and taller terrain than today's flat town. Default to shallow terraces with accessible parallel ramps, not cliffs or a relocated oak. The existing walkable nucleus remains the test fixture.

## Sources checked

`docs/act1.md`, `docs/greenhollow-world.md`, `docs/painted-world.md`, `docs/style-sheet.md`, the make-3d-asset and verify-game skills; `src/content/town-kit.ts`; `src/game/content/town/b.ts`; `docs/shots/approved/town.png`; the handbook town B screenshot; approved `5-order/chapel.webp`, `5-order/orderPump.webp`, `4-water/oldMill.webp`, `4-water/jetty.webp` and `stone.md`.

Handbook sources under `~/dev/sandbox/game-look-test`: `design/04d-new-story.md`, `design/26-map-of-greenhollow.md`, `design/28-the-people.md`, `playthrough/farms.js`, `playthrough/assets/map/hollowmere.png`, and `design/img/v1/greenhollow-map.png`.
