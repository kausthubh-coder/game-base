---
name: formal-game
description: Formally verify a rule of the game - every order of events in a small model, tied to the real code. Use when a rule has many orders of events (a stroke, a join and a leave, a trade, a save), when asked to model-check or prove something, and to find which model covers the code you changed.
---

# Formal verification in the game

A test checks the cases someone thought of. A model checker walks every order of events in a small design. Use it where the order of things is the risk, and tie the design to the real code so it cannot drift.

## What is verified today

| Area | Its skill | The design | The code it is held to |
|---|---|---|---|
| The build-mode stroke: press, drag, release, cancel, undo | `verify-build-stroke` | `docs/verify/build-stroke/Stroke.tla` | `src/game/build/model.test.ts`, 1,500 random runs of the real systems |

If your change touches code a row covers, run that row's skill. Each skill has a table of the code it stands for and the commit it was last read against.

## Worth verifying next

Each is a place where events arrive in more than one order and a wrong order harms a player.

- **The cloud save** (`src/features/account/account.ts`, `convex/saves.ts`): two devices, each playing, sending and fetching, a drop, a sign-out mid-fetch. No device's play is lost without the player choosing.
- **The bag** (`src/game/inventory`): moves, crafting and pickups never make or lose an item.
- **The save** (`server/store.ts`, `src/game/shell/save.ts`): a change, a save, a restart, a load, in any order, loses nothing a player was shown.

## Adding one

Follow `docs/verify/build-stroke` as the pattern. It has five parts, and a new area gets the same five:

1. **The design**: `docs/verify/<name>/<Name>.tla` and its `.cfg`, with each rule as an INVARIANT, named after its harm.
2. **The tie to the code**: a test beside the system that plays random events on the real code and compares it with the design's actions written in TypeScript, after every event.
3. **Proof it can fail**: a script that breaks the code several ways and expects the test to catch each, and one that breaks the design.
4. **Its own skill**, `verify-<name>`: the rules and their harm in plain words, which code each action stands for, the commit it was last read against, how to check a change, what it leaves out.
5. **A row in the table above.**

Read every model result with Kausthubh's `/statechart` skill: it tells each broken rule as its shortest path in plain words. His `/create-formal-verification-skill` (`~/.claude/skills/create-formal-verification-skill/SKILL.md`) is the full method; read it before starting a new area.

A rule the current code breaks is a finding. Report it with the path that breaks it. Never weaken the rule or the model until it passes.
