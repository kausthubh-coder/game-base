# region

The land of the first part: the grant, the mossy rocks, the dead garden, the path and Hollowmere. It implements `RegionApi` as `game.systems.region`.

## How the land is made

The plan is data in `src/game/content/region.ts`: a vale of gentle ground from the dead garden to the town, level ground, a river basin, the path, boxes of blocks, buildings, trees, bushes, places. The terrain (`src/features/world/terrain.sim.ts`) reads that plan while it makes each chunk, so the page and the worker make the same blocks. Trees are model entities owned by `src/game/trees`; terrain stamps only their invisible root barriers. This system writes no blocks. It answers questions about them and runs the berry bushes.

The plan is laid out on the land of world seed 1, which is the seed the game uses. Another seed gets the same plan at the same coordinates on its own land. Every place can still be stood on, but the river and the hills are somewhere else.

The camera starts south-east of the hero and looks north-west. So tall things stand north and west of where people act: the oaks over the mossy rocks, the trees by the grant, the houses around the square. Doors face south or east. Keep that when you move something.

To move something, change its numbers in `content/region.ts`, then run `bun tools/play-region-map.mjs` and look at `.artifacts/play/region-map.png`.

## Greenhollow, the whole map

The first part sits inside the plan of all of Greenhollow (`src/game/content/greenhollow.ts`, 800 by 600 blocks,
game x -420 to 380 and z -538 to 62). Inside that map the terrain asks `greenhollow-land.sim.ts` for the ground,
and eases into its own noise land over 48 blocks outside it, where mountains rise past what a chunk holds (the far
land draws them; a chunk stops at 50). A column is shaped in this order:

1. The kinds of land blended (`landShares`): meadow downs, the Old Forest's hollows, the marsh at the water line,
   the cave hills' rock shelves; then the ridges (`RIDGES`), the Hall's hill (`HALL_HILL`) and the terraces' four
   steps (`TERRACES`, with a ramp up the stair corridor).
2. The region plan's vales and knolls (`shapeRise` in `land.sim.ts`).
3. The Mere along `RIVER`: valley, bank, bed. Above `RIVER.falls` its water stands at `RIVER.high` in a gorge
   (`waterLevelAt`), and drops over a cliff to the valley. The High Road's corridor is held under 23.5.
4. The plan's paths, graded to a slope a hero can walk (`MAX_SLOPE`); over water they are planks.
5. A level pad under each landmark (`LANDMARK_SIZES`), and a bank of land behind a door that has `back`.
6. The region plan's levels and basins (`shapeLevel`): the plot, the garden and the town keep their exact ground.

