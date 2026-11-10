# story

The director: the scripted moments of the first part, the rules that keep the player from getting stuck, and the hints. It implements no interface and is not in `game.systems`. The kernel steps and saves it under the name `story`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the director with `kernel.addPlain('story', ...)` |
| `createDirector(game)` | The same without a kernel. It returns `{ system }`. |
| `fakes.ts`: `stage()` | A kernel with the real talk, quests and director and plain fakes for the rest, for tests |

## What it does

| Moment | Rule |
|---|---|
| Rain | After the first `crop.planted`, `time.setWeather('rain')` in the next afternoon (time of day 0.5 to 0.7), at least 20 seconds after the planting. 90 seconds later `setWeather(null)`. Once. |
| Festival starts | When the flag `bread.delivered` is set and it is dusk or night (0.73 on). If the player chose to wait with Maren (`festival.wait`), it calls `time.setTimeOfDay(0.735)` first. Then `setWeather('clear')`, every person is sent and held (`tamsin` and `brack` at `river.bank`, the rest at `town.square`), the flag `festival.started` is set, and `festival.started` and a toast go out. |
| Festival ends | The next morning (0.27): everyone is released, `setWeather(null)`, flag `festival.over`. The lamp and the last talk still work afterwards. |
| Lamp | A click handler added to `actions` on the first step. The secondary button with `river_lamp` in the hand, within 6 blocks of `river.bank`: one lamp is taken, the flag `festival.lamp` is set, `festival.lamps` counts, and a toast goes out. Further away it only says where to go. |
| End of the act | When a conversation ends with the flag `festival.ended` set (Tamsin's last scene), it sets `act1.ended` and sends `act.ended { act: 1 }`. Once. |
| Lost axe | No axe in the bag after the first talk: the mark `quest` over Tamsin and the hint `axe.lost`. Her conversation `tamsin.axe` gives another. |
| Short of seed | Wheat in the bag plus 2 for each seed in the bag and each wheat crop in the ground is under 20: the mark `quest` over Gus and the hint `seeds.short`. His conversation `gus.more` gives 4 seeds. |
| Full bag | A gift counted in `owed.<item>` is put in the bag as soon as it fits. |
| Lost leaftail | A bonded leaftail more than 24 blocks from a player who stands inside `region.grant()` is put beside them, with a toast. |
| Hints | Each entry of `src/game/content/hints.ts` goes out once as `hint { id, text }` the first time its condition holds: never in a conversation, 4 seconds apart. The flag `hint.<id>` remembers it. |

Tamsin's last scene ends with "Go on. Float your lamp." after the player has floated Odo's. So her last line hands over a second `river_lamp`, and the player can float it after the end card.

## Events it sends

`festival.started {}`, `act.ended { act: 1 }`, `hint { id, text }`, `toast { text, icon? }`.

## Wiring

```ts
import { install as installStory } from './story/index.sim.ts';

installStory(kernel);                      // after quests, so a step sees what the quests decided
kernel.game.events.on('hint', ({ text }) => { /* show one line */ });
kernel.game.events.on('festival.started', () => { /* lamps on the water, the festival music */ });
kernel.game.events.on('act.ended', () => { /* the end card */ });
kernel.game.events.on('flag.changed', ({ flag }) => {
  if (flag === 'festival.lamp' || flag === 'festival.lamps') { /* draw a lamp on the river */ }
});
```

It reads `time`, `people`, `actions`, `inventory`, `region`, `pets`, `crops` and `quests` in its steps. A missing one is skipped. Each rule is tried by itself, so one that throws is logged once and the others go on.

Save holds the seconds of rain left. Everything else is in flags: `story.rain.due`, `story.raining`, `story.rain.done`, `festival.started`, `festival.over`, `festival.lamp`, `act1.ended`, `hint.<id>`, `owed.<item>`.
