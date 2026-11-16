# Greenhollow, the whole map

Kausthubh, 2026-11-12, on the map of handbook chapter 26 (`~/dev/sandbox/game-look-test/design/26-map-of-greenhollow.md`):
"all the rest: walking around, assets, terrain and stuff for the new map we decided on. I want it to actually
look good and complex." Today the game holds a small part of it: your plot, the road, the dead garden and
Hollowmere, in the painted look (`docs/painted-world.md`). This branch builds the rest of the map as a place
you walk, in the same look, with every kind of land, landmark and ruin act 1 needs.

Branch `world/greenhollow`, cut from the fight lab (`lab/fight`, which he has played) with `main` merged in.
Nothing goes to `main` or `playtest` until he has walked it and said yes.

## What done looks like

1. You can walk from your plot to every place of the map: the Hall, the High Road, the grey forest and the
   boar, the terraces and the Old Gate, the root caves and the Lamp Gallery, Hollowmere and its chapel, the
   landing, the marsh and the Pump House, the Old Forest and the Seed Vault, six shrines and five ruins.
2. Each kind of land looks like itself from far off and close up: you know where you are from one screenshot.
3. Every landmark is a model in the painted look, not blocks with pixel textures.
4. The budgets hold (`docs/fast-everywhere.md`): at high, 150 draw calls and 400,000 triangles; at low, 80
   and 150,000, measured with `/?bench` and `window.__game.costs()` at the fixed places below.
5. A tester has walked it like a person and its bugs are fixed or filed in `docs/bugs/`.

The fights stay in the fight lab's own scenes for now. The plan marks where each of the twelve happens
(`FIGHTS`), so a later stage can put them in the world.

## The plan is data

`src/game/content/greenhollow.ts` is the map as data, in the map's own units (800 by 600, one unit a block, the
playthrough site's numbers): the kinds of land as outlines, the river Mere, the High Road, the paths, every
place, the fights and which landmark model stands where. `toWorld` turns a map point into a game column; your
plot, the dead garden and Hollowmere keep their game columns.

`src/game/region/greenhollow.sim.ts` answers questions about a column: `biomeAt`, `biomeMix`, `blightAt`,
`riverBank`, `highRoadDistance`, `highRoadLit`, `placeAt`. These signatures are the contract between the
helpers below. The land's helper may make them faster or change the plan's numbers so the land fits (a place
moved up to 30 blocks, an outline redrawn), and says so in its report. Nobody else edits either file.

`src/game/region/greenhollow.test.ts` holds the plan to the map: each place on its kind of land, the plot dry
and 80 blocks south of the High Road, grey under the lit road.

## The kinds of land

