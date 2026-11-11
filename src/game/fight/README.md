# fight

The fight lab's rules: one hero, one pet, a beast, and three ways to fight it. Nothing here draws or reads a key. The lab's view (`src/game/fightview`, `src/game/views/lab-fight.view.ts`) steps it and draws it, and the tests and `tools/fight-sim.ts` step it with no browser. Every number is in `src/game/content/fight.ts`. `docs/fight-lab.md` says how the lab fits together.

There is no `index.sim.ts` on purpose. A folder with one is installed into every game and would run on the world server.

## What it exports

| File | Export | What it is |
|---|---|---|
| `fight.sim.ts` | `createFight(stage, options)` | One fight. It returns a `Fight`. |
| `arena.sim.ts` | `ARENA`, `arenaStage(x, z)` | The arena as cells, and the `Stage` that answers the fight's questions about it |
| `bot.sim.ts` | `createBot(fight, stage, options)` | A player made of rules. It writes `fight.input` and calls `press`, as the keys do. |
| `record.sim.ts` | `checksOf(record, earlier)`, `layoutOf(record)` | Note 08's pass checks for one fight |
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

## The record

`fight.record` counts what note 08's checks need: the seconds of setup and of the fight, hits taken and by what, swings and whiffs, useful presses and the longest gap, orders and how many were in time, whistles, the pet's hits and faints, rigs placed and set off, the layout, crashes, and the answer to "Again?". `onEnd` gets a copy when a fight is won and when one in progress is dropped. `checksOf` turns it into pass or fail lines.

## Tests

`bun test src/game/fight` runs in well under a second. `fight.test.ts` holds the rules above, one test each, and a bot that wins every fight in every way. `bun tools/fight-sim.ts` prints the bot's numbers for all nine fights.
