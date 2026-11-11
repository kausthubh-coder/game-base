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

In the address: `?view=wide|tree|pond|house|tilt`, `?mood=noon|evening`, `?paint=0`, `?radius=5`,
`?quality=low|medium|high`, `?t=8` (holds the clock), `?panel=0`. Keys 1 to 5 pick a view, P turns the paint
filter on and off, M changes the mood. Drag to look round. `tilt` is the game's 2.5D camera angle.

## How the look is made

| Part | File | The idea |
|---|---|---|
| Light | `paint.ts` | One painted light for every surface: a wrapped sun, soft bands whose edge a brush texture breaks up, a warm tint in light, a blue-violet tint in shade, haze toward the sky's colour. Cloud shadows drift over the land and flecks of sun fall inside tree shadows. |
| Trees | `trees.ts` | A dark mass, then dabs of lighter leaves on the sunny side. Leaf cards sit on rounded blobs and take the blob's normal, so each card gets one of four tones and the crown shades as one round form. Each card faces the camera and is cut by a painted leaf mask. |
| Grass | `grass.ts` | Blades whose root is the ground's colour and whose normal points up, so the field and the ground are one surface. Painted tufts on cards give the brush strokes. Gusts travel across and lift the pale tips. |
| Land | `land.ts` | Heights from noise plus placed features: a knoll, a hill with a flat top, a pond, a path, higher hills round the edge. |
| Sky | `sky.ts` | A washed gradient, one painted cloud per card far away, three rings of ridges that the haze turns paler and bluer. |
| Water | `water.ts` | Colour, shore line and ripples all come from the water's depth. Hard steps make it read as drawn. |
| Paint filter | `post.ts` | An anisotropic Kuwahara filter. Flat areas become flat dabs and edges stay sharp. Then a grade and paper grain. |

## Assets

- **Paintings**: 17 images made with image generation. The raw PNGs are in `assets-src/ghibli/raw/` on the Mac
  mini only (24 MB, not in git, like the game's other raw images). Every prompt is in
  `assets-src/ghibli/prompts.json`: six clouds, three leaf masks, two grass tufts, and the brush, meadow,
  path, rock, bark and paper surfaces. `tools/ghibli-assets.mjs` turns them into `assets/*.webp` (762 KB).
  A texture that is missing falls back to a stand-in drawn in `textures.ts`, and the panel names it.
- **Models**: eight pieces of the Hollowmere town kit, copied into `assets/kit/` from
  `~/dev/sandbox/game-look-test/design/img/3d/town-dot/models/`. Their Blender sources and build scripts
  are in that folder, not in this repo.
- Trees, bushes, rocks, grass, land and sky are built by code.

## Numbers

At quality high, 1280 by 720, the five views draw 72 to 95 calls and 324,000 to 335,000 triangles, shadows
included. The budget is 150 and 400,000.

The paint filter's cost on a real GPU is not measured. This Mac draws WebGL in software. At radius 5 the
filter reads about 80 texels a pixel, which is likely too much for integrated graphics at full size.
Medium uses radius 3 and low turns it off.

## What is not done

- It is not wired into the game. The game's land is blocks and this land is a smooth height field.
- `path.webp` is made but not used: the path takes its colour from the land's vertex colours.
- No characters, no drifting petals or birds, no sound.
- The tree view shows large flat leaf dabs when the camera is under the crown.
