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
  calm.ts                       the moment of calming around the beast: the thread, the ash, the green, the gift
  figures.ts                    one quad per fighter: size, flash, shake, squash, roll, drained grey, colors coming back
  ground.ts                     everything flat on the ground, one draw call
  sparks.ts                     small pixel pictures in the air: motes, ash, a heart, flowers, pips, gifts. One draw call
  rigs.ts                       the four rigs, drawn with the game's rig props
  arena.ts                      stamps the arena into the block world and dresses it
  panel.ui.ts                   the card, the bars, the bar over the beast, "Again?", the log
  hall.ts                       the Stag's hall in the world: its blocks, the Stag, chains, pins, lamps, pods, vines
  hall.ui.ts                    the hall's line at the top of the screen
  log.ts                        the fights that ended, kept in the browser
src/game/views/lab-fight.view.ts   the glue: the flag, the arena, making the fight, the order of a frame, the door
tools/fight-sim.ts            the bot against every beast in every way, with no browser
tools/fight-play.mjs          one fight in headless Chrome, by the bot or by real keys
tools/fight-play-stag.mjs     the Stag's hall in headless Chrome (fight-play.mjs --scene stag)
tools/fight-poses.mjs         every pose of every fighter, set through the door, one sheet of pictures each
tools/fight-strip.mjs         a strip of pictures through one calming, in order
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
- **Draw calls.** One for each fighter (at most about eight), one for everything on the ground, one for the
  sparks in the air, one for each kind of rig standing, and a few for the three trees. The game's budget is 150 draw calls, 400,000
  triangles and 6 ms of script a frame.
- **The card stays out of the fight.** It folds to its title when a beast wakes and opens again when the
  fight ends. A player who opens it during a fight keeps it open. On a narrow window the bars move right of
  it, and at 1024 by 640 every control is on the page or one short scroll away.
- **"Again?" is about one fight.** A new beast, way or pet closes it, and "Fight it again" replays the way,
  pet and beast it names. A new way or pet in the middle of a fight brings the same beast back asleep, and
  the lab says that the fight ended and is in the log as left.
- **One word for one state.** Dizzy is an empty guard, the only state the Mark can hold. A beast standing
  open after an attack is not dizzy, and a stunned one is helpless. The card says the guard must be empty
  first.
- **The door.** `window.__fight` has the fight, `bot(on, layout)`, `state()`, `log()`, `standIns()`,
  `screen(x, z)` and `keysToward(x, z)`. `hold(on)` stops the rules while the picture goes on, so a test can
  set a fighter's state by hand and look at its pose. `slow(k)` plays the picture's own clocks k times as
  fast, for a strip of screenshots. `reduceMotion(on)` switches the game's setting. `state().beast.moment` is
  the seconds into the moment of calming. Tests use it. The game's own door `window.__game` is still there.

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

How `looks.ts` uses them:

| Fighter | State | What shows |
|---|---|---|
| Hero | A cut | Wind-up until the step the cut lands, the strike for a tenth of a second from there (so the freeze of the hit holds it), the follow-through, the recovery. The second cut starts from the recovery and is mirrored when seen from the front or the back, so it swings the other way. |
| Hero | Charging a spin, the spin | The wind-up held, brighter when the spin is ready. The strike turned once around the views. |
| Hero | Dodge, hurt | Their poses. The two afterimages of a dodge are the dodge pose. |
| Hero | Holding the Mark | Reach for 0.18 seconds, then calm, and calm through the release after it. |
| Hero | Throw, whistle | Wind-up, then release. A throw that is also an order to the pet points instead. |
| Hero | Faint | The hurt pose tipped over onto its back, pale. |
| Hero | Safe after a hit | A cool, brighter light on every other frame. The hero never disappears. |
| Pet | Strike, hurt, fainted | Their poses. A strike hops: 0.35 blocks for the leaftail, 0.12 for the pebblepup. |
| Pet | Brace | The ready pose, planted wider and lower. |
| Beast | Asleep | The calm pose, its eyes shut, drained grey. |
| Beast | Tell | The tell pose with a small breath of squash, and a warm light for the last quarter second. |
| Beast | Charge, just after an attack | The attack pose. |
| Beast | Dizzy, stunned, snared | The dizzy pose. Dizzy sways, a snare struggles. |
| Beast | Thrown by a plate | The dizzy pose, tumbling through the air. |
| Beast | Calmed | The dizzy pose while the grey runs out, then the calm pose with a settle. |

## The moment of calming

Research note 08 says winning without killing has to play as a win, and the handbook calls the color coming
back the most important small animation in the game. It is one clock per beast, counted in seconds from the
end of the release's freeze (`CALM` in `calm.ts`):

