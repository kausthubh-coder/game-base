# HUD

The frame around the game, in plain HTML and CSS over the canvas. Health, stamina and mana at the top left. The minimap's slot, the clock and the weather at the top right. Nine quick slots at the bottom, the tracked quest at the right, short messages at the bottom left. It looks like a book: parchment panels, ink lines, brass corners.

## Wiring

```ts
import { createHud } from './features/hud/index.ts';

const hud = createHud(ctx, { onSlot: (i) => inventory.select(i) });
hud.minimapSlot.append(map.minimap);
hud.setVital('health', 82, 100);                      // also 'stamina' and 'mana'
hud.setSlot(0, { icon: woodCanvas, label: 'Wood', count: 12 });
hud.setQuest({ title: 'Bread by noon', steps: [{ text: 'Talk to Odo', done: true }, { text: 'Bring ten logs' }] });
hud.message('found the village waystone.', { from: 'Ana' });

// every frame
hud.update(dt, ctx);                                  // the clock and the weather come from ctx.ambient
if (input.intents.slot >= 0) hud.selectSlot(input.intents.slot);
hud.setTouch(input.touch);                            // moves messages above the touch stick
```

## Exports

| Export | What it is |
|---|---|
| `createHud(ctx, options)` | Builds the HUD. Returns a `HudView`. |
| `HudView.minimapSlot` | An empty box at the top right for the minimap |
| `HudView.setVital(vital, value, max)` | A bar. The page changes only when the numbers do. |
| `HudView.setSlot(index, slot \| null)` | A quick slot, 0 to 8: `icon` (any element), `label`, `count` |
| `HudView.selectSlot(index)`, `selected` | The highlighted slot |
| `HudView.setQuest(quest \| null)` | The one tracked quest, or null to hide the panel |
| `HudView.message(text, { from?, seconds? })` | A short message. It leaves after 6 seconds. Four show at most. |
| `HudView.setScale(scale)`, `scale` | The size setting, 0.8 to 1.4. It saves. |
| `HudView.setTouch(on)`, `setVisible(visible)`, `element` | |
| `clockText`, `weatherIcon`, `isDay`, `barFraction`, `clampScale`, `contrast`, `BOOK`, `WEATHER_NAMES` | The rules, with no page in them |

Options: `parent`, `scale`, `storage` and `storageKey` (`localStorage` under `game-base.hud.scale`), `onSlot`, `bus` (a slot click sends a `ui` click event).

## The book theme

The HUD, the map, the dialogue box and the touch controls read the same colors. Set any of these on `:root` to change them everywhere.

| Variable | Default |
|---|---|
| `--book-parchment` | `#ecdcb9` |
| `--book-parchment-deep` | `#dcc797` |
| `--book-ink` | `#33241a` |
| `--book-ink-soft` | `#5a4330` |
| `--book-brass` | `#b88a3e` |
| `--book-brass-light` | `#e6c476` |
| `--book-font` | a serif stack |

Ink on parchment is 11 to 1. Soft ink on deep parchment, the lowest pair the HUD uses, is 5.55 to 1.

## Notes

- Every size is in em, and the root's font size is 16 pixels times the size setting. Small labels stop shrinking at 11 pixels.
- The page needs `viewport-fit=cover` in its viewport meta tag. Without it a phone reports no notch and the safe-area insets are 0.
- A quick slot is 44 pixels or more at any size. Under 560 pixels wide the slots wrap to five and four.
- The HUD sets `--gb-hud-bottom` on the page when the slots reach into the bottom corners. The touch controls read it and move up.
- Under 480 pixels tall the top right becomes a row: quest, clock, minimap. The touch buttons need the space below.
- The weather picture is worked out from `Ambient`: storm, rain, fog, cloud, wind, and otherwise the sun or the moon.
- A click on a slot does not take the keyboard focus, so the next Space still jumps.
- Tests: `bun test src/features/hud`.
