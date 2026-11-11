# build

Build mode: one press, drag and release works a whole stroke of cells. It implements `BuildApi` as `game.systems.build`.

## What a stroke does

The held item says what a stroke does and which cells it covers.

| Held | Kind | Cells | Cost |
|---|---|---|---|
| Hoe | `till` | A filled rectangle, at most 12 by 12 | None |
| A seed | `plant` | A filled rectangle | One seed a cell |
| Watering can | `water` | A filled rectangle | None |
| A block item | `block` | A straight line, at most 16 long | One a cell |
| A placeable that `joins` (the fence) | `place` | A straight line | One a cell |
| Any other placeable (chest, sprinkler, bed) | `place` | The one cell under the pointer | One |
| Anything else, or nothing | `none` | None | None |

A stroke works at one height: the ground block that was pressed. A block or a placeable goes on the cell above it.

Every cell gets a verdict before anything changes (`CellVerdict` in `api.sim.ts`): `ok`, `short` (the bag runs out before it), `skip` (nothing to do), `far`, `town`, `ground` (no level ground), `wrong` (the wrong kind of ground) or `blocked`. `reasonOf` in `plan.sim.ts` has the words for each. A stroke reaches 12 blocks from the player along x and z.

The bag pays for the cells nearest the press first.

## What it exports

`index.sim.ts` exports `install(kernel)`. `plan.sim.ts` exports the pure parts: `toolOf`, `strokeCells`, `judge`, `snapTurns`, `reasonOf` and the limits.

| Call | What it does |
|---|---|
| `active`, `setActive(on)` | Build mode. It stays off while `player.busy` is true. Turning it off drops a stroke. |
| `point(hit or null)` | Where the pointer is, as a ray cast gives it. During a stroke it moves the far end. A hit on the side of a block means the open cell in front of it. |
| `press()` | On a placed thing: takes it back into the bag and into the hand. Elsewhere: starts a stroke with the held item. |
| `release()` | Judges the stroke again against the world as it is now and applies every `ok` cell. Returns the cells it changed, or -1 with no stroke. |
| `cancel()` | Drops the stroke. Nothing changes. |
| `plan()` | What a release would do now, or what a press and release on the pointed cell would do. The same object on every call. |
| `turn(1 or -1)` | Turns the held placeable a quarter. It keeps that turn until another item is in the hand. |
| `undo()`, `canUndo` | Takes back the last stroke. A cell goes back only when it is still as the stroke left it, and its item returns to the bag. |
| `last()` | The cells the last stroke changed, or the last undo put back. |
| `applying` | True while a stroke or an undo is changing cells. |

The step drops a stroke when build mode is off, when the player is busy, or when the held item is no longer the one the stroke was pressed with. `release()` asks the same three questions itself, because it can run before the step does.

## Turning by itself

A placeable faces the player, as a click outside build mode places it. One whose definition has `backs` (the chest, the workbench) turns its back to a wall beside it and its front to open ground: toward the player when it can, then to either side, then away.

## Events

| Event | When |
|---|---|
| `build.mode { active }` | Build mode went on or off |
| `build.applied { kind, count, undone }` | A stroke changed `count` cells, or an undo put `count` back |

A stroke also sends what the systems it works through send for each cell: `soil.tilled`, `crop.planted`, `block.placed`, `placeable.placed`. A stroke with the can sends one `crop.watered`, on a crop when it wet one. While those come, `applying` is true, so a view can spread their sounds over a moment.

## What it adds to other systems

- `CropsApi.wet(x, y, z)` wets one soil block and sends nothing. `pull(x, y, z)` takes a crop out and returns its seed, and refuses when the seed has no room. `soil()` lists every soil block that is wet or planted.
- `PlaceableDef` has `joins`, `backs` and `waters`.
- `src/game/sprinklers` keeps tilled soil wet around a placeable with `waters`, every 20 seconds.

## Tests and the model

`bun test src/game/build` runs in about 2 seconds.

- `build.test.ts` holds the rules above, one test each.
- `model.test.ts` holds this code to `docs/verify/build-stroke/Stroke.tla`, the design of a stroke that a model checker has walked through every order of events. It plays 1,500 random runs of 200 events on the real systems and compares them with the model after every event.

Before you change how a stroke starts, ends, is applied or is undone, read `.agents/skills/verify-build-stroke/SKILL.md`.

## The views

`src/game/views/world-build.view.ts` draws the grid, the cells, the ghost and the landing, and turns the keys into `press`, `release` and `cancel`. `ui-build.view.ts` shows the bar and the line by the pointer. `lab-build.view.ts` is the test scene behind `?scene=build`. `bun tools/play-build.mjs` plays the scene with the real mouse and writes a screenshot of each step.
