# Fight lab

A test scene where three ways of fighting are played against the same three beasts: the hero fights, the pet fights, or rigs on the ground do. It is behind `?scene=fight` and changes nothing in the game without it.

## Sub-features

- `ways`: the card picks `hero`, `pet` or `world`, and the beast: thistlehog, gearling or boar.
- `fight`: shapes on the ground before each attack, a guard that empties, hold F to calm a dizzy beast, fainting and waking.
- `feel`: the freeze of a hit, the shake (with its switch on the card), the warm edge at low health, the push on a small beast.
- `poses`: which frame of the real art each fighter shows in each state, timed to the rules (`fightview/looks.ts`).
- `calming`: the moment a beast is calmed or a machine shut down, from the hold to the gift (`fightview/calm.ts`).
- `pets`: the leaftail and the pebblepup, picked on the card. The pebblepup's brace takes an attack for the hero.
- `rigs`: the world way's lamp, snare vine, spring plate and water channel, drawn with the game's rig props (`fightview/rigs.ts`), with the lab's rings so they read on grass.
- `card`: the card folds when a beast wakes and opens when the fight ends, Esc puts back a rig in the hand before it pauses, and the bars move right of the card on a narrow window.
- `again`: after a win the lab asks "Again?" and keeps the answer with the fight's numbers. The card is about one fight and closes when the beast, way or pet changes. With `&log=1` and `tools/fight-serve.mjs` the answers land in `.artifacts/fight/ratings.jsonl`.

## How to get to it (user POV)

Open the game with `?scene=fight`. Add `&way=pet&beast=boar` to start in a way with a beast. The card on the left does the rest.

## What to run after a change

Preconditions: `bun tools/doctor.mjs` is clean, its `export PORT=… PLAY_PORT=…` line is run, and `bun run dev` is up on that port. Stop the dev server by its pid when done. Change no source file while a browser run plays: the dev server reloads the page and the run fails.

| You changed | Run |
|---|---|
| `src/game/content/fight.ts` or `src/game/fight/*.sim.ts` | `bun test src/game/fight`, `bun tools/fight-sim.ts` (all nine fights won with no browser), `bun tools/boundaries.mjs`, then the nine bot runs below |
| Anything in `src/game/fightview` or `views/lab-fight.view.ts` | `bun tools/typecheck.mjs`, the nine bot runs, the three `--keys` runs against the thistlehog, and `--card` |
| `panel.ui.ts` | `--card`, and the card at 1280 by 720 and 1024 by 640 with each way and the boar: nothing covers the card or the bars, and every control is reachable |
| `rigs.ts` or the rigs in `draw.ts` | The world bot runs and the world `--keys` runs, and look at `world-*-rigs.png`, `-ghost.png` and `-helpless.png` at `--quality low`, `medium` and `high` |
| `looks.ts`, `figures.ts` or a fight sheet | `bun tools/fight-poses.mjs --port $PORT`, and look at every sheet in `.artifacts/fight/poses/` |
| `calm.ts`, `sparks.ts`, or the calm in `looks.ts` or `feel.ts` | `bun tools/fight-strip.mjs --port $PORT --beast <beast>` for the thistlehog, the boar and the gearling, once more with `--still`, and look at each strip in `.artifacts/fight/strips/` |
| `tools/fight-play.mjs` or `tools/fight-serve.mjs` | The run that uses it, and the build run below |
| Anything at all | `bun run check`, and `http://localhost:$PORT/` without the flag opens the game with no console error and no `window.__fight` |

The bot runs, one line each, with the arguments written out (a loop over a quoted string passes it as one argument in zsh and plays the defaults):

