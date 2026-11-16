# Building a landmark

Kausthubh, 2026-11-12: "I want 3D assets and terrain to be good and on a grand scale." The ancients built for
giants: arches 14 blocks high, pylons seen from anywhere in the valley, roots as thick as a cart, a waterwheel
taller than a house. A landmark is one prop of group `landmark`, at most 6,000 triangles, one draw call for all
its copies. These are the ways the first eight groups found to make that work, and what went wrong.

## Mass first, within the budget

- **A few big shapes carry the silhouette.** A pier is one tapering mass, not a stack of blocks. A rock arch is
  three or four overlapping organic masses, not one bent tube. Build the outline the sheet shows from the
  front and the side, then add the next size down.
- **Spend the budget where the camera sees.** The camera looks down 35 degrees: tops, front faces and the
  outline get the triangles. Leave out faces nobody sees (`skip: '-y'` on a box resting on the ground or on
  another). models-8's rock arch used 1,498 of its 6,000 triangles and came out faceted: a landmark that is
  soft on its sheet should use its budget on smooth curves before it adds small parts.
- **Seams are painted, not modelled.** Hearth limestone is ashlar about 2 blocks long, 1 high and 1 deep
  (`assets-src/concept/stone.md`). One box per block costs thousands of triangles and reads as noise at game
  distance. Draw the joints through the README's painted stone or baked colour, and vary colour block by
  block. Model only the joints that change the outline: a broken course, a missing block, a corner chip.
- **Carving is shallow.** One leaf, a pair of stems, a recessed channel. An extruded arch ring and a few
  wedges carry an arch.
- **Roots are swept tubes.** Tapering, 1.5 to 2 blocks thick for cart-sized roots, at most three main tubes a
  root, along curves that lie over the masonry and pry a few blocks apart. Roots never become stone carving.
  Underground anchors are overlap into the land, not extra height above it (`giantRoot`: arch 16 × 4 × 7,
  low 16 × 4 × 3, curl 16 × 4 × 5).
- **Moss sits** in damp joints, on upward ledges and at the foot. Leave most vertical faces bare.
- The props test holds every prop's lowest point within .15 of y = 0. A model meant to sit lower (the forest
  stair, whose top tread is at y = 3) stays grounded in its own space; its placement sinks it, and you say how
  in your report.

## Parts that join

A span, a wall face or a boardwalk repeats end to end. The seam must vanish.

- **One module, one length.** The High Road arch is 12 long along x, with open joints at x = −6 and x = 6 and
  no end wall. The channel and the walking lanes line up across the seam. Its notes overrule this skill's
  "length follows z": the notes win.
- **Shared parts belong to one side.** A terrace wall face shares or halves its end buttress, so two faces do
  not make a double-width post. A boardwalk piece owns its −z boundary posts and its middle posts; only the
  `end` variant adds the last pair. Nothing is drawn twice at a seam.
- **The deck height is the same in every piece** that meets another: boardwalk deck 1 above its base, hut porch
  2, joined by the hut's steps.
- **Variants share geometry where the sheet says so.** `dark` and `lit` arches are the same stone; only the
  channel's glow differs. A `broken` variant has no floating blocks: every piece rests on something.
- Check a join by building three in a row and looking at the seams from above and from the side, as
  `tools/world-models-8-preview.mjs` does for the boardwalk, and say what you checked.

## Moving parts

A prop's copies are instanced, so no part of one can turn by itself. A part that moves (the Pump House wheel,
the Hall door's leaves) is built as its own geometry from an exported function beside the builder, such as
`pumpHouseParts()` in `builders/group-4.ts` and `hallDoorParts()` in `builders/group-3.ts`. Its origin is its
pivot: the wheel's is the centre of its axle. Leave clearance between the moving part and anything fixed (the
wheel and both bearing piers). The fixed prop holds the axle and the bearings; the moving part holds rims,
spokes, paddles and hub, which turn together. Report where the part goes and how it moves (the wheel: at
`[-4.8, 7, 6]`, `rotation.z = seconds * 0.12`), for the coordinator's list in `docs/act1.md`.

Water and other see-through surfaces are separate too (`weirWater()`): the prop material is opaque.

## Glow

- A part glows with `glow: 1` (when it is dark) or `glow: 2` (always), plus `s.light(...)` where the light
  sits and a `light` level in the entry.
- Gold lume (`#FFD266`) is the lit High Road's channel and the pylon's crystal when lit. Dormant lume and
  crystals are slate lavender `#7E829E` and do not glow. The Lamp Gallery's lamps are dead: their pale glass
  does not glow. A dormant shrine and a sleeping waystone do not glow; their restored or waking variant does.
- Bright marks on a sheet are often reflected daylight. Glow only what the notes call lit.

## Openings and footprints

- A passage you walk through needs a clear bore: the fallen oak keeps 3 blocks across for its whole 24, the
  rock arch a 7 wide by 4 high passage. The hero is 1.8 tall; keep at least 2.5 clear overhead.
- Check it with rays through the opening in a fixture, as `tools/models7-preview.mjs` and
  `tools/world-models-8-preview.mjs` do, and report the clear size you measured.
- The floor of a passage is the land's (forest soil, not painted paving from the sheet's approach).
- The geometry gives no collision and no walking surface. A deck, a stair or a passage needs one from the
  game; say which in your report.
- Measure the model's bounds and compare them with the plan's width × depth × height. Moss or a post that
  sticks out a little is fine; say so.
