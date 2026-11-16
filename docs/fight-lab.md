# The fight lab

A test scene inside the real game with two places to fight. In the meadow, behind `?scene=fight`, the hero fights
the beasts with a weapon and a companion, one beast or two at once, and the traps wait behind their own button.
In the Verdant Stag's hall, behind `?scene=stag`, Kausthubh plays the first boss test. Both are on the branch
`lab/fight`. Without either flag the game is unchanged.

The plan it is built from is the handbook chapter `23-fighting.md` and the research notes `05`, `08` and `09`
in `~/dev/sandbox/game-look-test/design`. This file says how the lab is put together, what each part
promises the others, and what is still to build. Read it before you change anything under
`src/game/fight`, `src/game/fightview` or `src/game/views/lab-fight.view.ts`.

## The address

| Part | What it does |
|---|---|
| `?scene=fight` | Opens the lab. It skips the title and keeps its own save (`greenhollow.save.fight`). |
| `&weapon=sword`, `bow` or `staff` | Starts with that weapon in the hand. Without it, the one used last. |
| `&companion=leaftail`, `pebblepup`, `lanternfly` or `mossling` | Starts with that companion. Without it, the one used last. |
| `&beast=thistlehog`, `gearling` or `boar` | Brings that beast in at once. `&also=` brings a second one beside it. |
| `&way=world` | Opens on the traps. |
| `&quality=low`, `medium` or `high` | Holds a quality level for the visit, as in the game. |
| `&log=1` | Also sends every finished fight to `fight-log` beside the page. Only `tools/fight-serve.mjs` answers that. |
| `?scene=stag` | Opens the lab in the Verdant Stag's hall instead, with its own save (`greenhollow.save.stag`). `&quality` and `&log=1` work there too. |

## One way to fight

Until milestone 3 the lab compared three ways to fight. Kausthubh played them and picked: the hero fights, the
companions help, and the traps are a side scene. The pet's way is gone: its orders, its whistle, its hearts and
the pet that could be hurt left the rules, the card, the bot and the tools.

Every fight has the same rules. An attack shows its shape on the ground before it lands, a beast has a guard that
empties, the hero holds F to hold out the Mark to a beast whose guard is empty, and a hero whose health runs out
faints and wakes at the arena's edge. Nobody dies.

### Weapons

A weapon is an entry in `WEAPONS` in `content/fight.ts`: a quick move on a click and a held move on hold and let
go. One attack machine in `fight.sim.ts` plays whichever weapon is in the hand. 1, 2 and 3 change the weapon, also
in the middle of a fight; the hero cannot attack for 0.35 seconds after.

| Weapon | Click | Hold and let go | It asks the player to |
|---|---|---|---|
| Sword | Two cuts in an arc, 10 guard each | A spin that hits all round for 30 and pushes | Stand close, at the beast's side, and step out in time |
| Bow | An arrow down the aim, 6 guard, bent to a beast within 8 degrees | A drawn shot that passes through, 24 guard, and pushes | Keep a line and keep a distance, and move when the far attacks come |
| Staff | A bolt of the Mark's light, 5 guard, that leaves a mark | A burst at the pointer, 14 guard, that slows what it catches for 3 seconds | Set up the companion's strike, and slow a beast before it closes |

Arrows and bolts are one kind of thing in the rules, a shot: a place, a way, a speed, how far it goes, how wide it
is, what it breaks and whether it passes through. Shots stop at the wall and the trees and hit the hall's targets.
The sword's numbers are note 05's, as they were. The bow's quick shot is note 05's 9 frames and 24 blocks a second.

### Companions

A companion is an entry in `COMPANIONS`, with a role. It does its job by itself. Nothing hurts it, and nobody
sends it or calls it back. Each has one skill on C, with a rest. Every companion also strikes a little by itself,
and each mark of the staff's light on a beast makes that strike half again as strong and is spent by it.

| Companion | Role | What it does by itself | C | How it shows |
|---|---|---|---|---|
| Leaftail | Striker | Attacks what the hero fights, 6 guard a strike, and steps out of shapes | Pounce: 20 guard | It runs in and hops at the beast |
| Pebblepup | Guard | Stands between the hero and the beast, and takes half of a hit that lands on the hero | Brace: takes the next attack whole and staggers the beast | A small teal shield in front of it; braced, a full ring |
| Lanternfly | Healer | Mends 3 health a second while nothing is about to land on the hero, from 1.5 seconds after a hit | Mend: 35 health at once | A line of green light to the hero, motes rising off the hero |
| Mossling | Booster | Every 6 seconds of a fight, makes the hero's next hit strong: twice the guard | Bloom: for 5 seconds every hit breaks half again more guard and a held move charges twice as fast | A glow and sparks at the hero's hand; in bloom, a green ring round the hero |

