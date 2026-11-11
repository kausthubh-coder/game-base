# region

The land of the first part: the grant, the mossy rocks, the dead garden, the path and Hollowmere. It implements `RegionApi` as `game.systems.region`.

## How the land is made

The plan is data in `src/game/content/region.ts`: a vale of gentle ground from the dead garden to the town, level ground, a river basin, the path, boxes of blocks, buildings, trees, bushes, places. The terrain (`src/features/world/terrain.sim.ts`) reads that plan while it makes each chunk, so the page and the worker make the same blocks. Trees are model entities owned by `src/game/trees`; terrain stamps only their invisible root barriers. This system writes no blocks. It answers questions about them and runs the berry bushes.

The plan is laid out on the land of world seed 1, which is the seed the game uses. Another seed gets the same plan at the same coordinates on its own land. Every place can still be stood on, but the river and the hills are somewhere else.

The camera starts south-east of the hero and looks north-west. So tall things stand north and west of where people act: the oaks over the mossy rocks, the trees by the grant, the houses around the square. Doors face south or east. Keep that when you move something.

To move something, change its numbers in `content/region.ts`, then run `bun tools/play-region-map.mjs` and look at `.artifacts/play/region-map.png`.

## Hollowmere's layouts

Hollowmere is `content/town/b.ts`, the Hollow Oak on its Lantern Green. Two other layouts are kept to look at: `now.ts`, the first town, built of blocks, and `a.ts`, the Queen's Granary. `?town=now` picks one on the page, `VITE_TOWN=now` sets a build's default, and `town/pick.ts` says how the chunk worker learns it. Run the tests of a layout with `VITE_TOWN=now bun run check`. The table of places below gives the first town's coordinates; ask `region.place(name)` for the ones in use.

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
