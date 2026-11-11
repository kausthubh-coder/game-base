# How agents test the game

Three ways, and each finds what the others cannot. Use all three on anything a player will touch.

| Way | Who plays | Finds | Cannot find | Skill |
|---|---|---|---|---|
| **Scripts** | A script: a list of inputs and what must be true | A rule or a path that stopped working. It runs again on every change. | Anything nobody thought to assert. How it looks. | `test-game` |
| **A playtest** | An agent playing like a person: real keys and clicks, deciding from the picture | A prompt that never shows, a marker drawn over the quick slots, a hero hidden behind a stone, a tip nobody understands, a step that drags | Orders of events a single play never takes | `playtest-game` |
| **A model** | A model checker walking every order of events in a small design, tied to the real code | Two tabs, a drop and a restart landing in the one order that leaves a ghost player | Anything outside the design: the picture, the feel | `formal-game` |

They feed each other. A playtest finding becomes a script before it is fixed, so it stays fixed. A script that
needs many orders of events to be sure becomes a model. A model's left-out list names what a playtest must look at.

## Scripts

All of this exists; `test-game` has the table of which check goes where.

| Kind | Runs | Speed | Write it as |
|---|---|---|---|
| Scenario | The real rules in Bun, no browser | All of them in about a second | `src/game/scenarios/<name>.sim.ts` |
| Bot | Random valid presses under a seed, with the invariants checked after every step | About 100,000 steps a run | An invariant in `src/game/play/invariants.sim.ts` |
| Recording | The real page in Chrome, through the debug door or with real keys only | Seconds each | `tools/play/scenarios/<name>.json` |
| Approved picture | A fixed scene against its picture and its draw budgets | Seconds each | `tools/shots/scenes.json` |

A recording asserts on the game's state with `check` and on what the player can read with `see` and `gone`.
`bun tools/play.mjs replay all` plays every recording, and `bun run verify` runs that.

## A playtest

`bun tools/play.mjs start --mode human` is the player's hands. Its eyes are four commands:

| Command | What comes back |
|---|---|
| `act '<input or list of inputs>' [name]` | Plays the inputs, then a `look` |
| `look [name]` | A screenshot, what is on the screen as text (each visible piece of interface with its place, and what looks wrong: cut off, off the screen, overlapping, too small to hit), what changed in the game since the last look, and any console warning or failed request |
| `film '<input>' [name]` | The frames drawn while the input plays, as one sheet, with the frames that jump marked |
| `note <bug\|polish\|question> '<words>'` | Pins a finding to the last picture |

Every one of them adds a line to the session's journal. `bun tools/play.mjs journal` writes the journal as a
page and the notes as a report: what the playtester did, saw and thought, in order, with the pictures.

`start --blind` hides the game's state from the playtester, who then knows only what the screen shows, as a
new player does. `start --size 1366x768` plays at a Chromebook's size.

A playtest follows a charter: one part of the game, one kind of player, a time box. `docs/playtests/README.md`
lists the parts of the game and when each was last played. Reports go to `docs/playtests/<date>-<charter>.md`,
bugs to `docs/bugs/`.

## A model

`formal-game` lists what is modelled, what is worth modelling next, and the five parts every model has. Each
model has its own skill, `verify-<name>`, that says which code it stands for and how to recheck a change.

## What is still not covered

- Sound. Nobody can hear it here. The checks cover that a clip is requested and decodes.
- Frame rate on a player's device. Draw calls and triangles are exact here; a frame rate from this Mac is not reported.
- Taste. A playtester reports what it saw and why it reads as wrong. Kausthubh decides what the game should feel like.