### Beasts

Each beast keeps the question it asked and gets more. Every attack still shows its shape for at least 0.6 seconds.

| Beast | Its attacks | Guard |
|---|---|---|
| Thistlehog | Needles: a ring round itself (as before). Roll: it curls up and rolls down a line at a hero a little way off. Quills: far off, a ring where the hero stands, then a second where they went. | 300 |
| Gearling | Charge, then a spin where it ends (as before). Slam: a ring round itself when the hero is close. Toss: far off, a gear thrown down a long line, then a second. | 450 |
| Boar | Charge, tusks, stomp (as before, with longer tells and heavier hits). Gore: a short lunge with its head down a few steps off. Hurl: far off, a clod where the hero stands, then a second. Enraged, it wheels round after a charge and charges again. | 2,100 in three parts |

- Far off is not safe. Each beast has an attack that reaches past 15 blocks, and a follow-up that lands where the
  hero moved to.
- The boar turns slowly, 2 radians a second, and an attack with a direction waits until it faces the hero. A
  player who stands at its side is out of its tusks.
- Once half its guard is gone a beast is enraged: its leads are 0.9 of what they were (never under 0.6), it stands
  open 0.7 as long, rests 0.65 as long and walks a quarter faster. It stops, breathes out ash, shakes and cries
  out, the line over the bars says so, and its bar reads "Angry: it comes faster".
- In a fight a charge into the wall or a tree breaks 8% of the guard. The traps keep their own share.
- The card can bring in two beasts at once: two of a kind, or one each of two kinds. Each has 60% of its guard.
  They wake together and take turns: one does not wind up while the other's attack is still to land.

### The traps

The traps are a side scene behind the card's Traps button (`&way=world`), kept for what the game may use them for.
They play exactly as at milestone 3: the beasts fight with their milestone 3 attacks and never enrage, and the
perfect player's numbers match `fcefd6d` to the tenth of a second. C sends the companion to the pointer as a lure.

| Where | Keys |
|---|---|
| A fight | Click and hold click for the weapon, 1 to 3 for the weapon, Shift to dodge, C for the companion, hold F to calm |
| The traps | 1 to 4 and click for a rig, Z to take one back, E to wake the beast, C to lure, Shift to dodge, F for the plate and the calm |

This build's camera uses Q and R, and E interacts, so the companion's skill is C.

## How hard it is

`bun tools/fight-sim.ts` plays every weapon (with the leaftail) and every companion (with the sword) against each
beast and each pair, over 20 seeds, by three players made of rules:

| Player | Sees a shape | Steps the wrong way first | Dodges when walking is too slow | Attacks |
|---|---|---|---|---|
| Perfect | after 0.3 s | never | always | all the time, but never while a shape is about to land near it |
| Middle | after 0.4 s, or 0.75 s for a quarter of shapes | for 0.3 s on 15% of shapes | 6 times in 10 | in bursts of 2 to 4 s |
| Clumsy | after 0.7 s | for 0.3 s on 15% of shapes | 4 times in 10 | in bursts of 1.2 to 2.4 s |

The middle and perfect players come in at a big beast's side; the clumsy one walks straight in. The targets, with
the middle player, the sword and the leaftail: the thistlehog in 10 to 20 seconds, the gearling in 15 to 30, the
boar in 60 to 120 losing a quarter to two thirds of the health. The clumsy player faints against the boar in one
fight in ten to one in two and still wins in under four minutes. The perfect player wins everything without a hit.
`fight.test.ts` holds each of these.

## The layers

