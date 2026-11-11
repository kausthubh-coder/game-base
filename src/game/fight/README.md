# fight

The fight lab's rules: one hero, one pet, a beast, and three ways to fight it. Nothing here draws or reads a key. The lab's view (`src/game/fightview`, `src/game/views/lab-fight.view.ts`) steps it and draws it, and the tests and `tools/fight-sim.ts` step it with no browser. Every number is in `src/game/content/fight.ts`. `docs/fight-lab.md` says how the lab fits together.

There is no `index.sim.ts` on purpose. A folder with one is installed into every game and would run on the world server.

## What it exports

| File | Export | What it is |
|---|---|---|
| `fight.sim.ts` | `createFight(stage, options)` | One fight. It returns a `Fight`. |
| `arena.sim.ts` | `ARENA`, `arenaStage(x, z)` | The arena as cells, and the `Stage` that answers the fight's questions about it |
| `bot.sim.ts` | `createBot(fight, stage, options)` | A player made of rules. It writes `fight.input` and calls `press`, as the keys do. |
| `record.sim.ts` | `checksOf(record, earlier)`, `layoutOf(record)` | Note 08's pass checks for one fight, and the Stag's hall's |
| `hall.sim.ts` | `createHall(fight, stage, options)`, `createHallBot(fight, hall)` | The Verdant Stag's hall: its three phases, and a player made of rules that frees it |
| `hall-layout.sim.ts` | `HALL`, `hallStage(x, z)`, `rampHeight`, `onBody`, `onPost` | The hall as data, and the `Stage` it is fought on |
| `shapes.sim.ts` | `inCircle`, `inLine`, `inCone`, `dirX`, `dirZ`, `facingOf`, `turnBetween` | Is a point inside a shape. Facing 0 is north, a quarter turn is east. |

`Fight` has the state (`hero`, `pet`, `beasts`, `shapes`, `bolts`, `rigs`, `record`, `phase`, `clock`), the input the caller keeps (`input`), and these calls:

| Call | What it does |
|---|---|
| `step(dt)` | Moves the fight on. Any `dt` works. The lab steps it 60 times a second. |
| `press(kind)` | `attack`, `dodge`, `whistle`, `skill1`, `skill2` or `use`. A press that cannot act yet is kept for 0.2 seconds. |
| `bring(kind)` | A beast asleep at the den, in place of any other. It drops a fight in progress. |
| `wake()`, `clear()` | Wakes every sleeping beast. Takes every beast and rig away and heals the hero and the pet. |
| `setWay(way)`, `setPet(kind)`, `setGentle(on)` | `setWay` clears the arena. |
| `placeHero(x, z)` | Where the body is, with `external: true`. |
| `placeRig(kind, x, z)`, `canPlace(kind, x, z)`, `takeBack()`, `kit()` | The world way's rigs. `placeRig` returns why not, or null when it stands. |
| `skill(slot)` | The name and rest of the skill on C or T, or null. |
| `addTarget(spec)`, `removeTarget(t)`, `targets` | Things to hit that are not beasts. See the boss hooks below. |
| `threaten(spec)`, `cancel(shape)` | A shape on the ground that belongs to no beast. See the boss hooks below. |

Options: `way`, `pet`, `gentle`, `random`, `onEnd(record)`, `external` (the caller moves the hero, as the lab does), and `reach` (the Heartstone, off unless set).

## The rules every way shares

- A beast sleeps at the den until the hero comes within its `wakes` distance, or 0.6 of it in the world way. It stands alert for 0.8 seconds after it wakes.
- Every attack shows its shape on the ground for its whole lead time, then lands. A circle and a cone hit what is inside at that moment. A line is a charge: the beast runs down it and hits what it touches.
- A charge's line ends where a wall, a tree, water or the arena's edge stops it. Into a wall or a tree the beast crashes: it is helpless and loses its `rigShare` of the guard. At water or the edge it stalls for 1.2 seconds.
- A hit on the hero takes health, pushes them 0.8 blocks (2 for a heavy hit), staggers them for 0.25 seconds, and nothing hits them again for 0.6 seconds.
- A beast's guard empties. A guard in parts (the boar's three) staggers the beast for 1.5 seconds as each part breaks, and a broken part stays broken.
- At an empty guard the beast is dizzy for its `dizzy` seconds. Holding F within 3.5 blocks of its edge for 1 second calms it. Letting go loses the hold again, in two thirds of a second. A beast nobody calms gets a third of its guard back.
- A hero at no health faints for 2 seconds, then wakes at the arena's edge with full health. The beast keeps the guard it lost. Nobody dies.
- Gentle makes every lead time 1.5 times longer and every hit on the hero half as strong.

## The hero fights (`hero`)

