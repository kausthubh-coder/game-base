# The game in Chrome

The real page, built and served on this machine, in headless Chrome on the graphics chip.

## Sub-features

- `door`: reach any point of the game through `window.__game`.
- `human`: real keys and clicks only. A whole playtest in this mode is the `playtest-game` skill.
- `shots`: fixed scenes compared with approved pictures, with the draw budgets.

## How to get to it (user POV)

The player opens the page, presses New game, walks with W A S D, talks with E, opens the menu with Escape.

## Driving it with `bun tools/play.mjs`

Preconditions: `bun tools/doctor.mjs` is clean. Use the port it printed (`PLAY_PORT`).

- **Start:** `bun tools/play.mjs start --mode door` (or `--mode human`). It builds, serves and opens the game.
- **Read:** `bun tools/play.mjs state` prints the game's state as JSON: player, clock, quests, bag, talk, camera.
- **Act through the door:** `bun tools/play.mjs do '{"type":"door","method":"skipTo","args":["festival"]}'`. Other methods: `teleport`, `give`, `setTime`, `step`, `interact`, `talkThrough`.
- **Act like a person:** `bun tools/play.mjs do '{"type":"hold","key":"KeyW","ms":250}'`, `'{"type":"press","key":"KeyE"}'`, `'{"type":"click","text":"New game"}'`.
- **Check:** `bun tools/play.mjs do '{"type":"check","path":"talk.npc","equals":"tamsin"}'` waits for the state and fails on timeout.
- **Look:** `bun tools/play.mjs act '<input>' <name>` plays an input and prints the picture's path, the interface as text, what looks wrong and what changed; `look` does the same with no input, `film '<input>'` shows motion as a sheet of frames. Open the picture. `shot <png>` is one picture outside the journal.
- **Keep it:** `bun tools/play.mjs record <name>`, play, `record stop`, and copy the file into `tools/play/scenarios/`. `bun tools/play.mjs replay <file>` runs it again and fails on a console error or a failed check.
- **Stop:** `bun tools/play.mjs stop`.
- **Pictures:** `bun tools/shots.mjs all --check`. Scenes are in `tools/shots/scenes.json`.

`tools/play/README.md` has every input.

## Gotchas

- Human mode refuses door inputs. Start a second session to mix them.
- `tools/play-smoke.mjs`, `play-ui.mjs` and `play-act1.mjs` are the `slow` part: they play the most and take the longest. A check in them waits for state, never for a count of frames (`tools/play/wait.mjs`); `tools/play/frame-checks.md` tells how frame-count waits once hid a real bug.
- Approved pictures are compared only with the same renderer. A different one warns and checks the budgets alone.
- The background cache does not register under automation. Add `?sw` to the address to test it.
