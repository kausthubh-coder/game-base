---
name: playtest-game
description: Play the game like a person and report what a player would hit - real keys and clicks, deciding from the picture. Use when asked to playtest, to find bugs or polish by playing, to judge how something looks or feels, and after building anything a player sees.
---

# Playtest the game

A script checks what someone thought to assert. A playtester plays as a person does, looks at every picture, and reports what a player would hit. `docs/testing.md` says how this fits with scripts and models.

## 1. Take a charter

A charter is one part of the game, one player, and a budget of about 60 actions. `docs/playtests/README.md` lists the parts and when each was last played: take the one played longest ago, or the part you just built. Reach it the way a player does, from New game or Continue.

| Player | How they play | Start with | Finds |
|---|---|---|---|
| **New** | Knows nothing. Reads the screen and does what it says. | `--blind` | Whether the game says what to do, and whether it answers |
| **Hurried** | Skips text, presses keys early and twice, opens a menu in the middle of things, reloads and continues | | What breaks out of order |
| **Thorough** | Presses every button on every panel, walks into every corner, tries every item on everything | | Dead buttons, places to get stuck, things that do nothing |
| **Small screen** | Any of the above at a Chromebook's size | `--size 1366x768` | Interface that is cut off or covers the play |

## 2. Start

```sh
bun tools/doctor.mjs                                # once in a worktree; export the PLAY_PORT it prints
bun tools/play.mjs start --mode human --blind       # real keys and clicks only; the game's state is hidden
```

`tools/play/README.md` has every command and input. A blind session refuses `state`, `check` and `hold` with `until`: wait on what the screen shows with `see` and `gone`.

## 3. Play in a loop

1. `bun tools/play.mjs act '<input>' <name>` plays the input and looks.
2. **Open the picture it names.** The text block lists the interface; only the picture shows the world.
3. Pin what you saw while you see it: `bun tools/play.mjs note bug|polish|question '<what, where on the screen, why it reads as wrong>'`.
4. Choose the next input from the screen: a tip, a prompt, a marker, a button. When the screen gives no next step, that is a `question` note, and then you try what a person would try.

Use `film '<input>' <name>` for anything that moves: a walk, a panel opening, talk starting, a tool swing, sleep, a camera turn. Open the sheet, and open at full size the marked frames whose paths it prints. A fade or a panel opening is marked too: the picture says which it is.

- An action is one `act` or `film`. Give `act` a list when the steps need no look between them, such as the presses that walk through a conversation: `act '[{"type":"press","key":"Enter"},{"type":"wait","ms":400},{"type":"press","key":"Enter"}]' talk`.
- The game's clock stands still between commands, so reading a picture costs no game time. To see what happens when a player does nothing, play a `wait`.
- Words drawn into the 3D picture (the opening's title, a sign) are in the picture only, never in the text block.

As the New player, everything you know comes from the screen. Read the game's code and content only after the playtest, to place a bug.

Done playing when the budget is spent or the charter's part is played through, and every picture was opened.

## What to look for

| Ask | A note when |
|---|---|
| Do I know what to do next? | The tracker, tip or prompt is missing, late, wrong, or names a key that does nothing |
| Did the game answer? | A press changes nothing on the screen, or the answer comes with no sound cue, motion or text to show it |
| Can I see the hero and what I act on? | Either is hidden behind a stone, a tree, a wall or a panel, or off the screen |
| Is the interface in the way? | Pieces overlap, text is cut, a marker sits on a panel, a target is small, words sit unreadable on busy ground. The `wrong` lines list what a machine can tell; the picture shows the rest. |
| Does the picture hold? | Stray lines, holes, seams, a thing floating or sunk, a shadow apart from its owner, a sprite at the wrong height or size, something popping in |
| Does it move right? | In a film: a flicker, a slide with no walk, a snap of the camera, a stutter, a panel that jumps into place |
| Do the words read right? | A typo, a wrong name, a line that explains the theme, a twee name. The tone is an epic anime RPG with plain causes. |
| Can I get stuck? | A corner, a fence, water, the back of a building, a menu opened during talk, Escape pressed anywhere, that leaves no way on |
| Does it hold? | After a reload and Continue, something is lost, doubled or moved |
| Does it drag? | Twenty actions pass with nothing new to see or do |

## 4. Report

1. `bun tools/play.mjs journal` writes the playtest as a page and the notes as a list. `bun tools/play.mjs stop`.
2. **Each bug becomes a script before anyone fixes it.** Make it happen again and count how often (3 of 3, 1 of 5). Then write the check with the `test-game` skill: a recording that fails today, or a scenario. `see` and `gone` assert what a player can read, `clean` that nothing on the screen is cut, covered or off the edge, `check` the game's state. File it in `docs/bugs/` as that skill says, with the failing recording beside it.
3. Write `docs/playtests/<date>-<charter>.md`: the charter, the renderer and size, how many actions were played, then the findings, worst for a player first. Each finding has what you did, what you saw, why it reads as wrong, and its picture. `bun tools/play.mjs journal --to docs/playtests/img/<date>-<charter>` copies each noted picture there as a small JPEG; link those. End with what you did not reach.
4. Set the part's date in `docs/playtests/README.md`.

A playtester reports. Game code is fixed by whoever builds, from the bug file. How the game should feel is Kausthubh's call: report what you saw and why it reads as wrong, and leave the redesign to him.