```
src/game/content/fight.ts     every number: the hero, the weapons, the beasts, the companions, the rigs, the Stag
src/game/fight/               the rules (.sim.ts, no drawing, no keys)
  shapes.sim.ts                 is a point inside a circle, a line, a cone
  arena.sim.ts                  the arena as data, and the Stage the fight stands on
  fight.sim.ts                  createFight(stage, options): hero, companion, beasts, shapes, shots, rigs, the record
  record.sim.ts                 summaryOf(record) for the card after a fight, and the hall's checks
  bot.sim.ts                    createBot(fight, stage, { level }): a player made of rules, perfect, middle or clumsy
  stag-hall.sim.ts              createStagHall(fight, stage): the Verdant Stag's hall, and createHallBot
  hall-layout.sim.ts            the hall as data, and its Stage
src/game/fightview/           drawing and the interface for the lab
  keys.ts                       keys and mouse into the fight, the weapon and the rig in the hand, the hook that steps the fight with the body
  feel.ts                       a fight event into a freeze, a jolt, a flash on the ground, particles and a sound
  looks.ts                      which sheet, frame, squash and tint a fighter shows, and the stand-ins
  draw.ts                       each frame: the fighters, the companion's job, shots, and the marks on the ground
  calm.ts                       the moment of calming around the beast: the thread, the ash, the green, the gift
  figures.ts                    one quad per fighter: size, flash, shake, squash, roll, drained grey, colors coming back
  ground.ts                     everything flat on the ground, one draw call
  sparks.ts                     small pixel pictures in the air: motes, ash, a heart, flowers, pips, gifts. One draw call
  rigs.ts                       the four rigs, drawn with the game's rig props
  arena.ts                      stamps the arena into the block world and dresses it
  panel.ui.ts                   the card, the bars, a bar over each beast, the card after a fight, the log
  hall.ts                       the Stag's hall in the world: its blocks, the Stag, chains, pins, lamps, pods, vines
  hall.ui.ts                    the hall's line at the top of the screen
  log.ts                        the fights that ended, kept in the browser
src/game/views/lab-fight.view.ts   the glue: the flag, the arena, making the fight, the order of a frame, the door
tools/fight-sim.ts            the difficulty table, the traps and the hall, with no browser
tools/fight-play.mjs          one fight in headless Chrome, by a bot or by real keys, and the card
tools/fight-play-stag.mjs     the Stag's hall in headless Chrome (fight-play.mjs --scene stag)
tools/fight-poses.mjs         every pose of every fighter, set through the door, one sheet of pictures each
tools/fight-strip.mjs         a strip of pictures through one calming, one frame after another
```

The arrows go one way. Content knows nothing. The rules read content. The view reads the rules and never writes
their state: it calls `press`, `setWeapon`, `setCompanion`, `placeRig`, `bring`, `setWay` and changes
`fight.input`. The rules never learn that a view exists. A new weapon, companion, beast, attack or rig is data in
`content/fight.ts` first.

There is no `src/game/fight/index.sim.ts` on purpose. A folder with one is installed into every game and
would run on the world server. The lab makes its own fight and steps it itself.

## What the rules promise

- `fight.step(dt)` works for any `dt`. The lab calls it once for each step of the hero's body, 60 a second, from
  `PlayerRig.drive`. The tests do the same.
- With `external: true` the fight does not move the hero. The caller reports where the body is with `placeHero`
  before every step, then moves the body as `hero.driven`, `driveX`, `driveZ`, `pace`, `shoveX` and `shoveZ` say.
  Without it the fight moves the hero itself, walking at 4.4 blocks a second and swimming at 2.4 where the stage
  says the hero swims (the pond), as the body does.
- `fight.events` fills during a step and the caller empties it. An event is for the picture and the sound only. No
  rule depends on anyone reading it.
- `fight.record` counts the fight: its length, its weapon and companion, the hits taken and by what, the health
  lost and left, and what the companion did. `onEnd` gets a copy when a fight is won and when one in progress is
  dropped.
- Two hooks are left for later. `options.reach` is the Heartstone: a beast whose `depth` is higher is emptied and
  still not calmed. Nothing in the lab sets it. Friends would be more heroes: the hero's state is one object today,
  and every rule that reads it takes it from one place.

The words `window`, `document` and `THREE` may not appear in a `.sim.ts` file, not even in a comment.
`bun run boundaries` fails on them.

## What the view promises

- A fighter is drawn from the sheet named after it when the manifest has one, and from its stand-in otherwise.
  `window.__fight.standIns()` lists what is a stand-in right now.
- The freeze of a hit is in one place, `PlayerRig.drive`: the fight's clock and the body wait, the picture goes on. A cut
  freezes 4 frames, a spin 6, an arrow and a bolt 2, a drawn shot and a burst 5.
- One draw call for each fighter (at most about eight), one for everything on the ground, one for the sparks in
  the air, one for each kind of rig standing, and a few for the three trees. The hall adds about 12 of its own.
  The game's budget is 150 draw calls, 400,000 triangles and 6 ms of script a frame.
