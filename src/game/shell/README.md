# The shell

The shell starts the game. It makes the renderer, the block world, the kernel with its systems and every base feature. It steps the rules 20 times a second, draws, saves, and opens the debug door `window.__game`.

## Files

| File | What it holds |
|---|---|
| `../boot.ts` | Makes the shell, installs every view, opens the door, starts the game |
| `../systems.ts` | The list of systems, in order |
| `game.ts` | The frame, the step, the aim, saving, new game and continue |
| `view.ts` | `GameView`, the object every view gets |
| `keys.ts` | All key, mouse and wheel reading |
| `drag.ts` | Whether a right-button press is a click or a drag |
| `player.ts` | The hero's body, steered by the keys. It writes `game.player`. |
| `art.ts` | The only file that uses the assets and sprites features |
| `sound.ts` | Starts the sound engine on the first click or key |
| `water.ts` | Puts the water feature's material on the world's water |
| `save.ts` | The save in `localStorage` |
| `door.ts` | `window.__game` |
| `../views/core-actors.view.ts` | Actors to sprites, and the marks over their heads |
| `../views/core-aim.view.ts` | The box around the block, tree or station a click would act on |
| `../views/core-crosshair.view.ts` | The crosshair of a locked mouse: first person, and the free camera with Lock to turn |
| `../views/core-ghost.view.ts` | A see-through copy of what the right button would place |
| `../views/core-sound.view.ts` | Game events to sounds and particles |

## Adding a view

Put a file in `src/game/views/` named `<something>.view.ts` and export `install`. Edit nothing else. `boot.ts` finds the file, and installs views in the order of their file names. `core-*` comes first.

```ts
import type { GameView } from '../shell/view.ts';

export function install(view: GameView): void {
  const box = document.createElement('div');
  box.style.pointerEvents = 'auto';          // the root lets clicks through, so opt in
  view.root.append(box);
  view.onFrame((dt) => { /* once a frame, before the picture is drawn */ });
  view.onSimStep((dt) => { /* after every kernel step, dt = 0.05 */ });
  view.game.events.on('toast', ({ text }) => { box.textContent = text; });
}
```

`install` may be async. It runs after the world, the systems and the features exist and before the first frame. A view that throws in `install` is logged and skipped. A frame or step listener that throws is logged once and removed. `bun tools/play-view-proof.mjs` drops in one view that logs and one that throws in `install`, and checks that the game still starts.

What `GameView` gives you is in `view.ts`, with a comment on every member. The parts a view is most likely to need:

- `view.game` and `view.kernel`. `view.game.systems` may lack a system, so read it as `Partial<Systems>` when you can live without one.
- `view.root` for HTML. `view.scene` for 3D things. `view.ctx` is the `ViewContext` to hand to a base feature you create.
- `view.project(x, y, z, out?)` gives CSS pixels from the root's top left, or null off screen. It has the shape `createGameUi` asks for.
- `view.playerPosition` is where the hero is drawn. `view.aim` is the block under the pointer when it is in reach.
- `view.assets` for icons, portraits and sprite frames. `view.audio` is null until the first click or key, so write `view.audio?.emit(...)`, or use `view.onAudio(fn)`.
- `view.settings.setQuality('auto' | 'low' | 'medium' | 'high' | 'ultra')`, `view.settings.setVolume(bus, value)` and `view.stats()` fit `GameUiOptions` as they are.
- `view.keys.onPress(fn)` hears E, Q, R, the digits, the wheel and the mouse buttons. Listen there, not on `window`, so the base's input feature can replace `keys.ts` later.

## The title screen

Call `view.holdStart()` in your `install`. Without that call the game starts by itself: the saved game when there is one, a new one otherwise. Then call `view.newGame()` or `view.continueGame()` from your buttons. `view.hasSave()` says whether Continue has anything to load.

Before the game starts the camera already shows the spawn point with the hero standing on it, so the title can sit over a live picture.

A new game while a game is running reloads the page, because systems keep their state in closures. The page comes back straight into the new game and skips the title. The same holds for Continue during a game.

`view.setPaused('title', true)` stops the rules and keeps the picture. Each reason is counted on its own, so a pause menu and a panel do not undo each other. The shell does not pause for panels. `game.player.busy` stops the hero and the clicks, and the clock runs on, as it does in a conversation.

`view.save()` writes the save now. The shell saves on `slept`, on `quest.step`, every 60 seconds of play and when the page closes.

## Keys

| Key | What it does |
|---|---|
| W A S D, arrows | Walk, relative to the camera |
| Shift | Walk at 2 blocks a second |
| Space | Jump |
| V | The next camera: 2.5D, free, first person |
| Right button, dragged | Turn the camera, as in Roblox: the 2.5D camera smoothly along the ground, keeping its pitch and zoom, and with 2.5D turning on Quarter turns (the default) it glides to the nearest quarter when let go; the free camera all ways (Drag to turn). The cursor hides during the drag |
| Q, R | Turn the 2.5D camera to the next quarter that way. Between two quarters, the nearer one |
| Mouse | First person, and the free camera with Lock to turn: look around, once a click in the world has taken the mouse |
| Alt, Esc | Give the cursor back, when it is locked |
| Wheel | Zoom: in steps in 2.5D, smoothly in free |
| 1 to 9, Shift and wheel | Pick a quick slot |
| E | `interact.act()` |
| Left button | `actions.use` with `primary`, then `actions.hold` every step while it is down. A break needs a hold of 0.4 seconds or more |
| Right button, clicked | `actions.use` with `secondary`, when it comes up. A press that moves more than 6 pixels or lasts over half a second is not a click, and uses nothing |
| F3 | The performance meter |

