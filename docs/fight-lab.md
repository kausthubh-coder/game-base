# The fight lab

A test scene inside the real game where Kausthubh plays three ways of fighting and picks one by feel. It is
on the branch `lab/fight`, behind `?scene=fight`. Without that flag the game is unchanged.

The plan it is built from is the handbook chapter `23-fighting.md` and the research notes `05`, `08` and `09`
in `~/dev/sandbox/game-look-test/design`. This file says how the lab is put together, what each part
promises the others, and what is still to build. Read it before you change anything under
`src/game/fight`, `src/game/fightview` or `src/game/views/lab-fight.view.ts`.

## The address

| Part | What it does |
|---|---|
| `?scene=fight` | Opens the lab. It skips the title and keeps its own save (`greenhollow.save.fight`). |
| `&way=hero`, `pet` or `world` | Starts in that way to fight. Without it, the way used last. |
| `&beast=thistlehog`, `gearling` or `boar` | Brings that beast in at once. |
| `&quality=low`, `medium` or `high` | Holds a quality level for the visit, as in the game. |
| `&log=1` | Also sends every finished fight to `fight-log` beside the page. Only `tools/fight-serve.mjs` answers that. |
| `?scene=stag` | Opens the lab in the Verdant Stag's hall instead, with its own save (`greenhollow.save.stag`): the first boss test. |

## The three ways, and what they share

Every way has the same rules: an attack shows its shape on the ground before it lands, a beast has a guard
that empties, the hero holds F to hold out the Mark to a beast whose guard is empty, and a hero whose health
runs out faints and wakes at the arena's edge. Nobody dies.

| Way | Who empties the guard | The player's keys |
|---|---|---|
| `hero` | The hero: cuts, a charged spin, a dodge. The pet helps. | Click, hold click, Shift, C, hold F |
| `pet` | The pet. The hero throws the Mark's light, whistles the pet out of an attack and calls its skills. | Click (on a beast it is also an order), right click, Shift, C, T, hold F |
| `world` | Rigs on the ground, the rock wall and the trees. The hero baits and dodges. | 1 to 4 and click, Z, E, C, Shift, F |

This build's camera uses Q and R, and E interacts, so the notes' R and T for pet skills became C and T.

## The layers

```
src/game/content/fight.ts     every number: the hero's moves, the beasts, the pets, the rigs
src/game/fight/               the rules (.sim.ts, no drawing, no keys)
  shapes.sim.ts                 is a point inside a circle, a line, a cone
  arena.sim.ts                  the arena as data, and the Stage the fight stands on
  fight.sim.ts                  createFight(stage, options): hero, pet, beasts, shapes, bolts, rigs, the record
  record.sim.ts                 checksOf(record, earlier): note 08's pass checks for one fight
  bot.sim.ts                    createBot(fight, stage): a player made of rules, for tests and the door
  hall.sim.ts                   createHall(fight, stage): the Verdant Stag's hall, and createHallBot
  hall-layout.sim.ts            the hall as data, and its Stage
src/game/fightview/           drawing and the interface for the lab
  keys.ts                       keys and mouse into the fight, the rig in the hand, the hook that steps the fight with the body
  feel.ts                       a fight event into a freeze, a jolt, a flash on the ground, particles and a sound
  looks.ts                      which sheet, frame, squash and tint a fighter shows, and the stand-ins
  draw.ts                       each frame: the fighters where the rules have them, and the marks on the ground
  figures.ts                    one quad per fighter: size, flash, shake, squash, drained grey, colors coming back
  ground.ts                     everything flat on the ground, one draw call
  rigs.ts                       the four rigs as stand-in shapes
  arena.ts                      stamps the arena into the block world and dresses it
  panel.ui.ts                   the card, the bars, the bar over the beast, "Again?", the log
  hall.ts                       the Stag's hall in the world: its blocks, the Stag, chains, pins, lamps, pods, vines
  hall.ui.ts                    the hall's line at the top of the screen
  log.ts                        the fights that ended, kept in the browser
src/game/views/lab-fight.view.ts   the glue: the flag, the arena, making the fight, the order of a frame, the door
tools/fight-sim.ts            the bot against every beast in every way, with no browser
tools/fight-play.mjs          one fight in headless Chrome, by the bot or by real keys
tools/fight-play-stag.mjs     the Stag's hall in headless Chrome (fight-play.mjs --scene stag)
```