- The card folds to its title when a beast or the Stag wakes and opens again when the fight ends. A player who
  opens it during a fight keeps it open. On a narrow window the bars move right of it.
- The card after a fight says what happened: how long it took and with what, what hit the hero and how often, the
  health lost and left, and what the companion did, in a few lines. It asks for no rating. "Fight it again"
  brings the same beasts back with the same weapon and companion. It closes when new beasts come in, the traps
  open or the companion changes, and in the hall when the hall starts over.
- A new companion, or the traps, start the encounter again: the beasts come back asleep, and a fight in progress
  is in the log as left. A new weapon is taken in hand and the fight goes on. In the hall a new companion starts
  the hall over.
- One word for one state. Dizzy is an empty guard, the only state the Mark can hold. A beast standing open after
  an attack is not dizzy, and a stunned one is helpless. A beast is calmed, a machine shut down and the Stag
  freed. The record keeps `calmed` for all three.
- Gold means this will hurt: the shapes of attacks are gold, hot orange for the last quarter second. Teal is the
  player's magic: the Mark, the staff, the companions' work. Pale is the hero's own: the cut's arc, an arrow, the
  bow's line. A slowed beast has a cold blue ring, and an enraged one breathes grey ash.
- `window.__fight` is the door. It has the fight, `bot(on, layout, level)`, `state()`, `log()`, `standIns()`,
  `screen(x, z)` and `keysToward(x, z)`. `hold(on)` stops the rules while the picture goes on, so a test can set
  a fighter's state by hand and look at its pose. `slow(k)` plays the picture's own clocks k times as fast, for
  a strip of screenshots. `reduceMotion(on)` switches the game's setting. `state()` has the hero's weapon,
  charge, strong hit and bloom, the companion's role, mode and whether it is mending, every beast in `beasts`
  (its guard, whether it is enraged or slowed, the attack it is on) and the first in `beast`, with `moment`, the
  seconds into its calming. In the hall `hall` is the hall's rules, `bot(true)` plays the hall, `state().hall`
  has its phase, the Stag, what is broken, the record and the hall's own triangles, and `screen(x, z, y)` gives a
  point at a height, for the top of the vines. The game's own door `window.__game` is still there.

## The sheets the lab asks for

The names are a contract: the view looks for them in the manifest.

| Manifest name | Frames | What the lab does with it |
|---|---|---|
| `thistlehog`, `gearling`, `boar` | `idle` 2, `walk` 4, in front, back and side rows | Standing and walking |
| `thistlehog-fight`, `gearling-fight`, `boar-fight` | `poses` 4: tell, attack, dizzy, calm | Held one frame at a time |
| `hero-cut` | `cut` 4: wind-up, strike, follow-through, recovery | Played once over a cut. A redrawn one is coming. |
| `hero-bow` | `poses` 4: nock, full draw, release, lower | Not in the manifest yet. Its stand-in is `hero-call`'s throw wind-up and release. |
| `hero-staff` | `poses` 4: raise, cast, hold with the light gathered, burst | Not in the manifest yet. Its stand-in is `hero-moves`' reach and `hero-call`'s release and point. |
| `hero-moves` | `poses` 4: dodge, hurt, reach, calm | Held |
| `hero-call` | `poses` 4: throw wind-up, throw release, whistle, point | Only as the stand-in for the bow and the staff |
| `leaftail-fight`, `pebblepup-fight` | `poses` 4: ready, strike, hurt, fainted | Ready and strike. Hurt and fainted are no longer used: nothing hurts a companion. |
| `leaftail`, `pebblepup` | `idle` 2, `walk` 4 | The striker and the guard |
| `lanternfly` | `flutter` 4, front only | The healer, hovering a block up |
| `critter` | `idle` 2, `walk` 4 | The mossling, the booster: this is its own sheet |

Beasts are drawn in their healthy colors. The drained grey and the colors coming back are the shader in
`figures.ts`, so the two looks always have the same pose.

How `looks.ts` uses them:

