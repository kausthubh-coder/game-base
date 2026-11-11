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
- Every view part works at low, medium and high quality. Nothing is made per frame in the draw path.

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

## Checks

- `bun tools/fight-play.mjs --port <port> --way <way> --beast <beast>` plays one fight in headless Chrome through the door. `--keys` plays it with real keys and mouse instead, `--layout wall` sets no rigs, `--quality low` holds a quality level, and `--log` turns on `&log=1`. Pictures go to `.artifacts/fight/`.
- `bun tools/fight-serve.mjs <folder> <port>` serves a build and writes what `&log=1` sends to `.artifacts/fight/ratings.jsonl`.
- The `verify-game` skill's `features/fight-lab.md` lists the whole set.
