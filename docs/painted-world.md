# The painted world

The game is drawn in the look of the painted meadow test scene (`demos/ghibli`): smooth painted land that runs to
the horizon, grass in the wind, leafy trees, painted clouds and far hills in blue air. The rules did not change. They still see a world
of blocks, and farming and building still snap to that grid.

## How the look meets the blocks

| Thing | The rules see | The game draws |
|---|---|---|
| Natural ground (grass, dirt, sand, clay, stone, path) | Blocks | One painted surface, `src/features/painted/land.ts` |
| Tilled soil and paving at ground level | Blocks | Painted into that surface: furrows on a field, stones on paving, with a soft edge to the grass |
| A block put above the natural ground | A block | A block, as before |
| A floor of planks let into the ground | Blocks | Blocks. The land lies 0.08 under their tops |
| The wall of a cave | Blocks | Blocks |
| A tree | A trunk to fell, with a box | A leafy tree, `trees.ts`, that tips over when it is felled |
| A scattered rock or bush | A prop | A painted boulder or a mound of leaves, `scatter.ts` |
| A column of stone the plan stands in the wild (the grant's standing stone, the boulders by the pool) | Blocks | A painted stone large enough to hold its blocks |
| Hollowmere's buildings and street pieces | Barrier blocks | The town kit's models in the painted light, `src/game/views/world-town.view.ts` |
| The Hollow Oak | Two blocks of trunk | A great painted oak, drawn leaf by leaf from any distance |
| Grass tufts and flowers | Nothing | Blades, tufts and flowers grown where the land is green, `grass.ts` |

"Natural ground" is every land block under the height the terrain gave the column
(`groundHeight` in `src/features/world/terrain.sim.ts`). The block mesher leaves out the faces of those blocks
that look out over the land, and `land.ts` draws the surface in their place. Dig a hole and the surface dips
into it. Put a dirt block on the grass and it stands there as a block.

## Far from the hero

The game holds blocks in memory for about ninety blocks around the hero. Three things carry the picture on
from there to the horizon. None of them needs a chunk.

| Thing | Where | From |
|---|---|---|
| The far land, `far.ts` | From the near land's edge to 300 blocks | `landHeight`, `surfaceAt` and `forestAt` in `terrain.sim.ts`, a point every 8 blocks |
| Far trees, `impostors.ts` | From 62 blocks to 288 | `treesInArea`: the trees the hero will find there. Each is a picture of its tree, taken when the game starts |
| Ridges and clouds, `sky.ts` | Behind the far land | Fixed shapes that follow the hero |

The near land and the far land overlap for a few meters and thin out against each other, pixel by pixel, and
so do a tree and its picture. Nothing fades into fog to hide an edge.

The air is `paintAir` in `paint.ts`, with its numbers in `HAZE` (`src/content/painted.ts`): clear for 42
meters, then blue, then the colour of the horizon. It is thicker in low ground, so a hilltop stands out of it,
and it glows toward the sun. Rain and fog bring it in close.

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
- `src/content/painted.ts`: the tree shapes, the colour of the light and the air through the day, the great oak.
- `src/content/land.ts`: which blocks are land, and their colours.
- `src/game/views/world-painted.view.ts`: feeds the feature from the game.
- `public/assets/painted/`: twelve paintings (see `docs/assets.md`).
- `bun tools/painted-shots.mjs`: pictures from fixed places, to judge a change. `--query "look=steps" --tag steps`
  shoots another look beside the first, `--time 0.92 --tag night` another hour.
- `bun tools/land-relief.mjs`: the shape of the land from above, drawn from the terrain's functions, to judge
  a change to the terrain or the plan without starting the game.

## Known limits

- A cave that opens at the surface looks closed from outside: the land's slope covers its mouth.
- Lamp light falls on the land, not yet on the grass blades or the trees.
- What the player builds above the ground (walls, floors, roofs, fences) is still drawn as blocks, with the
  old pixel textures. So are the town's old pillars, the kennel's fence, the ferry dock and the dead garden's ruin.
- The far land shows no path, and its water is one flat blue.
- A tree felled far away comes back as a far tree only if it was felled in this game: the far trees ask the
  trees system, which keeps the felled ones in the save.
