# Fight lab

A test scene with two places to fight. In the meadow, behind `?scene=fight`, the hero fights the beasts with a weapon and a companion, one beast or two at once, and the traps wait behind their own button. In the Verdant Stag's hall, behind `?scene=stag`, the hero fights a giant boss. Without either flag nothing in the game changes.

## Sub-features

- `weapons`: the sword, the bow and the staff, picked on the card or with 1, 2 and 3, also mid-fight. Each has a quick move on a click and a held move on hold and let go.
- `companions`: the leaftail strikes, the pebblepup guards (its brace on C takes an attack whole), the lanternfly mends, the mossling makes a hit strong. Each does its job by itself, and nothing hurts it.
- `beasts`: the thistlehog, the gearling and the boar, each with its milestone 3 attacks and two or more new ones, an attack for a hero far off, and a rage at half guard. One beast, or two at once.
- `fight`: shapes on the ground before each attack, a guard that empties, hold F to calm a dizzy beast, fainting and waking.
- `feel`: the freeze of a hit by move, the shake (with its switch on the card), the warm edge at low health, the push on a small beast.
- `poses`: which frame of the real art each fighter shows in each state, timed to the rules (`fightview/looks.ts`), with stand-ins for `hero-bow` and `hero-staff`.
- `calming`: the moment a beast is calmed or a machine shut down, from the hold to the gift (`fightview/calm.ts`).
- `traps`: the lamp, snare vine, spring plate and water channel behind the card's Traps button, playing as at milestone 3.
- `card`: the card picks the weapon, the companion and the beasts, folds when a beast or the Stag wakes and opens when the fight ends, Esc puts back a rig in the hand before it pauses, and the bars move right of the card on a narrow window. After a fight it says how long, what hit you and the health left, and offers the same fight again. It asks for no rating. In the hall it shows only what works there.
- `difficulty`: `bun tools/fight-sim.ts` prints how hard each fight is for a perfect, a middle and a clumsy player made of rules.
- `stag`: the Verdant Stag's hall, the first boss test. Three phases: the chains, the overgrowth, the collar. It plays as at milestone 3, with any weapon in the hand.

## How to get to it (user POV)

Open the game with `?scene=fight`. Add `&weapon=bow&companion=lanternfly&beast=boar&also=boar` to start with a weapon, a companion and two boars, or `&way=world` for the traps. The card on the left does the rest. `?scene=stag` opens the Stag's hall, and the card's "The Stag hall" and "Back to the meadow" go between the two.

## What to run after a change

Preconditions: `bun tools/doctor.mjs` is clean, its `export PORT=… PLAY_PORT=…` line is run, and `bun run dev` is up on that port. Stop the dev server by its pid when done. Change no source file while a browser run plays: the dev server reloads the page and the run fails.

| You changed | Run |
|---|---|
| `src/game/content/fight.ts` or `src/game/fight/*.sim.ts` | `bun test src/game/fight`, `bun tools/fight-sim.ts` (every fight won, the perfect player never hit, the targets below met), `bun tools/fight-sim.ts traps` (as at milestone 3), `bun tools/boundaries.mjs`, then the bot runs below |
| Anything in `src/game/fightview` or `views/lab-fight.view.ts` | `bun tools/typecheck.mjs`, the bot runs, the key runs, and `--card` |
| `panel.ui.ts` | `--card`, and the card at 1280 by 720 and 1024 by 640 with each weapon and two boars: nothing covers the card or the bars, and every control is reachable |
| `rigs.ts` or the rigs in `draw.ts` | The traps runs, and look at `traps-*-rigs.png`, `-ghost.png` and `-helpless.png` at `--quality low`, `medium` and `high` |
| `looks.ts`, `figures.ts` or a fight sheet | `bun tools/fight-poses.mjs --port $PORT`, and look at every sheet in `.artifacts/fight/poses/` |
| `calm.ts`, `sparks.ts`, or the calm in `looks.ts` or `feel.ts` | `bun tools/fight-strip.mjs --port $PORT --beast <beast>` for the thistlehog, the boar and the gearling, once more with `--still`, and look at each strip in `.artifacts/fight/strips/` |
| `tools/fight-play.mjs` or `tools/fight-serve.mjs` | The run that uses it, and the build run below |
| `src/game/fight/hall*.ts`, `src/game/fightview/hall*.ts`, the `STAG` numbers, or the boss hooks in `fight.sim.ts` | `bun test src/game/fight`, `bun tools/fight-sim.ts stag --seeds 30` (all freed), `--weapon bow` and `--weapon staff` too, then the Stag runs below and a look at their pictures |
| `panel.ui.ts`, `hall.ui.ts`, or the hall's part of `draw.ts` or `ground.ts` | The Stag runs below, and once with `--size 1280x720` and `--size 1024x640` |
| Anything at all | `bun run check`, and `http://localhost:$PORT/` without the flag opens the game with no console error and no `window.__fight` |