| Fighter | State | What shows |
|---|---|---|
| Hero | A cut | Wind-up until the step the cut lands, the strike for a tenth of a second from there (so the freeze of the hit holds it), the follow-through, the recovery. The second cut starts from the recovery and is mirrored when seen from the front or the back. |
| Hero | Charging a spin, the spin | The wind-up held, brighter when the spin is ready. The strike turned once around the views. |
| Hero | An arrow, a drawn shot | Nock until the arrow leaves, release, then lower. Drawing holds the nock, then the full draw, brighter when ready. |
| Hero | A bolt, a burst | Raise until the bolt leaves, then cast. Gathering holds the light; the burst holds it until it lands, then bursts. |
| Hero | Dodge, hurt | Their poses. The two afterimages of a dodge are the dodge pose. |
| Hero | Holding the Mark | Reach for 0.18 seconds, then calm, and calm through the release after it. |
| Hero | Faint | The hurt pose tipped over onto its back, pale. |
| Hero | Safe after a hit | A cool, brighter light on every other frame. The hero never disappears. |
| Hero | A new weapon in hand | A short dip for the 0.35 seconds it cannot attack. |
| Companion | Strike | The strike pose with a hop: 0.35 blocks for the leaftail, 0.12 for the pebblepup. |
| Companion | The guard, the brace | The ready pose; braced, planted wider and lower. |
| Companion | Mending | The lanternfly flutters and glows. |
| Beast | Asleep | The calm pose, its eyes shut, drained grey. |
| Beast | Tell | The tell pose with a small breath of squash, and a warm light for the last quarter second. |
| Beast | Charge, just after an attack | The attack pose. |
| Beast | Dizzy, stunned, snared | The dizzy pose. Dizzy sways, a snare struggles. |
| Beast | Enraged | It shivers harder and breathes ash. |
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
| 3.6 | The card after the fight says what happened. |

A machine is shut down, not calmed. The gearling stays tipped over and lit for 0.4 seconds while its eye goes
dark, then stands, settles with a puff of dust and the stinger, and a spring pops out at 0.75. No ash, no
heart, no green.

With the game's reduce motion on, nothing flies: the colors fade back in place, the ring of green and the
flowers stand at full size and fade, and the gift's name shows over the hero.

The hold's motes and the ash are fewer at lower quality: 45% at `low`, 70% at `medium`. The sparks are one
draw call at every level.

## The Stag's hall

The research says a giant works when it is the place and its parts are the targets, and fails when it stops
attacking the player. The hall is built to that.

Two hooks in `fight.sim.ts`, in one marked block, let a boss be its own module. `fight.addTarget({ x, z,
radius, guard, name, open, high })` makes something that is not a beast for every move of every weapon and the
striker's strike to hit. Only the companion cannot reach a `high` one. It sends `targetHit` and
`targetBroken`. `fight.threaten({ kind, x, z, facing, reach, width, lead, damage, heavy, id, push })` shows a
shape that belongs to no beast and lands on the hero like any attack, and `fight.cancel` takes it away. A braced
guard takes one for the hero. A beast fight makes neither.

The rules are `fight/stag-hall.sim.ts`, the layout `fight/hall-layout.sim.ts`, the numbers `STAG` in
`content/fight.ts`. There are three phases:

1. The chains. Four pins to break. The Stag sweeps its antlers across the floor and stamps a leg near it.
2. The overgrowth. Dusk falls. Four lamps to light, and seed pods that grow only in the dark and burst.
3. The collar. A ramp of vines grows up its flank. On it the Stag shakes the vines, and a hit throws the hero
   off. The collar opens to a hero high on the ramp.

The hero fights with whatever weapon is in the hand, and the companion does its job: the striker strikes the
pins, lamps and pods the hero hits, and the healer mends. The hall's bot frees it with each of the three weapons.
Someone else is redesigning the hall after milestone 4, so it plays as it did at milestone 3. A hero who faints
wakes at the door, and the Stag keeps its phase. The record
gets the seconds in each phase, the hits by attack, the faints and the longest stretch with no attack of the
Stag's on the ground (`record.boss`), and the card shows them as checks. `src/game/fight/README.md` has every
rule and number.

The view is `fightview/hall.ts` and `hall.ui.ts`. It stamps the hall into the block world and builds the Stag
from code as a body as tall as an oak, whose head and antlers move with the rules. The Stag is drained grey
until the collar breaks, and keeps a pale rim of light at dusk so it reads as a body with a head and antlers.
Gold chains run to the pins and the collar. The end is 20 frames of stop. Then the chains fall, the grey runs
out from the antlers down with ash lifting off it as off a calmed beast, it lowers its head to the hero, and
the card after the fight says it was freed, with the hall's checks, and the log keeps it under the way `stag`.

