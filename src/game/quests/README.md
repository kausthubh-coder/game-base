# quests

The five quests of the first part. It implements `QuestsApi`. The quests are data in `src/game/content/quests.ts`, with the ids of `docs/play/act1.md`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.quests` |
| `createQuests(game, defs?)` | The same system without a kernel. It returns `{ api, system }`. |
| `rules.sim.ts`: `holds(game, condition)`, `apply(game, effect)` | Work out a condition and run an effect. Dialogue, hints and the director use them. |

## How it runs

- The quest `plot` starts by itself on the first step of a new game. `leaftail` starts when `roof` is done. Conversations start `roof`, `bread` and `festival`.
- The open step's condition is checked twice a second, and on the step after any event except footsteps and toasts.
- A step that is not a gate also counts as done when a later step is. A workbench set down passes "cut 12 logs", a bonded leaftail passes "pick 3 berries", a night's sleep passes the whole roof quest. The talks are gates.
- `tracked()` is the first quest that is active, or null. `all()` is every quest with its state. Both return the same objects until the next check, so the HUD may read them every frame. `all()` is empty before the first step.
- Only the open step has `at`. It is the nearest person to talk to, or the pet, or the named place from `region.place(name)`. `have` and `need` are set on steps that count.
- The person the open step sends the player to carries the mark `quest`, through `people.setMark`. It is set again at every check and cleared when the step is done.
- `skipTo(id)` marks every earlier quest done without sending its events, gives what they would have given (Almanac, axe, hoe, watering can, the mossling page, the flags), resets `id` and the later quests, sends Tamsin to the lodge (or the grant stone for `plot`) and starts `id`. It cannot bond the leaftail, because the pets system has no call for that.

## Flags it keeps

`quest.<id>.started`, `quest.<id>.done`, `quest.<id>.step` (the id of the open step, or `''`), `been.town.gate`.

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
quests.skipTo('bread');                    // the debug door
```

It reads `region`, `people`, `inventory`, `almanac`, `placeables`, `pets` and `crops`. A missing one reads as empty. A check that throws is logged once and tried again, so the shell never switches quests off.

Save holds each quest's state and the id of its open step. The flags are saved by the kernel.
