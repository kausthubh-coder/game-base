# nav

Path finding for anything that walks. It implements `NavApi`.

## What it exports

| File | Export | What it is |
|---|---|---|
| `index.sim.ts` | `install(kernel)` | Adds the system as `game.systems.nav` |
| `index.sim.ts` | `createNav(game)` | The same system without a kernel. It returns `{ api, system, cached() }`. |
| `nav.sim.ts` | `findPath`, `search`, `canStand`, `floorAt`, `nearestStand`, `DEFAULT_LIMIT` | The search as plain functions over a `World` |
| `walk.sim.ts` | `walkAlong(world, pos, walker, speed, dt)` | Moves a position along a path at an even speed. People and pets use it. |
| `stage.testkit.ts` | `makeStage`, `flatWorld`, `wall`, `feet` | A flat test land with fakes for region, interact, talk, inventory, items and actions. Only tests import it. |

## The api

- `path(from, to, limit = 4000)` returns block centers from the start block to the goal block, or null. A point's `y` is the height of the feet.
- `toward(from, to, limit)` returns the same when a path exists. When none exists, it returns the path to the closest block the search reached.
- `route(fromPlace, toPlace)` returns the path between two places of the region and keeps it. The way back is kept too. Do not change the array.
- `near(at, radius, skip?)` returns the center of the nearest block to stand on, or null.
- `standable(x, y, z)` is true when the block under is solid, the two blocks above are free, and neither holds water.

## The rules of a path

- A step goes to one of the eight neighbors.
- A step goes up or down one block at most. A step up needs head room above the block the walker leaves.
- A diagonal step stays level, and the two blocks beside it must both be free. No corner is cut.
- Water is not walkable.
- Land that is not loaded is air, so no path crosses it.
- The search stops after `limit` blocks and `path` returns null.

## Events

It sends none. It hears `block.placed` and `block.broken`. A change drops the kept routes that pass within one block of it, and every route that was not found. A route that was not found is also tried again after 20 seconds.

## Wiring

```ts
import { install as installNav } from './nav/index.sim.ts';

installNav(kernel);                      // any time before the first step
const nav = kernel.game.systems.nav;
const path = nav.path(from, to);         // Vec3[] | null
const route = nav.route('town.square', 'river.bank');
```

It needs `game.world` and `game.events` when installed. `route` calls `game.systems.region.place(name)` when somebody asks for a route, so the region must be installed before the first step. Nothing is saved.

## Contract changes

`NavApi` in `api.sim.ts` gained `toward`, `route` and `near`. A fake of `NavApi` in another system's tests needs them, or a cast.