- A cut lands 0.1 seconds after the press, in a 150 degree arc 2.2 blocks long, and takes 10 guard. A second press after 0.2 seconds chains a second cut. Each cut takes 0.4 seconds in all.
- A cut turns toward a beast within 35 degrees of the pointer.
- A cut pushes a thistlehog 0.4 blocks over 0.12 seconds, slowing to a stop. The gearling and the boar are steady: a cut moves them only once their guard is empty.
- Holding the button 0.6 seconds charges a spin. Letting go hits everything within 2.5 blocks for 30 guard.
- Shift dodges 3.5 blocks the way the hero walks, or back with no key held. Nothing hits the hero for its first 0.3 seconds. It costs 25 of 100 stamina, which comes back 1 second after it was last spent.
- The pet strikes what the hero hit last, with 1.5 times as long between strikes as in the pet's way. C calls its first skill.

## The pet fights (`pet`)

- A click throws the Mark's light at the pointer. A hit takes 3 guard and leaves a mark, at most 3, for 4 seconds. The pet's next strike is half again as strong for each mark and spends them.
- A click on a beast, or within 0.8 blocks of its edge, also sends the pet at it. The record counts the orders where the pet reached it within 2 seconds.
- A right click whistles the pet back. It comes out of the attack and goes back in by itself once the shapes have landed.
- Only in this way can the pet be hurt. At no hearts it faints and rests 8 seconds, then comes back whole beside the hero.
- C and T are the pet's two skills. The leaftail pounces and distracts. The pebblepup braces, taking the next attack on its back and staggering the beast, and taunts.

## The world fights (`world`)

- The kit holds one lamp, one snare vine, one spring plate and one water channel. A rig goes down within 6 blocks of the hero, on open ground, at least 1.5 blocks from a beast. Z takes back the last one.
- A beast that steps on a snare is held 2.5 seconds. A plate throws it 4 blocks back. A lamp draws the charge of a beast that charges at light, from 10 blocks, and dazzles it. A charge that reaches a channel stalls, and no beast walks across one.
- Each rig that goes off, and each crash into the wall, breaks the beast's `rigShare` of the guard.
- F springs the plate by hand when a beast is within 2.2 blocks of it. C sends the pet to the pointer as a lure for 5 seconds.
- The pet cannot be hurt in this way or the hero's.

## Events

`fight.events` fills during a step and the caller empties it. An event is for the picture and the sound only: no rule depends on anyone reading it. Each has `x`, `z`, a number `n` and a `text`.

| Event | When | `n`, `text` |
|---|---|---|
| `brought`, `wake` | A beast came in, or woke | `text` is its kind on `brought` |
| `tell`, `strike` | A shape appeared, or landed | `n` is the lead or 1 for heavy, `text` the attack |
| `swing`, `hit`, `whiff` | A cut or spin began, landed on a beast, or hit nothing | `n` is 1 or 2 for a cut, 3 for a spin |
| `charged` | The spin is ready to let go | |
| `guard`, `segment`, `dizzy`, `recovered` | Guard lost, a part broke, the guard is empty, it came round | `n` is the guard lost, or the parts left |
| `crash`, `stall` | A charge hit the wall or a tree, or stopped at water | |
| `calming`, `calmed`, `won`, `denied` | The hold began, it was calmed, the fight ended, the Mark could not hold it | `text` is the gift, or why not |
| `dodge`, `dodged`, `heroHurt`, `faint`, `woke` | The hero dodged, an attack passed through the dodge, was hit, fainted, woke | `n` is 1 for a heavy hit |
| `bolt`, `boltHit`, `boltMiss` | Light thrown, landed, flew out | |
| `order`, `whistle`, `skill` | The pet was sent, called back, or a skill was called | `text` is the skill's name |
| `petStrike`, `petHurt`, `petFaint`, `petUp`, `blocked` | The pet struck, was hit, fainted, came back, or turned an attack with a brace | |
| `rigPlaced`, `rigTaken`, `rig` | A rig went down, came back, or went off | `text` is the rig's kind on `rig` |
| `targetHit`, `targetBroken` | A target lost guard, or broke | `n` is the guard lost, `text` the target's name |

## The record

`fight.record` counts what note 08's checks need: the seconds of setup and of the fight, hits taken and by what, swings and whiffs, useful presses and the longest gap, orders and how many were in time, whistles, the pet's hits and faints, rigs placed and set off, the layout, crashes, and the answer to "Again?". `onEnd` gets a copy when a fight is won and when one in progress is dropped. `checksOf` turns it into pass or fail lines.

## The boss hooks

Two calls in `fight.sim.ts`, in one marked block, so a boss can be its own module. A beast fight makes neither, and plays as before.