The hall meets the meadow's lab where they share a part. The card folds and shows what happened as above. A cut on a
pin, a lamp, a pod or the collar shows the strike frame through the freeze of the hit, as on a beast. The
marks of `draw.ts` lie on the hall's floor or the top of its vines and are cut at its wall. The meadow's edge
ring is not drawn there. The hall draws a shake itself, on each step of the vines it covers. The game's
movement hint is hidden in both places.

`createHallBot` plays it. `bun tools/fight-sim.ts stag` prints its numbers with no browser, and
`bun tools/fight-play.mjs --scene stag` plays it in Chrome by the bot or with `--keys`.

## Where the view should be cut

The view is cut along these lines, so two people can work on it without meeting in one file:

| File | Its one job |
|---|---|
| `views/lab-fight.view.ts` | The flag, the arena, making the fight, the order of a frame, the door |
| `fightview/keys.ts` | Keys and mouse into `fight.input`, `press`, the weapon and the rig in the hand. The `PlayerRig.drive` hook that moves the body. |
| `fightview/feel.ts` | A fight event into a freeze, a jolt, a flash on the ground, particles and a sound. One table. |
| `fightview/looks.ts` | Which sheet, frame, squash and tint a fighter shows for what it is doing. The stand-in table. |
| `fightview/draw.ts` | Each frame: place the hero, the companion and the beasts, show the companion's job, and draw the marks on the ground. |

## What Kausthubh said after playing, and milestone 4

He played every way and the hall on 2026-11-11. His eleven fights are the first lines of
`.artifacts/fight/ratings.jsonl`. In his words, cleaned up:

- The pet's way was the worst. "I just stood back and pressed C."
- The hero's way was cool. "Add more weapons and more variety."
- Pets should be companions with different jobs. "From enhancing my abilities, to attacking, and it should
  attack by itself, and others to heal me."
- The traps were pretty cool, but not the main way to fight. "I do want to put that in the game somewhere."
- The beasts were too easy. He calmed the boar in 18.9 seconds on his first try.
- He did not get the boss. "The model was bad. There were colors all around the floor. It just stood
  there and then random charges happened." It took him 162 seconds, 25 hits and three faints.
- Polish everything, playtest it, and audit the interface.

So the hero's way is the fight. Milestone 4 turned the lab from a comparison of three ways into one fight worth
polishing. This was the plan; "One way to fight" above is what was built.

### One way, with a weapon and a companion

The card no longer picks a way. It picks a weapon and a companion, and the traps become a side scene.

- The pet's way goes. Its orders, its whistle and its hearts leave the rules, the card, the bot and the
  tools. What was good in it stays under other names: the thrown light is the staff's attack, and the marks it
  leaves make a companion's strike stronger.
- The traps stay as they are, behind their own button, for whatever the game later uses them for (the
  ladder's "use the place" fights: a charge baited into a wall, a channel flooded under a guardian). Nothing new
  is built on them now.

### Weapons are data

A weapon is an entry in `content/fight.ts`: a quick attack and a held attack, each with its timing, its shape
and what it does. The rules have one attack machine that plays whatever the weapon in the hand says. The hero's
`cut` and `spin` become the sword's two entries. The story names the first three weapons: sword, bow, staff.

| Weapon | Click | Hold and let go | It asks the player to |
|---|---|---|---|
| Sword | Two cuts in an arc | A spin that hits all round and pushes | Stand close and step out in time |
| Bow | An arrow down the aim | A drawn shot that passes through and pushes | Keep a line and keep a distance |
| Staff | A bolt of the Mark's light that leaves a mark | A burst at the pointer that slows what it catches | Set up the companion's big hit |

Arrows and bolts are one kind of thing in the rules, a shot: a place, a way, a speed, what it breaks and
whether it passes through. 1, 2 and 3 change the weapon in the hand.

### Companions have a job each, and do it by themselves

A companion is an entry in `content/fight.ts` with a role. Nothing hurts it, and nobody has to send it or call
it back. It has one skill on C.

| Role | What it does by itself | C |
|---|---|---|
| Striker | Attacks whatever the hero is fighting and steps out of shapes itself | A pounce |
| Guard | Stays between the hero and the beast | A brace that takes the next attack and staggers the beast |
| Healer | Mends the hero slowly while nothing is about to land on them | A burst of healing |
| Booster | Now and then makes the hero's next hit a strong one | For a few seconds every hit breaks more guard and a held attack charges twice as fast |

### Beasts ask more

A beast that only does one thing is solved in one fight. Each beast gets a second and a third question, comes
faster once its guard is half gone, and has an answer to a hero who stands far off with a bow. The card can
bring in two at once. How hard it is gets measured by the clumsy player, not the perfect one: a clumsy player
should lose a third of their health to the boar and sometimes faint.

### The boss starts again

The first hall failed on reading. The next one keeps the research's rule (the giant is the place, its parts
are the targets, it never stops attacking) and changes what broke it:

