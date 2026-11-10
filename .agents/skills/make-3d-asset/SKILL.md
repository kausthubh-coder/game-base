---
name: make-3d-asset
description: Add or improve a code-built 3D prop for the pastoral valley, town or forest, with palette, scale and budget checks.
---

# Make a 3D asset

Read `docs/style-sheet.md`, `src/content/props.ts`, the nearest neighbor builder and `src/features/props/shape.ts`. Default props use data plus a Shape builder. For an authorized model-file experiment, use the Blender section below. Use an existing neighbor's material language and note its actual triangle count.

## Concrete style

- One unit is one block. Hero is 2 high; doorway 1 wide by 2 high. Fence rails sit about .35 and .8 high, counters .8, canopies 2–2.5, hay bales .7, stumps .6, flowers .3–.6. Scale against those objects, never the turntable alone.
- Center at x=z=0, ground at y=0, front +z. Bridge length follows z. Wall pieces start at wall face z=0 and project toward +z.
- The camera looks down 35 degrees. Use broad top surfaces and clear silhouettes; structural rails .1–.2 thick, small visible parts at least .03. Bevel the main box by .02–.07. Round shapes use 5–8 sides.
- Use only `P` and `RAMP` from `palette.ts`. Wood dark/mid/light is `#916534/#9b6f3e/#b78b5a`, supports `#664930`. Foliage is `#3c5537/#516b3c/#6c8043/#8d9a4a`. Straw is `#b68a3f/#d4aa58/#eeca76`. Warm upper-left light; tops catch light, undersides stay dark. Do not bake a black outline into geometry. Sprite outlines are 1–2 pixels; prop edges get their separation from bevels and shadows.
- Keep saturated lume teal for magic. Town roofs use muted `P.teal`; pastoral cloth can use saffron and cream. Avoid tiny noisy detail: a plank must retain visible board divisions, a fence its rails, moss an uneven green cap.

## Build

1. Add data in `src/content/props.ts`, a builder in `builders/`, and its key in `builders/index.ts`. Use deterministic Shape seeds and `s.r()`/`s.rr()`. Choose WILD for growth, LOOSE for clutter, SNUG for joined structures.
2. Merge all parts through `s.done()`. Reuse the shared instanced material; no mesh or material per part, no allocations each frame. Provide shadowBox/shadowBlob for substantial masses.
3. Root wind at zero: tube `sways:[0,.3]` rather than uniform sway. Flowers/leaves can use .3–.5. Data wind must match geometry. Glow needs both a glow attribute and `s.light`, and a matching data light level.
4. Count geometry indices divided by 3, or position vertices divided by 3 for unindexed geometry. Set budget to largest variant plus about 20%, rounded to ten. Cap small props at 300, trees 1500, buildings 6000. The scene cap remains 150 calls and 400,000 triangles.
5. Run `bun tools/typecheck.mjs props` and `bun test src/features/props`. Existing tests verify palette, geometry, grounding, wind, lighting, determinism and instancing. Fix geometry rather than weakening checks.

## Look before done

`bun tools/props-preview.mjs <kind>` normally builds and runs day/night turntables plus its group sheet. If the task assigns an output folder or port, build there and use `bun tools/props-shots.mjs --only <kind> --url <assigned-url>` instead. Stop only your own server PID. Save screenshots in the task's artifact folder.

Open day, night and group images. Check every variant at one common scale, then inspect it at normal game distance. It must read without a label, have a grounded shadow, match neighboring colors, keep rooted parts still, and glow only when specified. Inspect low, medium and high quality. Count renderer calls/triangles with a known fixture; this Mac's software WebGL cannot establish frame rate. Report exactly which fixture and quality you checked.

Add world placements only when authorized. Otherwise report prop keys, dimensions and suggested locations. Bridges need a caller-provided walking surface; geometry alone does not supply collision.

Today's lesson: numeric checks allowed the hero's off-style tool row and the plank's lost board lines. The 3D equivalent is a thin fence disappearing in grass or a smooth cylinder passing as a stump. Judge the identifying shape at game distance before calling the asset complete.

## Blender model look tests

When the task permits model files, use `tools/models/` rather than a Shape builder.
Run `bun tools/models/build.mjs` to rebuild all six seeded GLBs and their manifest counts.
Add `--renders` for front and three-quarter PNGs in the design's `img/options/models/` folder.
Each model script imports `common.py` for the leaf atlas, vertex colors, export and studio.
Add a seed or model script to `build.mjs`, keep its origin at the base, and use one Blender
unit per block. Blender Z up exports to glTF Y up. Keep one mesh and one material per
variant so its instances take one draw call. Trees use outward normals on alpha-tested
leaf cards, never sphere meshes. Caps are 1,500 triangles per tree and 300 per small prop.
`public/assets/manifest.json` records `file`, `seed`, `triangles`, `budget` and `bytes` under
`models`; the verifier compares those against the actual GLB. Do not add compression
that needs a decoder package without task authorization.

`src/game/views/look-models.view.ts` loads this fixture only with `?models=1` and instances
each variant. Add placements there for a look test; keep the region and felling rules intact.
Build with `bun run build --outDir dist-models`, serve on the task's port, inspect matching
baseline/model screenshots at high quality, and check low and medium too. Read
`window.__game.counters()` after settling. Run `bun run check`, `bun tools/verify-assets.mjs`
and `bun tools/play-smoke.mjs`; inspect PNGs before reporting. Stop your own server PID.
