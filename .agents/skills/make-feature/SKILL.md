---
name: make-feature
description: Build or change a feature of the game - a rule, a system, something drawn, a panel, content. Use at the start of any task that adds or changes how the game plays or looks, to know where each part goes and what it must not break.
---

# Make a feature

Data first, then rules, then the picture. Each part has one home, and a check fails when it is in the wrong one.

## Where each part goes

| Part | Home | The rule that guards it |
|---|---|---|
| A block, item, recipe, crop, person, quest, line of dialogue | Data in `src/content` or `src/game/content`. No engine code changes for a new entry. | `bun run check` |
| What happens: a rule of the game | A `.sim.ts` file under `src/game/<system>/`. It imports only other `.sim.ts` files, content and `src/engine`. No Three.js, no page, no sound. | `bun run boundaries` |
| What is drawn | A `.view.ts` file. One file in `src/game/views/` named `<something>.view.ts` that exports `install` is found by itself (`src/game/shell/README.md`). | |
| A panel or menu | A `.ui.ts` file, built from the pieces in `src/game/ui`. Take the look that is there. | |
| A reusable piece with no story in it | `src/features/<name>/`, exporting `createX(ctx, options)`. No globals, no reaching into another feature. | `AGENTS.md` rule 2 |
| A number that differs by graphics level | The one table in `src/content/quality.ts`, read by the view | A test fails a view that keeps its own |

## What a new feature must keep true

- **Saved.** A system that holds state has `save()` and `load()`. The solo save, the world server's save and the online copy all use them, so a system that saves right is also right online.
- **Online.** In an online world the browser does not run the rules. A player's action reaches the server only through the methods `src/game/online/online.ts` forwards. A new kind of action needs a new act there and in `src/engine/net/messages.ts`. Read `src/game/online/README.md` before adding one.
- **One player today.** The rules know one bag and one set of quests (`docs/multiplayer.md`, stage 2). Write new state so it can become one player's own: keyed by who, not global.
- **Speed.** Nothing allocated per frame. After a change to anything drawn, read `window.__game.costs()` and stay inside rule 6 of `AGENTS.md`.
- **Sound and models** are made by tools, never added by hand (rule 4).

## The order of work

1. Write the data and the rule, with a scenario that plays it (`test-game` skill). Run `bun tools/sim.ts scenarios`.
2. Draw it. Reach it in a browser through the door and look at the screenshot yourself (`verify-game` skill).
3. Play it like a person once, with real keys, and look at the pictures (`playtest-game` skill).
4. `bun run verify` before you say done. A task that changes what a player sees ends with a before and after picture in `.artifacts/<feature>/`.

A design question that is Kausthubh's taste (a new look, a new mechanic, a name) is shown to him as two options before one is built.
