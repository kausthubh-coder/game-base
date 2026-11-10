# Input

Keys, the mouse, touch and a gamepad become intents in one place. The game reads `input.intents` once a frame and never listens for a key itself.

## Wiring

```ts
import { createInput } from './features/input/index.ts';

const input = createInput(ctx);                       // reads the mouse on ctx.renderer.domElement
const camera = createCamera(ctx, { input: false });   // the camera and the hero must not listen too
const hero = createHero(ctx, { blocks, spawn, input: false });

// every frame, before anything that reads intents
input.setMode(dialogue.isOpen ? 'talk' : map.isOpen ? 'menu' : 'play');
input.update(dt, ctx);
const want = input.intents;
hero.control(want);                                   // it has right, forward and jump
if (want.turn) camera.turn(want.turn);
if (want.zoom) camera.zoomBy(want.zoom);
if (want.map) map.toggle();
if (want.slot >= 0) hud.selectSlot(want.slot);
```

`hero.control` takes `right` and `forward` relative to the camera, which is what the intents hold. For a move in world space, call `moveToWorld(want.right, want.forward, camera.yaw, out)`.

## Exports

| Export | What it is |
|---|---|
| `createInput(ctx, options)` | Starts listening. Returns an `InputView`. |
| `InputView.intents` | What the player wants this frame. The same object every frame. |
| `InputView.setMode(mode)` | `'play'`, `'talk'` (nothing passes) or `'menu'` (only `map` passes). Cheap to call every frame. |
| `InputView.rebind(action, code, slot?)` | Binds a key and saves. The key is taken from any other action. |
| `InputView.resetBindings()` | Back to the defaults. |
| `InputView.capture()` | A promise for the next key, mouse button or pad button, or null on Esc. For a keys panel. |
| `InputView.press(action)` | Presses an action once, for an on-screen button. |
| `InputView.touch`, `setTouch(show)` | Whether the touch controls show. |
| `InputView.bindings`, `mode` | The current keys and mode. |
| `Intents` | `right`, `forward`, `jump`, `jumpPressed`, `interact`, `use`, `usePressed`, `place`, `placePressed`, `turn`, `zoom`, `map`, `slot`, `slotStep` |
| `ACTIONS`, `Action`, `Bindings`, `DEFAULT_BINDINGS` | Everything a key can be bound to, and the default keys |
| `mapIntents`, `maskIntents`, `moveToWorld`, `rebind`, `unbind`, `saveBindings`, `loadBindings` | The rules, for tests and a server |
| `actionLabel(action)`, `codeLabel(code)` | Names for a keys panel: `'Jump'`, `'W'`, `'Pad A'` |

Options: `element` (where the mouse, the wheel and a pinch are read), `parent` (where the touch controls go), `touch` (`'auto'`, `'on'` or `'off'`), `storage` and `storageKey` (bindings save to `localStorage` under `game-base.bindings`).

## Default keys

| Intent | Keys | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD, arrows | left stick | the stick |
| Jump | Space | A | button |
| Talk and pick up (`interact`) | F | X | button |
| Use | left click | RT | button |
| Place | right click | LT | button |
| Turn the camera | Q, E | LB, RB | two buttons |
| Zoom | wheel, `-` and `=` | D-pad up and down | pinch |
| Map | M | Back | tap the minimap |
| Quick slots | 1 to 9 | D-pad left and right | tap a slot |

## Notes

- A press is reported once, on the next `update`, even if the key is up again by then.
- `setMode` drops presses that have not been read yet. The key that closes a dialogue box or the map does not also act in the game on the next frame.
- The touch controls show on a touch screen, and on any screen after the first touch. They hide outside `'play'` mode.
- The touch controls sit `--gb-hud-bottom` pixels above the bottom edge. The HUD sets that variable when its quick slots would reach under them.
- A code is `KeyboardEvent.code` for a key, `Mouse0` to `Mouse4` for a mouse button, and `Pad0` to `Pad16` for a gamepad button in the standard layout.
- Tests: `bun test src/features/input`.