`stampGreenhollow` writes the invisible blocks: the High Road's deck at `DECK_Y` with low walls and piers, its
stairs, and two blocks of barrier over each landmark you cannot walk through. `landmarkSites()` lists every model
set down (the plan's `LANDMARKS`, the arches, pylons, stairs, terrace faces and boardwalks), and
`src/game/views/world-landmarks.view.ts` draws them; a model not yet in `src/content/props.ts` is skipped, and
`?landmarks=boxes` shows a box in its place. Every place of the plan is a place of this system by its id
(`teleport('caves')`, `?at=caves`, `?at=x,z`), stood in front of its landmark. The spots the quests name under an
older place are there too (`plot.pond`, `town.green`), and `saltgate` stands where the south road leaves the map; a
spot not laid out yet (`saltgate.yard`) stands at its place.

To judge a change: `bun tools/land-relief.mjs` draws the map from above (`.artifacts/land/relief.png`),
`bun tools/painted-shots.mjs --views greenhollow` shoots the ten places, `bun tools/land-costs.mjs` flies the bench
and reads `costs()` at each, and `bun test src/game/region/greenhollow.test.ts` walks the map from your plot.

## Hollowmere, the city

Hollowmere has grown into a city round the Hollow Oak's town (`content/town/city.ts`), from the approved plan in
`assets-src/concept/region-hollowmere/plan.webp`, fitted to the land: the river bends round the west and south of
the town, so the city grows north and east, about 180 by 130 blocks built and six edge fields east of that. The
old town of `b.ts` (the nucleus, `NUCLEUS`) is kept as it was, except that the granary is now the city kit's B10
in the old granary-hall's place, with the same door. Round it:

| District | Where | What |
|---|---|---|
| The civic heart | North of the main street | The granary (`granary`, `town.granary`), Civic Street, the Queen's Hall (`town.hall`) |
| The chapel quarter | North | The Order's chapel (a plan landmark) on its square with a well (`town.chapel`), Chapel Street out to the north road |
| The market | East of the old town | The market square, two rows of stalls and the fountain (`town.market`); Market Street on to the fields |
| The quay | South-east, on the river | The promenade, two warehouses, docks, boats, a crane (`town.quay`) |
| The artisans | South-east | The wheelwright's yard (`town.wheelwright`), the lamp house (`town.lamphouse`), workshops |
| The mill | West of the hedge | The working mill on a race from the Mere (`town.mill`) |
| Homes | Everywhere else | Every street's frontage filled from a palette by district, then the backs of the blocks |
| The fields | East | Six fields (`CITY_FIELDS` in `content/greenhollow.ts`, `town.fields`), each with one of the Order's pumps |

The streets and the big buildings are placed by hand; the houses by a fixed random, so the page, the worker and a
test make the same city, and a building placed by hand on taken ground throws. Each building is two blocks of
barrier over its footprint. `src/game/views/world-city.view.ts` draws them: the near ones whole inside
`cityTriangles` and `cityReach` (`src/content/quality.ts`), the rest as plain roofed blocks, the street pieces
merged by cell within `cityPieceReach`. `bun tools/painted-shots.mjs --views city` shoots four views of it.

## The story on the land

`story.sim.ts` turns the shared flags into what the land shows, and the region writes it every step as flags of its
own: `road.relit` (scene 23 until the ledger is full), `land.pumps` (6, fewer as the ledger's four sections fill),
`land.healed` (fight 12 won) and `land.green` (how far your plot greens round tended ground, 3 plus 2 a Heartstone
level). `blightAt(x, z, relit, healed, pumps)` reads them; the painted land, the landmarks and the city follow them.
The scenario `land-follows-the-story` plays it.

## Hollowmere's layouts

Hollowmere's old town is `content/town/b.ts`, the Hollow Oak on its Lantern Green, and the city grows round it. Two other layouts are kept to look at: `now.ts`, the first town, built of blocks, and `a.ts`, the Queen's Granary. `?town=now` picks one on the page, `VITE_TOWN=now` sets a build's default, and `town/pick.ts` says how the chunk worker learns it. Run the tests of a layout with `VITE_TOWN=now bun run check`. The table of places below gives the first town's coordinates; ask `region.place(name)` for the ones in use.

A and B are built from the Hollowmere town kit (`src/content/town-kit.ts`, made by `tools/models/town.mjs`). A layout sets kit models down with `modelAt` in `content/town/kit.ts`. `land.sim.ts` turns each one's solid cells into two blocks of invisible barrier, and a model can give a place at its doorstep, as a building of blocks gives one at its door. `src/game/views/world-town.view.ts` draws the models. Nobody can walk into a kit building, so its quest places are the doorsteps. Keep three blocks of open ground in front of a door: the nav keeps one block of room around a barrier, so a narrower way is closed to it.

## What it exports

| File | Export | What it is |
|---|---|---|
| `index.sim.ts` | `install(kernel)` | Adds the system as `game.systems.region` |
| `index.sim.ts` | `createRegion(game)` | The same system without a kernel. It returns `{ api, system }`. |
| `index.sim.ts` | `REGROW_SECONDS`, `BUSH_REACH` | 120 seconds and 1.8 blocks |
| `land.sim.ts` | `shapeGround`, `shaped`, `onPath`, `treeAllowed`, `stampStructures`, `BOUNDS` | What the terrain calls. Pure functions of the plan. |
| `land.sim.ts` | `built()`, `regionProps()`, `scatterBlocked(x, z)`, `clearing(x, z)` | The stamped buildings with their doors, every prop, where nothing is scattered, and how open the plan keeps a place |
| `tree-spots.sim.ts` | `isTreeSpot(seed, x, z)` | True for the one column of a 3 by 3 square where the props scatter may stand a tree |

`land.sim.ts` is the only file here that uses `src/content/blueprints.ts` and `src/features/buildings`.

## The api

- `spawn()` is two blocks north of the standing stone. `spawnFacing()` is `Math.PI`, which faces south to the stone.
- `places()` and `place(name)` give `{ name, at, label }`. `at` is the middle of a block, with `y` the height of the feet. `place` throws for a name it does not know, and the message lists the real names.
- `grant()` is `{ x: -30, z: -248, width: 28, depth: 28 }`.
- `isProtected(x, y, z)` is true inside the town's bounds (x 131 to 206, z -192 to -118), inside the plan's `sealed` rectangles (the court of Ilara's Hall, x -25 to -9, z -265 to -253) and on every column of the path, at any height. It is false in the grant and in the wild.
- `berryBushes()` returns the ten bushes as `{ id, x, y, z, ripe }`. They are the same objects on every call, and `ripe` changes in place.
- `props()` returns every prop to draw as `{ kind, variant, x, y, z, rotation, scale, quarterTurns, building }`. The first seven fields are the arguments of the props feature's `place`. The list holds the doors, windows, signs and furniture of the ten buildings, then a signpost, a gate, two benches and two stalls that stand alone.
- `scatter()` returns `{ density: 1, blocked(x, z), forest(x, z) }`, the options of the props feature's `scatter`.
  - `blocked` is true where nothing is scattered: the whole grant, the path and one block either side of it, the town, the dead garden's beds and ruin, and where the plan put a tree, a bush or a rock.
  - Around the sites `blocked` is also true for one column in nine: the column of each 3 by 3 square where the scatter would stand a tree. So no scattered tree grows within 10 blocks south or east of the grant, around the garden, by the town or within 6 blocks of the path, and the grass and flowers stay. The props scatter omits its tree shapes; cuttable model trees use the terrain distribution instead. `tree-spots.sim.ts` holds a copy of the scatter's hash for this, and the region test runs the real scatter to check that the copy still matches.
  - `forest` says the same in the scatter's own terms: the terrain's forest (`forestAt` in `terrain.sim.ts`), falling to 0 around the sites. The dressing view does not pass it to the scatter today. If it did, scattered woods would stand where the block woods stand.
- `townCenter()` is `{ x: 170, z: -158, radius: 46 }`.

The last five are optional in `RegionApi`, so a fake without them still fits. This system always has them.

## Places

Feet positions at seed 1. All of them are out of doors except `granary`, which is the barn's open doorway.

| Name | x, y, z | What is there |
|---|---|---|
| `grant.stone` | -2, 22, -221 | The first block of the path, one east of the standing stone |
| `grant.center` | -16, 22, -234 | The middle of the plot |
| `grant.rocks` | 8, 22, -228 | Open ground south-east of the pool. The mossy stones are north and west of it under three oaks. |
| `dead.garden` | -79, 21, -232 | Between the four dry beds |
| `shut.door` | -17, 22, -251 | Two blocks south of the stone door of Ilara's Hall |
| `hall.door`, `hall.heart`, `hall.custodian`, `hall.gate`, `hall.mural` | inside the court | The threshold, the Heartstone, the plinth, the Gate and the mural. They have no label, so the map does not show them. |
| `town.gate` | 134, 20, -174 | On the path between the two gate lamps |
| `town.square` | 173, 20, -144 | Six blocks south of the well, so nobody who stands near it lands on the well's rim |
| `lodge` | 161, 20, -162 | The doorstep, on the north side of the square |
| `bakery` | 172, 20, -162 | The doorstep, on the north side of the square |
| `granary` | 155, 20, -177 | The barn's doorway, on the main street |
| `carpenter` | 155, 20, -154 | The doorstep, on the west side of the square |
| `gus.field` | 193, 20, -149 | The west edge of the tilled field, on the town's east side |
| `kennel` | 193, 20, -166 | Outside the gap in the yard's fence |
| `river.bank` | 173, 20, -131 | The stone quay. Water starts three blocks south. |
| `ferry` | 196, 20, -125 | On the plank dock |

## Berry bushes

Six stand around the dead garden and four beside the path. Each is an Interactable with the id `bush:<n>`, a reach of 1.8 blocks and the prompt `Pick berries`. Picking adds 1 or 2 `berry` to the bag, chosen with `game.random()`, and the bush is bare for 120 seconds of game time. A bare bush has no prompt. When the bag takes nothing, the bush keeps its berries and a toast says "Your bag is full."

The bushes join the interact system on the first step, because interact is installed after the region. `save()` returns `{ bare: number[] }`, the seconds each bush has left. After `slept`, every bush has berries.

## Events

It sends `toast` when the bag is full. The bag sends `item.gained` with `at` set to the bush. It hears `slept`.

## Wiring

```ts
import { install as installRegion } from './region/index.sim.ts';

installRegion(kernel);                 // after items and inventory, before anyone asks for a place
const region = kernel.game.systems.region;
const start = region.spawn();
const lodge = region.place('lodge').at;
for (const p of region.props?.() ?? []) props.place(p.kind, p.variant, p, p.rotation, p.scale);
```

It needs `game.world.seed` at install, to find the ground under each bush. It reads `inventory` and `interact` in its steps.

## Tests

`bun test src/game/region src/features/world`. The region test loads the whole region once, installs the real nav, bag and interact systems on it, and prints how long a chunk takes to make.
