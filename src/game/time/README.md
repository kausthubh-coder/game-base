# Time

Implements `TimeApi` as `game.systems.time`: the clock, day and night, sleep, and the weather. The weather rules are the machine in `src/features/weather`. This system steps it and copies its numbers into `game.ambient`.

## What it exports

`index.sim.ts` exports:

- `install(kernel)`, which adds the system under the name `time`.
- `createTime(game)`, which returns `{ api, system }`.
- The constants `DAY_LENGTH` (720), `MORNING` (0.27), `EVENING` (0.66) and `BED_REACH` (4).

Every step it writes `game.clock` (`day`, `timeOfDay`, `seconds`) and all of `game.ambient`.

The API:

| Call | What it does |
|---|---|
| `dayLength` | 720 seconds of real time. |
| `canSleep()` | True when the time of day is 0.66 or later, or before 0.23, a `bed` station stands within 4 blocks of the player, and the player is not under open sky. |
| `sleep()` | Jumps to 0.27 of the next day, then sends `day.started` and `slept`. It does not ask `canSleep()` first. The caller does. |
| `setWeather(kind)` | Holds a kind of weather until the next call. `null` hands the weather back. |
| `setTimeOfDay(t)` | Moves the dial to `t` on the same day. Use `sleep()` to reach the next morning. |
| `onThunder(listener)` | Calls the listener with the place of each lightning strike, later for a far strike. It returns a function that stops it. This is new in the contract. |

The clock:

- The day number goes up at dawn, at 0.23. A new game starts at 0.27 on day 1.
- The day has the weather clock's four parts in the same proportions: 36 seconds of dawn (0.23 to 0.27), 432 of light (to 0.73), 36 of dusk (to 0.77) and 216 of night.
- `clock.seconds` counts game time and never goes back. Sleep adds the night it skipped. A jump back with `setTimeOfDay` adds nothing.

The weather:

- Day 1 is held clear. From day 2 the machine picks the weather from its seed.
- `setWeather('rain')` starts a front. Wind and cloud come first, rain starts about 45 seconds after the call and is full after 62. To have rain fall for 90 seconds, hold it for about 135.
- `setWeather(null)` ends held weather. Anything but clear leaves in a front (rain stops within 16 seconds), then the machine carries on from clear. On day 1 it goes back to held clear.
- The machine's glowing motes and its rainbow are not in `Ambient`, so this system does not pass them on.

## Events it sends

| Event | When |
|---|---|
| `day.started { day }` | Once for each day, on the first step of the day: at dawn, or right after `sleep()`. Day 1 gets one too, on the first step of a new game. |
| `night.started { day }` | Once for each day, when dusk begins at 0.73, or on the first step after `setTimeOfDay` jumps past it. A day that ends in `sleep()` before dusk gets none. |
| `slept { day }` | After `sleep()`, with the new day, after `day.started`. Crops and creatures catch up when they hear it. |

## Wiring

```ts
import { install as installTime } from './time/index.sim.ts';

installTime(kernel); // before crops and anything else that reads game.ambient in its step

// thunder has no game event, so hand it to the sound engine yourself
kernel.game.systems.time.onThunder?.((at) => sound.thunder(at));
```

It calls `game.systems.placeables.near('bed', player.pos, 4)` and `game.world.openSky`, both inside `canSleep()`. Installing it draws one number from `game.random()` for the weather seed.

The save holds the day, the seconds since dawn, `clock.seconds`, which days were announced, the forced kind and the machine's kind. The machine cannot restart in the middle of a front, so a load settles the saved kind at once: full rain and soaked ground if it rained, dry ground if not.
