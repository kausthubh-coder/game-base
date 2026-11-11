# Environment look: research and build order

Written 2026-11-10 for Kausthubh's ask: "work on the environment and make it look better, more stylized."
The judge is still `docs/style-lab/reference/genshin-fields.png`. The game today is
`.artifacts/style-lab/base/places/sheet.png`.

Read this with the painterly look bible, `~/dev/sandbox/game-look-test/design/img/3d/look/claude/bible.md`.
That bible covers the light model, the palette, the grade and the grass. This file covers what it left out.

A first test of these ideas is built: the painted meadow in `demos/ghibli` (see its README).

## The finding

Earlier passes changed how surfaces are shaded. The reference differs from the game mostly in what is in
the frame. Count the layers in the reference from front to back: long grass, a path with rocks and bushes,
tree groups, a river, town walls, blue cliffs, clouds. That is seven. The spawn view has two, a green plane
and a sky. A better shader on a flat plane with five trees still shows a flat plane with five trees, which
is why look A read as "very close to how the game is now".

So the order of work is content first, shading second.

## The gaps, largest first

| # | The reference has | The game has | Where it lives |
|---|---|---|---|
| 1 | Land that rises and falls, cliffs, far ridges in blue haze | A meadow that varies about 3 blocks over 52 m, hills only in masked areas, a straight horizon | `src/features/world/terrain.sim.ts` (`naturalHeight`), `src/game/content/region.ts` |
| 2 | Trees in groups of many sizes, round crowns, bushes at their feet | A handful of single trees with thin trunks | `tools/models/`, `src/game/views/world-trees.view.ts`, `region.ts` |
| 3 | A deep blue sky with large cumulus in two or three flat tones | A pale sky with soft noise wisps | `src/features/sky/sky.view.ts` |
| 4 | Lime grass in light, teal in shade, tufts close to the ground's value | One saturated emerald, near-black spiky tufts, dark blob shadows | palette, `src/features/world/material.view.ts`, props |
| 5 | Rocks as large faceted masses, blue-grey, grass at the foot | Grey cubes and small scattered rocks | `tools/models/`, props scatter |
| 6 | Bright turquoise water with a pale edge at the shore | Water that takes the sky colour, no shore line | `src/features/water/water.view.ts` |
| 7 | Things sit on the ground: dark contact under trees, rocks and walls | Props float a little, no contact shade | `src/features/post/post.view.ts`, props |
| 8 | Buildings with roofs and shapes | Buildings made of textured blocks | Dot's town kit, on hold |

The tilt camera looks down and sees little sky. From that view gaps 1, 2, 4, 5 and 7 carry the picture.
From the free and first-person cameras, 1 and 3 matter most.

## What the sources say, by element

### Land and layout

