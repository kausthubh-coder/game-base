# Brief: the shell that turns the systems and the base features into one game

## Goal

Kausthubh wants to play the first part of the story at 6 am: `docs/play/act1.md`. Seven agents are writing
the game's systems in `src/game/<name>/` right now, against the contract in `src/game/api.sim.ts`. The base
features (world, camera, hero, perf, sky, weather, water, effects, post, audio, sprites, assets) are in
`src/features/`. You build the shell: the one program that starts all of it, draws it, steps it, saves it
and lets a test drive it. You are on the critical path, so get a walkable world on screen first and add
the rest in the order below.

Read first: `AGENTS.md`, `docs/play/act1.md` (all of it), `src/game/api.sim.ts`, `src/game/kernel.sim.ts`,
then the wiring references the feature authors left: `demos/world/main.ts` (world, camera, hero, perf),
`demos/sky/main.ts` (`step()` there shows how sky, weather, water, effects and post fit together),
`demos/audio/` and `src/features/audio/NOTES.md`, `demos/sprites/main.ts` and each system's `README.md`
under `src/game/` as they appear.

## What you own

- `index.html`, `src/main.ts`
- `src/game/boot.ts`, `src/game/systems.ts`, `src/game/shell/`
- `src/game/views/core-*.view.ts`
- `tools/play-*.mjs`, `.artifacts/play/`

Three more agents will add files to `src/game/views/` after you (the region, the crops and stations
drawing, the HUD and panels). They must never need to edit your files, so:

- Define `GameView` in `src/game/shell/view.ts`: the kernel and game, the `ViewContext`, the renderer,
  scene and DOM root, each base feature's handle (world, camera, sprites, sky, effects, post, audio,
  perf, assets), `onFrame(fn)`, `onSimStep(fn)`, a `project(x, y, z)` to screen pixels, `stats()` for the
  end card, and `settings`.
- `boot.ts` loads every `src/game/views/*.view.ts` with `import.meta.glob(..., { eager: true })`, sorted
  by file name, and calls each one's exported `install(view)`. A view that throws is logged and skipped,
  and the game still starts.
- `src/game/systems.ts` is the one list of system installs, in order. A system whose folder has no
  `index.sim.ts` yet is left out with a comment, and you add it when it lands.

## What to build, in this order

1. **A walkable world.** Renderer, scene, the world with its camera and cutaway, the sky and its lights,
   water, post-processing, the perf meter on F3, automatic quality. The hero's body is `HeroBody` from the
   hero feature. Draw the player with the `hero` sprite through the sprites feature, facing the way it
   walks. 20 simulation steps a second through `kernel.step()`, drawing in between.
2. **The player's hands.** WASD moves relative to the camera. Shift walks softly at 2.0 blocks a second.
   Space jumps. Q and R turn the camera a quarter turn (E is taken). The wheel zooms. Number keys and
   Shift+wheel pick a quick slot. E runs `game.systems.interact.act()`. The left button held calls
   `actions.hold` on the block under the pointer, a click calls `actions.use` with `primary`, the right
   button with `secondary`. Find the block with the world's ray cast from the camera through the pointer,
   passing `camera.hides` so hidden roofs do not catch clicks. Nothing acts while `game.player.busy`.
   Write `game.player` every step and send `footstep`, `jump` and `land` into `game.events`.
   Put all key reading in `src/game/shell/keys.ts` behind one small interface, because the base's input
   feature will replace it later.
3. **Actors.** Copy `game.actors` to sprite handles every frame: add, move, face, animate, hide, remove.
   A mark (`quest`, `talk`, `heart`, `alert`, `sleep`) floats over the actor as a small DOM element placed
   with `project`.
4. **Sound and effects from events.** One file maps `game.events` to the sound engine (`onEvent`,
   `followAmbient`, a stinger on `quest.step`, a voice blip per letter is the dialogue view's job) and to
   the effects feature (dust on footsteps, chips on `block.broken`, a pop on `block.placed`, a sparkle on
   `crop.grew`, a trail on `item.gained`). The music is the `meadow` palette. Sound starts on the first
   click or key.
5. **Saving.** `kernel.save()` plus `world.save()` into `localStorage` under one key, inside try and catch.
   Save on `slept`, on `quest.step`, and every 60 seconds. `hasSave()`, `continueGame()` and `newGame()`
   are on `GameView` for the title screen.
6. **The debug door**, `window.__game`, exactly as the table in `act1.md` lists it. `advance(seconds)`
   steps the kernel and the hero body without drawing, so a test can play fast on this slow machine.
7. **A smoke test**, `tools/play-smoke.mjs`: build the game (`bun run build`), serve `dist` on port 5330
   (stop it by its pid), open it in headless Chrome the way `tools/shot.mjs` does, start a new game
   through the door, advance, walk, break a block, place it back, and fail on any console error. Save
   screenshots to `.artifacts/play/`: the start, after a camera turn, night.

Until the region system lands, start the player at the world feature's `spawnPoint()`.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs --paths src/main.ts src/game` passes, or fails only inside another agent's
   folder that is still being written. Name each such folder.
2. `bun run build` works, and `bun tools/play-smoke.mjs` passes with no console errors.
3. You looked at the three screenshots: the world, the hero sprite and the sky are there.
4. `window.__game.state()` shows the clock moving and the player where `teleport` put them.
5. A new view file dropped into `src/game/views/` with an `install` that logs once runs, with no edit to
   your files. Prove it and remove the file.

## Limits

- Work only in `/Users/dabot/dev/sandbox/game-base-play`. Never touch `/Users/dabot/dev/sandbox/game-base`.
- Write only in the paths you own. Do not commit, and do not run `bun install` or `bun add`.
- `src/features/sprites` and `src/features/assets` are provisional copies of a feature another agent is
  finishing. Their API may shift slightly: keep your use of them in one file.
- Stop any server by the pid it printed. Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`.
- This Mac draws WebGL in software at a few frames a second. Never report a frame rate.
- Do the work yourself. Start no subagents. When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the list of systems installed and left
out, every default you picked, and what the next three agents need to know to add their views.
