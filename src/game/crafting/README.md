# Crafting

Implements `CraftingApi` as `game.systems.crafting`. The recipes are data in `src/game/content/recipes.ts`.

## What it exports

`index.sim.ts` exports:

- `install(kernel)`, which adds the system under the name `crafting`. It has no step and saves nothing.
- `createCrafting(game)`, which returns the `CraftingApi` alone.

The API:

| Call | What it does |
|---|---|
| `recipes()` | Every recipe, in the order of the data file. |
| `available()` | The `hand` recipes, plus those whose station stands within 5 blocks of the player. It returns the same array on every call, so copy it if you keep it. |
| `canMake(id)` | True when the recipe is available and the bag holds every input. |
| `make(id)` | Removes the inputs, adds the output and sends `item.crafted`. It returns false and leaves the bag as it was when an input is missing, the station is too far, the id is unknown or the output does not fit. |

The recipes, with the item ids from `src/game/content/items.ts`:

| Recipe id | Station | Needs | Makes |
|---|---|---|---|
| `plank` | `hand` | 1 `oak_log` | 4 `plank` |
| `workbench` | `hand` | 4 `plank` | 1 `workbench` |
| `bed` | `workbench` | 6 `plank`, 3 `fiber` | 1 `bed` |
| `chest` | `workbench` | 8 `plank` | 1 `chest` |
| `lamp` | `workbench` | 1 `plank`, 1 `moss_tuft` | 1 `lamp` |

Odo gives the river lamp at the festival, so it has no recipe.

## Events it sends

- `item.crafted { id, count, station }` after each successful `make()`. `id` and `count` describe the output.
- `toast { text: 'Your bag is full.' }` when the output does not fit.

The bag sends `item.gained`, `item.lost` and `inventory.changed` itself.

## Wiring

```ts
import { install as installCrafting } from './crafting/index.sim.ts';

installCrafting(kernel); // any place in the order: it has no step
```

It calls `game.systems.inventory` (`count`, `remove`, `add`) and `game.systems.placeables.near(station, player.pos, 5)`, and only inside its API methods. A crafting panel calls `available()` to list recipes, `canMake(id)` to grey a row out and `make(id)` on a click.

`fakes.ts` in this folder holds test stand-ins for the bag, the item table, the stations and the click handlers. The crops and time tests use it too.
