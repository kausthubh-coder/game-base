# Play in Chrome

`bun tools/play.mjs` keeps one Chrome open for this worktree and plays the game in it two ways: through the debug door (`--mode door`, the default), or like a person with real keys and clicks only (`--mode human`). Use the port `bun tools/doctor.mjs` gives you: `PLAY_PORT` or `--port`.

To playtest, start in human mode, then loop `act` and read the block it prints. Use `film` where motion matters, `note` what you find, and finish with `journal`.

## Commands

| Command | What it does |
|---|---|
| `start --mode human` | Builds the game into `.artifacts/play/site`, serves it and opens Chrome. It prints the session file `.artifacts/play/session.json` (and the state, unless blind). Options: `--blind`, `--size 1366x768` (960x540 by default), `--touch`, `--software` (software drawing), `--port 5495`. To change any of them, stop and start again. |
| `look [name]` | Takes a picture into the journal and prints the look block (below). `--json` prints the same as JSON. |
| `act '<input>' [name]` | Plays the inputs, then looks. An input is one JSON input, a JSON list of them, or a bare key name (`act KeyE` presses E). If an input fails, the block's first line says which one and how many were not played, it still looks, and it exits 1. |
| `film '<input>' [name] [--fps 10]` | Records every frame Chrome draws while the inputs play and for 0.5 s after, through the screencast (screenshots if that sends nothing; the block says which). It writes a sheet of the frames, each labelled with its time, keeps the full-size frames in a folder beside it, then looks. **flickers** lists runs of 1 to 4 frames drawn unlike both the frame before and the frame after, while those two match: a sprite drawn wrong or dark for a moment, even while the camera scrolls. **jumps** lists the frames that differ from the frame before by over 5 times the film's median difference, such as a panel closing; `and back` means the next frame jumps too. Both are marked in red on the sheet. Open the sheet anyway, since a flicker longer than 4 frames shows only there. |
| `note <bug\|polish\|question> '<words>'` | Pins a finding to the last picture. |
| `journal [folder] [--to <folder>]` | Writes `journal.html` (every step with its input, picture, changes and notes) and `notes.md` (the notes alone) into the session's folder and prints both paths. It works after `stop` too, on the newest session. `--to docs/playtests/img/<date>-<charter>` also copies each noted picture there as a JPEG of about 100 KB, with a `notes.md` that links them, for a report in the repo. |
| `do '<input>'` | Plays one JSON input and prints the whole state (`{"done":true}` when blind). It fails on a console error since the last report, once. |
| `state` | Prints `window.__game.state()`. A blind session refuses. |
| `shot <png>` | One picture, outside the journal. |
| `record <name>`, `record stop` | Saves the inputs played between them to `.artifacts/play/recordings/<name>.json`. Every input is also recorded on its own, failed ones too. To keep a recording, copy it into `tools/play/scenarios/`. |
| `replay <file>`, `replay all` | Opens a clean page at the recording's seed and mode and plays it. It fails on a failed input or a console error. `all` plays every file in `tools/play/scenarios/` and fails if one fails. It starts a session if none is open. |
| `stop` | Closes Chrome and the server this session started, and prints the journal folder. |

## The look block

```
act 003 skip  .artifacts/play/journal/2026-11-11T23-30-29/003-skip.png
screen (19):
  "Talk to Tamsin at the grant stone"  704,279 240x41
  [Minimap. Open the full map.]  788,36 135x135
  Quick slot [1: Axe, 1] [2: empty] …  9x 54x54 from 213,464 to 693,468
wrong: none
changed:
  hero moved 1.3 m north-east
  prompt: "Talk to Tamsin"
now: hero at x -1.6, z -223.4 (y 22); day 1, 06:32; prompt: "Talk to Tamsin"; quest plot: meet; hands empty
problems: none
```

- **screen**: what a player can read (`"text"`) or press (`[name]`) on the DOM interface, in reading order, with the box in viewport pixels (x,y wxh). It adds `disabled`, or `blocked by …` when a full-screen layer such as the dialogue sits over the button. Text drawn into the 3D canvas is not on this list, so look at the picture for it.
- **wrong**: `cut` text clipped by its box; `off` partly outside the viewport; `over` a pressable thing covered at its centre, two pressable things that overlap, or text drawn over other text or over a pressable thing; `small` a pressable thing under 24 px.
- **changed**: what changed in the game since the last look: hero distance and compass direction (north is -z), prompt, talk line, quests, bag, held item, game time, pause, new `viewErrors` and `failed` systems.
- **now**: what the HUD tells a player.
- **problems**: console errors and warnings, failed requests and 4xx or 5xx responses since the last look. Each is reported once.

A **blind** session (`start --blind`) prints only screen, wrong and problems, refuses `state`, and refuses `check` and `hold` with `until` from `do`, `act` and `film`. That way you know only what a new player would see. Assert with `see` and `gone` instead. A `replay` still runs its checks.

Each session's journal is `.artifacts/play/journal/<start time>/`: numbered pictures, film sheets and frame folders, and `journal.jsonl`.

## Inputs

| Input | Does |
|---|---|
| `{"type":"click","text":"New game"}` | Clicks the button with that accessible name. With `"x":400,"y":300` (and `"button":"right"`) it clicks there. |
| `{"type":"press","key":"KeyE"}` | Presses a key (Playwright key names). |
| `{"type":"hold","key":"KeyW","ms":250}` | Holds a key. With `"until":{"path":"player.z","max":-224},"timeout":15000` it lets go when the state condition holds, or fails. |
| `{"type":"type","text":"Hollow Oak"}` | Types text into what has focus. |
| `{"type":"see","text":"Talk to Tamsin","timeout":10000}` | Waits until that text is on the screen (in a piece the screen list shows), or fails. |
| `{"type":"gone","text":"Skip"}` | Waits until that text is off the screen, or fails. |
| `{"type":"check","path":"talk.npc","equals":"tamsin"}` | Waits for a state condition: `equals`, `min`, `max`, or truthy. Default timeout 10000 ms. |
| `{"type":"move","x":420,"y":300}`, `mouseDown`, `mouseUp`, `{"type":"wheel","y":200}` | Moves, presses, releases and scrolls the mouse. `button` works as in click. |
| `{"type":"wait","ms":200}` | Waits. |
| `{"type":"tap","text":"New game"}` or `{"type":"tap","x":400,"y":300}` | A finger tap. Needs `start --touch`. |
| `{"type":"swipe","x":120,"y":300,"dx":0,"dy":-60,"ms":600}` | One finger down, slid by dx, dy over half of ms, held, then lifted. Needs `--touch`. |
| `{"type":"door","method":"skipTo","args":["festival"]}` | Door mode only: `newGame`, `teleport`, `give`, `skipTo`, `advance`, `setTime`, `setCamera`, `look`, `interact`, `talkThrough`, `manual`, `turn`. |

With `--touch`, Chrome reports a touch screen (`pointer: coarse`), and taps press the interface's buttons. The game itself has no touch controls yet. The input feature's stick and buttons (`src/features/input/touch.ui.ts`) are not wired into it, so on a touch screen the hero cannot walk.

## The tool's own checks

`bun test tools/play` tests the pure parts. `bun tools/play/check-eyes.mjs` (run it with no session open) starts sessions on the pages in `fixtures/` with `start --page <html>`. It checks that look flags each kind of wrong, that `see` and `gone` fail when they should, that a console error fails `do` once only, and that `film` finds a one-frame flicker and nothing on a still or steadily moving page. The `play` part of `bun run verify` runs all three: `replay all`, these tests and `check-eyes`.