- **Targets.** `addTarget({ x, z, radius, guard, name, open, high })` makes something the hero's cut and spin, thrown light and the pet's strike can hit that is not a beast: a pin, a lamp, a seed pod, a collar. It takes guard only while `open`. At 0 it breaks and stays broken. A cut that lands on one is not a whiff, and a cut bends toward an open one near the pointer as it does to a beast. With the hero fighting, the pet goes for the target the hero hit last. A `high` target is up on the boss: only the hero's own cut and spin reach it.
- **Loose shapes.** `threaten({ kind, x, z, facing, reach, width, lead, damage, heavy, id, push })` shows a shape that belongs to no beast (its `owner` is 0). It sends `tell` at once and `strike` when its lead runs out, then lands on the hero and the pet like any attack: the same dodge, the same moment of safety after a hit, the same `hitsTaken` and `hitBy[id]`. A circle or a cone pushes away from its middle, a line straight out from its middle line, as far as `push` says when it is given. `cancel(shape)` takes it off the ground before it lands.

The record's `way` may be `stag`, and a boss puts its own numbers in `record.boss`: the seconds in each phase, the longest stretch with no attack of its own on the ground (in all and by phase), and its counts by name.

## The Verdant Stag's hall

`createHall(fight, stage)` holds the first boss test: a god as tall as an oak, chained in a round hall. The lab steps it right after the fight, 60 times a second. Every pin, lamp, pod and the collar is a target, and every attack is a loose shape. The numbers are `STAG` in `content/fight.ts`; where things stand is `HALL` in `hall-layout.sim.ts`.

- The Stag lies across the north end of the hall, facing the door. Its body is solid. It sleeps until the hero comes 13.5 blocks from its chest, a step in from the door.
- **The chains.** Four pins, 60 guard each. It sweeps its antlers in a line 3 blocks wide across the whole floor through where the hero stands, from one side and then the other, with 1.5 seconds of lead. A hero within 3.5 blocks of its body gets a stamp of the nearest leg instead, a ring of 4.5 with 1.3 seconds of lead. A broken pin drops its chain and the Stag staggers 1.6 seconds, dropping the attack it wound up. The fourth pin ends the phase.
- **The overgrowth.** Four lamps open, 20 guard each: two cuts light one, and it lights a circle of 4.5 blocks. While a lamp is dark a seed pod comes up every 2.2 seconds, 2.5 to 6.5 blocks from the hero, in the dark, never more than four. It grows for 3 seconds with a ring of 1.8 and bursts for 12. One cut takes it. A pod in a lamp's light withers. The sweeps go on. The phase ends when every lamp is lit and no pod is left.
- **The collar.** The vines grow a ramp, two cells wide, up the Stag's east flank from the floor to six blocks at its shoulder. It counts as water to the stage, so the pet stays below. A hero on it gets shakes instead of sweeps: a stretch of 3.2 blocks of the ramp, 1.2 seconds of lead, and a hit throws the hero 3.5 blocks out, off the vines to the floor. The collar, 120 guard, opens to a hero five or more blocks up the ramp, and only the hero's own cut reaches it. A floor attack never lands on a hero up the vines, and a shake never lands on the floor.
- Between two phases the Stag rears for 1.5 seconds. After an attack it stands 1 second, then waits 0.8 seconds (1.2 in the overgrowth). It never goes more than about four seconds without an attack on the ground while the hero is up.
- A hero who faints wakes at the door. The Stag keeps its phase and everything broken. It waits for the hero to wake before it attacks again.
- Breaking the collar frees it: the hall sends `freed`, stops, and calls `onEnd` with a record whose `way` is `stag` and whose `result` is `calmed`. `restart()` starts the hall over from the chains and reports one in progress as `left`.

`hall.events` holds the hall's own events for the view: `woke`, `phase`, `pin`, `lamp`, `sprout`, `burst`, `cut`, `wither`, `fall`, `stagger`, `freed`, `restart`.

`createHallBot(fight, hall)` plays the hall the hero's way: out of what is about to land, the nearest pin, the pods near it and the lamps, then up the vines and the collar. On the vines it steps down out of a shake, not sideways off them.

## Tests

`bun test src/game/fight` runs in well under a second. `fight.test.ts` holds the rules above, one test each, and a bot that wins every fight in every way. `hooks.test.ts` holds the two boss hooks, and `hall.test.ts` the Stag's hall and its bot. `bun tools/fight-sim.ts` prints the bot's numbers for all nine fights, `bun tools/fight-sim.ts stag` the hall's, and `bun tools/fight-sim.ts clumsy` a clumsy player's against the boar in every way.

`createBot`'s `clumsy` option is a player still learning: it sees a shape 0.7 seconds late, attacks in bursts with pauses, and dodges four times in ten. The plain bot is never hit, so its times are a floor for a person's.
