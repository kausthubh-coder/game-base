---
name: make-3d-asset
description: Build or improve a code-built 3D prop or landmark (a tree, a stall, a ruin, an arch, a mill) from its approved concept sheet, with scale, budget and a side-by-side check against the sheet in the game's light.
---

# Make a 3D asset

A model starts from its **concept sheet** and ends beside it. In between, the sheet is the target for the
look and the plan is the target for size. The first group built this way (`world/models-8`) matched every size
and still looked far worse than its sheets: hard facets, one flat colour per part, boxes where the sheet had
shaped rock. Its report said PASS with "surfaces simpler than the concepts". That is a fail. This skill exists
so the next model is judged against the sheet, not against the checks.

## 1. The sheet

Find the approved sheet: `assets-src/concept/<group>/<key>.webp`, its group's notes (`report-*.md` or
`README*.md` in `assets-src/concept/`) and the plan's row for the key (`docs/greenhollow-world.md` for the
landmarks, `docs/act1.md` for the rest). **No approved sheet, no model**: stop and ask the coordinator for
one. Sheets are approved by Kausthubh on the concepts page; `docs/act1.md` says which sets are.

Read the notes before the picture. They correct the painting: the High Road deck is at 13, not the 14 the
pylon's sheet prints; the standing stones are eight though the top inset shows seven; the pump house's bearing holds
the hub, not the rim as its label says. **The notes win over the plan's rough sizes, and both win over the
painting.**

Take from the sheet:

- **Silhouette**: the outline of each view. This is what a player recognises from across the valley.
- **Proportions**: the ratio of parts (pier to opening, roof to wall, wheel to house), measured against the
  hero drawn beside it. The hero is about 1.8 blocks tall.
- **Materials and palette**: each named material and where it sits. Light faces, shade faces, the accent
  colours, and how much of the surface each covers (moss in joints and on ledges, never everywhere).
- **Surface rendering**: soft or hard edges, colour that varies across a face, seams. A painted soft rock
  must come out soft.
- **Parts and joints**: what moves, what glows, what joins a neighbour, what you walk through.

Ignore:

- Generated lettering and arithmetic on the sheet. Use the notes and the plan's numbers.
- Perspective slips between the sheet's views. The front and side elevations settle proportions.
- Incidental dressing: backdrop trees, flowers, grass tufts, people, water. The land and the biomes draw
  those. Model only what the notes call part of the prop.
- Vistas, for anything but mood and relative scale.

The ancients' stone is one material everywhere: **Hearth limestone**, `assets-src/concept/stone.md`. Read it
for any ancient ruin, road, terrace, shrine or vault. `stone-2.md` to `stone-4.md` are older proposals it
replaces where they differ.

## 2. Build

**`src/features/props/README.md` is how to build.** It documents the organic forms, the shading baked into
vertex colour and the painted textures that make a model read like its sheet. Read it first and use its calls.
Until it exists, a builder has only `src/features/props/shape.ts` (boxes, tubes, blobs, cones, polygons),
which is how models-8 came out faceted. In that case say so in your report and expect a second round.

Reach for these first, by material. The README names the exact calls; this column is what to look up in it.

| Material | Form | Surface |
|---|---|---|
| Rock, boulders, cliffs | Organic lumpy masses, smooth-shaded, a few big ones overlapping, never a faceted blob with flat faces | Baked light-to-shade gradient and the lavender-grey rock painting; moss on upward faces only |
| Roots, branches, trunks | Swept tubes along curves, tapering, 8 or more sides, smooth-shaded (`tube` with `sways:[0,…]` today) | Bark painting or baked ochre ridges and dark recesses |
| Wood (boards, beams, posts) | Bevelled boxes, one per board where the boards read at game distance | Board seams and grain in the wood painting, not modelled grooves |
| Masonry (walls, piers, arches) | A few big bevelled masses for the silhouette; arch rings swept or extruded | Ashlar seams painted or baked, never a box per block; colour varied per block |

Then:

1. Add the data in `src/content/props.ts` (group `landmark` for anything from `docs/greenhollow-world.md`),
   a builder in `src/features/props/builders/` and its key in `builders/index.ts`. Use deterministic Shape
   seeds and `s.r()` / `s.rr()`. Choose WILD for growth, LOOSE for clutter, SNUG for joined structures.
2. Merge all parts through `s.done()`. Reuse the shared material: no mesh or material per part, nothing
   allocated per frame. Give substantial masses a `shadowBox` or `shadowBlob`.
3. Rooted parts stay still in wind: a tube takes `sways:[0,.3]`, not one sway for all of it. Leaves and flowers
   can use .3 to .5. The entry's `wind` must match the geometry.
4. Glow needs a `glow` on the part, `s.light` where the light sits, and a matching `light` level in the entry.
5. Count triangles (index count / 3). Set the entry's budget to the largest variant plus about 20%, rounded to
   ten. Caps (`TRIANGLE_CAP` in `src/content/props.ts`): 300 for a small prop, 1,500 for a tree, 6,000 for a
   landmark. The scene's cap stays 150 draw calls and 400,000 triangles at high.
