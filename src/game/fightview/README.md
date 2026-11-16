# fightview

The fight's picture, sound and interface: the lab's behind `?scene=fight` (the meadow) and `?scene=stag` (the Verdant Stag's hall), made by `src/game/views/lab-fight.view.ts`, and the world's, made by `world.ts` from `src/game/views/world-fights.view.ts` for each fight `src/game/fights` starts. The world's parts follow whichever fight runs through stand-ins (`follow` in `world.ts`), take the keys and the body only while one runs (`keys.use`), and hide when it ends (`draw.show`). The rules are `src/game/fight`; nothing here writes their state except through `fight.input`, `press`, `setWeapon`, `setCompanion`, `placeRig`, `bring`, `setWay` and the other calls a player could make. `docs/fight-lab.md` says how the lab fits together.

## What it exports

| File | Export | Its one job |
|---|---|---|
| `world.ts` | `createWorldFights(view)` | The world's fights: the lab's keys, feel and picture on the running fight, a keeper's body and room, the vines, and the door `window.__fights` |
| `world-hud.ui.ts` | `createWorldHud(root, art)` | The world's fight HUD in the Gilded Hearth look: the line, health and stamina, the kit's slots, the skill, each beast's name, depth and guard |
| `keys.ts` | `createKeys(view, fight, hooks)` | Keys and mouse into `fight.input` and `press`, 1 to 3 for the weapon, the rig in the hand, and the `PlayerRig.drive` hook that steps the fight with the hero's body |
| `feel.ts` | `createFeel(view, fight, hooks)`, `jolt`, `settle` | A fight event into a freeze, a jolt, a shake of the screen, a flash on the ground, particles and a sound. The table is `hear`. |
| `looks.ts` | `createLooks(figures)`, `TEAL`, `GOLD`, `HOT`, `PALE`, `SHADE`, `RED` | Which sheet, frame, squash and tint the hero shows for each move of each weapon, and each companion and beast for what it is doing, timed to the rules. The stand-in table. |
| `draw.ts` | `createDraw(view, fight, stage, floor, keys, feel, hooks)`, `heightOf(view)` | Each frame: the fighters where the rules have them, their shadows, the shapes of attacks, the cut's arc, the bow's line and the staff's ring while charging, arrows and bolts, the companion's job, the staff's marks, slowed and enraged beasts, and the rigs. `hooks.hall` says where the hall's floor, vines and wall are. |
| `calm.ts` | `createCalming(view, ground, sparks, hooks)`, `CALM`, `SHUT` | The moment of calming around the beast: the thread of the hold, the release, the ash, the heart, the green, the gift and its name |
| `figures.ts` | `createFigures(view)` | One quad per fighter: size, flash, shake, squash, roll, warm and teal glow, a mirror, drained grey, colors coming back |
| `ground.ts` | `createGround(view)`, `MARK` | Every flat mark on the ground in one draw call. `clip` cuts them at a circle. |
| `sparks.ts` | `createSparks(view)`, `SPARK` | Small 8 by 8 pixel pictures in the air, turned to the camera, in one draw call: motes, ash, a heart, flowers, pips and the gifts |
| `rigs.ts` | `createRigViews(view)` | The four rigs and the rig in the hand, drawn with the game's rig props |
| `arena.ts` | `stampArena`, `dressArena` | Stamps the arena into the block world and dresses it |
| `panel.ui.ts` | `createPanel(root, log, actions, { hall })` | The card (weapon, companion, beasts, the traps), the bars, the weapon and the skill on C, a bar over each beast, the warm edge, the card after a fight and the log. Where the bars go on a narrow window. |
| `log.ts` | `createLog()` | The fights that ended, kept in the browser, and sent to `fight-log` with `&log=1` |
| `hall.ts` | `stampHall`, `setRamp`, `dressHall`, `createHallView(...)` | The Verdant Stag's hall in the world, behind `?scene=stag` |
| `hall.ui.ts` | `createHallLine(root)` | The hall's line at the top: the phase, what to do, and the guard of the thing hit last |

## How a frame goes

1. The hero's body steps 60 times a second. On each step `keys.ts` writes the keys into `fight.input`, steps the bot when it is on, steps the fight, hands each event to `feel.hear`, and moves the body as the fight says.
2. Once a frame the view calls `keys.aim()` (the pointer on the ground), `feel.frame(dt)` (the shake), `draw.frame(dt, clock)`, the hall's own frame in the hall, and `panel.update`. `draw.frame` also runs the moment of calming (`calm.ts`) for a beast whose clock is running.

In the hall, `lab-fight.view.ts` wraps the body's step so the hall steps right after the fight, and wraps `feel.hear` so the hall hears the targets' events. `feel.ts` itself knows nothing of the hall.

## Facts

- The freeze of a hit is `feel.freeze`, in seconds. Only `keys.ts` spends it: the fight's clock and the body wait, the picture goes on.
- A cut freezes 4 frames, a spin 6, an arrow and a bolt 2, a drawn shot and a burst 5, a companion's strike 2, a strong hit and an enraged beast 6, a broken part of the guard 8, a brace 8, a calm 10. The cut's strike frame is on screen from the step the cut lands, so the freeze holds it.
- The screen shakes 3 pixels for 0.1 seconds when a spin lands and 6 pixels for 0.2 seconds when a heavy hit lands on the hero (`SHAKE` in `content/fight.ts`). It is an offset on the lens, so the world and the aim stay where they are. A drawn shot, a strong hit and a beast's rage shake it too. The Shake switch on the card and the game's reduce motion turn it off. The switch is kept with the weapon and the companion.
- Below 35% health (`LOW_HEALTH`) the screen's edge glows warm and beats slowly, stronger as health falls. It is never a red flash. A fainted hero has none.
- A fighter is drawn from the sheet named after it when the manifest has one, and from its stand-in otherwise. `window.__fight.standIns()` lists the stand-ins in use. The names the lab asks for are in `docs/fight-lab.md`.
- Shapes on the ground are gold while they fill, hot orange for the last quarter second, and white as they land. A charge that will crash shows a pale ring where it ends.
- Gold is only for what will hurt the hero. Teal is the player's magic: the Mark's ring and thread, the staff's bolt, burst and pips, the guard's shield and brace, the skills, the heart over a calmed beast. Pale is the hero's own: the cut's arc, arrows, the bow's line while drawing. The healer's line and bloom are a warm green, a slowed beast's ring cold blue. Grey is a drained beast, and the ash an enraged one breathes; its colors come back from the head down when it is calmed. A machine goes dark instead.
- What the companion does shows without the card: the striker hops at the beast, the guard stands in the way with a small shield in front of it and a full ring when braced, the healer's line of light runs to the hero with motes rising off the hero, and the booster's strong hit glows and sparks at the hero's hand, with a green ring round the hero in bloom. A strike from range is a short streak to the beast.
- A mark over the pond lies on the water, so a ring that lands on a hero wading there shows.
- A calmed beast's moment runs on its own clock, `calmT`, which `feel.ts` sets to minus the release's freeze when the rules say `calmed`. `looks.ts` reads it for the pose, the grey and the glow, and `calm.ts` for everything around. The timeline is `CALM` and `SHUT` in `calm.ts`, and `docs/fight-lab.md` lists it. The card after the fight waits for `CALM.end`.
- The game's reduce motion stills the calming: the colors fade in place, and nothing flies.
- The hero never blinks out. For the safe moment after a hit it shimmers a cool, brighter light on every other frame.
- The game's hints are hidden in the lab. A rig refused near a beast shows a red ring at the distance the beast keeps clear.
- A rig is its prop from `src/content/props.ts`, placed through `worldProps` like the game's stations: the armed prop while it is set, the spent one for the 1.2 seconds after it goes off, and a channel as three pieces in a row. Each kind costs one draw call. The rig in the hand is the armed prop, see-through, pale green where it can go and red where it cannot.
- The snare vine is leaf green on grass, so `draw.ts` draws a bright ring where it lies, pulls the ring tight when it goes off, and keeps a ring around the feet of a beast it holds. The lamp keeps its circle of teal light, and the plate the pale ring of its hand spring's reach.
- The card folds to its title when a beast or the Stag wakes, and opens again when the fight ends, the beast is taken away or the Stag is freed. A player who opens it during a fight keeps it open.
- The card after a fight is about one fight. New beasts, the traps or a new companion close it, and so does the hall starting over. It says in a few lines how long the fight took and with what, what hit the hero and how often (a follow-up counted with what it follows), the health lost and left, and what the companion did. It asks for no rating. "Fight it again" brings the same beasts back with the same weapon and companion, or starts the hall again. A fight that ends while the lab waits to show it is not shown once another starts. It says calmed for a beast, shut down for a machine and freed for the Stag, and so does the log. The hall's card keeps its checks.
- A new companion or the traps bring the same beasts back asleep. If a fight was on, it ends as left and the line over the bars says so. A new weapon, from the card or from 1, 2 and 3, is taken in hand and the fight goes on. In the hall a new companion starts the hall over, since changing it clears the fight's targets.
- The card's Bring in row has a select for a second beast: alone, or with a thistlehog, a gearling or a boar. In the traps it is hidden, and the traps fight one beast.
- In the hall the card shows what works there: the weapon and the companion, "Start over" in place of the beasts and the traps, the keys without the Mark, and the three phases as its rules.
- Esc with a rig in the hand puts the rig back and does not pause. `keys.ts` hears Esc first because views install sorted by their file names, and `lab-fight` comes before `ui-panels`.
- On a window too narrow for centered bars beside the card, the bars move right of it and wrap. The card after a fight and the line over the bars center in the same room. The card after a fight also keeps clear of the minimap and clock, 232 pixels of the top right corner, when it would reach them, and the hall's line always does. Below 820 pixels high the card tightens, and below 720 it scrolls with its bar showing.
- The Log button's count is the log's length, read each frame.
- Every view part works at low, medium and high quality. The draw path makes no mesh, material, color or vector per frame; a few small iterators and closures remain.

## The Stag's hall

`?scene=stag` opens the lab in the Verdant Stag's hall on the same plot, with its own save. `views/lab-fight.view.ts` keeps everything for it in blocks marked "the Stag's hall".

- **The blocks.** `stampHall` paves the floor with cobble and two rings of stone brick (the painted land draws them as paving), clears the plot, sets a ring of barriers two high for the boulders, a barrier post under each pin and lamp, and the Stag's body as barriers eight high, taller than the top of the ramp. It runs every time the hall opens. `setRamp` adds or takes away the vines' ramp as barrier steps, one block higher every two cells; the painted hero walks up a one-block step.
- **The Stag.** Two merged meshes built from spheres and rods in the palette: the body (about 8 blocks at the shoulder), and the neck, head and antlers (past 14), which turn and dip with `hall.stag`. A sweep turns the head to the side it comes from, lowers the antlers, and swings them across as it lands. A stamp rears the front up and drops it. A shake rolls the body. A stagger hangs the head. Between phases it throws its head up. Freed, it stands still, then lowers its head to the hero.
- **Grey and color.** One uniform, `uDrain`, is a height in the world above which the colors are back. It stays above everything until the collar breaks, then falls from the antlers to the hooves in about two and a half seconds, and flecks of ash lift off where it passes, through the lab's sparks. The vines keep their colors: they are alive.
- **Dusk.** A second uniform, `uDusk`, follows the hall's hour toward dusk. The body keeps a pale rim of light and some of its own color, so at dusk it reads as a body with a head and antlers, not a black shape.
- **The rest.** The gold chains are one instanced mesh of links on sagging curves; a pin's end drops to the floor when it breaks, and every end on the collar drops when the Stag is freed. The pins topple when broken. The lamp heads glow once lit. The pods are one instanced mesh, growing and warming toward their burst. The roots flood out from the legs over the second phase's rise, and the ramp grows up out of the floor over the third's.
- **The hour.** The hall keeps its own hour: morning, then dusk while the lamps are dark, then morning again once they are lit. The lit lamps draw warm circles on the floor.
- **The marks.** The hall has its own `ground.ts` batch. It draws a ring round each target the hero can hit now, with its guard as a gold arc, the collar's ring on the top of the ramp, and the light of the lamps. It also draws each shake, on every step of the vines the shake covers, at that step's height. `draw.ts` draws the other shapes as for any attack, at the hall's floor or the top of the vines, cut at the hall's wall, and without the meadow's edge ring.
- **The feel.** A hit on a target freezes the fight 4 frames (3 for a pod), as a hit on a beast does, so a cut on a pin, a lamp, a pod or the collar holds its strike frame. A broken pin freezes 8, a phase 10, and the collar 20, note 05's "A Warden phase ends".
- **The camera** goes to its furthest step when the hall opens. The wheel brings it in as anywhere.
- The hall's meshes and marks draw about 14,500 triangles with their shadows, and about 12 draw calls.

## The door

`window.__fight`, only with `?scene=fight` or `?scene=stag`:

| Call | What it gives |
|---|---|
| `fight` | The fight itself |
| `bot(on, layout, level)` | Lets the rule-made player fight, or hands the keys back. `layout` is the traps' `rigs` or `wall`, `level` is `perfect` (the default), `middle` or `clumsy`. |
| `state()` | Plain data: the way, the phase, the hero with its seconds in its act, its weapon, charge, swap, strong hit and bloom, the companion with its role, mode and whether it mends, the first beast and every beast (enraged, slowed, the attack it is on), how many shots fly, the rigs, the record, the rig in the hand, the shake in pixels, the freeze left, how many figures and marks are drawn, and the hall |
| `log()` | The fights that ended |
| `standIns()` | Which art is a stand-in right now |
| `screen(x, z)` | Where a point of the ground is on the page |
| `keysToward(x, z)` | The walking keys that lead to a point, with the camera as it stands |
| `hold(on)` | Holds the rules still while the picture goes on. A test sets a fighter's state by hand through `fight` and looks at the pose. |
| `slow(k)` | Plays the picture's clocks, and the freeze of a hit, at k times their speed. 1 is normal. |
| `reduceMotion(on)` | Switches the game's reduce motion setting. It is stored. |
| `hall` | The Stag's hall's rules with `?scene=stag`, null in the meadow. `bot(true)` then plays the hall, and `state().hall` has its phase, the Stag, what is broken, the record and the hall's own triangles. `screen(x, z, y)` gives a point at a height, for the top of the vines. |

`state().beast.moment` is the seconds into the moment of calming, below 0 during the release, and null before it.

## Checks

- `bun tools/fight-play.mjs --port <port> --weapon <weapon> --companion <companion> --beast <beast>` picks them with real clicks on the card and plays one fight in headless Chrome through the door. `--also <beast>` brings a second, `--level middle` lets a player that is not perfect fight, `--keys` plays it with real keys and mouse instead (1 to 3 mid-fight, the held move, C, F), `--traps` opens the traps (`--layout wall` sets no rigs), `--quality low` holds a quality level, and `--log` turns on `&log=1`. `--card` checks the card instead of playing one fight: the card after a fight, "Fight it again", the weapon and companion buttons, two beasts, the log, the traps, Esc with a rig in the hand and the fold. Pictures go to `.artifacts/fight/`, one for each attack's tell, each weapon's held move and each companion's job as they happen. It prints the cost during the fight, as mean and worst, and through the calming.
- `bun tools/fight-play.mjs --port <port> --scene stag` plays the Stag's hall, by its bot or with `--keys`, and `--size 1024x640` in a smaller window. It checks the card in the hall, the strike frame of a cut on each kind of target, and that no panel covers another. It takes a picture at each zoom step, in each phase and of each strike, and prints the hall's record, then draw calls, triangles (and the hall's own) and script time, in all and in each phase.
- `bun tools/fight-poses.mjs --port <port>` shoots every state of every fighter in three views, one sheet each in `.artifacts/fight/poses/`. `--only hero` shoots one.
- `bun tools/fight-strip.mjs --port <port> --beast <beast>` shoots nine frames through one calming, one after another, into `.artifacts/fight/strips/`. `--still` turns on reduce motion first.
- `bun tools/fight-serve.mjs <folder> <port>` serves a build and writes what `&log=1` sends to `.artifacts/fight/ratings.jsonl`. That file also holds Kausthubh's own fights: never write to it while a copy is out for him.
- The `verify-game` skill's `features/fight-lab.md` lists the whole set.
