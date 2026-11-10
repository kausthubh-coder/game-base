# actions

Clicking on the world. It implements `ActionsApi`.

## What it exports

- `install(kernel)` from `index.sim.ts`. It adds `game.systems.actions`.
- `REACH` (5), `EYE_HEIGHT` (1.6) and `reachDistance(player, x0, y0, z0, x1, y1, z1)`, the distance from the eyes to a box.
- The toast texts: `TOWN_TOAST`, `BAG_FULL_TOAST`, `NO_GROUND_TOAST`, `NO_ROOM_TOAST`.
- `stage.ts` is a test helper. Only tests import it.

## How a click runs

`use(context)` is one press of a button. Handlers from `addHandler` run in the order they were added until one returns true. Crops, pets and stations add theirs. The built-in handler always runs last:

- Secondary button. A held block item places its block on the face that was hit. A held station item places the station there through `PlaceablesApi`, turned to face the player, and only on solid ground. Both take one from the bag.
- Primary button. It starts a break and returns true when there is something to break. It does not break anything by itself.

`hold(context, dt)` does the breaking. Call it on every step while the primary button is down, with the block under the pointer. It fills a meter and returns true on the step the block breaks. `breaking()` gives the block and the progress from 0 to 1 for the crack overlay, or null.

Seconds to break, from `src/game/content/drops.ts`:

| Block | By hand | With the tool |
|---|---|---|
| grass, leaves | 0.25 | |
| dirt, sand, path, clay, tilled soil | 0.5 | |
| logs | 1.5 | axe 0.5 |
| planks and every other placed block | 0.6 | |
| stone, mossy stone, lume crystal | never | pickaxe 1.0 |
| a placed station | 0.6, and its item goes back to the bag | |

Drops go straight into the bag. A log gives `oak_log`. Leaves give `fiber` one time in two. Grass gives `dirt`, and `fiber` one time in five. Oak planks give `plank`. Mossy stone gives `stone`. Any other block gives the item that places it.

## What it refuses

- Anything while `game.player.busy` is true.
- A block farther than 5 blocks from the player's eyes. The eyes are 1.6 above `player.pos`.
- A cell where `game.systems.region.isProtected` is true, for breaking and for placing. It toasts "This belongs to the town."
- Placing inside the player, an actor, a solid block, a station, or the cell over a growing crop.
- Breaking the block a station stands on.
- Stone by hand. It toasts "This needs a pickaxe."

The same toast shows at most once in 3 seconds. The 3 seconds count kernel steps.

After a handler takes a primary click, `hold()` does nothing until the next primary `use()`. So harvesting a crop and keeping the button down does not dig up the soil. A meter that nobody holds for 0.5 seconds starts over.

## Events

| Event | When |
|---|---|
| `block.broken { x, y, z, id, by: 'player' }` | A block broke |
| `block.placed { x, y, z, id, by: 'player' }` | A block was placed |
| `toast { text }` | A refusal, or a drop that did not fit in the bag |

The bag sends `item.gained` with `at` set to the middle of the broken block, and `item.lost` for a placed item. Placing a station sends `placeable.placed` from the placeables system.

## Wiring

```ts
import { install as installActions } from './actions/index.sim.ts';
installActions(kernel);
const actions = game.systems.actions;
// The hit is world.raycast from the camera through the pointer. Pass null when it misses.
const context = (button) => ({ button, hit, held: game.systems.inventory.held() });
onPointerDown((button) => actions.use(context(button)));
// once per kernel step, while the primary button is down
if (primaryDown) actions.hold(context('primary'), STEP);
overlay.crack(actions.breaking());
// window.__game.click('primary', x, y, z): use() once, then hold() until it returns true, at most 100 times
```

The actions system needs a kernel step to run its clocks, so add it with the rest. It saves nothing.
