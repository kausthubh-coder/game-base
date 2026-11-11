# fightview

The fight lab's picture, sound and interface, behind `?scene=fight`. `src/game/views/lab-fight.view.ts` makes each part and calls them in order. The rules are `src/game/fight`; nothing here writes their state except through `fight.input`, `press`, `placeRig`, `bring`, `setWay` and the other calls a player could make. `docs/fight-lab.md` says how the lab fits together.

## What it exports

| File | Export | Its one job |
|---|---|---|
| `keys.ts` | `createKeys(view, fight, hooks)` | Keys and mouse into `fight.input` and `press`, the rig in the hand, and the `steer` hook that steps the fight with the hero's body |
| `feel.ts` | `createFeel(view, fight, hooks)`, `jolt`, `settle` | A fight event into a freeze, a jolt, a shake of the screen, a flash on the ground, particles and a sound. The table is `hear`. |
| `looks.ts` | `createLooks(figures)`, `TEAL`, `GOLD`, `HOT`, `PALE`, `SHADE`, `RED` | Which sheet, frame, squash and tint a fighter shows for what it is doing. The stand-in table. |
| `draw.ts` | `createDraw(view, fight, stage, floor, keys, feel)`, `heightOf(view)` | Each frame: the fighters where the rules have them, their shadows, the shapes of attacks and the rigs |
| `figures.ts` | `createFigures(view)` | One quad per fighter: size, flash, shake, squash, drained grey, colors coming back |
| `ground.ts` | `createGround(view)`, `MARK` | Every flat mark on the ground in one draw call |
| `rigs.ts` | `createRigViews(view)` | The four rigs and the rig in the hand, as stand-in shapes |
| `arena.ts` | `stampArena`, `dressArena` | Stamps the arena into the block world and dresses it |
| `panel.ui.ts` | `createPanel(root, log, actions)` | The card, the bars, the bar over the beast, the warm edge, "Again?" and the log |
| `log.ts` | `createLog()` | The fights that ended, kept in the browser, and sent to `fight-log` with `&log=1` |
| `hall.ts` | `stampHall`, `setRamp`, `dressHall`, `createHallView(...)` | The Verdant Stag's hall in the world, behind `?scene=stag` |
| `hall.ui.ts` | `createHallLine(root)` | The hall's line at the top: the phase, what to do, and the guard of the thing hit last |

## How a frame goes

1. The hero's body steps 60 times a second. On each step `keys.ts` writes the keys into `fight.input`, steps the bot when it is on, steps the fight, hands each event to `feel.hear`, and moves the body as the fight says.
2. Once a frame the view calls `keys.aim()` (the pointer on the ground), `feel.frame(dt)` (the shake), `draw.frame(dt, clock)` and `panel.update`.

## Facts

- The freeze of a hit is `feel.freeze`, in seconds. Only `keys.ts` spends it: the fight's clock and the body wait, the picture goes on.
- A hit freezes 4 frames, a spin's hit 6, a broken part of the guard 8, a calm 10.
- The screen shakes 3 pixels for 0.1 seconds when a spin lands and 6 pixels for 0.2 seconds when a heavy hit lands on the hero (`SHAKE` in `content/fight.ts`). It is an offset on the lens, so the world and the aim stay where they are. The Shake switch on the card and the game's reduce motion turn it off. The switch is kept with the way and the pet.
- Below 35% health (`LOW_HEALTH`) the screen's edge glows warm and beats slowly, stronger as health falls. It is never a red flash. A fainted hero has none.
- A fighter is drawn from the sheet named after it when the manifest has one, and from its stand-in otherwise. `window.__fight.standIns()` lists the stand-ins in use. The names the lab asks for are in `docs/fight-lab.md`.
- Shapes on the ground are gold while they fill, hot orange for the last quarter second, and white as they land. A charge that will crash shows a pale ring where it ends.
- Teal is the player's magic: the Mark's ring, thrown light, the pet's orders and skills. Grey is a drained beast; its colors come back from the head down when it is calmed. A machine goes dark instead.
- Every view part works at low, medium and high quality. The draw path makes no mesh, material, color or vector per frame; a few small iterators and closures remain.

## The Stag's hall