The mouse works one of three ways (`MouseMode` in `keys.ts`). In 2.5D (`point`) and in the free camera with Drag to turn (`drag`, the default) the cursor stays free and the buttons act on the block under it; a right click acts on the block it went down on. In first person and with Lock to turn (`lock`) they act on the block under the crosshair, in the middle of the screen. Either way reach is measured from the hero's eyes. The click that takes the mouse acts on nothing, and anything that holds the player (a panel, the map, a conversation, the title) gives the cursor back and ends a drag.

The Mouse setting (`view.settings.mouse`, `drag` or `lock`, `?mouse=lock` for one visit) picks how the free camera turns. First person always locks. The 2.5D turning setting (`view.settings.tiltTurn`, `quarter` or `smooth`, `?turn=smooth` for one visit) picks where the 2.5D camera rests after a drag: Quarter turns because halfway between two quarters the camera looks straight along the grid and the blocks lose their 3D corners. The `move` hint is worded for the mouse in use when it is sent: see `mouse` in `src/game/content/hints.ts`.

The drag does not lock the pointer. Chrome shows its "Press Esc to show your cursor" notice each time a page locks the mouse, and a drag happens too often for that, so the cursor is hidden and the pointer captured instead. When the drag ends, the cursor shows again where the hand left it.

E does nothing while `game.player.busy` is true. The dialogue view advances its own lines: hear `{ kind: 'interact' }` from `view.keys.onPress` and call `talk.advance()`.

I, B, J, Tab and Esc are free. `createGameUi` listens for them itself.

## Systems

`systems.ts` lists the systems in order. It finds each `src/game/<name>/index.sim.ts` with a glob, so a system that lands later joins without an edit. A folder that is not on the list is installed last. `NEEDS` in that file holds back `people` and `pets` until `region` exists, because their READMEs say they cannot run without it.

A system that throws in a step is logged once and switched off, and the others keep running. `window.__game.state().failed` names it.

## The debug door

The calls in `docs/play/act1.md`, and a few more for tests:

| Call | What it does |
|---|---|
| `manual(true)` | The frames stop stepping the rules, so only `advance` moves time |
| `key(name, down)` | With `down`, holds or lets go of `w`, `a`, `s`, `d`, `shift`, `space` |
| `teleport(x, z)` | Two numbers stand the player on the ground there |
| `click(button, x, y, z, face)` | `face` is the side clicked, as a step out of the block. The top by default. |
| `newGame()`, `continueGame()`, `save()`, `hasSave()`, `started` | The game's life |
| `setTime(t)`, `turn(1)`, `block(x, y, z)` | The clock, the camera, a block's id and key |
| `setCamera(mode)` | `tilt` (2.5D), `free` or `first`, as the View setting and V pick it |
| `state().camera` | The mode, quarter, zoom, yaw, pitch and distance, and the mouse: `mouse` (`point`, `drag` or `lock`), `locked`, `dragging`, `tiltTurn` |
| `look(yaw, pitch, distance?)` | Free and first person: the view in degrees. Yaw 0 looks north and 90 west, pitch is how far it looks down. `distance` is the free camera's |
| `aimAt(x, y, z)` | Free and first person: turns the view so the middle of the screen falls on that point |
| `frames(n)`, `settle()` | Promises: n frames drawn, the land in view loaded and drawn |
| `costs()` | The last frame's draw calls and triangles by feature (land, grass, trees, town). The rows add up to the totals. |
| `programs()` | Shader programs held, how many were compiled in the middle of a draw, and the warm-up's state |
| `view` | The `GameView` |

Open the page with `?hold=1` to stop the automatic start, `?quality=high` to hold a quality level (`low`, `medium`, `high` or `ultra`) and `?perf=1` to show the meter. `src/features/perf/README.md` says what the last two calls give. `advance` does nothing before a game has started.

`bun tools/play-act1.mjs --port 5364 --dist dist-trees-act1` runs the five-quest browser check with its own port and build folder. Its save check compares standing and felled trees, the bonded pet, the bag and the tracked quest after Continue.

`bun tools/play-drag.mjs` drags the 2.5D and the free camera with the real right button, checks a drag places nothing and a click still does, and checks the Mouse setting. `--shots <folder>` writes frames of it.

`bun tools/play-smoke.mjs` builds the game, serves `dist` on port 5330 and plays through the door. It writes screenshots and `smoke.json` to `.artifacts/play/`.

## What to know about the world

The world keeps only the chunks around the player in memory, about 100 blocks each way. A system that reads blocks farther off gets air. A teleport, a new game and a load make the chunks around the player on the spot, 3 chunks each way, so the rules never run over a hole.
