# fight

The fight's rules: one hero with a weapon and a companion, one beast, two or a pack, the vault keepers, and the traps. Nothing here draws or reads a key. The lab's view (`src/game/fightview`, `src/game/views/lab-fight.view.ts`) steps it and draws it; so does the world's (`fightview/world.ts`), for the fights `src/game/fights` starts in the world; the tests and `tools/fight-sim.ts` step it with no browser. Every number is in `src/game/content/fight.ts`. `docs/fight-lab.md` says how the lab fits together.

There is no `index.sim.ts` on purpose: these are rules a system uses, not a system. The world's system is `src/game/fights`.

Act 1 added, each off unless a caller asks for it, so the lab plays as it did: the hero's numbers (`stats`), the gear's step and fitting (`gear`), the kit's three slots (`kit`, `kitSlots`, `useKit`), a machine's plates (`plates`), a pack (`bringAll`), a beast that waits (`passive`) and the Mark held out to a beast deeper than `reach` (the `beyond` event). The fox, the lynx and the rootsnare are beasts; Dax, Wren, the fox and the Stag's young are companions (`ACT1_COMPANIONS`).

## What it exports

| File | Export | What it is |
|---|---|---|
| `fight.sim.ts` | `createFight(stage, options)` | One fight. It returns a `Fight`. |
| `arena.sim.ts` | `ARENA`, `arenaStage(x, z)` | The arena as cells, and the `Stage` that answers the fight's questions about it |
| `bot.sim.ts` | `createBot(fight, stage, options)`, `PLAYERS` | A player made of rules, perfect, middle or clumsy. It writes `fight.input` and calls `press`, as the keys do. |
| `record.sim.ts` | `summaryOf(record)`, `endedWord`, `foesOf`, `checksOf(record)` | The few lines the card shows after a fight, and the Stag's hall's pass checks |
| `stag-hall.sim.ts` | `createStagHall(fight, stage, options)`, `createHallBot(fight, hall)` | The Verdant Stag's hall: its three phases, and a player made of rules that frees it |
| `hall-layout.sim.ts` | `HALL`, `hallStage(x, z)`, `rampHeight`, `onBody`, `onPost` | The hall as data, and the `Stage` it is fought on |
| `keepers.sim.ts` | `createKeeper(kind, fight, room)`, `keeperRoom(kind, x, z)`, `createKeeperBot(fight, keeper)` | The three vault keepers, each with one rule of its room, a test room, and a player made of rules |
| `world-stage.sim.ts` | `worldStage(ground, spec)` | The circle round a place of the world, read once from the ground: rises and blocks are solid, water is water |
| `shapes.sim.ts` | `inCircle`, `inLine`, `inCone`, `dirX`, `dirZ`, `facingOf`, `turnBetween` | Is a point inside a shape. Facing 0 is north, a quarter turn is east. |

`Fight` has the state (`hero`, `companion`, `beasts`, `shapes`, `shots`, `rigs`, `record`, `phase`, `clock`), the input the caller keeps (`input`), and these calls:

| Call | What it does |
|---|---|
| `step(dt)` | Moves the fight on. Any `dt` works. The lab steps it 60 times a second. |
| `press(kind)` | `attack`, `dodge`, `skill` or `use`. A press that cannot act yet is kept for 0.2 seconds. |
| `bring(kind, also)` | A beast asleep at the den, in place of any other, and a second beside it when `also` names one. It drops a fight in progress. |
| `wake()`, `clear()` | Wakes every sleeping beast. Takes every beast and rig away and heals the hero. |
| `setWeapon(kind)` | Takes the sword, the bow or the staff in hand, also mid-fight. |
| `setCompanion(kind)`, `setWay(way)`, `setGentle(on)` | `setCompanion` and `setWay` clear the arena. `way` is `hero` for a fight or `world` for the traps. |
| `placeHero(x, z)` | Where the body is, with `external: true`. |
| `placeRig(kind, x, z)`, `canPlace(kind, x, z)`, `takeBack()`, `kit()` | The traps' rigs. `placeRig` returns why not, or null when it stands. |
| `skill()` | The name and rest of the skill on C: the companion's, or the lure in the traps. |
| `addTarget(spec)`, `removeTarget(t)`, `targets` | Things to hit that are not beasts. See the boss hooks below. |
| `threaten(spec)`, `cancel(shape)` | A shape on the ground that belongs to no beast. See the boss hooks below. |

Options: `way`, `weapon`, `companion`, `gentle`, `random`, `onEnd(record)`, `external` (the caller moves the hero, as the lab does), and `reach` (the Heartstone, off unless set).

## The rules every fight shares