`?scene=stag` opens the lab in the Verdant Stag's hall on the same plot, with its own save. `views/lab-fight.view.ts` keeps everything for it in blocks marked "the Stag's hall".

- **The blocks.** `stampHall` paves the floor with cobble and two rings of stone brick (the painted land draws them as paving), clears the plot, sets a ring of barriers two high for the boulders, a barrier post under each pin and lamp, and the Stag's body as barriers eight high, taller than the top of the ramp. It runs every time the hall opens. `setRamp` adds or takes away the vines' ramp as barrier steps, one block higher every two cells; the painted hero walks up a one-block step.
- **The Stag.** Two merged meshes built from spheres and rods in the palette: the body (about 8 blocks at the shoulder), and the neck, head and antlers (past 14), which turn and dip with `hall.stag`. A sweep turns the head to the side it comes from, lowers the antlers, and swings them across as it lands. A stamp rears the front up and drops it. A shake rolls the body. A stagger hangs the head. Between phases it throws its head up. Freed, it stands still, then lowers its head to the hero.
- **Grey and color.** One uniform, `uDrain`, is a height in the world above which the colors are back. It stays above everything until the collar breaks, then falls from the antlers to the hooves in about two and a half seconds. The vines keep their colors: they are alive.
- **The rest.** The gold chains are one instanced mesh of links on sagging curves; a pin's end drops to the floor when it breaks, and every end on the collar drops when the Stag is freed. The pins topple when broken. The lamp heads glow once lit. The pods are one instanced mesh, growing and warming toward their burst. The roots flood out from the legs over the second phase's rise, and the ramp grows up out of the floor over the third's.
- **The hour.** The hall keeps its own hour: morning, then dusk while the lamps are dark, then morning again once they are lit. The lit lamps draw warm circles on the floor.
- **The marks.** The hall's own `ground.ts` batch: a ring round each target it can hit now with its guard as a gold arc, the collar's ring on the top of the ramp, the light of the lamps, and a shake drawn at the height of the hero's feet on the vines. `draw.ts` still draws every loose shape on the floor as it draws any attack.
- **The feel.** A hit on a target freezes the fight 4 frames (3 for a pod), as a hit on a beast does. A broken pin freezes 8, a phase 10, and the collar 20, note 05's "A Warden phase ends". `feel.hear` is wrapped to hear the targets' events; `feel.ts` itself is unchanged.
- **The camera** goes to its furthest step when the hall opens. The wheel brings it in as anywhere.
- The hall's meshes and marks draw about 16,000 triangles with their shadows, and about 12 draw calls.

## The door

`window.__fight`, only with `?scene=fight`:

| Call | What it gives |
|---|---|
| `fight` | The fight itself |
| `bot(on, layout)` | Lets the rule-made player fight, or hands the keys back. `layout` is `rigs` or `wall`. |
| `state()` | Plain data: the way, the phase, the hero, the pet, the first beast, the rigs, the record, the rig in the hand, the shake in pixels, and how many figures and marks are drawn |
| `log()` | The fights that ended, with their answers |
| `standIns()` | Which art is a stand-in right now |
| `screen(x, z)` | Where a point of the ground is on the page |
| `keysToward(x, z)` | The walking keys that lead to a point, with the camera as it stands |
| `hall` | The Stag's hall's rules with `?scene=stag`, null in the meadow. `bot(true)` then plays the hall, and `state().hall` has its phase, the Stag, what is broken, the record and the hall's own triangles. `screen(x, z, y)` gives a point at a height, for the top of the vines. |

## Checks

- `bun tools/fight-play.mjs --port <port> --way <way> --beast <beast>` plays one fight in headless Chrome through the door. `--keys` plays it with real keys and mouse instead, `--layout wall` sets no rigs, `--quality low` holds a quality level, and `--log` turns on `&log=1`. Pictures go to `.artifacts/fight/`.
- `bun tools/fight-play.mjs --port <port> --scene stag` plays the Stag's hall, by its bot or with `--keys`. It takes a picture at each zoom step and in each phase, and prints the hall's record, draw calls, triangles (and the hall's own) and script time.
- `bun tools/fight-serve.mjs <folder> <port>` serves a build and writes what `&log=1` sends to `.artifacts/fight/ratings.jsonl`.
- The `verify-game` skill's `features/fight-lab.md` lists the whole set.
