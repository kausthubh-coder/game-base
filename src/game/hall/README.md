# hall

Ilara's Hall: the Shut Door north of the grant, the first night, the Mark, the Custodian and the Heartstone. It implements `HallApi`. The story behind it is the handbook chapter `04d-new-story.md`. The place is `HALL` in `src/game/content/region.ts`, and the words are the scenes and the Custodian's lines at the end of `src/game/content/dialogue.ts`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.hall` |
| `createHall(game)` | The same system without a kernel. It returns `{ api, system }`. |
| `SCENES` | The id of every scene it starts. A test checks each one is a conversation spoken by `SCENE`. |
| `heartWords(heart)` | The Heartstone's number as the toast it gives |
| `HEART_WORTH` | What one roof, one crop and one bonded beast add |
| `FOX_ID`, `CUSTODIAN_ID` | The two actors it owns: `fox:blighted` and `npc:custodian` |

## The first night, in order

The quest `night` ("The Shut Door") starts when `roof` is done. Each step of it waits on a flag that a scene here sets.

| Step | What the player does | What happens | Flag |
|---|---|---|---|
| `bed` | Lies down in the evening, or is on the plot when night falls | `time.sleep()` asks the hall first. It answers "Something is moving outside. You cannot sleep." and the player stays awake. | `night.fox` |
| `door` | Walks to the place `shut.door` | A Blighted fox follows, slower than the player, and stops three blocks off. Within 2.6 blocks of the place the scene `night.door` plays, and the door's nine cells are cleared. | `door.open` |
| `mark` | Walks in | Inside the court the scene `hall.mark` plays. The fox waits a block and a half outside the doorway and never crosses it. | `mark`, `hall.lit` |
| `key` | "Turn the key" at the plinth | The scene `custodian.wake`. The Custodian's actor goes from `sleep` to `idle`. | `custodian.awake` |
| `calm` | "Hold out your hand" within 3.6 blocks of the fox | The scene `fox.calm`. The fox carries a heart for 3 seconds, runs out west, and is taken out of the world. | `fox.calmed`, then `fox.gone` |
| `heart` | "Touch the Heartstone" | The scene `heart.first`. After it, touching the stone gives its number as a toast. | `heart.seen` |
| `sleep` | Sleeps, or is still up when dawn comes | The hall no longer objects. In the morning Tamsin, Juniper, Gus and Brack are sent to the grant stone and held there. | `night.over` |
| `tamsin` | Talks to Tamsin | Her conversation `tamsin.mark`. The four are released to their routines. | `night.told` |

Until `heart.seen` is set the hall keeps the player awake, with a different line for each stage.

Before the night, the door gives the prompt "Push the door" and the scene `door.shut`. The mural and the Gate give a look each once the Mark is there, with a line from the Custodian once it is awake.

A game that skips past the night (`quests.skipTo`) gets every flag at once. The hall then clears the door, shows the Custodian awake and brings no fox.

## The Heartstone

`heart()` returns `{ level, parts }`. A bed is a roof worth 2, a growing crop is worth a quarter, a bonded pet is worth 5. The level is the sum, rounded down. Once `heart.seen` is set the HUD shows it (`views/ui-heart.view.ts`). Once the Custodian is awake, the level rising past 3, 6 and 10 in play gets one line from it each, as a toast (`CUSTODIAN_HEART` in `content/dialogue.ts`), and sets `heart.said.<level>` so it is said once. It is the first form of the number the story calls how alive the land is. The Gates and the kingdom's steps will read it.

## The api

- `heart()`, above.
- `fox()` is where the Blighted fox stands, or null when it is not about.

## Contract changes

- `HallApi` and `Heart` are new in `api.sim.ts`, and `Systems` has `hall`.
- `TimeApi.guardSleep?(guard)` is new. `time.sleep()` asks each guard, and the first that returns words keeps the player awake and sends the words as a toast.
- `RegionPlan.sealed` is new: rectangles where `region.isProtected` is true, as it is in the town. The Hall's court is one.
- `SCENE` in `content/dialogue.ts` is the speaker of a conversation that a system starts by its id. `talkTo` never picks one.

## Wiring

```ts
import { install as installHall } from './hall/index.sim.ts';

installHall(kernel);                       // after talk, people, placeables, time and region
// On its first step it adds the Custodian's actor, its six prompts and its sleep guard.
const { level } = kernel.game.systems.hall.heart();
kernel.game.events.on('flag.changed', ({ flag }) => {
  if (flag === 'door.open') { /* swing the door's prop open, play stone on stone */ }
  if (flag === 'hall.lit') { /* light the Hall's lamps */ }
});
```

It reads `region`, `talk`, `people`, `placeables`, `crops`, `pets`, `interact` and `time`. A missing one reads as empty.

Save holds the fox's position and how long ago it was calmed, or null. Everything else is in flags, and the open door is in the world's edits.

## Not done yet

- The fox is drawn with the leaftail's sheet. A grey, dull-eyed sheet of its own is still to make.
- The Custodian stays on its plinth. It does not follow the player.

## Tests

`bun test src/game/hall`, and the whole night played through the real rules in `bun test src/game/play`.
