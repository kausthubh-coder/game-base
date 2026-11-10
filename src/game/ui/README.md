# src/game/ui

The game's panels, as plain HTML and CSS over the canvas. No UI library. It reads the game only through
`game.systems` and `game.events`. The HUD (bars, quick slots, quest tracker, minimap, dialogue box) is a
separate feature and is not here.

## What it exports

`src/game/ui/index.ui.ts`:

- `createGameUi(root, game, options): GameUi`
- `DEFAULT_KEYS`, `DEFAULT_SETTINGS`
- types: `GameUi`, `GameUiOptions`, `PanelName`, `IconRef`, `PictureRef`, `NineSlice`, `Quality`,
  `VolumeChannel`, `Settings`, `EndStats`, `KeyHint`

`GameUi`:

| Method | What it does |
|---|---|
| `open(panel, detail?)` | Opens `bag`, `make`, `almanac`, `quests`, `title`, `pause`, `settings` or `end`. `detail` is a page id for the Almanac, or `'hand'` to open the bag on its "By hand" tab. |
| `close()` | Closes the open panel. Settings goes back to the title or the pause menu it came from. |
| `toggle(panel)` | Opens it, or closes it when it is the open one. |
| `isOpen(panel?)` | True when that panel is open. With no name: true when any is. |
| `settings()` | A copy of the stored settings. |
| `notices.hold(on)` | While held, the hint and the Almanac's note at the top step aside and their time stands still. A story card holds them while it shows. |
| `notices.skip(id)` | A hint with this id is never shown, because something on screen already says it. |
| `dispose()` | Removes every element and listener. |

While a panel is open `game.player.busy` is true. On close it is set to `game.systems.talk.active`.

## Wiring

```ts
import { createGameUi } from './ui/index.ui.ts';
const ui = createGameUi(document.querySelector('#ui')!, game, {   // #ui: position fixed, inset 0, over the canvas
  icon: (name) => iconFromManifest(name),            // { url, x, y, size } or null
  picture: (name) => firstFrameOfSprite(name),       // { url, x, y, width, height } or null
  project: (x, y, z) => camera.toScreen(x, y, z),    // { x, y } in CSS pixels, or null when off screen
  stats: () => ({ days: game.clock.day, wheat, blocks, pages }),
  hasSave: () => save.exists(), newGame, continueGame, saveAndQuit,
  setQuality: (q) => view.setQuality(q), setVolume: (channel, v) => audio.setVolume(channel, v),
  art: { title: url(manifest.ui.title), panel: { url: url(manifest.ui.panel) }, button: { url: url(manifest.ui.button) } },
});
ui.open('title');
```

A workbench opens the Make panel by sending an event from its `act()`:
`game.events.emit('ui.open', { panel: 'make' })`. `crafting.available()` decides what the panel lists.

## Every option

| Option | Needed | What it is |
|---|---|---|
| `icon(name)` | yes | An icon cell from the manifest: `{ url, x, y, size }` in sheet pixels. `null` draws a plain square with the item's first two letters. |
| `picture(name)` | no | A sprite frame for an Almanac page: `{ url, x, y, width, height }`. When missing or `null`, `icon(name)` is tried, then the letters. |
| `project(x, y, z)` | yes | Screen position of a world point in CSS pixels from the root's top left, or `null`. Places the breaking ring. |
| `stats()` | yes | `{ days, wheat, blocks, pages }` for the end card. Read when the card opens. |
| `hasSave()` | yes | True when Continue has something to load. Read each time the title draws. |
| `newGame()` | yes | Title, New game. With a save present the player confirms first. The title closes after it returns. |
| `continueGame()` | yes | Title, Continue. The title closes after it returns. |
| `saveAndQuit()` | yes | Pause, "Save and return to title". The title opens after it returns. |
| `setQuality(quality)` | yes | `'low' \| 'medium' \| 'high' \| 'auto'`. Called once at creation with the stored value, then on every change. |
| `setVolume(channel, value)` | yes | `channel` is `music`, `ambience`, `effects` or `voice`, `value` 0 to 1. Called once per channel at creation, then on every change. |
| `setInterfaceSize(size)` | no | 0.9, 1 or 1.15, so the HUD can match. The panels scale themselves. Called once at creation, then on change. |
| `art.title` | no | URL of the title picture. Without it: a plain dawn gradient. |
| `art.panel` | no | Not used by the game since the redesign (the panels are CSS). `{ url, slice?, width? }`, a nine-slice frame for panels. Defaults fit the 96 by 96 `ui/panel.png`: corner `slice` 28, drawn at `width` 56. Without it: a CSS frame in the same colors. |
| `art.button` | no | `{ url, slice?, width? }`, a nine-slice frame for buttons. Defaults fit the 96 by 32 `ui/button.png`: slice 6, drawn at 6. Without it: a CSS button. |
| `keys` | no | The list of keys in Settings, `{ action, keys }[]`. Default `DEFAULT_KEYS`. Change it if the movement keys differ. |
| `hotkeys` | no | `false` stops the interface from handling I, B, J, Tab and Esc itself. Tab-focus and arrow keys inside a panel still work. Default `true`. |
| `hudBottom` | no | Pixels kept free at the bottom for the HUD's quick slots. The prompt sits above it. Default 96. |
| `storageKey` | no | The localStorage key for settings. Default `game-ui.settings`. |
| `onChange(panel)` | no | Called after a panel opens or closes, with its name or `null`. Use it to stop the simulation while `title`, `pause`, `settings` or `end` is open. |