| Kind | Where | Ground and grass | Trees and small things | Air |
|---|---|---|---|---|
| `meadow` | Everywhere else: the middle, the south | Today's painted meadow | Today's oaks and birches in groups, flowers, rocks | Today's |
| `oldForest` | The west, past the dead garden | Darker, mossier, ferns under the trees | Old oaks twice today's size, close together, roots above ground, fallen logs, mushrooms, honeybees | Shafts of light through gaps, green shade |
| `greyForest` | A band north of the High Road, widest in the east | Grey-green and dry, grass short and pale | The same oaks with the colour gone: grey bark, ashen leaves. Nothing flowers | Ash-like flecks rise and vanish (the story's grey: "Still") |
| `marsh` | The south-east, below the town | Wet mud, standing pools, lily pads | Reeds, willows, bulrushes, stepping stones | Low mist at dawn; lanternflies at night |
| `caveHills` | The north-east, beyond the river | Rock shelves, thin turf, scree | Crystals in clefts, hardy pines, boulders, the cave mouth | Cool and clear |
| `terraces` | The far north, inside the grey forest | Giant stone steps, each 6 blocks high, wrapped in roots as thick as a cart | Roots, grey moss, broken statues | The Dawn's gold on the horizon behind them |
| `town` | Hollowmere | As built today | As built today | As built today |

`blightAt` says how grey a column is from 0 to 1. Grey is a mix, not a switch: the edge of the grey forest pales
over 24 blocks, and the land under the lit stretch of the High Road is grey up to 40 blocks south of it.

## The landmarks

Kausthubh, 2026-11-12: "I want 3D assets and terrain to be good and on a grand scale, do more 3D assets. I don't
want just a village. We can plan more with 2D assets for reference, and then give that to Astra to build, so we
can build something good." So every model is painted first, and built from its painting.

**Grand scale** means the ancients built for giants and the land is bigger than you: arches 14 blocks high,
pylons you see from anywhere in the valley, a statue as long as a street lying on the terraces, roots as thick
as a cart, a waterwheel taller than a house. The hero is about 1.8 blocks tall. Every sheet shows the hero beside
the model.

Each model is a prop in `src/content/props.ts` with the group `landmark` (6,000 triangles at most) and a builder
in `src/features/props/builders/`. `LANDMARKS` in the plan says where each stands; the land's helper places the
ones the plan does not list yet (pylons, fallen spans, boulders, the colossus). Sizes are blocks, width by depth
by height, roughly.

| Group | Model key | What | Size |
|---|---|---|---|
| 1. The High Road | `highRoadArch` | One span: two piers, the arch, the deck with low walls, the channel down its middle. Variants `dark`, `lit` (the channel glows gold), `broken` (one pier fallen). Spans join end to end | 12 × 7 × 14 |
| | `roadStair` | A stair tower against the road where a path climbs to the deck | 8 × 8 × 15 |
| | `roadPylon` | A tall carved tower beside the road every 100 blocks or so, that once carried the ancients' network; a dead crystal at its top, gold where the road is lit | 6 × 6 × 30 |
| | `fallenSpan` | Pieces of a collapsed span lying in a river or among trees | 14 × 8 × 5 |
| 2. The terraces | `terraceWall` | One face of a giant step, 12 wide and 6 high, carved stone with roots spilling down. Faces join side by side | 12 × 3 × 6 |
| | `terraceStair` | A grand flight of steps from one terrace to the next | 10 × 12 × 6 |
| | `oldGate` | The round gate at the foot of the terraces, three empty sockets, roots across it | 14 × 5 × 14 |
| | `colossus` | A giant stone figure of one of the king's friends, fallen and half buried, its face turned up | 30 × 10 × 8 |
| | `giantRoot` | A root as thick as a cart, arching out of the ground and back. Variants `arch`, `low`, `curl` | 16 × 4 × 7 |
| 3. Sacred places | `hallDoor` | The stone door of Ilara's Hall in a hill face: a carved frame, the door, worn steps, roots over the top | 9 × 3 × 8 |
| | `shrine` | A small round shrine with a basin of light. Variants `dormant`, `restored` | 5 × 5 × 5 |
| | `waystone` | A tall carved stone that wakes when you touch it | 2 × 2 × 4 |
| | `standingStones` | A ring of old standing stones on a hill | 14 × 14 × 5 |
| 4. Water | `pumpHouse` | A great brass waterwheel turning in the river (a separate part that turns) and the stone house on its bank | 22 × 16 × 16 |
| | `weir` | An old stone weir across the river, water spilling over it | 24 × 4 × 4 |
| | `oldMill` | A ruined mill with a still wheel, north of the town | 10 × 8 × 9 |
| | `jetty` | The landing: a plank jetty on posts, a mooring post, a lamp | 4 × 12 × 3 |
| 5. The Order | `chapel` | The Order's small white chapel with a gilded half dome and a bell | 10 × 14 × 13 |
| | `orderPump` | The brass root pump that stands in every field round Hollowmere, a ring of grey grass round it | 3 × 3 × 4 |
| | `orderEngine` | The Order's gold machine on the High Road, switching the road back on, one stretch at a time | 12 × 8 × 10 |
| | `watchPost` | A small stone watch tower by the lit road, a gold seal on its door | 6 × 6 × 10 |
| | `dawnDome` | The golden dome on the northern horizon with a city's outline under it, seen from 400 blocks and more | 120 across |
| 6. Ruins | `sunkTower` | A broken round tower, half sunk, one room inside | 8 × 8 × 12 |
| | `forestStair` | Old stone steps going down into the ground and stopping | 6 × 10 × 3 |
| | `muralWall` | A stretch of old wall with a painted mural, one figure scraped off | 16 × 2 × 6 |
| | `deadCottage` | The dead garden's ruined cottage, roofless, one wall standing high | 9 × 7 × 6 |
| | `colonnade` | A row of broken columns, some fallen, half in the grass | 18 × 6 × 8 |
| 7. Ways down | `galleryMouth` | The Lamp Gallery's door: a dark arch with dead lamps either side | 10 × 6 × 10 |
| | `caveMouth` | The root caves' mouth in a rock face, roots hanging over it | 10 × 6 × 8 |
| | `vaultRoots` | The Seed Vault's door under a roof of living roots, Calla's gold seal on it | 14 × 12 × 10 |
| | `crystals` | A cluster of pale crystals growing from rock. Variants `small`, `large` | 3 × 3 × 4 |
| 8. Set pieces of the land | `rockArch` | A natural arch of rock you can walk under | 16 × 6 × 12 |
| | `boulders` | Big mossy boulders. Variants `one`, `pair`, `pile` | 6 × 6 × 5 |
| | `fallenGiant` | A fallen giant oak, hollow, that you can walk through | 24 × 5 × 5 |
| | `stiltHut` | A marsh hut on stilts with a boardwalk to it | 8 × 8 × 8 |
| | `boardwalk` | Plank walkway on posts over the marsh. Joins end to end | 2 × 8 × 1 |

### Painted first

A Sol helper paints a concept for each model before it is built: one painted sheet with a three-quarter view,
the front and the side, the hero beside it for scale, in the painted world's style and light (soft, warm,
Genshin-like, the palette of `public/assets/painted/` and the town's kit). Sheets go in
`assets-src/concept/<group>/<key>.webp`, about 1600 wide, and a vista of the group in place at
`assets-src/concept/<group>/vista.webp`. The coordinator looks at each set before its Astra helper starts, and
shows them to Kausthubh.

## Who builds what

One helper a slice. Each works in its own worktree on its own branch, fast-forwarded to `world/greenhollow`
first, and never edits a file another slice owns. A file several slices add to (`src/content/props.ts`,
`src/features/props/builders/index.ts`) takes each helper's lines in one block at its end, under a comment with
the slice's name; the coordinator joins the blocks at the merge.

| Slice | Who | Branch | Owns |
|---|---|---|---|
| The land | Opus | `world/land` | `src/features/world/terrain.sim.ts`, `src/game/region/`, `src/game/content/region.ts` and `greenhollow.ts`, the far land's heights, `src/features/map/`, `tools/land-relief.mjs`, placing the landmarks |
| The kinds of land | Opus | `world/biomes` | `src/features/painted/`, `src/content/painted.ts`, `src/content/land.ts`, small natural props in `builders/wilds.ts` |
| The paintings | Sol | `world/paintings` | ground, bark and leaf textures in `public/assets/painted/` |
| Concepts, groups 1 and 2 | Sol | `world/concept-1` | `assets-src/concept/1-high-road/`, `2-terraces/` |
| Concepts, groups 3 and 4 | Sol | `world/concept-2` | `assets-src/concept/3-sacred/`, `4-water/` |
| Concepts, groups 5 and 6 | Sol | `world/concept-3` | `assets-src/concept/5-order/`, `6-ruins/` |
| Concepts, groups 7 and 8 | Sol | `world/concept-4` | `assets-src/concept/7-ways-down/`, `8-set-pieces/` |
| Models, one group each | Astra | `world/models-<n>` | `src/features/props/builders/group-<n>.ts` and its entries |
| Walk and measure | Sol | `world/test` | `docs/bugs/`, `.artifacts/world/`, a walk script in `tools/` |

The kinds of land need the land to look at. Until the land merges, its helper reads `biomeAt` (which works now)
and looks at each kind where the plan already puts it, on today's terrain.

### The paintings

The kinds of land use these, made in the style of the twelve paintings already in `public/assets/painted/`
(`docs/assets.md`): `bark-grey.webp`, `bark-old.webp` (bark), `leaves-grey.webp`, `leaves-old.webp`,
`leaves-willow.webp` (leaf cards), `reeds.webp`, `fern.webp` (cards), `moss.webp`, `mud.webp`, `scree.webp`,
`terrace-stone.webp` (ground and stone). Until they land, the kinds of land's helper uses the existing
paintings tinted, and reads the new names when the files exist.

## Order

1. Stage 1, at once: the land, the kinds of land, the paintings, and the four concept slices.
2. As each concept set lands and the coordinator has looked at it, an Astra helper builds that group.
3. The coordinator merges one branch at a time, with `bun run check` and `bun run lint` after each.
4. Stage 2: the walk and measure tester plays the merged branch. Fixes follow.
5. He walks it, on a Tailscale link served from this worktree's build.
6. Later, his call: the fights in the world at their places, sound by place, waystones.

## Places to judge it from

`bun tools/painted-shots.mjs` takes pictures from fixed places. The land's helper adds these to it: your plot
looking north to the High Road; the oak shrine looking at the plot; the bridge looking at the town; the boar's
clearing in the grey forest; the Old Gate from the north path; the cave mouth; the Pump House from the quay
path; the marsh shrine looking south to the sea; the Seed Vault in the Old Forest; and the terrace shrine looking
north to the Dawn. Each at noon and at dusk, at high and at low.

## His decisions

- The two looks of the grey forest. The kinds of land's helper makes two behind `?grey=a` and `?grey=b`: `a`
  the same oaks with the colour drained, `b` the oaks dying, with thinner crowns and bare branches. He picks.
- Anything the land's helper moves more than 30 blocks from the map.

## Dressing the regions

Each kind of land has an approved kit (`assets-src/concept/region-*`). What exists as a prop is set down as
`DRESSING` in `src/game/content/greenhollow.ts`: small things laid on the land as it is, with no level ground and no
barrier. What still needs a model, by kit:

| Region | Dressed with what exists | Still needs a model |
|---|---|---|
| The marsh (south-east M01 to M12) | A second stilt hut out on the reeds with its boardwalk, a fisher's camp (net rack, skiff, barrels), lantern posts along the boardwalk (the city lamp), a rotting pier (dock pieces) | Shallow pool, mud bank, reed bed, eel trap, the marsh lantern post (M09), fishing rack (M10) |
| The river works (south-east R01 to R12) | The weir and its water, the Pump House and its turning wheel | Sluice gate, channels and bends, brass pipes, gearshaft stand, keeper walkway, lever plinth, floodable channel, quay edge, chute and rope bin |
| The caves (south-east C01 to C12) | Crystals in the clefts on the way up and round the Lamp Gallery, a delver's camp (tent, cold fire, crates, a cart) | Cave walls, corners, vaults and floors, stalagmites, root curtain, glow moss, delver support, delver equipment (C10), chasm bridge |
| The Old Forest and the grey (forests 01 to 28) | Old gate posts round the forest stair and the vault (broken pillars), fallen logs, stumps, Wren's camp by the boar's clearing (tent, fire, bedroll) | The five painted oaks (01 to 05), hollow trunk, root fan, moss mound, fallen branch, forest rocks, hanging vines, bee tree, half-buried wall, statue in roots, forest shrine ring, dead brush, ash drift, beast den, Wren's lean-to (28) |
| The north (road, terraces, far) | Broken pillars on the terraces; the stairGap arch where the dark stair meets the deck | A lit stairGap arch for the stair on the lit stretch, waystation, toll arch, milestone, broken parapet, road shrine, channel sleeve, the Order's lamp (07), deck landing; sentinel statue, fallen head, broken hand, root curtain, carved panel, wild garden, root-broken coping; the far ridges and Aukai, Khetara and the far arcade |
| Home (01 to 26) | An old fence on the field's west side, the signpost where the roads part | Grass patch and wildflowers in two states, brambles, field edge, hedgerow, dry-stone wall, stile, gate, berry bush in two states, pond rim, road edge, mile stone, plank bridge, wheel ruts, puddle, landing shed and ramp, dry bed, trellis, old well, fox den, garden wall and gate ruins |
| Hollowmere | All 16 buildings of the city kit, its street and quay pieces | The modular parts (`cityPart*`) are built but not used yet: every building is its whole model |
