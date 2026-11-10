# demos/game-ui

The panels from `src/game/ui` alone, over a fake game. `main.ts` builds stub systems with sample data
(a bag, five recipes, four Almanac pages, four quests) and a row of buttons that open each panel, add a
fact, send a hint, a toast and the end card. Nothing here is used by the game.

```
bun tools/demo.mjs build game-ui
bun tools/serve.mjs dist/demos/game-ui 5321      # prints its pid. Stop it by that pid.
bun tools/shot.mjs "http://127.0.0.1:5321/?panel=bag" .artifacts/game-ui/bag-1440.png
```

A full `vite build` empties `dist/`, and with it this demo. While other builds run, copy the build out
and serve the copy: `cp -R dist/demos/game-ui .artifacts/game-ui/site`.

## The address

| Part | What it does |
|---|---|
| `?panel=<name>` | Opens `bag`, `hand` (the bag's "By hand" tab), `make`, `almanac`, `quests`, `title`, `pause`, `settings` or `end` at the start, and hides the buttons |
| `?extras=1` | Shows the prompt, a hint, toasts, the Almanac's note and the breaking ring |
| `?save=0` | The title has nothing to continue |
| `?art=0` | Leaves out the manifest's `ui` pictures, to show the CSS fallback |

## For scripts

`window.__ui` is the object `createGameUi` returned. `window.__demo` holds `game`, `almanac`,
`open(name)` and `showExtras()`.

## Wiring, as the demo does it

```ts
const manifest = await fetch('./assets/manifest.json').then((r) => r.json());
const ui = createGameUi(document.querySelector('#ui')!, game, {
  icon: (name) => cellOf(manifest.icons, name),          // null when the sheet has no such icon
  picture: (name) => firstFrameOf(manifest.sprites, name),
  project: () => ({ x: root.clientWidth / 2, y: root.clientHeight * 0.56 }),
  stats: () => ({ days: 3, wheat: 24, blocks: 61, pages: 1 }),
  hasSave: () => saved, newGame, continueGame, saveAndQuit, setQuality, setVolume,
  art: { title, panel: { url: panelUrl }, button: { url: buttonUrl } },
});
```

Screenshots are in `.artifacts/game-ui/`.
