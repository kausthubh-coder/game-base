# A bed under a tree finishes "A roof before dark" with no wood, no workbench and no roof

Found on 2026-11-11 while teaching the bot to sleep. Not fixed: whether leaves count as a roof is a design
choice.

## What happens

The hero sets a bed down under a tree and presses E beside it in the evening. The hero sleeps until morning.
The quest "A roof before dark" is then done, and "Leaf and tail" starts. The hero never cut 12 logs, never
set down a workbench and never put a block over the bed.

## Why

Two rules ask for a roof in two ways.

| Rule | Where | What counts as a roof |
|---|---|---|
| May the hero sleep | `canSleep()` and `roofedBedNear()` in `src/game/time/index.sim.ts` | `world.openSky()` is false over the bed. Under a tree's leaves it is false, because `openSky` also asks `canopyAt`. |
| The quest step "Set a bed down with a block over it" | `{ placed: 'bed', covered: true }` in `src/game/quests/rules.sim.ts` | A block within 6 above the bed |

The last step of the quest waits for the `slept` event. The steps before it are not gates, and a step that
is not a gate counts as done when a later one is. So one night under a tree passes the wood, the bench and
the shelter steps together.

## How to see it

There is no bot seed for this one: no invariant covers it. These lines play it, from the repo's root, in a
file run with `bun`:

```ts
import { begin } from './src/game/play/scenario.sim.ts';
const p = begin(3, { quest: 'roof', give: { bed: 1 } });
p.teleport('grant.center');
// The oak at -44, 22, -222, west of the grant.
p.teleport({ x: -43.5, z: -217.5 });
p.walkTo({ x: -43.5, y: 22, z: -218.5 }, { within: 0.1 });
p.take('bed');
p.use(-44, 21, -220);
p.until(() => p.game.clock.timeOfDay >= 0.66, 720);
p.interact();
p.advance(1);
console.log(p.game.clock.day, p.game.flags.is('quest.roof.done'));
```

It prints `2 true`. No block stands over the bed.

## Choices

- Leaves are no roof for sleeping: `roofedBedNear()` and `canSleep()` ask for a block over the bed or the
  hero and not for `openSky`. The bed then says "The bed needs a roof over it." under a tree.
- Leaves are a roof: then the quest step should say so, and the shelter step should become a gate so that
  a night under a tree does not also pass the wood and the workbench.

The bot's evening errand sets its bed under a tree because that is the cheapest roof. If leaves stop
counting, bots will sleep less often and nothing else changes.