The arrows go one way. Content knows nothing. The rules read content. The view reads the rules and never
writes their state: it calls `press`, `placeRig`, `bring`, `setWay` and changes `fight.input`. The rules
never learn that a view exists. A new beast, pet or rig is data in `content/fight.ts` first.

There is no `src/game/fight/index.sim.ts` on purpose. A folder with one is installed into every game and
would run on the world server. The lab makes its own fight and steps it itself.

## What the rules promise

- **Time.** `fight.step(dt)` works for any `dt`. The lab calls it once for each step of the hero's body, 60 a
  second, from `PlayerRig.steer`. The tests do the same.
- **The hero's place.** With `external: true` the fight does not move the hero. The caller reports where the
  body is with `placeHero` before every step, then moves the body as `hero.driven`, `driveX`, `driveZ`,
  `pace`, `shoveX` and `shoveZ` say. Without it the fight moves the hero itself, which is what the tests use.
- **Events.** `fight.events` fills during a step and the caller empties it. An event is for the picture and the
  sound only. No rule depends on anyone reading it.
- **The record.** `fight.record` counts what note 08's checks need. `onEnd` gets a copy when a fight is won and
  when one in progress is dropped.
- **Hooks left for later.** `options.reach` is the Heartstone: a beast whose `depth` is higher is emptied and
  still not calmed. Nothing in the lab sets it. Friends would be more heroes: the hero's state is one object
  today, and every rule that reads it takes it from one place.

The words `window`, `document` and `THREE` may not appear in a `.sim.ts` file, not even in a comment.
`bun run boundaries` fails on them.

## What the view promises

- **Stand-ins swap themselves.** A fighter is drawn from the sheet named after it when the manifest has one,
  and from its stand-in otherwise. `window.__fight.standIns()` lists what is a stand-in right now.
- **One freeze.** The freeze of a hit is in one place, `steer`: the fight's clock and the body wait, the
  picture goes on.
- **Draw calls.** One for each fighter (at most about eight), one for everything on the ground, a few for the
  rigs and the three trees. The game's budget is 150 draw calls, 400,000 triangles and 6 ms of script a frame.
- **The door.** `window.__fight` has the fight, `bot(on, layout)`, `state()`, `log()`, `standIns()`,
  `screen(x, z)` and `keysToward(x, z)`. Tests use it. The game's own door `window.__game` is still there.

## The sheets the lab asks for

Two helpers are making these on `lab/fight-sprites-beasts` and `lab/fight-sprites-hero`. The names are a
contract: the view looks for them in the manifest.

| Manifest name | Frames | What the lab does with it |
|---|---|---|
| `thistlehog`, `gearling`, `boar` | `idle` 2, `walk` 4, in front, back and side rows | Standing and walking |
| `thistlehog-fight`, `gearling-fight`, `boar-fight` | `poses` 4: tell, attack, dizzy, calm | Held one frame at a time |
| `hero-cut` | `cut` 4: wind-up, strike, follow-through, recovery | Played once over a cut |
| `hero-moves` | `poses` 4: dodge, hurt, reach, calm | Held |
| `hero-call` | `poses` 4: throw wind-up, throw release, whistle, point | Held |
| `leaftail-fight`, `pebblepup-fight` | `poses` 4: ready, strike, hurt, fainted | Held |
| `pebblepup` | `idle` 2, `walk` 4 | The second pet |

Beasts are drawn in their healthy colors. The drained grey and the colors coming back are the shader in
`figures.ts`, so the two looks always have the same pose.

## Where the view should be cut

The view is cut along these lines, so two people can work on it without meeting in one file:

| File | Its one job |
|---|---|
| `views/lab-fight.view.ts` | The flag, the arena, making the fight, the order of a frame, the door |
| `fightview/keys.ts` | Keys and mouse into `fight.input`, `press` and the rig in the hand. The `steer` hook that moves the body. |
| `fightview/feel.ts` | A fight event into a freeze, a jolt, a flash on the ground, particles and a sound. One table. |
| `fightview/looks.ts` | Which sheet, frame, squash and tint a fighter shows for what it is doing. The stand-in table. |
| `fightview/draw.ts` | Each frame: place the hero, the pet and the beasts, and draw the marks on the ground. |

## Still to build

Milestone 1, the lab with stand-in art, is done: every way plays start to finish against every beast in the
browser, by the bot and by real keys; the view is cut into `keys`, `feel`, `looks` and `draw`; a cut pushes a
small beast; the screen shakes, with a switch; the edge warms at low health; `tools/fight-serve.mjs` keeps
the ratings; and the lab is in `verify-game`'s feature map (`features/fight-lab.md`).