Breath of the Wild built its terrain from triangles: hills, mountains and cone rocks. A triangle draws the
eye to its tip, so points of interest go on peaks. It also hides what is behind it, so only a couple of
places show at once and walking reveals two or three more. Small landmarks are made to stick out from far
away: a tall column of smoke, a lit shrine, a giant horse statue on the stable.
([GMTK on BotW's world](https://gmtk.substack.com/p/how-nintendo-solved-zeldas-open-world),
[Takizawa at GDC 2017](https://www.thumbsticks.com/gdc17-designing-zelda-breath-of-the-wild/))

For this game: raise the meadow's swing from 3 blocks to 6 to 10 over 40 to 60 m, keep the plots level, and
put one cliff or knoll in every view from spawn. Give each place one tall thing visible from the others: the
town's windmill or tower, a lone giant tree on a hill, smoke from the lodge. Ring the loaded land with a far
ridge, a few hundred triangles of unlit silhouette in haze colour, so the horizon is never a straight line.

Genshin's own 4.4 update added "Global Far Fog" and tinted far rock so hills step back like a shan shui
painting. ([report on the 4.4 update](https://www.sportskeeda.com/esports/genshin-impact-4-4-graphics-update-brings-two-new-features))
The bible's haze bands already do this. They need something far away to act on.

### Trees and bushes

The anime tree recipe has four parts.
([Trung Duy Nguyen, Blender anime foliage](https://trungduyng.substack.com/p/tutorial-blender-anime-foliage-pipeline),
[Douges, fluffy trees in three.js part 1](https://douges.dev/blog/threejs-trees-1) and
[part 2](https://douges.dev/blog/threejs-trees-2),
[DreamWorks, aggregate normals for trees](https://research.dreamworks.com/?p=524))

1. Scatter leaf cards over a rounded blob, a subdivided cube, not a sphere, so the cards spread evenly.
2. Copy the blob's normals onto the cards (Blender's Data Transfer modifier, custom normals). Flat cards
   shade as one flat colour. With the blob's normals the crown shades as one ball.
3. Cut each card with a brush-stroke alpha texture, `alphaTest` 0.5. This gives the fluffy edge.
4. In the vertex shader, push each card's corners out in view space by its UV (`uv` remapped to -1..1,
   times a scale) plus `normal * inflate`. Cards then face the camera head on and stretch at other angles.

Wind rotates cards in view space, more where the normal points up, with a phase from `position.x + position.z`.
Darken the side away from the sun with a gradient and multiply in ambient occlusion so the inside of the
crown is deep green and the top is lime.

The game's trees are Blender scripts already, so steps 1 to 3 belong in `tools/models/` and step 4 in the
tree material. Then plant them in groups: three to seven trees of mixed size, bushes at the edge, never an
even scatter.

Triangles are the limit. The spawn view is at 331,000 of 400,000 today. Far trees need a cheap version: one
crossed pair of cards with a baked picture of the crown beyond about 40 m.

### Sky and clouds

Games draw clouds one of three ways: painted images on a sky dome, shaped meshes, or ray-marched volumes.
Anime skies use the first two. Genshin's cloud shadows are a dark noise texture scrolled across the map, not
shadows of the clouds you see. ([Stylized Station thread](https://threadreaderapp.com/thread/1659208008491208704.html))
A mesh version builds a flat base and a puffy top from cellular noise, lights it with wrapped Lambert so
light reaches the underside, and adds a bright rim where light grazes the edge.
([Frozen Fractal, clouds](https://frozenfractal.com/blog/2026/7/31/around-the-world-33-clouds/))

For this game: keep the dome shader, but shape the clouds as cumulus. Use cellular noise with a hard
threshold so edges are crisp, a flat base, three tones (white top, pale blue body, blue-grey base) and
a thin bright rim toward the sun. Painted cloud sprites from image generation on a ring near the horizon are
the cheap second layer. Deepen the zenith blue so white clouds have something to stand against. The cloud
shadows the game has are the same trick Genshin uses. Make them lighter and bluer, since today they read
as dark blobs.

### Colour and value

Stylized scenes keep a strict small palette, let value contrast carry form, and use fog as the main depth
tool. Distant things blend toward the horizon colour.
([Bugnet, low-poly style guide](https://bugnet.io/blog/low-poly-3d-a-style-guide-for-small-teams),
[80 Level, stylized production tips](https://80.lv/articles/stylized-production-tips-and-tricks))
miHoYo states the goal as "fresh, bright, clean and anime-like" and keeps features lean so the picture looks
unified. ([notes on miHoYo's console rendering talk](https://nugglet.github.io/posts/2022/12/console_graphics_rendering_pipeline_genshin_impact))

The game today has this backwards. It has strong contrast at small scale (black tufts on bright green) and
almost none at large scale (one green everywhere). The reference has no small contrast and large patches of
different colour: lime field, teal shade, sand path, blue rock, turquoise water.

The bible's palette and light model fix this and exist as code on `look/claude` (6 commits ahead of
`style/lab`). Port them. Do not write them again.

### Rocks and cliffs

Stylized rocks avoid surface noise. Moss goes on faces that point up, found with a dot product against world
up, so a rotated rock still has moss on top. The colour is lighter in the middle of a plane and darker toward
its edges. ([Games Artist, stylized rock study](https://gamesartist.co.uk/stylized-rock-study/),
[80 Level, stylized chaparral](https://80.lv/articles/creating-a-stylized-chaparral-environment-in-ue4/))

For this game: a small cliff and boulder kit from a Blender script, 3 to 5 pieces with large flat planes, no
texture, moss by world up in the shader, the meadow's green at the foot. Use them where the land steps more
than two blocks, so a hill has a rock face and not a staircase of grass blocks.

### Water

The whole stylized water look comes from the depth under the surface. Depth picks the colour between a
shallow and a deep tone, and the same depth value masks a foam line where water meets land. Hard `step`
cut-offs and ramps, not smooth physical shading, make it read as drawn.
([Ameye, stylized water](http://ameye.dev/notes/stylized-water-shader),
[Tuts+, toon water for the web](https://code.tutsplus.com/creating-toon-water-for-the-web-part-1--cms-30447t))

For this game: the world is blocks, so depth to the bed is known without a depth texture. Bake it per water
column into a vertex attribute. Shallow turquoise to deeper blue, a pale band at the bank, a slow foam line
with a hard edge.

### Grounding and light

Genshin uses three kinds of ambient occlusion: HBAO for small detail, baked AO volumes for static objects
and capsule AO under characters. Its shadows are 8 cascades with soft edges only in the penumbra.
([notes on miHoYo's talk](https://nugglet.github.io/posts/2022/12/console_graphics_rendering_pipeline_genshin_impact))

For this game the cheap equivalents are enough: a soft dark disc under every tree, rock and bush, vertex
colour that darkens toward the foot of a prop, and darker ground along the base of walls. Screen-space AO
only at quality high, if at all.

### Motion

A still field looks dead. Wind in the grass and the crowns, a few drifting leaves or petals, butterflies near
flowers and birds far off cost a few draw calls together. The effects feature has the particles for this.

## What exists already

| Thing | State |
|---|---|
| Painted light, palette, grade, haze bands, grass field, rounded stones | Built on `look/claude` and `mgr/look-a-build`, never merged, waiting for his pick |
| Tree, rock and bush models from Blender scripts | On `style/lab`: `tree-*`, `birch-*`, `pine-*`, `env-rock-*`, `env-bush-*` |
| Soft shadows, cloud shadows, bloom, haze, colour grade | On `style/lab` |
| Clean block ground with a rounded lip | Merged |
| Dot's town kit of buildings | Outside the repo, on hold |

## Build order

One spot, the spawn meadow looking toward Hollowmere, shot from the tilt camera and the low camera. Each step
ends with the same two shots beside the reference.

1. Land: more swing in the meadow, one cliff, the far ridge, one landmark on the skyline.
2. Trees: the leaf-card crown, then groups and bushes, then the far version.
3. Colour and light: port `look/claude`.
4. Sky: cumulus shapes, deeper blue, lighter cloud shadows.
5. Rocks and cliff faces.
6. Water.
7. Contact shade.
8. Motion.

Steps 1 to 4 make the two first screens he judges. Steps 5 to 8 follow his pick.

The budget stays 150 draw calls and 400,000 triangles at quality high. Trees and grass are what spend it, so
step 2 does not finish until the far version of a tree exists.