- A beast sleeps at the den until the hero comes within its `wakes` distance, or 0.6 of it in the traps. It stands alert for 0.8 seconds after it wakes. Two brought in together wake together.
- Every attack shows its shape on the ground for its whole lead time, at least 0.6 seconds, then lands. A circle, a cone and a thrown line hit what is inside at that moment. A charge's line is run down: the beast hits what it touches.
- A line ends where a wall, a tree, water or the arena's edge stops it. A charge into a wall or a tree leaves the beast helpless and breaks 8% of its guard (in the traps, its `rigShare`). At water or the edge it stalls for 1.2 seconds.
- A hit on the hero takes health, pushes them 0.8 blocks (2 for a heavy hit), staggers them for 0.25 seconds, and nothing hits them again for 0.6 seconds.
- A beast's guard empties. A guard in parts (the boar's three) staggers the beast for 1.5 seconds as each part breaks, and a broken part stays broken.
- At an empty guard the beast is dizzy for its `dizzy` seconds. Holding F within 3.5 blocks of its edge for 1 second calms it. Letting go loses the hold again, in two thirds of a second. A beast nobody calms gets a third of its guard back.
- A hero at no health faints for 2 seconds, then wakes at the arena's edge with full health. The beast keeps the guard it lost. Nobody dies.
- Gentle makes every lead time 1.5 times longer and every hit on the hero half as strong.
- Without `external`, the hero walks at 4.4 blocks a second and swims at 2.4 in the pond, as the lab's body does.

## Weapons

A weapon (`WEAPONS`) is a quick move and a held move. One attack machine plays them: a move starts, lands once at its `startup`, and ends at its `total`. A dodge may cut it short from its `cancel`. What it makes when it lands is its `kind`: an `arc` in front, a `ring` round the hero, a `shot` down the aim, or a `burst` at the pointer. A press starts the quick move; holding the button from there charges the held move, and letting go once it is ready plays it.

- The sword: a cut lands six steps of the body (0.1 seconds) after the step that reads the press, in a 150 degree arc 2.2 blocks long, and takes 10 guard. A second press after 0.2 seconds chains a second cut. Each takes 0.4 seconds. It turns toward a beast within 35 degrees of the pointer. A cut pushes a small beast 0.4 blocks over 0.12 seconds; the gearling and the boar are steady until their guard is empty. Holding 0.6 seconds charges a spin: everything within 2.5 blocks loses 30 guard and is pushed 2 blocks.
- The bow: an arrow leaves 0.15 seconds after the press at 24 blocks a second, for 14 blocks, takes 6 guard, and bends to a beast within 8 degrees and 12 blocks. Holding 0.75 seconds draws a shot that passes through everything in its way, takes 24 guard from each, and pushes a small beast 1.2 blocks. The hero walks slower while drawing.
- The staff: a bolt leaves 0.2 seconds after the press at 18 blocks a second, takes 5 guard and leaves a mark, at most three, for 4 seconds. Holding 0.8 seconds gathers a burst that lands 0.25 seconds after the release at the pointer, at most 9 blocks off: 14 guard and a mark to everything within 2.4 blocks, and it slows them to half speed for 3 seconds.
- A shot stops at the wall, a tree and the arena's edge. A shot that hits nothing is a whiff.
- `setWeapon` takes a weapon in hand. For 0.35 seconds after, the hero cannot attack, and a held move being charged is dropped.

## Companions

A companion (`COMPANIONS`) has a role and does its job by itself. Nothing hurts it. In the traps it only follows, and C sends it to the pointer as a lure for 5 seconds.

- Each strikes a beast now and then: the leaftail every 1.1 seconds from close, the pebblepup every 1.6 when a beast is close to it, the lanternfly and the mossling every 2.2 from 7 and 5 blocks off. Each mark on the beast makes the strike half again as strong, and the strike spends them.
- The leaftail goes for the beast the hero hit last, or the nearest one awake, and steps out of shapes. C is a pounce: 20 guard.
- The pebblepup stands 1.3 blocks from the hero toward the nearest beast. A hit that lands on a hero within 1.9 blocks of it, from the beast's side of it, is halved. C braces it for 2.5 seconds: the next attack that would land on the hero, or on it, does nothing, and the beast that made it loses 20 guard and staggers 1.2 seconds.
- The lanternfly mends 3 health a second while nothing is about to land on the hero, from 1.5 seconds after the last hit. C mends 35 at once.
- The mossling makes the hero's next hit strong once every 6 seconds of a fight: it breaks twice the guard. A strong shot that hits nothing is not lost. C is a bloom: for 5 seconds every hit breaks half again more and a held move charges twice as fast.

## Beasts