Milestone 2, real assets:

- The sheets above, wired through `looks.ts`.
- The four rigs and the marks of an attack as props, with the `make-3d-asset` skill.
- The moment of calming, worked up: it is the most important small animation in the game.

Milestone 3, the boss tests. The first is built, on `lab/fight-hall`: the Verdant Stag's hall, behind
`?scene=stag`. The research says a giant works when it is the place and its parts are the targets, and fails
when it stops attacking the player. The one question it answers: does a giant boss read, and is it a fight,
with a pixel hero in the tilted camera?

- **Two hooks in `fight.sim.ts`**, in one marked block, so a boss is its own module. Targets:
  `fight.addTarget({ x, z, radius, guard, name, open, high })` makes something the hero's cut and spin, thrown
  light and the pet's strike can hit that is not a beast, and sends `targetHit` and `targetBroken`. Loose
  shapes: `fight.threaten({ kind, x, z, facing, reach, width, lead, damage, heavy, id, push })` shows a shape
  that belongs to no beast and lands on the hero and the pet like any attack; `fight.cancel` takes it away. A
  beast fight makes neither, and every test in `fight.test.ts` passes unchanged.
- **The rules**, `fight/hall.sim.ts` with its layout in `fight/hall-layout.sim.ts` and its numbers as `STAG` in
  `content/fight.ts`: the chains (four pins, antler sweeps across the floor, a stamp near its legs), the
  overgrowth (lamps to light, seed pods that grow only in the dark), and the collar (a ramp of vines up its
  flank, shakes that throw the hero off). The hero fights the hero's way. A hero who faints wakes at the door
  and the Stag keeps its phase. The record gets the seconds in each phase, the hits by attack, the faints and
  the longest stretch with no attack of the Stag's on the ground (`record.boss`); the card shows them as checks.
- **The view**, `fightview/hall.ts` and `hall.ui.ts`: the hall stamped into the block world, the Stag as a
  code-built body with its head and antlers moving with the rules, drained grey until the collar breaks, gold
  chains, dusk over the overgrowth, and the end: 20 frames of stop, the chains fall, the grey runs out from the
  antlers down, it lowers its head to the hero, and the lab asks "Again?" and logs the way `stag`.
- **The tools.** `createHallBot` plays it, `bun tools/fight-sim.ts stag` prints its numbers,
  `bun tools/fight-play.mjs --scene stag` plays it in Chrome by the bot or with `--keys`, with a picture at each
  zoom step and in each phase.
- **A person against the boar.** `createBot`'s `clumsy` option sees a shape 0.7 seconds late, attacks in
  bursts and dodges four times in ten. `bun tools/fight-sim.ts clumsy` times it against the boar in every way.
  Every way was well under three minutes, so the boar's numbers did not change.

Still to build for milestone 3: whatever Kausthubh's play of the hall says. A giant boss for the game, and
its final look, are his calls.

## Known weak spots

- The hero's stand-in cut is the farm tool's swing, and it has no dodge, hurt or calm pose. The hurt and the
  dodge are the idle and walk frames squashed and tinted.
- A hero nobody can hit blinks fully out on every other frame, so for half a second after a hit the hero is
  gone on half the frames.
- The marks of thrown light are thin teal rings close around the beast, the same color as the hold of the
  Mark. They read as one thing at a glance.
- Tall grass pokes through the shapes on the ground. Their rims stay readable at every quality, but their
  fill is broken up.
- A charge that ends at the arena's edge stops as if at water. Nothing shows the edge but a pale ring.
- The bot never gets hit, and the key runs in `fight-play.mjs` never dodge. Neither is a person: the bot's
  numbers are a floor for a person's, and the key runs' hits and faints are the script's.
- Note 05's soft heartbeat at low health has no sound yet: only the edge beats.
- In the Stag's hall, `draw.ts` still draws the meadow's pale edge ring, 15 blocks out, just outside the hall's
  wall of 13. Every loose shape is also drawn at floor height, so a shake on the vines shows faintly on the floor
  under the Stag's belly as well as on the vines.
- The hall's numbers come from the bot, which is never hit by more than a few attacks. A person's first time
  through is untested.
- At high quality, from the top of the vines at the furthest zoom step, a frame draws up to about 400,000
  triangles: the hall's own meshes are about 16,000 of them, the valley seen from that far out the rest.
