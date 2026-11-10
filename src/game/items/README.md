# items

The item table. It implements `ItemsApi`.

## What it exports

- `install(kernel)` from `index.sim.ts`. It adds `game.systems.items`.
- `get(id)` returns the `ItemDef`. It throws on an id that is not in the table.
- `all()` returns every `ItemDef`.

The data is `src/game/content/items.ts`, 27 items:

| Group | Ids |
|---|---|
| Resources | `oak_log`, `plank`, `fiber`, `moss_tuft`, `berry` (a treat), `wheat`, `wheat_seeds` (seed of `wheat`), `bread` |
| Tools, stack of 1 | `axe`, `hoe`, `watering_can` (tool kind `can`), `pickaxe` |
| Stations, stack of 9 | `workbench`, `bed`, `chest` |
| Blocks | `dirt`, `stone`, `cobble`, `oak_plank`, `lamp`, `glass`, `thatch`, `plaster`, `stone_brick`, `sand` |
| Story, stack of 1 | `almanac`, `river_lamp` |

Everything else stacks to 99.

## Two things to know

- `plank` places the oak plank block, and that block gives a `plank` back when it breaks. The recipes make only `plank`, so without this the player could not build with wood. `oak_plank` is still an item and places the same block.
- The manifest has no icon for dirt, sand, glass, plaster, cobble or stone brick. Those items use the `stone` icon and thatch uses `fiber`. When `def.block` is set, the interface can draw that block's tile from the block atlas for a better picture.

## Events

None.

## Wiring

```ts
import { install as installItems } from './items/index.sim.ts';
installItems(kernel);
const axe = game.systems.items.get('axe');
```

Install order does not matter. Nothing here is saved.
