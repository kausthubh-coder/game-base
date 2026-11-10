# Brief: the block world, the camera and the performance meter

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera. He asked for a solid base of general systems to start
building the game on, in his words: "a first solid base which doesn't need specifics", where "the world
works", with good graphics and good performance on the web.

You build the heart of that base: a block world the player can walk in and change, the camera that shows
it, and the meter that proves it is fast. He measured 40 to 50 frames a second on his laptop in an older,
heavier test scene. This base has to do better, so speed is part of done.

Read first: `AGENTS.md` in this repo (the rules and the commands), `src/engine/` (the contract), and in
`~/dev/sandbox/game-look-test/design/` the chapters `15-system-design.md` (sections "How the world is
stored" and "Making it fast") and `12-art.md` (sections "The 3D world" and "Camera").

Code you may borrow from: `~/dev/sandbox/game-25d-test/src/` (an earlier side-view scene in plain
JavaScript: `geo.js`, `materials.js`, `env.js`). Port ideas, not files. That scene was placed by hand and
is too heavy.

## What you own

- `src/content/blocks.ts`
- `src/features/world/`, `src/features/camera/`, `src/features/hero/`, `src/features/perf/`
- `demos/world/`
- `tools/world-*.mjs` if you need a script
- `.artifacts/world/` for screenshots

## What to build

1. **Blocks as data** (`src/content/blocks.ts`). About 22 kinds: grass, dirt, tilled soil, path, sand, clay,
   stone, mossy stone, cobble, stone brick, oak log, oak plank, birch log, pine log, thatch, shingle,
   plaster, glass, oak leaves, pine needles, water, lume crystal, lamp. Each has an id, a name, whether it
   is solid and opaque, its `Surface`, the light it gives off, and tile names for top, side and bottom.
2. **Textures.** Until painted textures arrive, draw each 32 by 32 tile in code onto one atlas canvas, with
   three variants for natural blocks picked by position. When `public/assets/manifest.json` has a `blocks`
   entry (see `docs/assets.md`), load that atlas in place of the drawn one. Nearest filtering, with a
   mipmap plan that does not bleed between tiles.
3. **The world as rules** (`*.sim.ts`, no Three.js). Chunks 16 by 16 wide and 64 high. Terrain from a seed:
   meadow, low hills, a river and a pond, forest areas, a few caves. The same seed gives the same land.
   Get and set a block, a ray cast for placing and breaking, a height cache, sky light and block light from
   0 to 15 that update around a change, and an implementation of `WorldQuery`. A save is the seed plus the
   changed blocks, and it loads back exactly.
4. **Meshing in a worker.** Build one mesh per chunk off the main thread. Skip hidden faces, merge flat
   faces where it pays, shade corners where blocks meet, bake light into vertex colors. Water is its own
   see-through mesh. A changed block remeshes its chunk and the neighbors it touches, within a budget of
   4 ms of main-thread time per frame. Load chunks around the player by quality level and drop far ones.
5. **Drawing.** One material for all solid terrain. It reads the scene's lights, takes fog, and darkens
   open ground by `ctx.ambient.wetness`. Chunks outside the view are not drawn. Your demo sets up one sun
   light with a shadow and a sky color itself: another feature will own the real sky and lights later, so
   keep lights out of the world feature.
6. **The camera** (`src/features/camera/`). A long lens looking down at about 35 degrees. It follows a
   target smoothly. Q and E turn it a quarter turn in about 0.3 seconds. The wheel picks one of three zoom
   steps. **Cutaway:** when a roof, wall or hill hides the target, the player must still see it. Indoors,
   hide what is above the target's head. Underground, hide everything above the target's layer in a
   circle around it with a soft edge. Blocks between the camera and the target fade. Expose the camera's
   quarter-turn index and yaw, because sprites will need them.
7. **The hero as rules** (`src/features/hero/`). A body that walks with WASD relative to the camera, jumps,
   swims and collides with blocks. It emits `footstep`, `jump` and `land` events from
   `src/engine/events.ts`, with the surface underfoot. Draw it as a plain placeholder: the sprite system
   replaces it later.
8. **The meter** (`src/features/perf/`). An overlay with frames per second (average and worst 1 percent),
   frame time, simulation time, draw calls, triangles, loaded chunks, the meshing queue and memory where
   the browser gives it. A button copies a text report. Three quality levels, and an automatic mode that
   lowers the render size first and effects second when the frame rate stays under 50, and raises them
   again when it holds above 58. `?stress=N` in the address multiplies the view distance.
9. **The demo** (`demos/world/`). Walk, turn the camera, zoom, break a block with the left button, place
   one with the right, pick the block with the number keys. It starts next to a small house you can walk
   into and a cave mouth, so the cutaway shows at once. A slider sets the time of day. Buttons save and
   load. The meter is on.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs world`, and the same for `camera`, `hero` and `perf`, pass. `bun run boundaries` passes.
2. `bun test src/features/world src/features/hero src/features/camera` passes, with tests for: get and
   set, the ray cast, the height cache, light after placing and removing a lamp, a save that loads back
   exactly, the same seed giving the same land, face counts for a single block and for two touching
   blocks, and the hero stopping at a wall and landing on a floor.
3. `bun tools/demo.mjs build world` works, and the built page loads with no console errors
   (`bun tools/serve.mjs dist/demos/world 5311`, then `bun tools/shot.mjs`).
4. Screenshots you looked at, in `.artifacts/world/`: the start view, each of the four camera turns, the
   hero inside the house with the roof cut away, the hero in the cave, night with a lamp lit, and a view
   after breaking and placing blocks.
5. At the default view distance the meter reports 150 draw calls or fewer and 400,000 triangles or fewer.
   State both numbers.
6. Placing 50 blocks in a row never takes more than 4 ms of main-thread meshing in one frame. Measure it
   in the page and state the worst frame.
7. After five minutes of walking in a straight line (drive it from a script), the count of loaded chunks
   and of live geometries is flat.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`.
- Your port is 5311. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the output of the checks, the numbers from lines 5, 6 and
7, the defaults you picked, anything in `src/engine` you found missing, and what you could not check,
starting with what is most likely to be slow or wrong on a real laptop.
