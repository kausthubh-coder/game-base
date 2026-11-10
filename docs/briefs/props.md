# Brief: props, trees and buildings made in code, and the skill for making more

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera. He cannot model, so agents write every 3D shape as
Three.js code. He asked for a solid base of general systems, in his words including "assets, 3D models"
that "all fit a theme" with variation, and for "a skill for creating 3D assets".

You build the library of props that dresses the world, the system that draws thousands of them cheaply,
buildings stored as data, and the skill another agent will follow to add a prop later.

Read first: `AGENTS.md` (the rules and the commands), `src/engine/` (the contract), `docs/style-sheet.md`,
`src/content/blocks.ts` (the block kinds, written by another agent), and in
`~/dev/sandbox/game-look-test/design/` the chapter `12-art.md` (section "The 3D world"). The older
side-view scene has trees, foliage, a house and props in `~/dev/sandbox/game-25d-test/src/` (`foliage.js`,
`house.js`, `props.js`, `geo.js`). Its screenshots are in `~/dev/sandbox/game-25d-test/shots/`. Port what
looks good, and make it cheaper.

## What you own

- `src/features/props/`, `src/features/buildings/`
- `src/content/props.ts`, `src/content/blueprints.ts`
- `demos/props/`
- `.agents/skills/make-3d-asset/`
- `tools/props-*.mjs` if you need a script
- `.artifacts/props/` for screenshots

## What to build

1. **Props as data plus a builder.** Each kind in `src/content/props.ts` has a name, its builder, its
   variants, its triangle budget, whether wind moves it, and whether it gives light. A builder returns one
   merged geometry with vertex colors from the style sheet's palette. No texture files.
2. **The first set.** Trees: oak, birch and pine, three shapes each. Small plants: three grass tufts, tall
   grass, flowers in six colors, reeds, a lily pad, three mushrooms, three bushes, a berry bush. Ground:
   four rocks, a fallen log, a stump. Town: a door, a window that glows at night, a chimney, a sign, an
   awning, a market stall, a well, a fence, a gate, a lamp post, a bench. Clutter: a barrel, a crate, a
   cart, a sack. Stations: a workbench, a forge, a kitchen stove, a chest, a bed.
3. **Thousands for almost nothing.** `createProps(ctx)` returns a `ViewSystem` with `place(kind, variant,
   position, rotation, scale)` and `remove(handle)`. Every copy of one kind and variant is one instanced
   draw call. Props are grouped in cells of 32 by 32 blocks, and cells outside the view are not drawn.
   Each placed prop gets a small random turn, size and tint. A forest of 2,000 props must cost 40 draw
   calls or fewer.
4. **Wind.** Leaves and grass sway in the vertex shader, driven by `ctx.ambient.wind` and `windDir`, each
   on its own timing. Trunks do not move.
5. **Light.** A window and a lamp post glow when `ctx.ambient.timeOfDay` says it is dark. The system
   lists the positions of lit props, so the world can light the blocks around them later.
6. **Scatter as rules** (`*.sim.ts`, no Three.js). Given a seed, a `WorldQuery` and a density setting, it
   returns where trees, plants and rocks go: trees on grass, reeds beside water, nothing on paths. The same
   seed gives the same result. It also lists the tree tops, which the weather uses for falling leaves.
7. **Buildings as data** (`src/features/buildings/`). A blueprint is a list of blocks and props relative
   to one corner. `stamp(blueprint, position, quarterTurns, target)` writes the blocks through a
   `setBlock(x, y, z, blockId)` function it is given, and places the props. Write three: a cottage, a shop
   and a barn, each with a door you can walk through, a real inside and a roof.
8. **The skill** (`.agents/skills/make-3d-asset/SKILL.md`). Load the `writing-for-agents` skill before you
   write it. It tells an agent how to add one prop: where the entry goes, the style rules, the triangle
   budget, how to preview it, and the check that must pass. Add `preview.html` logic to your demo so
   `demos/props/?only=<kind>` shows one prop alone on a turntable with its triangle count.
9. **The demo** (`demos/props/`). A gentle ground you make yourself, with a meadow, a forest edge, a pond
   rim with reeds, and a small village of the three buildings and town props. Sliders for wind and time of
   day, a simple camera with Q and E quarter turns and a zoom, and draw calls and triangles on screen.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs props` and `bun tools/typecheck.mjs buildings` pass. `bun run boundaries` passes.
2. `bun test src/features/props src/features/buildings` passes, with tests for: every prop inside its
   triangle budget, the same seed scattering the same way, no tree on a path or in water, and a stamped
   blueprint turned four ways landing its door where expected.
3. `bun tools/demo.mjs build props` works, and the built page loads with no console errors
   (`bun tools/serve.mjs dist/demos/props 5315`, then `bun tools/shot.mjs`).
4. Screenshots you looked at, in `.artifacts/props/`: the village by day and at night with windows lit,
   the forest edge, the pond rim, a contact sheet with every prop and variant labeled, and one prop on the
   turntable.
5. A forest of 2,000 props reports 40 draw calls or fewer. The whole demo scene stays under 250,000
   triangles in view. State both numbers.
6. The contact sheet looks like one game. Say what stands out if it does not.
7. A fresh read of `SKILL.md` alone is enough to add a prop. Prove it by following it yourself to add one
   more prop, a signpost, and say whether any step was missing.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`. Three.js is the only library.
- Your port is 5315. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the numbers from line 5, your defaults,
anything in `src/engine` you found missing, and what you could not check, starting with what is most
likely to be slow or look wrong on a real laptop.