- Each attack is picked when the hero is between its `from` and `to`, and it is rested. In a fight a beast turns at its own `turn` speed, and an attack that has a direction waits until the beast faces the hero within 0.3 radians.
- An attack with `at: 'target'` lands where the hero stands when it is told. One with `then` is followed at once by another, told at where the hero is then. One marked `fightOnly` is not used in the traps.
- Once half its guard is gone a beast in a fight is enraged (`RAGE`): leads 0.9 as long, never under 0.6 (a follow-up keeps its whole lead), standing open 0.7 as long, rests 0.65 as long, a quarter faster on its feet. The boar then turns after a charge and charges again.
- A slowed beast walks and charges at half speed.
- Two beasts brought in together each have 60% of their guard and take turns: one does not wind up while the other's attack is still to land or landed less than 0.35 seconds ago.

## The traps (`world`)

- The kit holds one lamp, one snare vine, one spring plate and one water channel. A rig goes down within 6 blocks of the hero, on open ground, at least 1.5 blocks from a beast. Z takes back the last one.
- A beast that steps on a snare is held 2.5 seconds. A plate throws it 4 blocks back. A lamp draws the charge of a beast that charges at light, from 10 blocks, and leaves it helpless when it gets there. A charge that reaches a channel stalls, and no beast walks across one.
- Each rig that goes off, and each crash into the wall, breaks the beast's `rigShare` of the guard.
- F springs the plate by hand when a beast is within 2.2 blocks of it.
- The beasts fight as they did at milestone 3, and play exactly as at `fcefd6d`.

## Events

`fight.events` fills during a step and the caller empties it. An event is for the picture and the sound only: no rule depends on anyone reading it. Each has `x`, `z`, a number `n` and a `text`.

| Event | When | `n`, `text` |
|---|---|---|
| `brought`, `wake` | A beast came in, or woke | `text` is its kind on `brought` |
| `tell`, `strike` | A shape appeared, or landed | `n` is the lead or 1 for heavy, `text` the attack |
| `swing`, `hit`, `whiff` | A move began, landed on a beast, or hit nothing | `text` is the move, `n` 1 or 2 for a cut |
| `shot`, `shotHit`, `burst` | A shot left, a shot hit, a burst landed | `text` is the move; `n` the burst's reach |
| `charged`, `swap` | The held move is ready; a new weapon is in hand | `text` is the move or the weapon |
| `guard`, `segment`, `dizzy`, `recovered` | Guard lost, a part broke, the guard is empty, it came round | `n` is the guard lost, `text` who broke it: `hero`, `companion` or `world` |
| `enraged`, `slowed` | Half its guard is gone; a burst slowed it | |
| `crash`, `stall` | A charge hit the wall or a tree, or stopped at water | |
| `calming`, `calmed`, `won`, `denied` | The hold began, it was calmed, the fight ended, something could not be done | `text` is the gift, or why not |
| `dodge`, `dodged`, `heroHurt`, `faint`, `woke` | The hero dodged, an attack passed through the dodge, was hit, fainted, woke | `n` is 1 for a heavy hit |
| `companionStrike`, `skill`, `blocked`, `guarded`, `mend` | The companion struck, its skill was called, a brace took an attack, it took half of one, it mended | `text` is the role, `pounce` or the skill's name; `n` the marks spent or the health given |
| `strongReady`, `strongHit` | The booster made the next hit strong, and it landed | |
| `rigPlaced`, `rigTaken`, `rig` | A rig went down, came back, or went off | `text` is the rig's kind on `rig` |
| `targetHit`, `targetBroken` | A target lost guard, or broke | `n` is the guard lost, `text` the target's name |

## The record

`fight.record` counts the fight: its way, its beasts (`boar+gearling` for two), its weapon (the one in hand when the beast woke) and every weapon used, its companion, its length, hits taken and by what, the health lost, the lowest health and the health left, faints, dodges, swings and whiffs, shots and shot hits, swaps, what the companion did (blocks, halved hits, health mended, strong hits) and the skills called, the rigs placed and set off with their layout, and crashes. `onEnd` gets a copy when a fight is won and when one in progress is dropped. `summaryOf` turns it into the few lines the card shows.

## The boss hooks

Two calls in `fight.sim.ts`, in one marked block, so a boss can be its own module. A beast fight makes neither, and plays as before.

- Targets: `addTarget({ x, z, radius, guard, name, open, high })` makes something every move of every weapon and the striker's strike can hit that is not a beast: a pin, a lamp, a seed pod, a collar. It takes guard only while `open`. At 0 it breaks and stays broken. A move that lands on one is not a whiff, and a cut or a shot bends toward an open one near the pointer as it does to a beast. The striker goes for the target the hero hit last. A `high` target is up on the boss: only the hero's own moves reach it, not the companion.
- Loose shapes: `threaten({ kind, x, z, facing, reach, width, lead, damage, heavy, id, push })` shows a shape that belongs to no beast (its `owner` is 0). It sends `tell` at once and `strike` when its lead runs out, then lands on the hero like any attack: the same dodge, a braced guard taking it, the same moment of safety after a hit, the same `hitsTaken` and `hitBy[id]`. A circle or a cone pushes away from its middle, a line straight out from its middle line, as far as `push` says when it is given. `cancel(shape)` takes it off the ground before it lands.

