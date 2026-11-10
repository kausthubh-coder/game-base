# Creatures

One engine runs every kind of creature from its entry in `src/game/content/creatures.ts`. A new creature is a new entry there. The engine names no kind.

## Exports

`index.sim.ts`:

- `install(kernel: Kernel, kinds = CREATURES): void` adds `game.systems.creatures` (`CreaturesApi`: `all()`, `countNear(kind, at, radius)`). The game passes no `kinds`.
- `createCreatures(game, kinds)` returns `{ api, system }` for a caller that has no kernel.
- `SLEEP_DISTANCE` is 48. `CreaturesSave` is the shape of the save.

Each creature is an actor in `game.actors` with the id `creature:<kind>:<n>`, the sprite from its data, `anim` set to `walk` or `idle`, and `facing` set to the way it moves. The actor's `pos` is the creature's own `pos` object. `doing` is one of `idle`, `wander`, `flee`, `give`, `sleep`.

## Events

It sends:

- `creature.gave { kind, item, at }` when a creature leaves its item and the player is within reach (10 blocks for the mossling). The item goes into the bag through `inventory.add(item, 1, at)`, so the bag sends `item.gained` with the place. When the player is farther away the item is lost and no event is sent.
- `crop.watered { x, y, z }` when the player uses the watering can on a block that is not tilled soil. The handler joins `actions` on the first step. Tilled soil is left to the crops system.

It hears `crop.watered` (that ground is damp for 3 minutes) and `slept` (watered ground dries, and every creature is ready to give).

It calls `almanac.meet(page)` and `almanac.learn(page, fact)`, which send `fact.learned` and `page.completed`. Watching teaches nothing until the flag `has.almanac` is set or the item `almanac` is in the bag.

## Wiring

```ts
import { install as installAlmanac } from './almanac/index.sim.ts';
import { install as installCreatures } from './creatures/index.sim.ts';

installAlmanac(kernel);
installCreatures(kernel);
// It reads these on each step, in any install order: region.place, inventory.add and count,
// almanac.meet and learn, actions.addHandler, items.get, game.clock.timeOfDay, game.ambient.rain.
// The view draws game.actors. Nothing else is needed.
```

## What the world must have

No mossling appears unless all of this holds, so check it first when the rocks are empty:

- The region has a place named `grant.rocks`, and the player is within 48 blocks of it.
- A `mossy_stone` block lies within 10 blocks of that place sideways and 4 blocks up or down.
- The cell over that block is open, and its light is 14 or less. A cell under open sky has 15, so the rock needs leaves or another opaque block somewhere above it. The limit is `appears.light` in the data.
- For the first lesson with no tool, a `water` block lies within 2 blocks of a mossy stone, counted on all three axes. The first mossling appears on such a stone when there is one.

A mossling gives when the ground under it is damp: water within 2 blocks, ground within 2 blocks that was watered in the last 3 minutes, or rain in the last 3 minutes. Rain counts under leaves too.

A lanternfly needs `game.clock.timeOfDay` at 0.72 or later, or before 0.24, and a `water` block within 12 blocks of the player. It drifts to a `lamp` block within 12 blocks of where it appeared. The manifest has no `lanternfly` sprite yet.

## Tests

`bun test src/game/creatures`. `stage.testkit.ts` builds the one-chunk world the tests use. The game does not import it.
