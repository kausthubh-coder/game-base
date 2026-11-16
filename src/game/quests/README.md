# quests

The 21 quests of act 1. It implements `QuestsApi`. The quests are data in `src/game/content/quests.ts`, in the order and with the ids of `src/game/content/ids.ts` and handbook chapter 27.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.quests` |
| `createQuests(game, defs?)` | The same system without a kernel. It returns `{ api, system }`. |
| `rules.sim.ts`: `holds(game, condition)`, `apply(game, effect)` | Work out a condition and run an effect. Dialogue, hints and the director use them. |

## How it runs

- `grantday` starts by itself on a new game. Every other quest starts when the quests it waits for are done (`starts.after`, one or a list). The three vaults (`pump`, `gallery`, `seeds`) all open with `echo` and can be done in any order; `uphill` waits for `pump`, `lights` for `gallery`, and `itself` for `seeds`, `uphill` and `lights`.
- Each quest has its `chapter` (1 to 5). The condition `{ chapter: n }` holds while the latest quest that has started is in chapter n: walk-up lines change with it.
- A step has a `kind` (film, talk, go, do, watch, fight, scene, choice, sleep), a `scene` and a `fight` where chapter 27 gives them, a `place` for the waypoint, a `talk` (the conversation that offers it, which the story director starts) and a `hint` (one more line for the quest log).
- A scene step is done by `scene.<n>`, a fight step by `fight.<n>.won` and the scene that follows it, a choice by its `choice.<id>` flags. A step another system finishes is done by that system's shared flag (`farm.moss.built`, `settler.gus`, `ledger.<section>.filled`, `settlement.step`) or, until its builder gives it a real condition, by its own `step.<quest>.<step>`.
- The open step's condition is checked twice a second, and on the step after any event except footsteps and toasts.
- A step that is not a gate also counts as done when a later step is.
- `tracked()` is the quest the player picked with `track(id)` while it is open, else the first open quest in the act's order, or null. `all()` is every quest with its state and chapter. Both return the same objects until the next check, so the HUD may read them every frame.
- Only the open step has `at`: the nearest person it marks, or the pet, or the named place from `region.place(name)`. `have` and `need` are set on steps that count.
- The person the open step sends the player to carries the mark `quest`, through `people.setMark`.
- `skipTo(id)` marks every earlier quest done without sending its events, gives what they would have given (`satisfy` of each step's condition, then the quest's gifts), resets `id` and the later quests, sends Tamsin to the grant stone or the lodge, and starts `id` and any quest whose waits are now done.

## Flags it keeps

`quest.<id>.started`, `quest.<id>.done`, `quest.<id>.step` (the id of the open step, or `''`), `been.<place>` for a step that asks for a place ever reached.

## Events it sends

| Event | When |
|---|---|
| `quest.started { quest }` | A quest becomes active |
| `quest.step { quest, step }` | A step is done. `step` is the step that finished. |
| `quest.completed { quest }` | The last step is done |

## Wiring

```ts
import { install as installQuests } from './quests/index.sim.ts';

installQuests(kernel);                     // any order: it reads other systems only in steps and api calls
const quests = kernel.game.systems.quests;
const tracked = quests.tracked();          // the tracker: tracked.title and tracked.steps
const open = tracked?.steps.find((step) => !step.done);
if (open?.at) { /* the minimap waypoint */ }
kernel.game.events.on('quest.step', () => { /* stinger, save */ });
quests.skipTo('kitchen');                  // the debug door
quests.track?.('seeds');                   // the quest log: follow another open quest
```

It reads `region`, `people`, `inventory`, `almanac`, `placeables`, `pets` and `crops`. A missing one reads as empty. A check that throws is logged once and tried again, so the shell never switches quests off.

Save holds each quest's state, the id of its open step, and the quest the player follows. The flags are saved by the kernel.

Loading a save rebuilds `all()` and `tracked()` immediately. Continue can read them before the first simulation step; quest marker synchronization still runs on the next check.