6. `bun tools/typecheck.mjs props` and `bun test src/features/props`. The tests check palette, geometry,
   grounding, wind, light, determinism and instancing. Fix the geometry, never the test.

A landmark is big, joins its neighbours, may move, glow or be walked through: read
[landmarks.md](landmarks.md) before building one. For a `.glb` built by Blender rather than a Shape builder,
read [blender.md](blender.md).

### The style, in numbers

- One unit is one block is one metre. The hero sprite's frame is 2 blocks; the figure in it is about 1.8.
  A doorway is 1 wide by 2 high. Fence rails sit about .35 and .8 high, counters .8, canopies 2 to 2.5, hay
  bales .7, stumps .6, flowers .3 to .6. Scale against those, never the turntable alone.
- Centre at x = z = 0, ground at y = 0, front +z. A bridge's length follows z. A wall piece starts at its wall
  face z = 0 and projects toward +z.
- The camera looks down 35 degrees. Broad top surfaces, clear silhouettes. Structural rails .1 to .2 thick,
  small visible parts at least .03. Bevel a main box by .02 to .07.
- Colours from `P` and `RAMP` in `palette.ts`, or the README's painted materials. Wood `#916534 / #9b6f3e /
  #b78b5a`, supports `#664930`; foliage `#3c5537 / #516b3c / #6c8043 / #8d9a4a`; straw `#b68a3f / #d4aa58 /
  #eeca76`. Warm light from the upper left; tops catch light, undersides stay dark. No black outline in
  geometry: edges separate by bevel and shade.
- Bright lume teal is magic and old machines only. Town roofs use muted `P.teal`. Gold light is the Order's
  and the lit High Road's.

## 3. The side-by-side check

This is the gate. Run it for every variant:

```sh
bun tools/props-beside.mjs <kind> [--variant <n>]
```

It builds the game, stands the prop on the painted meadow in the game's own light with the hero beside it,
and writes `.artifacts/props/beside-<kind>-<n>.png` (a low three-quarter view, the sheet's angle, left; the
sheet right) and `game-<kind>-<n>.png` (the game's own camera). It finds the sheet by key; `--sheet` names
another. `--side left` and `--turn` match a sheet drawn from the other side, `--at x,z` moves it off a slope,
`--time 0.75` shoots dusk. Use the port `bun tools/doctor.mjs` gave you (`--port`, or `PORT` in the
environment).

Open both pictures. The model **fails** when a person looking at the pair would call it clearly worse than the
sheet. Any one of these is a fail:

- **Flat colour**: a part is one colour where the sheet's face varies (lit edge to shaded base, block to
  block, moss in the joints).
- **Facets**: hard triangles show where the sheet is soft and rounded (rock, roots, bark, thatch, cloth).
- **Boxes**: a box or a plain cylinder stands where the sheet has a shaped outline (a tapering pier, a lumpy
  rock mass, a sagging roof, a curling root).
- **Lost silhouette**: from the sheet's angle the outline is not recognisably the sheet's: a missing overhang,
  crown, tree on top, broken edge or opening.
- **Wrong proportion**: a part is visibly too thick, thin, tall or short against the hero, compared with the
  sheet.
- **Wrong material**: a colour that is not the sheet's (grey for honey limestone, green for teal), or glow
  where the sheet has none.
- **Out of place on the land**: it looks pasted on beside the painted trees, rocks and grass: brighter,
  flatter or more saturated than its neighbours.

"Simpler than the sheet" passes only for detail the sheet's notes or this skill say to leave out (dressing,
carved fingers, small ornaments). It never passes for surface, silhouette or colour. When it fails, fix it
and shoot again. When you cannot fix it with the calls the README gives, report **ISSUES** with the beside
picture's path and what fails; never PASS.

Then the other looks, through the props demo:

```sh
bun tools/props-preview.mjs <kind>
```

It writes `.artifacts/props/only-<kind>.png` (every variant by day, with its triangles and budget),
`only-<kind>-night.png` (what glows) and `sheet-<group>.png` (beside its neighbours at one scale). With an
assigned output folder or port, build there and run `bun tools/props-shots.mjs --only <kind> --url
<your-url>` instead. Stop only your own server's pid.

Check every variant at one scale and at game distance: it reads without a label, its shadow is grounded,
rooted parts stay still, it glows only where specified, and it holds at low, medium and high quality. Count
draw calls and triangles with a known fixture; this Mac cannot measure a frame rate. Say which fixture and
quality you checked.

## 4. Done and the report

Done means: the tests pass, `bun tools/verify-assets.mjs` passes, and every beside picture passes the list
above. Report the prop keys, each variant's triangles against its budget, its measured size against the plan,
the path of every beside picture, and what the sheet shows that the model leaves out, with the reason.

Add world placements only when your brief says so. Otherwise report keys, sizes and suggested places.
Geometry gives no collision or walking surface: a bridge, a boardwalk or a passage needs one from its caller.
List what the game must wire (a turning part, a water sheet, a door that opens) the way `docs/act1.md` lists
it under "Waiting to be wired in".
