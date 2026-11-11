# The painted world

The game is drawn in the look of the painted meadow test scene (`demos/ghibli`): smooth painted land, grass in
the wind, leafy trees, painted clouds and far hills in haze. The rules did not change. They still see a world
of blocks, and farming and building still snap to that grid.

## How the look meets the blocks

| Thing | The rules see | The game draws |
|---|---|---|
| Natural ground (grass, dirt, sand, clay, stone, path) | Blocks | One painted surface, `src/features/painted/land.ts` |
| A block put above the natural ground | A block | A block, as before |
| Paving, tilled soil, floors | Blocks | Blocks. The land lies 0.08 under their tops |
| The wall of a cave | Blocks | Blocks |
| A tree | A trunk to fell, with a box | A leafy tree, `trees.ts`, that tips over when it is felled |
| A scattered rock or bush | A prop | A painted boulder or a mound of leaves, `scatter.ts` |
| Grass tufts and flowers | Nothing | Blades, tufts and flowers grown where the land is green, `grass.ts` |

"Natural ground" is every land block under the height the terrain gave the column
(`groundHeight` in `src/features/world/terrain.sim.ts`). The block mesher leaves out the faces of those blocks
that look out over the land, and `land.ts` draws the surface in their place. Dig a hole and the surface dips
into it. Put a dirt block on the grass and it stands there as a block.

## The three ways to draw the ground

| Address | Ground | Getting up a one-block step |
|---|---|---|
| (none), `smooth` | Each corner takes the average height of the four columns round it, so a step is a slope | The hero walks up it |
| `?look=steps` | Every column has a flat top at its own height, with earth on the risers | A jump, as before |
| `?look=blocks` | The block world as it was, with its model trees | A jump |

On smooth land the drawn ground lies up to half a block from the tops of the blocks. `view.lift(x, y, z)` says
how far, and the people, the pets and the props are drawn that much higher or lower.

## Where things are

- `src/features/painted/`: the look. `paint.ts` is the one painted light every material uses.
- `src/content/painted.ts`: the tree shapes and the colour of the light through the day.
- `src/content/land.ts`: which blocks are land, and their colours.
- `src/game/views/world-painted.view.ts`: feeds the feature from the game.
- `public/assets/painted/`: twelve paintings (see `docs/assets.md`).
- `bun tools/painted-shots.mjs`: pictures from fixed places, to judge a change. `--query "look=steps" --tag steps`
  shoots another look beside the first, `--time 0.92 --tag night` another hour.

## Known limits

- A cave that opens at the surface looks closed from outside: the land's slope covers its mouth.
- Lamp light falls on the land, not yet on the grass blades or the trees.
- The town and the landmarks (the standing stone, the mossy rocks, the dead garden) are still made of blocks.
