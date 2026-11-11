# Fight lab

A test scene where three ways of fighting are played against the same three beasts: the hero fights, the pet fights, or rigs on the ground do. It is behind `?scene=fight` and changes nothing in the game without it.

## Sub-features

- `ways`: the card picks `hero`, `pet` or `world`, and the beast: thistlehog, gearling or boar.
- `fight`: shapes on the ground before each attack, a guard that empties, hold F to calm a dizzy beast, fainting and waking.
- `feel`: the freeze of a hit, the shake (with its switch on the card), the warm edge at low health, the push on a small beast.
- `again`: after a win the lab asks "Again?" and keeps the answer with the fight's numbers. With `&log=1` and `tools/fight-serve.mjs` the answers land in `.artifacts/fight/ratings.jsonl`.

## How to get to it (user POV)

Open the game with `?scene=fight`. Add `&way=pet&beast=boar` to start in a way with a beast. The card on the left does the rest.

## What to run after a change

Preconditions: `bun tools/doctor.mjs` is clean, its `export PORT=… PLAY_PORT=…` line is run, and `bun run dev` is up on that port. Stop the dev server by its pid when done. Change no source file while a browser run plays: the dev server reloads the page and the run fails.

| You changed | Run |
|---|---|
| `src/game/content/fight.ts` or `src/game/fight/*.sim.ts` | `bun test src/game/fight`, `bun tools/fight-sim.ts` (all nine fights won with no browser), `bun tools/boundaries.mjs`, then the nine bot runs below |
| Anything in `src/game/fightview` or `views/lab-fight.view.ts` | `bun tools/typecheck.mjs`, the nine bot runs, and the three `--keys` runs against the thistlehog |
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
- Look at the pictures in `.artifacts/fight/<way>-<beast>-*.png` yourself: `tell` (the shape on the ground), `dizzy`, `calming` (the teal ring closing), `colors-return` and `again`. A run that passes with a picture that reads badly is not done.
- `--quality low`, `medium` and `high` each print draw calls, triangles and script time. The budget is 150 draw calls, 400,000 triangles and 6 ms of script a frame. Never report a frame rate from this Mac.

## Gotchas

- The lab keeps its own save (`greenhollow.save.fight`) and its own log in the browser. `fight-play.mjs` empties the log first.
- The game's meter gives script time as a mean over the last 2 seconds. `fight-play.mjs` leaves out the first 2.5 seconds of a fight, which still hold the page loading (the meter reads about 16 ms there), so its peak is the worst 2-second mean once settled. A peak over 6 ms from an older copy of the tool is the load, not the lab.
- A fight played twice in one page counts toward "different layouts that beat the boar". Each run of the tool empties the log, so one run never shows it: the rigs run and the `--layout wall` run are the two layouts.
