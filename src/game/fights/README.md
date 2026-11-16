# fights

The world's fights: the twelve of handbook chapter 23 at their places, the night visitors at the fence, and the
hero's health and stamina (`FightsApi`, `HeroStats`, in the "act 1: fights" section of `src/game/api.sim.ts`). The
rules are `src/game/fight`; this system decides when a fight runs, where, against what, with whom, and what the
world does after. `src/game/fightview/world.ts` draws a running fight and steps it with the hero's body.

| What | Where it comes from |
|---|---|
| Which fights there are, their foes, companion, line, gifts and what a calmed beast does after | `ENCOUNTERS` in `src/game/content/fight.ts` |
| Where each is fought | `FIGHTS` and `PLACES` in `src/game/content/greenhollow.ts` (`fightPlace`) |
| When each is armed | its quest step in `src/game/content/quests.ts` (`armingSteps`) is the open one, and it is not won |
| The Mark's reach | `HallApi.heart()`, which the settlement gives |
| Health and stamina | `BenchApi.gear().armor`, `meal.day` today, `shrine.<id>` heart or stamina |

- A beast fight starts when the hero comes within `near` of its place (fight 2 only at night). It is fought on a
  `worldStage` read from the ground there. It ends won, fell (the hero fainted) or left (out of the circle for 1.5 s);
  a fight left or lost starts again once the hero has walked away and come back.
- Fight 1 is the Hall's first night; `fox.calmed` marks it won. Fight 4's boar is passive, and the Mark held out to it
  sets `fight.4.denied`.
- The keepers start only in their rooms, which the ruins build and pass to `startKeeper(n, room)`, and the Stag only
  through `startStag(x, z)`. `begin(n)` fights any of them in its test room where the hero stands.
- Night visitors: about one night in three while the hero is home and the Heartstone is at least 1, never deeper than
  it. Dax on the watch (`job.dax` = `watch`) turns them back.
- With no view, as in `tools/sim.ts`, the system steps the fight itself; `autoplay(level)` lets the rule-made player
  fight it. Tests: `fights.test.ts`, the scenario `fights-in-the-world`, and in Chrome `tools/fight-world.mjs`.
