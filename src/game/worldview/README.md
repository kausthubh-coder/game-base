# World views

Draws the things the game's systems know about and the base world does not: crops, stations, the land's
dressing and the festival lamps. The views are `src/game/views/world-*.view.ts`. This folder holds what
they share.

| File | What it holds |
|---|---|
| `props.ts` | The one file that uses `src/features/props` and `src/content/props.ts`. `worldProps(view)` gives every view the same props, and keeps them inside 40 draw calls. |
| `region.ts` | Everything the views ask the region. A missing region or method gives an empty answer, never a throw. |
| `camp.ts` | `campOf(view)`: the camp's fire as a film holds it, read by the camp view |
| `crop-mesh.ts` | The two instanced meshes of the crops view and their shaders |

## The views

| View | Draws | Draw calls |
|---|---|---|
| `world-crops.view.ts` | Every crop of `crops.all()` as two crossed quads with its stage's tile from the `crops` sheet. A dark patch on wet soil. | 2 |
| `world-stations.view.ts` | Every station of `placeables.all()` with the prop its definition names, turned by its quarter turns | counted with the props |
| `world-dressing.view.ts` | The region's props and berry bushes, and trees, grass, flowers, rocks and reeds from the scatter rules. Leaves fall from the tree tops. | 40 at most, shadows included |
| `world-camp.view.ts` | The fire and the tent at the place `camp`: `cold` by day, `lit` from dusk, `low` after scene 9 until `night.over`, or as a film holds it. A pool of firelight on the ground, sparks, smoke and the fire's sound. Stands in the brazier, the bed and fireflies until `campfire`, `tent` and `ember` land. | 1, and the props |
| `world-lamps.view.ts` | The river lamps of the festival | 2 |

The aim has no view here. `core-aim.view.ts` already shows a block breaking: its outline closes in and turns warm.

## How each one stays right

- **Crops and stations** get no event when something is removed or a save is loaded. Each frame they compare the system's list with what they drew, slot by slot, and write only what differs.
- **A crop pops** for 0.2 seconds when the plant on the same soil gains a stage. The shader does it from the moment written in the plant's row, so nothing is written while it pops or sways.
- **Wet soil under a crop** is `state.wet > 0`. Wet soil with no crop is not in `CropsApi`, so the view follows it from `crop.watered` (the can wets three by three) for 180 seconds. See "What is missing".
- **A station** is one block. A prop longer than 1.4 blocks is drawn smaller until it is 1.4 long: the workbench at 0.82 of its size, the bed at 0.7. Its front turns the way `quarterTurns` says: north at 0, then clockwise.
- **The dressing** is made chunk by chunk, 3 chunks each way around the player, at most 3 ms a frame after the first chunk. It is taken away 5 chunks out. A dressed chunk remembers the world's chunk it came from and that chunk's `rev`. When `rev` moves, every prop whose column no longer has the height and surface it grew on is removed, so tilling, building and setting down a station clear the grass without an event.
- **The budget.** A prop costs one draw call for each kind and variant in view, plus two for all shadows. `props.ts` folds the scatter's 36 variants into 26, and counts the kinds and variants that stand near the player. Stations, the region's props and berry bushes are placed with `must` and are always drawn. When a 39th kind arrives, the least important scattered kind standing (the end of `KEEP_ORDER`) is taken away to make room. If nothing is less important, a scattered prop is drawn as a variant of its kind that is standing, or left out. The town's own props are 29 kinds and variants, so in the middle of town nine scattered kinds remain. The count is on the scene: `scene.getObjectByName('props').userData.stats`.
- **A berry bush** is the prop `berryBush` while it has berries and `bush` (variant 0, the same shape) when picked. The scatter's own berry bushes are drawn as plain bushes, so only a bush that can be picked shows berries. It is drawn at 1.2 of the prop's size, so its berries show from the usual zoom. A bush more than 4 chunks from the player is not drawn.
- **Lamps** start on the water nearest `river.bank` and make for the place `ferry`. With no ferry they take the longest stretch of open water. A lamp is carried a few blocks out (4 for the player's, 1 to 9 for one of the town's), then creeps at a tenth of that pace, so the river by the bank stays lit all evening. The town's twelve go in up to 6 blocks up and down the river, 2.5 to 4.5 seconds apart. Lamps steer around banks and stop when no water is ahead. They move on the game's clock, so `window.__game.advance` moves them. The morning after the festival (`festival.over`) the town's lamps are gone and the player's stays.

## What the region gives

`region.ts` reads these from `game.systems.region`. With no region, or a region without the method, the view draws nothing for it:

| Method | Used for |
|---|---|
| `place(name)` | `river.bank` and `ferry` for the lamps |
| `berryBushes()` | The bushes. `ripe` is read every frame. |
| `props()` | The props of the buildings and the town, placed as they are given |
| `scatter()` | `density`, `forest(x, z)` and `blocked(x, z)` for the scatter rules. The town is inside `blocked`, so `townCenter()` is not read. |

## What is missing

- `CropsApi` does not list wet soil that has no crop. The view's own count can be one block off when the can is aimed at bare soil beside a crop, and bare wet soil is not drawn after a load. A `wetSoil()` on the crops system would make it exact.
- The scatter rules place trees as props. A prop tree cannot be chopped and does not stop the player. Trees for wood are the world's block trees.
- `GameView` has no way to hand tree tops to the weather, so the dressing view drops its own leaves through `view.effects.play('leaf', ...)`.

## Checking

`bun tools/play-worldviews.mjs` builds the game, plays through the debug door and writes `wv-*.png` and
`worldviews.json` to `.artifacts/play/`. It counts the draw calls of the props from the renderer.
