# placeables

Stations and furniture the player sets down. It implements `PlaceablesApi`.

## What it exports

- `install(kernel)` from `index.sim.ts`. It adds `game.systems.placeables`.
- `PROMPT_RADIUS` (2) and the bed's toast texts: `NO_ROOF_TOAST` and `TOO_EARLY_TOAST`.
- `defs()` returns the three kinds from `src/game/content/placeables.ts`:

| Kind | Station | Prompt | Size |
|---|---|---|---|
| `workbench` | `workbench` | Craft | 1 by 1 by 1 |
| `bed` | `bed` | Sleep | 1 by 1 by 1 |
| `chest` | `chest` | Open | 1 by 1 by 1 |

- `place(kind, x, y, z, quarterTurns)` stands one with its corner at that block and returns it. It returns null when a cell is not air or another station is there. Ids look like `workbench:1`.
- `remove(id)`, `all()`, `at(x, y, z)`.
- `near(station, at, radius)` is true when a station of that name has its nearest side within `radius` of the point.
- `onUse(listener)` hears every use of a placed thing and returns a function that stops listening.

`quarterTurns` is 0 to 3. Zero means the front faces north, and each turn is clockwise seen from above, the same as `Actor.facing`. A click places a station with its front toward the player.

## What a placed thing does

Each one adds an `Interactable` called `placeable:<id>` at its middle, with a radius of 2 blocks. "E" beside it and the secondary button on it both use it.

- The bed calls `game.systems.time.sleep()` when `canSleep()` is true. Otherwise it toasts one reason. "The bed needs a roof over it." shows when no block is over the bed and none is over the player. With a roof over either, the reason is "It is not evening yet."
- The workbench and the chest only tell the `onUse` listeners and send `ui.sound`. Their prompts stay hidden until something listens, so no prompt leads nowhere. The chest holds no items yet.

Holding the primary button on a station for 0.6 seconds puts it back in the bag. The actions system does that.

Each station fills its cells with the block whose key is `barrier` in `src/content/blocks.ts`. It is solid and draws nothing, so the player cannot walk through a station or stand in a bed's block, and the pointer stops at it. The click code also treats the open cell the ray crossed last as the station, for a build without that block.

## Events

| Event | When |
|---|---|
| `placeable.placed { kind, x, y, z }` | `place` succeeded. A load does not send it again. |
| `toast { text }` | The bed could not be slept in |
| `ui.sound { sound: 'open' }` | A workbench or a chest was used |

Nothing is sent on `remove` or after a load. A view should compare `all()` with what it drew.

## Contract change

`PlaceablesApi.onUse?` is new. It is optional in the type so that older fakes still fit. The real system always has it.

## Wiring

```ts
import { install as installPlaceables } from './placeables/index.sim.ts';
installPlaceables(kernel);                 // after or before actions and interact, either works
const placeables = game.systems.placeables;
placeables.onUse?.((placed) => {
  if (placed.kind === 'workbench') panels.openCrafting();
  if (placed.kind === 'chest') panels.openChest(placed.id);
});
for (const placed of placeables.all()) props.draw(placed);   // each frame, or when the list changes
```

The save holds every placed thing and the id counter. Load the world before the kernel, so that a station's cells match the blocks around it.