The targets `fight-sim.ts` is tuned to, with the middle player, the sword and the leaftail: the thistlehog in 10 to 20 seconds, the gearling in 15 to 30, the boar in 60 to 120 losing a quarter to two thirds of the health. The clumsy player faints against the boar in one fight in ten to one in two and wins in under four minutes. No weapon and no companion is more than about a third faster or slower than the others against the boar. `fight.test.ts` checks each.

The bot runs, one line each, with the arguments written out (a loop over a quoted string passes it as one argument in zsh and plays the defaults). Every weapon against every beast:

```sh
bun tools/fight-play.mjs --port $PORT --weapon sword --beast thistlehog
bun tools/fight-play.mjs --port $PORT --weapon sword --beast gearling
bun tools/fight-play.mjs --port $PORT --weapon sword --beast boar
bun tools/fight-play.mjs --port $PORT --weapon bow --beast thistlehog
bun tools/fight-play.mjs --port $PORT --weapon bow --beast gearling
bun tools/fight-play.mjs --port $PORT --weapon bow --beast boar
bun tools/fight-play.mjs --port $PORT --weapon staff --beast thistlehog
bun tools/fight-play.mjs --port $PORT --weapon staff --beast gearling
bun tools/fight-play.mjs --port $PORT --weapon staff --beast boar
```

Each companion once against the boar, and one fight against two beasts:

```sh
bun tools/fight-play.mjs --port $PORT --weapon sword --companion pebblepup --beast boar
bun tools/fight-play.mjs --port $PORT --weapon sword --companion lanternfly --beast boar
bun tools/fight-play.mjs --port $PORT --weapon sword --companion mossling --beast boar
bun tools/fight-play.mjs --port $PORT --weapon bow --companion lanternfly --beast boar --also boar
```

The traps:

```sh
bun tools/fight-play.mjs --port $PORT --traps --beast thistlehog
bun tools/fight-play.mjs --port $PORT --traps --beast gearling
bun tools/fight-play.mjs --port $PORT --traps --beast boar
bun tools/fight-play.mjs --port $PORT --traps --beast boar --layout wall
bun tools/fight-play.mjs --port $PORT --traps --beast boar --keys
```

Real keys and mouse, each weapon against the thistlehog and the boar: the same with `--keys`. A key run walks up, dodges, presses 2 or 3 and back mid-fight, holds the button for the weapon's held move, presses C, fights the beast down and holds F.

The card itself, with real clicks and keys: the card after a fight says what happened and asks for no rating, it closes when the beast changes, "Fight it again" brings back the same weapon, companion and two beasts, the card folds when a beast wakes, a new weapon mid-fight is taken in hand, the Log button counts a fight that was left, the log has weapon and companion columns, the traps have their own button, and Esc puts a rig back before it pauses:

```sh
bun tools/fight-play.mjs --port $PORT --card
```

The Stag's hall, by its bot and with real keys and mouse, at each quality:

```sh
bun tools/fight-play.mjs --port $PORT --scene stag --quality low
bun tools/fight-play.mjs --port $PORT --scene stag --quality medium
bun tools/fight-play.mjs --port $PORT --scene stag
bun tools/fight-play.mjs --port $PORT --scene stag --keys --quality low
bun tools/fight-play.mjs --port $PORT --scene stag --keys --quality medium
bun tools/fight-play.mjs --port $PORT --scene stag --keys
```

Each checks the card in the hall (only what works there, folded while the Stag is awake, open once it is freed, the card after it saying freed), that no panel covers another or the minimap, and that each cut on a pin, a lamp, a pod and the collar landed on its strike frame with the freeze of a hit. It prints the hall's record (seconds in each phase, hits by attack, faints, the longest wait for an attack), then the draw calls, the triangles with the hall's own share and the script time, in all and in each phase, and the cost of each zoom step. A run where the bot cut no pod says so and skips that check.