```sh
bun tools/fight-play.mjs --port $PORT --way hero --beast thistlehog
bun tools/fight-play.mjs --port $PORT --way hero --beast gearling
bun tools/fight-play.mjs --port $PORT --way hero --beast boar
bun tools/fight-play.mjs --port $PORT --way pet --beast thistlehog
bun tools/fight-play.mjs --port $PORT --way pet --beast gearling
bun tools/fight-play.mjs --port $PORT --way pet --beast boar
bun tools/fight-play.mjs --port $PORT --way world --beast thistlehog
bun tools/fight-play.mjs --port $PORT --way world --beast gearling
bun tools/fight-play.mjs --port $PORT --way world --beast boar
bun tools/fight-play.mjs --port $PORT --way world --beast boar --layout wall
```

Real keys and mouse: the same with `--keys`, for each way against the thistlehog and the boar.

The card itself, with real clicks and keys: "Again?" closes when the beast changes and replays the fight it names, the card folds when a beast wakes, the Log button counts a fight that was left, and Esc puts a rig back before it pauses:

```sh
bun tools/fight-play.mjs --port $PORT --card
```

The second pet, by the bot against all three beasts and by keys against the thistlehog and the boar. Its key run braces into the beast's next attack and checks the brace took it:

```sh
bun tools/fight-play.mjs --port $PORT --way pet --beast thistlehog --pet pebblepup
bun tools/fight-play.mjs --port $PORT --way pet --beast boar --pet pebblepup --keys
```

A built copy with the log on:

```sh
bun run build --outDir .artifacts/fight/site --emptyOutDir
bun tools/fight-serve.mjs .artifacts/fight/site $PORT        # prints its pid
bun tools/fight-play.mjs --url http://127.0.0.1:$PORT/ --way hero --beast thistlehog --log
tail -1 .artifacts/fight/ratings.jsonl                       # the fight, with "again": 4
kill <the pid it printed>
```

## What proves it

- Each run ends with `no console errors`, exits 0, and prints note 08's checks for its way with their numbers. The bot never gets hit, so its numbers are a floor for a person's.
- Look at the pictures in `.artifacts/fight/<way>-<beast>-*.png` yourself: `tell` (the shape on the ground), `dizzy`, `calming` (the thread and the ring closing), `colors-return` (the line of color part way down), `bow` (the heart, the green, the gift) and `again`. A run that passes with a picture that reads badly is not done.
- `--quality low`, `medium` and `high` each print draw calls, triangles and script time, during the fight and through the calming. The budget is 150 draw calls, 400,000 triangles and 6 ms of script a frame. Never report a frame rate from this Mac.
- A pose sheet (`fight-poses.mjs`) holds every state of one fighter in three views. Feet sit on the shadow, the strike frame shows at `cut t=.10`, the hero is there at `safe after a hit`, and nothing is squashed out of its drawing.
- A strip (`fight-strip.mjs`) is nine frames in order: the hold, the release, then the moment by seconds. Grey runs out from the head down, then the bow and the heart, the green ring and flowers, the gift in flight with its name. The gearling has no ash, no heart and no green. `--still` shows the same story with nothing moving.

## Gotchas

- `fight-poses.mjs` and `fight-strip.mjs` drive the lab through `__fight.hold` and `__fight.slow`. They leave the rules running and the picture at full speed when they end, but a page they used is not a clean page for a fight.

- `.artifacts/fight/ratings.jsonl` also holds Kausthubh's own answers. When a served copy is out for him to play, run the build check without `--log` and never open a page with `log=1`.
- The lab keeps its own save (`greenhollow.save.fight`) and its own log in the browser. `fight-play.mjs` empties the log first.
- The game's meter gives script time as a mean over the last 2 seconds. `fight-play.mjs` leaves out the first 2.5 seconds of a fight, which still hold the page loading (the meter reads about 16 ms there), so its peak is the worst 2-second mean once settled. A peak over 6 ms from an older copy of the tool is the load, not the lab.
- A fight played twice in one page counts toward "different layouts that beat the boar". Each run of the tool empties the log, so one run never shows it: the rigs run and the `--layout wall` run are the two layouts.
