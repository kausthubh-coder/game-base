# Crops

Implements `CropsApi` as `game.systems.crops`: tilled soil, water, and crops that grow in wet soil. The crops are data in `src/game/content/crops.ts`.

## What it exports

`index.sim.ts` exports:

- `install(kernel)`, which adds the system under the name `crops`.
- `createCrops(game)`, which returns `{ api, system, use }`. `use` is the click handler, in case you want to add it to the actions system yourself.

The API. Every coordinate is the soil block, and the crop is drawn one block above it.

| Call | What it does |
|---|---|
| `defs()` | Wheat, turnip and carrot. Only wheat has an item for its seed. |
| `till(x, y, z)` | Turns grass or dirt into `tilled_soil` and sends `soil.tilled`. False on any other block and where `region.isProtected` says so. |
| `plant(x, y, z, seed)` | Plants the seed's crop on tilled soil with air above it. It does not take the seed from the bag. The click handler does that. |
| `water(x, y, z)` | Wets the soil block and its 8 neighbors for 180 seconds. False when the block is not tilled soil. |
| `harvest(x, y, z)` | Puts a ripe crop in the bag and removes it. The soil stays tilled. False, with a toast, when the bag is full. |
| `at(x, y, z)` | The crop's `CropState`, or null. The object is live: the system changes it in place. |
| `all()` | Every crop as `{ x, y, z, state }`. It returns the same array on every call. |

The rules:

- Wheat has 4 stages, 0 to 3, and stage 3 is ripe. A stage takes 45 seconds in wet soil, so a watered seed is ripe after 135 seconds. Dry soil does not grow.
- One watering lasts 180 seconds.
- Rain waters every crop under open sky while `game.ambient.rain` is above 0.05. A crop under a roof or under leaves stays dry.
- On `slept`, every crop in wet soil gains two stages, and all soil is dry in the morning.
- A ripe wheat gives 2 `wheat` and, one time in three, 1 `wheat_seeds`. The chance uses `game.random()`.
- A crop comes out, and its seed goes back to the bag, when its soil block is broken (`block.broken`) or a block is placed on it or in place of its soil (`block.placed`).

The click handler:

- The secondary button with a hoe on grass or dirt tills it.
- The secondary button with a seed on tilled soil plants it and takes one seed.
- The secondary button with a watering can on tilled soil waters nine blocks.
- The primary button on a ripe crop harvests it. The held item does not matter.
- The primary button on an unripe crop is left to the next handler, so holding it breaks the soil and pulls the crop out.

The handler finds the hoe and the can by `items.get(id).tool.kind` (`hoe`, `can`).

## Events it sends

| Event | When |
|---|---|
| `soil.tilled { x, y, z }` | A block was tilled. |
| `crop.planted { x, y, z, crop }` | A seed went in. |
| `crop.watered { x, y, z }` | Once for each use of the can, at the soil that was aimed at. When that soil is bare and a neighbor holds a crop, the event names the neighbor, so `crops.at(x, y, z)` answers which crop was watered. Rain sends nothing. |
| `crop.grew { x, y, z, crop, stage }` | A crop gained a stage, by time or by sleep. Sleep sends one event with the final stage. |
| `crop.harvested { x, y, z, crop }` | A ripe crop went into the bag. |
| `toast { text: 'Your bag is full.' }` | A harvest did not fit. |

A harvest also adds to the number flag `harvested.<item>`, so `flags.get('harvested.wheat')` is the wheat grown so far. The end card can read it.

## Wiring

```ts
import { install as installTime } from './time/index.sim.ts';
import { install as installCrops } from './crops/index.sim.ts';

installTime(kernel);  // first, so crops read this step's rain
installCrops(kernel);
```

On its first step the system adds its click handler to `game.systems.actions`. It listens for `slept`, `block.broken` and `block.placed`, and reads `game.ambient.rain`. It calls `inventory.add` and `inventory.remove`, `items.get`, and, when they exist, `region.isProtected` and `placeables.at`.

The save holds every crop (place, kind, stage, seconds grown, seconds of water) and every wet soil block. The world save holds the tilled blocks.

A view draws `crops.all()` each frame. `state.stage` picks the picture, `state.ripe` marks it for harvest and `state.wet > 0` means dark soil.