| Seconds | What happens |
|---|---|
| The hold | The hero holds out the Mark. A thread of teal light runs along the ground to the beast and fills as the hold grows, and motes rise off it. The ring that closes around the beast stays. |
| The release, before 0 | 10 frames of freeze. The beast is lit in the Mark's pale teal, never the white of a hit, with its drawing still readable under the light, and a ring of light goes out from under it. The spell sound plays. |
| 0 to 1.5 | The colors come back from the head down behind a bright line. Flecks of grey ash lift off where the line passes and vanish upward. |
| 1.25 to 2.6 | A ring of fresh green spreads from under the beast and fades, and seven flowers open as it passes them. |
| 1.5 | It bows: the calm pose with a small settle. A teal heart shows over it, and the stinger plays. |
| 1.95 to 3.1 | The gift pops out in a small arc, lands, and flies to the hero with its name over it: a quill, a tusk, a spring. The name rises above the hero's head, and above the beast and its heart, wherever it would cross them. |
| 3.6 | The lab asks "Again?". |

A machine is shut down, not calmed. The gearling stays tipped over and lit for 0.4 seconds while its eye goes
dark, then stands, settles with a puff of dust and the stinger, and a spring pops out at 0.75. No ash, no
heart, no green.

With the game's reduce motion on, nothing flies: the colors fade back in place, the ring of green and the
flowers stand at full size and fade, and the gift's name shows over the hero.

The hold's motes and the ash are fewer at lower quality: 45% at `low`, 70% at `medium`. The sparks are one
draw call at every level.

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

Milestone 2, the real art in the lab, is done. Every pose of every fighter was set through the door and looked
at, at the game's zoom (`tools/fight-poses.mjs`). The scales fit the rules as drawn: each beast is about as wide
as its radius says, and the boar stands a little taller than the hero. What changed:

- The cut is timed to the rules: the strike is on screen from the step the cut lands and through the freeze.
  The rules now land a cut on its sixth step, as note 05 times it, where before it was a step late.
- The second cut swings back, the charge holds the wind-up, the faint lies down, a throw that orders points.
- A tell keeps its pose with only a small breath of squash on it (it was puffed up to 1.28 times on top of a
  real pose), and its warm light no longer darkens a grey beast to brown.
- The moment of calming, above.
- The hero shimmers through the safe moment after a hit instead of vanishing on every other frame.
- The marks of thrown light are teal pips over the beast's head. The pet's strike sends them diving into it.
- The game's own hints are hidden in the lab.
- A rig refused for being too near a beast shows the ring the beast keeps clear, in red, outside its body.
- The spin pushes what it hits 2 blocks away over a quarter second, and a steady beast only once its guard is
  empty, with a test.
- The pebblepup plays the pet's way. Its brace takes an attack for the hero, and the record counts it.

Milestone 1, the lab with stand-in art, is done: every way plays start to finish against every beast in the
browser, by the bot and by real keys; the view is cut into `keys`, `feel`, `looks` and `draw`; a cut pushes a
small beast; the screen shakes, with a switch; the edge warms at low health; `tools/fight-serve.mjs` keeps
the ratings; and the lab is in `verify-game`'s feature map (`features/fight-lab.md`).

The rigs are the real props now (`rigLamp`, `rigSnare`, `rigPlate`, `rigChannel` and their spent ones). The
lab adds what they need to read at the fight's zoom: a bright ring where the snare vine lies, pulled tight
when it goes off and kept around the feet of a beast it holds, the lamp's circle of light and the plate's
reach. An independent tester's seven problems with the card, the keys and the words are fixed, and
`fight-play.mjs --card` keeps four of them fixed. Still open from milestone 2: the marks of an attack as
props.

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

Most serious first. The ones that need a sheet redrawn say so.

- The hero in `hero-cut` is slimmer than in his own sheet, and his front view turns a little to the side, so
  he changes shape for the length of a cut. Code cannot fix it: the sheet needs redrawing.
- The sheets have three views, so a cut at 45 degrees shows the side view while its arc on the ground shows
  the true angle. Note 05 names eight directions as the upgrade if this reads wrong in play.
- The second cut in a side view is the first cut again: mirroring a side view would turn the hero around. A
  real backswing needs its own frames.
- The pets are small at the fight's zoom (0.85 and 0.9 blocks tall), so the leaftail's tail whip and the
  pebblepup's brace read as a crouch and a hop. The pebblepup's brace does not show its stone back clearly
  (the artists' report says so too): a sheet with a clearer brace pose would fix it.
- The boar's tell holds its head high, where a charge would want it low. The code adds only a small draw back.
- The card folds as a beast wakes. "Take it away" and the way buttons are then one click further, behind
  Show.
- The spent lamp's crack and the plate's spring wire are too small to see at the fight's zoom. The lamp reads
  as spent by its dark globe and its circle of light going out, the plate by standing up on its spring.
- The snare vine's ring is the lab's own drawing. The vine itself is still hard to see on grass.
- The warm light of a tell's last quarter second turns the grey boar a warm brown, close to its own healthy
  brown. The gold shape on the ground turning hot orange carries the same warning.
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
