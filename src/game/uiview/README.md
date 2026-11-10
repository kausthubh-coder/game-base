# src/game/uiview

Helpers for the interface views, the files named `src/game/views/ui-*.view.ts`. The views join three
things in the running game: `createGameUi` from `src/game/ui`, the hud, map and dialogue features, and
the shell's `GameView`.

## The views

| File | What it does |
|---|---|
| `ui-title.view.ts` | Opens the game on the title and asks the shell to hold the start. With `?title=world` the title is the live world and the camera drifts behind the plate. |
| `ui-panels.view.ts` | Binds I, B, Tab, J, M and Esc. Tab does nothing until Tamsin has given the Almanac (`has.almanac`). Opens the Make panel when a workbench is used. |
| `ui-hud.view.ts` | Quick slots (drag a stack between them; hover for the item's name and use), the Almanac's button left of them once the book is given, the tracked quest as its title, a pip per step and only the step to do now, the day, the clock and the weather. Hides the health bars. |
| `ui-map.view.ts` | The minimap, the full map, the quest step as the waypoint, pins for places, marks for people. Keeps the waypoint's edge arrow clear of the HUD panels. |
| `ui-talk.view.ts` | Draws `talk.current()` in the dialogue box and sends the voice blips |
| `ui-notices.view.ts` | Places the prompt, hints and toasts beside the HUD, and sends a toast for each thing gained |
| `ui-show.view.ts` | `?show=<state>` opens one state of the interface, for `critly check` |
| `story-opening.view.ts` | The opening scene on a new game chosen from the title: four shots with the real camera, letterbox bars, fades, a line each, a Skip button and Esc. Once per new game, never on Continue. `?opening-at=<seconds>` holds it at one moment. |
| `story-sleep.view.ts` | Sleep fades to dark, the card ("Day 2", the hour), then morning fades in |
| `story-almanac.view.ts` | The card that rises when Tamsin hands over the Almanac. It names the Tab key, holds the hints back while it shows and skips the "Press Tab" hint. |

Each feature is used in one file: hud in `ui-hud`, map in `ui-map`, dialogue in `ui-talk`, assets in
`uiview/art.ts`. The input feature is not used, because the shell's `keys.ts` reads the keys.

## The helpers

| File | What is in it |
|---|---|
| `book.ts` | `bookOf(view)`: the one `createGameUi`, the pictures, which panel is open, `onPanel`, `onStart`, `onSize`. The first view that asks makes it, so the views work in any order. |
| `art.ts` | Icons by name from either icon sheet, portraits, a sprite's first frame, and the `ui` pictures |
| `theme.ts` | The look's tokens as `--ui-*` on the views' root (paper, ink, the teal accent, the dark glass for the HUD), the `--book-*` names the features read, and `frame(element)`, which gives an element the panel's paper |
| `keys.ts` | `KEY_LIST` for Settings, `PANEL_KEYS` for the panels view, the keys that move a conversation on |
| `voices.ts` | A sound-engine voice for each speaker's voice id |
| `opening.ts` | The opening's clock (`createOpening`), its rule (`playsOpening`: fresh, chosen from the title, the flag `story.opening` not set) and the title's mark in sessionStorage |
| `sleep.ts` | The sleep card's clock, on the rules' steps. It hands the time system a sleep curtain, so the morning comes once the screen is dark. |
| `clear.ts` | `clearOfPanels`: slides the waypoint's edge arrow along its edge until it touches no HUD panel. `ui-map.view.ts` calls it after the map has placed the arrow. |

## Keys

`keys.ts` holds the list. The movement, camera, slot and mouse keys are bound in
`src/game/shell/keys.ts`, and this folder only names them. A changed binding needs three edits: the
shell, the row in `KEY_LIST`, and the hint in `src/game/content/hints.ts`. `tools/play-ui.mjs` presses
every key a hint names and fails when one does something else.

`createGameUi` runs with `hotkeys: false`. The panels view takes I, B, Tab, J, M and Esc in the
capture phase, so the full map, a panel and the pause menu never answer the same key press.

## Who has the screen

| State | Rules stepped | HUD, hints and toasts |
|---|---|---|
| Title, pause, Settings, the end card | no | hidden |
| Bag, Make, Almanac, quest log | yes, and `player.busy` is true | hidden |
| Full map | yes, and `player.busy` is true | hidden |
| A conversation | yes, and `player.busy` is true | shown, without the quick slots. Toasts sit above the box. |

`book.covered` is true while a panel or the full map is open, and the views' root has the class
`ui-covered`. The map view calls `book.settle()` when the map opens or closes.

Stacking inside the views' root: the waypoint arrow 12, the HUD 10, `createGameUi` 20 (panels, the
prompt, hints, toasts), the dialogue box 30, the Almanac card 35, the full map 40, the sleep card 45,
the opening scene 50.

The opening and the sleep card take every key in the capture phase while they show. Their views are
named `story-*`, so they install before the `ui-*` views and hear a key first.

Two CSS lengths keep the bottom of the screen clear. The HUD view sets `--ui-hud-clear` to the height
the quick slots take. The talk view sets `--ui-talk-clear` to the height of the dialogue box while it is
open. The prompt, the toasts and a hint on a narrow screen sit above them.

## The address

| Part | What it does |
|---|---|
| `?title=world` | The title over the live world, not the picture |
| `?show=hud`, `talk`, `choice`, `bag`, `make`, `almanac`, `quests`, `map`, `pause`, `settings`, `end` | Skips the title and opens that state. It does nothing when a saved game exists. |

## Checking it

```
bun tools/play-ui.mjs                 # builds, serves on 5332, walks the interface, writes .artifacts/play/ui-*.png
bun tools/play-ui.mjs --only phone    # desktop | phone | world
```

It exits 1 on a failed check or a console error, and writes the list to `.artifacts/play/ui.json`.
