# Brief: sky, weather, water, effects and the final picture

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera. He asked for a solid base of general systems that need no
story, in his words including "weather and other systems, graphics" and good performance on the web.

You build everything above and around the world: the sky and its light, the weather, water, particles and
the post-processing that makes the final picture. He liked how the earlier test scene looked ("it was
sick") but it ran at 40 to 50 frames a second on his laptop. Keep the look and make it cheaper.

Read first: `AGENTS.md` in this repo (the rules and the commands), `src/engine/` (the contract), and in
`~/dev/sandbox/game-look-test/design/` the chapters `08-weather.md` (all of it) and `12-art.md` (sections
"Light", "Water" and "Effects").

Code you may borrow from: `~/dev/sandbox/game-25d-test/src/` (`env.js` for sky and weather, `particles.js`,
`post.js`, `materials.js` for water). It is plain JavaScript from a side-view scene. Port what looks good
into typed features, and cut what costs too much. Its screenshots are in `~/dev/sandbox/game-25d-test/shots/`.

## What you own

- `src/features/sky/`, `src/features/weather/`, `src/features/water/`, `src/features/effects/`, `src/features/post/`
- `src/content/weather.ts`, `src/content/effects.ts`
- `demos/sky/`
- `tools/sky-*.mjs` if you need a script
- `.artifacts/sky/` for screenshots

## What to build

1. **Weather as rules** (`src/features/weather/*.sim.ts`, no Three.js). A clock where a day is 20 minutes,
   and a moon with 8 phases. A weather machine that picks from a table in `src/content/weather.ts`: clear,
   breezy, overcast, rain, storm, fog, and one rare gentle event of glowing motes at dusk. Weather arrives
   as a front: wind first, then cloud, then rain, over about a minute. Each step it writes the shared
   `Ambient` numbers (`src/engine/types.ts`), including wetness that rises in rain and dries after, and the
   lightning flash. It emits a `thunder` event, later the farther away the strike. A seed makes it repeat.
2. **Sky and light** (`src/features/sky/`). This feature owns the scene's lights. A sky drawn by a shader:
   color by hour, a sun, a moon with its phase, stars, two layers of clouds that thicken with
   `ambient.cloud`. One sun light with one shadow that follows a target you are given
   (`sky.setShadowTarget(position)`), an ambient light, and fog, all driven by `ctx.ambient`. Night is dark
   blue, never black. Expose the sun direction and the current sky colors, because water and terrain will
   want them.
3. **Water** (`src/features/water/`). One material for ponds, rivers and the sea, exported as
   `createWaterMaterial(ctx)` so the world feature can put it on its water mesh. Deeper is darker, foam
   where water meets land, moving ripples, rings where rain lands, a hint of sky color. Your demo puts it
   on a flat pond.
4. **Effects** (`src/features/effects/`). One pooled particle system that plays an entry from
   `src/content/effects.ts`: shape, count, life, speed, gravity, color over life, size, blend. It draws
   every effect in at most three draw calls and never holds more than 2,000 particles. `effects.play(id,
   position, options)` starts one. `effects.onEvent(event)` answers a `GameEvent`: dust or splash by surface
   on a footstep, chips in the block's color when a block breaks, a pop when one is placed, a trail on a
   pickup. Weather uses it too: rain streaks with splashes only where `ctx.world.openSky` is true, falling
   leaves, wind lines, fireflies at night, the glowing motes.
5. **Lightning, fog and a rainbow.** A bolt and a flash in a storm. Fog that thickens with distance. A
   rainbow sometimes after rain. Light shafts at dawn at `high` quality only.
6. **The final picture** (`src/features/post/`). `createPost(ctx)` with `render()`: bloom for glowing
   things, a soft blur far from the focus point for the miniature look, tone mapping, and a render size
   that can drop below full. Everything has an off switch and a cost. `low` quality is no post at all at
   three-quarter size, and must still look good.
7. **The demo** (`demos/sky/`). A small scene of your own: a flat grass ground from `flatWorld`, a few
   simple trees and boxes to catch shadows, and a pond. Sliders for time of day and for each `Ambient`
   number, buttons for each kind of weather and for letting the weather machine run at 20 times speed,
   buttons that fire each effect, and the three quality levels. Show draw calls and triangles on screen.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs sky` passes, and the same for `weather`, `water`, `effects` and `post`.
   `bun run boundaries` passes.
2. `bun test src/features/weather src/features/effects` passes, with tests for: the clock and moon, a
   front arriving in the right order, wetness rising and drying, the same seed giving the same weather for
   an hour of game time, thunder delayed by distance, and the particle pool never passing 2,000.
3. `bun tools/demo.mjs build sky` works, and the built page loads with no console errors
   (`bun tools/serve.mjs dist/demos/sky 5313`, then `bun tools/shot.mjs`).
4. Screenshots you looked at, in `.artifacts/sky/`: dawn, noon, sunset, night with the moon, overcast,
   rain, storm with a bolt, fog, the motes at dusk, the pond close up, each effect, and the same noon view
   at `low`, `medium` and `high`.
5. With everything on at `high`, your features add 12 draw calls or fewer and 60,000 triangles or fewer
   to the demo scene. State both numbers, measured with the features off and on.
6. After five simulated minutes of storm, the count of live particles, geometries and textures is flat.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`. Three.js is the only library.
- Your port is 5313. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the output of the checks, the numbers from lines 5 and 6,
the defaults you picked, anything in `src/engine` you found missing, and what you could not check,
starting with what is most likely to be slow or look wrong on a real laptop.