## Keys it handles

I or B: bag. J: quests. Tab: Almanac (Tab also closes it; inside the other panels Tab moves the focus).
Esc: closes the open panel, or opens Pause when none is open. Arrow keys move through the bag's slots (the quick
row and the bag are two grids, and Up and Down cross between them) and
the Almanac's pages. All of these are ignored while `game.systems.talk.active` is true and no panel is open.

## The bag

Two grids: the nine quick slots, then the 27 slots of the bag. A stack moves three ways, all through
`inventory.move(from, to, count?)`:

- **Drag** (`drag.ui.ts`): press on a stack and move a few pixels. A ghost follows the pointer and the slot under it
  lights up; a slot that cannot take it is ringed in amber. The left button takes the whole stack, the right button
  or Shift takes half. Onto the same item it merges, onto another it swaps, onto an empty slot it moves. Esc puts it
  back. A finger works the same way, with the ghost above the finger. A change to the bag during a drag is drawn
  when the drag ends.
- **Click, then click**: a click picks a stack up, a click on another slot puts it there. Shift-click picks up half.
  Enter does the same from the keyboard. Esc puts it down.
- The HUD's quick slots take a drag between them too (`src/game/views/ui-hud.view.ts`, the same `createSlotDrag`).

Hovering or focusing a stack shows its tooltip: the name, what it is for (`itemUse` in `logic.ui.ts`, from what the
item does), its description, and "Put it in a quick slot to hold it" for a tool or a block left in the bag.

## Over the game

The prompt, the hints and the toasts are dark glass, so the world shows around them. One card at a time at the
top: a hint, and the Almanac's note only once no hint is up. At most three toasts; a repeat of a line still
showing raises its count instead of adding a line.

## Events

It listens to `inventory.changed`, `quest.started`, `quest.step`, `quest.completed`, `fact.learned`,
`page.completed`, `hint`, `toast`, `act.ended` (opens the end card) and `ui.open`.
It sends `ui.sound` with `open`, `close` or `click`.

`ui.open` is new in `api.sim.ts`: `{ panel: string; detail?: string }`. It opens `bag`, `make`, `almanac` or
`quests`, and is ignored while the title, pause, settings or end card is up.

## What it reads from the game

`items.get`, `inventory.slots / selected / count / move`, `crafting.available / canMake / make`,
`almanac.pages`, `quests.all`, `interact.nearest`, `actions.breaking`, `talk.active`.

## Files

| File | What is in it |
|---|---|
| `index.ui.ts` | `createGameUi`: the stage, the keys, the events, settings storage |
| `bag.ui.ts` | The bag, its "By hand" tab, and the Make panel |
| `almanac.ui.ts` | The Almanac |
| `quests.ui.ts` | The quest list |
| `menus.ui.ts` | Title, pause, Settings, the end card |
| `overlay.ui.ts` | The prompt, hints, toasts, the Almanac's note, the breaking ring |
| `drag.ui.ts` | `createSlotDrag`: a stack dragged from slot to slot, for the bag and the HUD's quick slots |
| `styles.ui.ts` | All the CSS, as one string. Tokens at the top. |
| `logic.ui.ts` | The parts with no page in them, tested in `logic.test.ts` |
| `dom.ui.ts`, `types.ui.ts` | Element helpers and the shared types |

The demo is `demos/game-ui`.
