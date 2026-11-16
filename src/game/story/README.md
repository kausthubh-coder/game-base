# story

The director: act 1's scenes and the conversations that offer a quest step, the rules that keep the player from
getting stuck, and the hints. It implements no interface and is not in `game.systems`. The kernel steps and saves it
under the name `story`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the director with `kernel.addPlain('story', ...)` |
| `createDirector(game)` | The same without a kernel. It returns `{ system }`. |
| `scenes.sim.ts`: `createSceneRunner(game)`, `STAND_IN` | The scene runner the director steps, and the prefix of its stand-ins' actor ids |
| `fakes.ts`: `stage()` | A kernel with the real talk, quests and director and plain fakes for the rest, for tests |

## The scenes

The 38 scenes are `src/game/content/scenes.ts` (how each is shown and what starts it) and their lines are
conversations in `src/game/content/dialogue.ts` (`scene.<n>`, and `scene.<n>.before` for the lines before a fight).

| What starts it | Rule |
|---|---|
| A step is open | For each open quest step: its `talk`, or `scene.<n>` for a scene step, or `scene.<n>.before` for a fight step with a scene. It starts when the player is within 12 blocks of the step's `place` (or the scene's `at`, or the step's `at`), and at once when the region has no such place, as for Saltgate today. |
| Someone in the world | A conversation spoken by a person the people system has (scene 15 with Tamsin, scene 22 with the queen, Gus's field) waits for the player to talk to them, with the quest mark over them. |
| A moment | After `fight.<n>.won` (or `fight.4.denied`) the scene that follows it (19, 21, 31, 33). The first `vault.<id>.cleared`: scene 25, Calla's seal, at whichever vault. All four `ledger.<section>.filled`: the end of scene 27. `slept` with the dream open: scene 35. A settler walked to a room (`job.<who>` set by the settlement): their line `took.<who>.<job>`. |
| The dinner | The settlement's: its table, its panel (`ui-home.view.ts`) and its asks in chapter 22's words (`SETTLERS` in `content/people.ts`). The step `echo.dinner` is done on `choice.dinner`, which `settlement.grant` sets. The story opens no dinner of its own. |
| Not here | The hall plays the first night's scenes (8, 10 to 14), and the film director scene 9 (its flag sets `scene.9`). |

A conversation starts only when nobody is talking and the player has been free for 1.2 seconds. Each one started is
remembered as `story.seen.<id>` when it ends, and a scene whose `scene.<n>` is already set (by the bots, the debug
door or another way) is not played again.

While a staged or film scene plays, the people in its `cast` the people system does not have near are stood in as
actors `stage:<who>` round its place (or round the player when they are far from it), turned toward the player.
In a memory (24, 26, 28, 29 and the dream) the player's own actor is hidden. They go when the conversation ends.
The camera is the stage view's (`src/game/views/story-stage.view.ts`), the box and the film bars the talk view's.

## The other rules

| Moment | Rule |
|---|---|
| Rain | After the first `crop.planted`, `time.setWeather('rain')` in the next afternoon (time of day 0.5 to 0.7), at least 20 seconds after the planting, for 90 seconds of rain falling. Once. |
| End of the act | When `quest.pilgrimage.done` is set, it sets `act1.ended` and sends `act.ended { act: 1 }`. Once. |
| Lost axe | No axe after grant day: the hint `axe.lost`, and Tamsin's conversation `tamsin.axe` gives another. |
| Full bag | A gift counted in `owed.<item>` is put in the bag as soon as it fits. |
| Lost fox | A bonded fox (the `leaftail` pet) more than 24 blocks from a player who stands inside `region.grant()` is put beside them, with a toast. |
| Hints | Each entry of `src/game/content/hints.ts` goes out once as `hint { id, text }` the first time its condition holds: never in a conversation, 4 seconds apart. The flag `hint.<id>` remembers it. A step's own how-to line is its `hint` in the quest log. |

## Events it sends

`act.ended { act: 1 }`, `hint { id, text }`, `toast { text, icon? }`. The conversations it starts send their own.

## Wiring

```ts
import { install as installStory } from './story/index.sim.ts';

installStory(kernel);                      // after quests, so a step sees what the quests decided
kernel.game.events.on('hint', ({ text }) => { /* show one line */ });
kernel.game.events.on('act.ended', () => { /* the end card */ });
```

It reads `time`, `people`, `inventory`, `region`, `pets`, `talk` and `quests` in its steps. A missing one is
skipped. Each rule is tried by itself, so one that throws is logged once and the others go on.

Save holds the seconds of rain left. Everything else is in flags: `story.rain.*`, `story.seen.<id>`, `act1.ended`,
`hint.<id>`, `owed.<item>`.