A built copy, on a port of its own:

```sh
bun run build --outDir .artifacts/fight/site --emptyOutDir
bun tools/serve.mjs .artifacts/fight/site $PORT                  # prints its pid
bun tools/fight-play.mjs --url http://127.0.0.1:$PORT/ --weapon bow --beast gearling
kill <the pid it printed>
```

`tools/fight-serve.mjs` serves the same way and also answers `&log=1`, writing each fight to `.artifacts/fight/ratings.jsonl`. That file holds Kausthubh's own fights: only use `--log` when no copy is out for him.

## What proves it

- Each run ends with `no console errors`, exits 0, and prints the card after the fight, the record and the cost.
- Look at the pictures in `.artifacts/fight/<weapon>-<companion>-<beasts>-*.png` yourself: `tell` and `tell-<beast>-<attack>` (each attack's shape on the ground), `<weapon>-held` (the bow's line, the staff's ring, the sword's wind-up), `shot`, `staff-burst`, `slowed`, `enraged-<beast>`, `companion-strike`, `companion-guard`, `companion-brace`, `companion-healing`, `companion-strong`, `companion-bloom`, `dizzy`, `calming`, `colors-return`, `calm-bow` (the heart, the green, the gift) and `again` (the card after the fight). A run that passes with a picture that reads badly is not done.
- For the hall, `.artifacts/fight/stag-*.png` (`stag-keys-*`, `stag-low-*`, `stag-medium-*`, `-1024` for a smaller window): `zoom-0` to `zoom-4`, `chains-sweep`, `chains-stamp`, `chains-pin`, `strike-pin`, `strike-lamp`, `strike-pod` and `strike-collar`, `overgrowth-pods`, `overgrowth-lamps`, `collar-vines`, `collar-climb`, `collar-shake`, `collar-cut`, `freed`, `colors-return`, `head-lowered` and `again`. No pale ring shows outside the hall's wall.
- `--quality low`, `medium` and `high` each print draw calls and triangles as mean and most, and script time as mean and the worst 2 seconds, during the fight and through the calming. The budget is 150 draw calls, 400,000 triangles and 6 ms of script a frame. Never report a frame rate from this Mac.
- A pose sheet (`fight-poses.mjs`) holds every state of one fighter in three views: the hero's cuts, the bow's draw and release, the staff's raise, cast and burst, a strong hit and bloom; each companion's strike, brace, mending and lure; each beast's tells, its rage and its slow. Feet sit on the shadow, the strike frame shows at `cut t=.10`, the hero is there at `safe after a hit`, and nothing is squashed out of its drawing.
- A strip (`fight-strip.mjs`) is nine frames one after another: the hold, the release, then the moment by seconds. Grey runs out from the head down, then the bow and the heart, the green ring and flowers, the gift in flight with its name. The gearling has no ash, no heart and no green. `--still` shows the same story with nothing moving.

## Gotchas

- `fight-poses.mjs` and `fight-strip.mjs` drive the lab through `__fight.hold` and `__fight.slow`. They leave the rules running and the picture at full speed when they end, but a page they used is not a clean page for a fight. The hall's run holds the rules for a moment at each first strike, for its picture.
- `.artifacts/fight/ratings.jsonl` holds Kausthubh's own fights. When a served copy is out for him to play, run the build check without `--log` and never open a page with `log=1`.
- The lab keeps its own save (`greenhollow.save.fight`) and its own log in the browser. `fight-play.mjs` empties the log first.
- The game's meter gives script time as a mean over the last 2 seconds. `fight-play.mjs` leaves out the first 2.5 seconds of a fight, which still hold the page loading (the meter reads about 16 ms there), so its peak is the worst 2-second mean once settled.
- In the browser the rule-made player takes longer over the boar than in `fight-sim.ts`, up to about twice as long, so a boar run can take three minutes of game time. The tool waits 400 seconds.
- The Stag's hall at high quality, from the top of the vines at the furthest zoom step, draws up to about 399,000 triangles. The hall's own meshes are about 14,500 of them: the run prints both. The valley's share moves by a few hundred from run to run, so a peak near 400,000 there is the valley, not the hall.
- The hall's stamped blocks are part of its save (`greenhollow.save.stag`). It stamps itself again every time it opens, so a ramp left in the save never stands at the start.
