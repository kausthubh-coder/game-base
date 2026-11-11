# perf

What the game needs around Three.js to be fast on a weak machine and to say what it costs. Three.js draws.
This feature measures, warms the shaders, picks the quality level and flies the fixed flight.

| File | What it does |
|---|---|
| `perf.view.ts` | The meter (F3, Settings > Debug, or `?perf=1`): frame rate, draw calls, triangles, the level buttons, the copy button. It owns the three parts below. |
| `governor.sim.ts` | Automatic quality: gives up render size, then effects, when the frame rate drops. Its steps are `QUALITY_LADDER` in `src/content/quality.ts`. |
| `cost.view.ts` | Draw calls and triangles by feature, and shader programs compiled in the middle of a draw |
| `warm.view.ts` | Shader warm-up: compiles programs before the things that wear them are seen |
| `flight.sim.ts` | The fixed flight's path and log. `src/game/views/lab-bench.view.ts` flies it. |
| `stats.sim.ts` | Frame-time arithmetic |

The quality levels themselves are data: `src/content/quality.ts` is the one table every view system reads.

## Reading it through the debug door

| Call | Gives |
|---|---|
| `window.__game.counters()` | The frame's totals: draw calls, triangles, shader programs, the level |
| `window.__game.costs()` | The same frame by feature. `features` has a row each for land, grass, trees, town and so on, with the part spent on shadows. `sum` adds the rows up, `total` is the renderer's count, `addsUp` says they are equal. |
| `window.__game.programs()` | Shader programs held, how many were compiled in the middle of a draw (`compiledInDraw`, with the features that caused the latest), and the warm-up's state |
| `window.__game.bench()` | The fixed flight's report |

The copy button's report has the cost by feature too.

## Cost by feature

Every draw of every pass goes through `renderer.renderBufferDirect`. The meter wraps it and adds what each draw
added to the renderer's counters to the feature of the object drawn. So the rows add up to the totals by
construction.

An object's feature comes from the names table in `src/game/views/core-perf.view.ts` (`grass` is grass,
`painted-trees` is trees). A new top-level object with a name not in the table shows up as `other: <name>`.
Add its name to the table. `perf.costs.tag(object, feature)` names one object by hand.

## Shader warm-up

A program is compiled the first time something that wears its material is drawn. On a weak graphics chip that
stalls the frame. `programs().compiledInDraw` counts every time it happens, and should stay where it was at the start.

- While the title is up, `core-perf.view.ts` calls `warm.start()` once the land in view has arrived. Everything
  in the scene is compiled in the background with `renderer.compileAsync`, hidden things and things out of view
  included, then drawn once into a single pixel to make the shadow pass's programs and send the textures.
- A start that comes before that (a reload into the game, a test through the door) calls `warm.finish()`: the
  same, at once, at the start of the first frame.
- Afterwards a material that arrives late is compiled in the background, and what wears it is held back by its
  layers for the frame or two that takes.

Two things still compile in a draw: a material whose `needsUpdate` was set (a changed Graphics setting does that
to every material), and the shadow program of a late material when it is a new kind.

## The fixed flight

`/?bench` starts a new game with no click and flies from the spawn through the meadow into the town: ten stops,
held four seconds each. `/?bench&quality=low` holds a level. `/?bench=0.5` flies it in half the time. It ends
with a table on screen and the same at `window.__game.bench()`: a row a second (frame times, draw calls,
triangles, the level, programs compiled in a draw) and a row a stop with its cost by feature.

The rules are paused while it flies, at noon under a clear sky, so two runs draw the same world. The flight's
clock is the frames' own time step, so a slow machine flies the same path in more real time and second 12 of
one run is the same place as second 12 of another. A stop is held for at least sixty frames, so a slow machine
has the place's land, grass and water before the stop's numbers are taken.

This Mac draws in software: its frame times mean nothing. Its draw calls, triangles and program counts are exact.
