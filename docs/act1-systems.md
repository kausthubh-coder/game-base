# Act 1's systems: how every system builder works

Act 1 is being built by one Opus builder per system, at the same time, on the base `act1` holds. This page is
what each of them shares; each brief adds only its own scope. Kausthubh, 2026-11-12: "Implement the whole act 1
... build everything out, improve and polish everything ... I want this to be grand scale, a real kingdom feel."

## Read first

1. `AGENTS.md` and the skills it names for your work (`make-feature`, `test-game`, `verify-game`, `make-ui` for
   anything on screen, `playtest-game` to play it).
2. `docs/act1.md` (the plan), `docs/act1-foundation.md` (the ids, flags, events, systems and api sections you
   build on, and **who owns which files**), and your own section of `docs/act1-gaps.md` (what exists, what is
   missing, the seams with the other systems, the old-story leftovers you remove).
3. The design, which is the source of truth for what the player sees: the handbook in
   `~/dev/sandbox/game-look-test/design/` (chapters 20 to 30; chapter 22 is the script, rewritten this week) and
   its data in `~/dev/sandbox/game-look-test/playthrough/` (`content.js` quests, people and fights; `farms.js`
   building; `film.js` the opening). Read them; do not edit them.
4. The art that exists: sprites, portraits and icons are final for most of the cast and creatures; the props in
   `src/content/props.ts` include the landmarks, Hollowmere's kits, the machine parts and the settlement; the
   approved concept sheets in `assets-src/concept/` show anything not built yet. Use what exists; where something
   is missing, use a clear stand-in and list it in your report.

## How to work

- Branch `act1-sys-<your system>`: `git checkout -b act1-sys-<name> && git merge --ff-only act1` in your fresh
  worktree of `~/dev/sandbox/game-base`, then `bun tools/doctor.mjs` and use the port it prints.
- Write only the files `docs/act1-foundation.md` gives your system. Rules go in `.sim.ts` (`bun run boundaries`),
  drawing in `.view.ts`, panels in `.ui.ts`. Talk to other systems only through the api sections, events and
  flags of the foundation. If you need an id, item, flag or event that does not exist, add it in the one list it
  belongs to (`src/game/content/ids.ts`, `flags.ts`, `items.ts`, `api.sim.ts`) in as few lines as you can, and
  name each in your report: the coordinator settles clashes at the merge.
- Fill the quest steps your system finishes: a step whose flag your system sets must be set by playing, not only
  by `skipTo`. Keep `bun tools/sim.ts scenarios act1` passing.
- Speed is part of done (`AGENTS.md` rule 6): every view reads its numbers from `src/content/quality.ts`.
- **Look as you go.** After each change a player can see, shoot it and open the picture: `bun tools/slot.mjs --look --
  <command>` (two at once, 5 minutes a job, first come first served). Pictures never go in one job with a check.
- **Heavy work waits its turn.** `bun run check` and `bun run verify` queue for one of three machine-wide slots
  by themselves (`tools/slot.mjs`). Run every other heavy command the same way: `bun tools/slot.mjs -- <command>`
  for `shots.mjs`, `look-beside.mjs`, `painted-shots.mjs`, `props-beside.mjs`, a bench, a long `bun test`. Close
  `play.mjs` with `bun tools/play.mjs stop` when you finish. On 2026-11-12 twenty heavy runs and orphaned Chromes
  held the Mac mini at load 215 and every test timed out.
- The machine is shared with up to eight builders. Run the full check when you finish a slice, not after every
  edit; if a test times out, rerun it alone before calling it a failure.

## Done

1. `bun run check`, `bun run lint`, `bun run boundaries` and `bun tools/verify-assets.mjs` pass.
2. `bun tools/sim.ts scenarios` passes, with new scenarios that play your system's part of the act.
3. You have played your part in the real game in a browser (`bun tools/play.mjs`, the `playtest-game` skill),
   from a new game or with `?at=<place>` and the debug door, and looked at the pictures; they are in
   `.artifacts/<your system>/`.
3b. **The look gate.** Every place, room or scene you built or changed, shot from the game's own camera, beside
   its approved concept sheet in `assets-src/concept/` (`bun tools/look-beside.mjs <moment>` once it exists; until
   then one picture made by hand beside the sheet). If a person would call the game's picture clearly worse than
   the sheet (a different layout, empty where the sheet is busy, flat or dark where it is warm, a box where it has a
   shape, a stand-in where it has a model), it is not done: fix it or name the gap and its owner in your report.
   Kausthubh caught three such gaps by eye on 2026-11-12 that every check had passed.
4. `bun run verify` passes.

## Report

PASS, ISSUES or BLOCKED. Your last commit's SHA. What a player can now do, step by step. Every id, item, flag or
event you added outside your files. Each check with its command and result. The picture paths. The stand-ins
you used, and what is left.

Commit as you go. Never push, never merge or push `main` or `playtest`. Stop only processes you started, by pid.