The record's `way` may be `stag`, and a boss puts its own numbers in `record.boss`: the seconds in each phase, the longest stretch with no attack of its own on the ground (in all and by phase), and its counts by name.

## The Verdant Stag's hall

`createStagHall(fight, stage)` holds the first boss test: a god as tall as an oak, chained in a round hall. The lab steps it right after the fight, 60 times a second. Every pin, lamp, pod and the collar is a target, and every attack is a loose shape. The numbers are `STAG` in `content/fight.ts`; where things stand is `HALL` in `hall-layout.sim.ts`.

- The Stag lies across the north end of the hall, facing the door. Its body is solid. It sleeps until the hero comes 13.5 blocks from its chest, a step in from the door.
- The chains: Four pins, 60 guard each. It sweeps its antlers in a line 3 blocks wide across the whole floor through where the hero stands, from one side and then the other, with 1.5 seconds of lead. A hero within 3.5 blocks of its body gets a stamp of the nearest leg instead, a ring of 4.5 with 1.3 seconds of lead. A broken pin drops its chain and the Stag staggers 1.6 seconds, dropping the attack it wound up. The fourth pin ends the phase.
- The overgrowth: Four lamps open, 20 guard each: two cuts light one, and it lights a circle of 4.5 blocks. While a lamp is dark a seed pod comes up every 2.2 seconds, 2.5 to 6.5 blocks from the hero, in the dark, never more than four. It grows for 3 seconds with a ring of 1.8 and bursts for 12. One cut takes it. A pod in a lamp's light withers. The sweeps go on. The phase ends when every lamp is lit and no pod is left.
- The collar: The vines grow a ramp, two cells wide, up the Stag's east flank from the floor to six blocks at its shoulder. It counts as water to the stage, so the companion stays below. A hero on it gets shakes instead of sweeps: a stretch of 3.2 blocks of the ramp, 1.2 seconds of lead, and a hit throws the hero 3.5 blocks out, off the vines to the floor. The collar, 120 guard, opens to a hero five or more blocks up the ramp, and only the hero's own cut reaches it. A floor attack never lands on a hero up the vines, and a shake never lands on the floor.
- Between two phases the Stag rears for 1.5 seconds. After an attack it stands 1 second, then waits 0.8 seconds (1.2 in the overgrowth). It never goes more than about four seconds without an attack on the ground while the hero is up.
- A hero who faints wakes at the door. The Stag keeps its phase and everything broken. It waits for the hero to wake before it attacks again.
- Breaking the collar frees it: the hall sends `freed`, stops, and calls `onEnd` with a record whose `way` is `stag` and whose `result` is `calmed`, which the card after the fight and the log show as freed. `restart()` starts the hall over from the chains and reports one in progress as `left`.

`hall.events` holds the hall's own events for the view: `woke`, `phase`, `pin`, `lamp`, `sprout`, `burst`, `cut`, `wither`, `fall`, `stagger`, `freed`, `restart`.

`createHallBot(fight, hall)` plays the hall with the weapon in the hand, from a cut's reach or a little way off for a shot: out of what is about to land, the nearest pin, the pods near it and the lamps, then up the vines and the collar. On the vines it steps down out of a shake, not sideways off them.

## Tests

`bun test src/game/fight` runs in under a second. `fight.test.ts` holds the rules above, one test each, and the players made of rules: the perfect one wins every weapon against every beast and three pairs with no hit, the middle one meets the targets over eight seeds, the clumsy one faints against the boar in some fights and not others, and the traps play as they did. `hooks.test.ts` holds the two boss hooks, and `hall.test.ts` the Stag's hall and its bot with each weapon.

`bun tools/fight-sim.ts` prints the difficulty table over 20 seeds, `bun tools/fight-sim.ts traps` the traps, `bun tools/fight-sim.ts stag` the hall's numbers, and `bun tools/fight-sim.ts one bow lanternfly boar --events` one fight event by event.

The middle player sees most shapes after 0.4 seconds and a quarter of them after 0.75, steps the wrong way first on 15% of them, dodges six times in ten when walking is too slow, and attacks in bursts. The clumsy player sees every shape 0.7 seconds late, dodges four times in ten, and walks straight in. The perfect player is never hit, so its numbers are a floor for a person's.
