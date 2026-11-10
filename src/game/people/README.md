# people

The townspeople and their routines. It implements `PeopleApi`. The data is `src/game/content/people.ts`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.people` with the 14 people of the content file |
| `createPeople(game, defs?)` | The same system without a kernel, for tests with other people. It returns `{ api, system }`. |
| `PeopleSave` | The shape `save()` returns |

## Who is there

| Id | Where |
|---|---|
| `tamsin` | `grant.stone` until the flag `quest.plot.done` is set. Then `lodge` from 6:00 and three blocks beside it from 20:00. |
| `maren`, `odo`, `gus`, `mira`, `wren`, `brack` | `granary`, `bakery`, `gus.field`, `carpenter`, `kennel`, `ferry`, at every hour |
| `juniper` | Walks between `town.square` and `river.bank`. She stands about 150 seconds at each. |
| `villager-1` to `villager-6` | Walk between `town.square`, `river.bank` and `town.gate`. Each stands for a time of their own at each place, from about 70 seconds for `villager-1` to about 145 for `villager-6`, a few blocks off the place. Odd numbers use the sprite `villager-a`, even numbers `villager-b`. |

For the eight named people the sprite, the portrait and the voice are the id. The hour is `game.clock.timeOfDay * 24`.

## What a person does

- Each person is an actor `npc:<id>` in `game.actors`. `anim` is `walk` or `idle`. `NpcState.pos` and the actor's `pos` are one object.
- Each person adds an Interactable with the id `npc:<id>`, the prompt `Talk to <name>` and a radius of 2.5 blocks. Its `act()` calls `game.systems.talk.talkTo(id)`.
- A person walks at 2.2 blocks a second along a path from `game.systems.nav`. Standing, they face a player within 3 blocks.
- A person more than 60 blocks from the player does not walk. They jump to their place.
- When no path leads to the place, they walk the part of the way that exists, then appear at the place. When there is nowhere to walk, they appear at once.
- Two people never stand on one block. The second one takes the nearest free block.
- A person in a conversation stands still until `talk.ended`.
- After `slept`, everybody is at their morning place at once.

## The api

- `send(id, place, offset?)` walks someone to a place now. They stay there until the day number changes, then follow their routine again. A place the region does not have is ignored. `offset` is `{ x, z }` in blocks east and south of the place. The festival uses it to stand fourteen people a few blocks apart. It is new in the contract.
- `hold(id, true)` stops someone where they are and keeps them out of their routine. Someone who was sent first still finishes that walk and then stays, whatever the day. `hold(id, false)` returns them to the routine.
- `befriend(id, amount)` keeps friendship between 0 and 5.
- `setMark(id, mark)` sets the actor's mark.
- An id that does not exist does nothing.

## Events

It sends none. It hears `talk.started`, `talk.ended` and `slept`.

## Wiring

```ts
import { install as installNav } from './nav/index.sim.ts';
import { install as installPeople } from './people/index.sim.ts';

installNav(kernel);
installPeople(kernel);                   // any order among the systems
// On its first step or first api call it reads region, nav, interact and talk,
// places everybody, adds the actors and the prompts.
kernel.game.systems.people.send('tamsin', 'river.bank');
```

It needs `region`, `nav`, `interact` and `talk` to be installed before the first step. The region must have every place named above. A missing place puts that person at `region.spawn()`.

`Place.at` may be the block to stand on or the feet above it. Both work.

Save holds each person's position, facing, place, friendship, mark, hold, the place they were sent to with its offset, and their wander timer. A load before the first step is kept and applied on that step.

People pause their routes for two seconds when they first enter talking range of the player on the same level. They face the player during that pause, then resume even if the player stays. Leaving talk range resets the greeting. This gives the player time to use a moving person's prompt without keeping that person from their routine.
