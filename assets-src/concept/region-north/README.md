# The north and the horizon

Concept proposal for Kausthubh's approval, 12 November 2026. These paintings are Astra's build reference and the source for later far-scenery paintings. No game models, terrain placements or runtime assets change here.

## Views

| Painting | Camera and story state |
|---|---|
| `vista-road.webp` | From the southern meadow looking north. West is left and dormant; east is right and lit by the Order engine. The Mere passes under the road. Paths climb to the deck; the road continues through both valley edges. |
| `vista-terraces.webp` | Northbound approach through the grey forest, before the Stag is freed. The Old Gate is at the terraces' foot. The giant fallen colossus and root-wrapped stairs establish scale. |
| `vista-dawn.webp` | Looking north from the lowest terrace's shrine. The closest act-1 view still keeps the dome distant, with the Order's closed approach between it and the hero. All six bands remain intact. |
| `vista-west.webp` | The pilgrimage at act 1's end, looking broadly west-northwest. The dark road leads toward Khetara; the restored forest is green. North is to the right, where one band of the Dawn has thinned. |
| `horizon.webp` | Unwrapped clockwise sweep W, N, E, S, W. Dunes west, Dawn north, Aukai across the Brackwater east, open sea beyond Saltgate south. Mountains frame the routes without blocking them. |

## Build conventions

All dimensions below are width × depth × height in blocks. One block is one metre. Use a 1.8-block hero to check scale. The tables govern dimensions rather than perspective proportions or generated lettering. Ground is y=0. Wall fronts face +z; rotate modules to follow the road. Existing approved landmarks retain their dimensions.

Use [Hearth limestone](../stone.md): honey cream stone, lavender-grey shade, small teal caps, shallow leaf and network carvings, sage moss on ledges, ochre roots lying over masonry. Gold belongs to active lume channels and the Order's brass fittings. A dormant channel retains its inset geometry and turns slate lavender. Keep masonry identical between states.

### Road kit

Numbers refer to `kit-road.webp`.

| No. | Piece | Footprint | Height | Assembly and use |
|---|---|---|---|---|
| 01 | Waystation | 12 × 10 | 9 | Arched shelter and a teal-roofed side bay. Put it on a widened platform beside the road, with independent support below. Keep both cart lanes clear. Crates and cart are context. |
| 02 | Toll arch | 7 × 3 | 8 | Frame across the deck, with a raised brass barrier. Keep at least 4 blocks of clear width and 5 of clear height. |
| 03 | Milestone | 1 × 1 | 3 | Worn marker at road edge. Broad network groove, no fine lettering required. |
| 04 | Broken parapet | 6 × 1 | 2 | Broken wall section. Ground rubble is optional dressing; keep it off the walking lane. |
| 05 | Road shrine | 4 × 3 | 5 | Leaf-carved niche and basin on a side platform. Dormant stone and a small restored light state. |
| 06 | Channel sleeve | 2 × 4 | 1 | Service fitting around the channel. Four blocks run along the road; recess the body so the walking surface remains flush. The actual light aperture stays about 0.4 blocks wide. Off and on views show the same piece. |
| 07 | Order lamp | 1 × 1 | 4 | Stone post, brass hood and amber glass, six-ray half-sun seal. Repeat on the lit stretch, with an unlit state available. |
| 08 | Deck landing | 7 × 6 | 2 | Landing and parapet opening only. Align its walking surface to the existing road deck at y=13. The pictured stair is connection context, not another stair model. |

Reuse the approved 12 × 7 × 14 road span, 8 × 8 × 15 stair, 6 × 6 × 30 pylon and 12 × 8 × 10 Order engine. Road kit dimensions are local dimensions above their mounting surface. The waystation's 10-block platform does not fit on a standard 7-block deck without widening it.

### Terrace kit

Numbers refer to `kit-terraces.webp`.

| No. | Piece | Footprint | Height | Assembly and use |
|---|---|---|---|---|
| 01 | Sentinel statue | 4 × 4 | 10 | Calm robed ancient figure with a broad leaf clasp. Its identity is unassigned. |
| 02 | Fallen head | 4 × 3 | 3 | Separate half-buried statue fragment with moss on its upper surface. |
| 03 | Broken hand | 5 × 3 | 2 | Fingers and wrist fragment beside a stair or colossus. |
| 04 | Root curtain | 10 × 2 | 8 | Hanging roots with a passage gap. Stone lintel is context; keep at least 3 × 3 blocks clear where people pass. |
| 05 | Carved panel | 6 × 1 | 4 | Shallow leaf/network relief and a scraped figure. Surface paint can carry most detail. |
| 06 | Wild garden | 10 × 8 | 2 | Low stepped planter, tangled roots and pale grasses. Grey before release; green after it. |
| 07 | Rootworks mouth | 14 × 5 | 14 | The approved Old Gate itself, not a second entrance. Closed round disk with three empty sockets at 10, 12 and 2 o'clock. Stair descends behind the threshold into the Rootworks and eventually the Stag's hall. |
| 08 | Root-broken coping | 6 × 3 | 3 | Heavy root pries apart capped stone blocks. Join to existing terrace walls. |