- The Stag is drawn like everyone else in the game: a big pixel sprite with poses for what it does, not a
  body of boxes. It stays as tall as an oak.
- It acts before the floor does. It turns to the hero, rears, lowers its antlers and then sweeps where the
  antlers are. A shape on the floor confirms what the body already showed.
- The floor is quiet. One color means "this will hurt". Pins, lamps and light circles do not use it.
- It says what to do, once, the way the first fight in the game would: one line at the start of each
  phase, and the first pin glints until it is hit.

## Still to build

Milestone 4 is built: one way to fight, three weapons, four companions with a job each, beasts with more attacks,
an answer to a hero far off and a rage at half guard, two beasts at once, a middle player and the difficulty
table, and a card after a fight that says what happened. What is left:

- The bow's and the staff's own sheets, `hero-bow` and `hero-staff`, and the redrawn `hero-cut`. Two artists are
  drawing them. The view picks them up by name when the manifest has them.
- Sounds for the bow's release, an arrow's hit, the staff's bolt and burst, a heal and a strong hit. The lab uses
  the game's spell, hit and interface sounds for them now.
- How hard it is for a person, not a rule-made player. The table is tuned to the middle player; Kausthubh's play
  says whether the middle player is a person.
- The next boss test, which someone else is building. The hall plays as at milestone 3.

Milestone 3, the boss tests: the first is built, the Verdant Stag's hall above. Milestone 2, the real art in the
lab, and milestone 1, the lab with stand-in art, are done. Their history is in the git log of `lab/fight`.

## Known weak spots

Most serious first. The ones that need a sheet redrawn say so.

- The difficulty is tuned to rule-made players. The middle player is a guess at a person who reads most shapes in
  time; nobody has played milestone 4 yet.
- In the browser the perfect rule-made player takes longer over the boar than in the sim: about 190 game seconds
  against about 95, with the sword and the lanternfly or the pebblepup. The two agree over the first 40 seconds;
  why they part after that is not known yet.
- The bow and the staff have stand-in poses: the throw of `hero-call` for the bow, and the reach and point of
  `hero-moves` and `hero-call` for the staff. They read as throwing, not as drawing a bow.
- The clumsy player faints against the boar in about a third of fights with the sword, but rarely with the bow
  or the staff, and never with the pebblepup or the lanternfly. The sword is the riskiest weapon for a learner.
- Two boars at once are the hardest fight: a middle player with the bow takes about 140 seconds and faints in
  about half of them, with the staff about 130 seconds and faints in a third. With the sword it is about 95.
- The companions are small at the fight's zoom (0.85 to 0.9 blocks tall). The guard's shield and the healer's line
  carry their jobs; the striker's hop is small.
- The hero in `hero-cut` is slimmer than in his own sheet, and his front view turns a little to the side. The sheet
  is being redrawn.
- The sheets have three views, so a cut at 45 degrees shows the side view while its arc on the ground shows the
  true angle.
- The boar's tell holds its head high, where a charge would want it low. Its new attacks use the same tell pose;
  only the shape on the ground tells them apart.
- Two beasts' bars can overlap when they stand close.
- A hero wading in the pond is slow, as the body swims there. The beasts' far attacks reach the pond, and their
  rings are drawn on the water.
- The warm light of a tell's last quarter second turns the grey boar a warm brown, close to its own healthy brown.
  The gold shape turning hot orange carries the same warning.
- Tall grass pokes through the shapes on the ground. Their rims stay readable at every quality.
- A charge that ends at the arena's edge stops as if at water. Nothing shows the edge but a pale ring.
- Note 05's soft heartbeat at low health has no sound yet: only the edge beats.
- The hall: the hero snaps up the vines a block at a time, the Stag at dusk is pale, and at high quality from the
  top of the vines at the furthest zoom a frame draws up to about 397,000 triangles. The hall is being redesigned.
