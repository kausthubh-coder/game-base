# Painted meadow: a test scene

A scene apart from the game that asks one question: can this engine draw a place that looks like a
hand-painted film background? Kausthubh's brief was "try to make it like a Studio Ghibli movie".
It has a rolling meadow, a great tree on a knoll, groves, a pond, a cottage on a hill, far ridges and
painted clouds, at noon and late in the day.

## Run it

| Command | What it does |
|---|---|
| `bun tools/demo.mjs dev ghibli 5460` | Dev server. It prints its pid. |
| `bun tools/demo.mjs build ghibli` | Builds into `dist/demos/ghibli` |
| `bun tools/serve.mjs dist/demos/ghibli 5460` | Serves the build |
| `bun tools/ghibli-assets.mjs` | Remakes the textures from the generated paintings |
| `bun tools/shot.mjs "http://127.0.0.1:5460/?view=wide&t=8&panel=0" out.png --w 1280 --h 720 --wait 80000` | One screenshot. The paint filter takes about a second a frame on this Mac, so wait long. |

In the address: `?view=wide|tree|pond|house|tilt|solo`, `?mood=noon|evening`, `?trees=leafy|painted|fluffy`,
`?paint=1`, `?radius=5`, `?quality=low|medium|high`, `?t=8` (holds the clock), `?panel=0`. Keys 1 to 6 pick a
view, T changes the trees, M the mood, P turns the paint filter on and off. Drag to look round. `tilt` is the game's
2.5D camera angle.

Kausthubh's first reaction (2026-11-10): the scene "looks sick", but he did not like the paint filter or the
first trees (flat green discs). The filter is now off unless asked for, and the trees have new looks. He then sent a picture of a Genshin
tree (a wide emerald crown of leaf sprays with pale tips) and asked for one like it: that is the `leafy` look,
and the `solo` view shows one such tree alone by the pond.

## How the look is made

| Part | File | The idea |
|---|---|---|
| Light | `paint.ts` | One painted light for every surface: a wrapped sun, soft bands whose edge a brush texture breaks up, a warm tint in light, a blue-violet tint in shade, haze toward the sky's colour. Cloud shadows drift over the land and flecks of sun fall inside tree shadows. |
| Trees | `trees.ts` | A crown is rounded blobs with cards on them that face the camera. Each card takes its blob's normal, so the crown shades as one round form. `leafy` (the default): sprays of leaflets drawn by code, at every depth in the crown, in emerald tones with pale tips. `painted`: a few large cards, each a painting of one bough of leaves with its own light and shade. `fluffy`: many small cards cut by a painted leaf mask and shaded smoothly through four tones. |
| Grass | `grass.ts` | Blades whose root is the ground's colour and whose normal points up, so the field and the ground are one surface. Painted tufts on cards give the brush strokes. Gusts travel across and lift the pale tips. |
| Land | `land.ts` | Heights from noise plus placed features: a knoll, a hill with a flat top, a pond, a path, higher hills round the edge. |
| Sky | `sky.ts` | A washed gradient, one painted cloud per card far away, three rings of ridges that the haze turns paler and bluer. |
| Water | `water.ts` | Colour, shore line and ripples all come from the water's depth. Hard steps make it read as drawn. |
| Paint filter | `post.ts` | Off by default. An anisotropic Kuwahara filter: flat areas become flat dabs and edges stay sharp. The grade and the paper grain after it always run. |

## Assets

- **Paintings**: 21 images made with image generation. The raw PNGs are in `assets-src/ghibli/raw/` on the Mac
  mini only (24 MB, not in git, like the game's other raw images). Every prompt is in
  `assets-src/ghibli/prompts.json`: six clouds, four boughs of leaves, three leaf masks, two grass tufts, and
  the brush, meadow, path, rock, bark and paper surfaces. `tools/ghibli-assets.mjs` turns them into
  `assets/*.webp` (1 MB). Three more paintings (two whole bushes, one whole tree) are in the raw folder and
  not used.
  A texture that is missing falls back to a stand-in drawn in `textures.ts`, and the panel names it.
- **Models**: eight pieces of the Hollowmere town kit, copied into `assets/kit/` from
  `~/dev/sandbox/game-look-test/design/img/3d/town-dot/models/`. Their Blender sources and build scripts
  are in that folder, not in this repo.
- Trees, bushes, rocks, grass, land and sky are built by code.

## Numbers

At quality high, 1280 by 720, with the paint filter off, shadows included:

| Trees | Draw calls | Triangles |
|---|---|---|
| leafy | 75 to 99 | 370,000 to 381,000 |
| painted | 72 to 95 | 283,000 to 293,000 |
| fluffy | 72 to 95 | 360,000 to 371,000 |

The budget is 150 and 400,000. Frame rate is not measured: this Mac draws WebGL in software.

The paint filter (`?paint=1`) reads about 80 texels a pixel at radius 5, which is likely too much for
integrated graphics at full size.

## What is not done

- It is not wired into the game. The game's land is blocks and this land is a smooth height field.
- `path.webp` is made but not used: the path takes its colour from the land's vertex colours.
- No characters, no drifting petals or birds, no sound.
- A painted bough has its light on the upper left of the screen, whichever way the camera faces.