Reuse the approved 12 × 3 × 6 terrace wall, 10 × 12 × 6 stair, 30 × 10 × 8 fallen colossus and 16 × 4 × 7 giant-root envelope. Gardens and loose fragments add dressing without replacing these masses. The Stag's chamber remains underground; the exterior does not expose its arena.

### Far scenery kit

Numbers refer to `kit-far.webp`. These are proposed nominal source-space envelopes for painted silhouettes, not new playable terrain or surveyed geographical sizes. Small hero icons identify the scale convention; their drawn size on this sheet is not a scale ruler for mountains.

| No. | Piece | Footprint | Height | Direction and layer |
|---|---|---|---|---|
| 01 | Near ridge | 240 × 40 | 70 | Green foot, blue stone upper face; behind the 300-block far terrain. |
| 02 | Middle ridge | 400 × 60 | 140 | Blue mountain saddle, with an open western pass. |
| 03 | Far peaks | 700 × 80 | 240 | Pale lavender mountains around the valley, interrupted at sea openings. |
| 04 | Aukai high island | 180 × 100 | 100 | Jagged vegetated sea cliffs east across bright water. |
| 05 | Aukai low isle | 100 × 60 | 18 | Low reef shape and a sparse palm silhouette east. |
| 06 | Khetara dune ridge | 300 × 80 | 55 | Ochre dunes and red canyon base west through the pass. |
| 07 | Ring tower | 8 × 8 | 36 | Remote road-network silhouette. For playable valley pylons use the approved 6 × 6 × 30 model instead. |
| 08 | Far road arcade | 120 × 7 | 14 | Repeated distant arches that carry the road through the pass. |

The painted kit separates each mass so the builder can extract silhouettes and repaint edges. It is not an alpha atlas. Near trees remain the real trees' impostors from 62 to 288 blocks; far land remains sampled terrain out to 300. Put painted ridges behind that terrain, with their green feet matching it. Do not replace those systems with a foreground curtain or fog wall. Keep the Dawn north as the camera moves; do not let a following backdrop change its compass bearing.

## Defaults and open decisions

- Horizon distances beyond the valley are art proposals: Khetara 2–8 km west, Aukai 2–6 km east, sea 1–10 km south. They describe apparent depth, not traversal distances. The Dawn keeps the approved 120-block diameter, 60-block height and a viewing distance of 400 blocks or more.
- The horizon is a labelled 360-degree direction study. Its western ends show matching subject matter but are not pixel-seamless. Extract direction-specific ridges and islands, omit the foreground and label band, and blend the western overlap before runtime use. The supplied file is not a ready-made skybox.
- The broad world story places Khetara southwest and Aukai southeast relative to the Dawn. The local map and this brief put them west and east from Greenhollow; these local bearings govern this package.
- Statue identities, waystation locations, lamp spacing and toll operation are not assigned in the handbook. Defaults are unnamed statues, stations beside existing stair access, and lamps only on the active stretch. These are proposals for approval, not new quest rules.
- Dome bands wrap around a hemisphere; a single camera cannot show all six equally. Keep six bands in the model even where some seams are hidden by perspective. The ending view's clear band reveals towers, not an open doorway.
- A code-built prop still needs its own geometry, collision, draw-budget and day/night checks. These paintings do not establish runtime performance or authorize changes to terrain.

## Generation recipe

Built-in imagegen, with approved sheets supplied as image references. Shared direction: wide painterly gouache, grand Genshin-like horizons, warm upper-left light, honey limestone, lavender shade, restrained teal, sage moss, ochre roots, tiny traveller, broad readable forms.

The prompt set asks for: the complete west-dark/east-gold valley crossing; a northbound Old Gate approach beneath root-wrapped terraces; the six-band Dawn beyond a closed Order approach from the shrine; the westbound dormant pilgrimage road over recovered forest; a continuous W/N/E/S/W horizon with labelled provisional distances; eight numbered road objects; eight numbered terrace objects; and eight isolated far-scenery shapes. The three kit prompts specify every dimension in the tables above and ask for three-quarter views plus top footprints. The western vista receives one edit to move desert emphasis west and make the released band visibly thin.

## Verification

Every final WebP was opened after export and compared with the approved High Road and terrace sheets, the Dawn, engine and watch-post sheets, the shared stone notes, the four map pieces and the whole Greenhollow map. Checks cover material language, cardinal directions, the three-socket gate, road states, kit numbering and dimensions. Export checks require exactly the eight requested images, each 1600 pixels wide and below 600,000 bytes, with successful decoding. Only this folder is staged. Runtime checks do not apply to these unreferenced concept paintings.
