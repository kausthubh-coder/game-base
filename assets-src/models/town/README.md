# Hollowmere town kit

An original stylized riverside town kit with warm plaster, carved timber, teal roofs, harvest details and lanterns.

## Start here

- Import individual assets from `models/` into a glTF 2.0-compatible engine or DCC.
- Open `sources/mock-town-square.blend` in Blender 4.3 or later to inspect the assembled dusk scene.
- See `renders/mock-town-square-dusk.png` and `renders/town-square-close-dusk.png` for the completed square.
- Use the architecture, street and night contact sheets in `renders/` for quick visual review.

## Delivery

- 27 static GLBs: 3 landmarks, 9 buildings and 15 street props.
- 27 editable per-asset Blender sources, plus the assembled town-square source.
- 81 per-asset PNG proofs: front, three-quarter and night at 640 × 640.
- Dusk square: 1000 × 750; closer square view: 900 × 675.
- Labeled architecture, street and night contact sheets, plus a side-by-side reference comparison.
- JSON manifest, binary validation reports and reproducible source/export scripts.
- Unique kit geometry totals 53,234 triangles and 2,532,640 GLB bytes. The assembled scene uses repeated instances and additional stage geometry.

## Units, pivots and materials

- Units are metres. GLBs are Y-up, with their architectural front toward +Z. Blender sources are Z-up, front −Y.
- Each GLB contains one merged mesh with baked identity transforms. Its origin is centered across X/Z at ground level.
- Manifest footprints are integer-metre placement cells in X/Z, including decorative overhangs. They are not collision bounds.
- `Body` uses opaque vertex colors with a white base-color multiplier. Preserve `COLOR_0` on import.
- `Glow`, where present, is an opaque warm emissive material. Some unlit props only need `Body`.
- Normals are signed normalized bytes through the required standard `KHR_mesh_quantization` extension. Positions remain float32.
- Emission strength uses `KHR_materials_emissive_strength`. Use a compatible loader, or re-export the editable sources for a loader that lacks these extensions.
- No texture images, Draco, meshopt, animation, skeletons, cameras or lights are embedded in the individual kit GLBs.
- Preview lights, ground, landscaping, paving, river and the supplied character cast are stage-only. They are not included in the individual GLB budgets.
- Engine bloom and scene lights must be configured separately. Emissive surfaces do not automatically produce the same lighting in every engine.

## Per-model inventory

Triangle counts and sizes below are measured from the delivered GLBs. Footprint is X × Z; dimensions are X × Y × Z in metres. Bytes are decimal, with a strict limit of less than 400,000 per asset.

| Asset | Category | Triangles | Bytes | Grid footprint (m) | Dimensions (m) | Materials |
|---|---|---:|---:|---|---|---|
| granary-hall | landmark | 7,714 | 359,072 | 14 × 12 | 13.950 × 13.120 × 10.070 | Body, Glow |
| rootworks-gate | landmark | 5,312 | 236,936 | 12 × 8 | 10.943 × 7.490 × 5.900 | Body, Glow |
| town-well | landmark | 2,800 | 122,824 | 6 × 6 | 4.090 × 5.120 × 3.740 | Body, Glow |
| bakery | building | 2,893 | 140,248 | 10 × 8 | 8.770 × 6.327 × 6.615 | Body, Glow |
| lodge | building | 3,923 | 187,456 | 12 × 10 | 11.540 × 8.767 × 8.925 | Body, Glow |
| workshop | building | 2,629 | 125,644 | 10 × 8 | 9.050 × 6.426 × 5.980 | Body, Glow |
| kennel | building | 3,031 | 146,564 | 10 × 8 | 9.060 × 6.167 × 6.690 | Body, Glow |
| ferry-house | building | 3,507 | 167,800 | 10 × 10 | 8.775 × 6.316 × 9.045 | Body, Glow |
| house-a | building | 2,463 | 121,684 | 7 × 6 | 5.750 × 5.176 × 5.050 | Body, Glow |
| house-b | building | 3,603 | 173,936 | 9 × 8 | 7.940 × 6.506 × 6.750 | Body, Glow |
| house-c | building | 3,294 | 159,272 | 10 × 7 | 8.550 × 5.686 × 6.200 | Body, Glow |
| house-d | building | 3,255 | 160,008 | 8 × 8 | 6.920 × 8.697 × 6.840 | Body, Glow |
| market-stall-a | street | 684 | 32,592 | 3 × 3 | 2.650 × 2.511 × 1.895 | Body |
| market-stall-b | street | 684 | 34,872 | 3 × 3 | 2.650 × 2.511 × 1.895 | Body |
| cart | street | 660 | 30,496 | 3 × 4 | 2.200 × 1.565 × 2.930 | Body |
| barrels-crates | street | 552 | 26,540 | 3 × 2 | 2.341 × 1.422 × 1.365 | Body |
| bench | street | 512 | 24,444 | 3 × 2 | 2.340 × 1.280 × 1.009 | Body |
| signpost | street | 400 | 19,740 | 3 × 2 | 2.450 × 2.570 × 0.813 | Body |
| lamp-post | street | 652 | 31,580 | 3 × 2 | 2.385 × 2.780 × 0.600 | Body, Glow |
| string-lights | street | 754 | 36,132 | 6 × 2 | 5.783 × 3.090 × 0.277 | Body, Glow |
| banner-pole | street | 352 | 19,072 | 2 × 2 | 1.715 × 3.275 × 0.680 | Body |
| flower-planter | street | 728 | 40,144 | 3 × 2 | 2.520 × 1.408 × 1.237 | Body |
| fence-straight | street | 308 | 15,684 | 3 × 1 | 2.976 × 1.320 × 0.427 | Body |
| fence-corner | street | 336 | 17,048 | 3 × 3 | 2.976 × 1.320 × 2.976 | Body |
| stone-bridge | street | 692 | 31,876 | 6 × 3 | 6.000 × 1.380 × 2.980 | Body |
| dock-segment | street | 728 | 34,260 | 3 × 3 | 2.986 × 0.830 × 3.000 | Body |
| statue-gardener-warden | street | 768 | 36,716 | 3 × 3 | 1.720 × 2.480 × 1.720 | Body |

## Asset descriptions

- **granary-hall**: Proud grain-store civic hall with an open oak arcade, sweeping layered teal gables, wheat standards, and a lantern cupola.
- **rootworks-gate**: Friendly ancient river-intake gateway, with a truly open stone arch, teal-roofed towers, bronze root pipes, water wheel, and pressure gauge.
- **town-well**: Circular carved stone well, with an open water shaft, curved teal canopy, working spindle and hanging bucket, wheat finial, and paper lanterns.
- **bakery**: Cream-and-oak bakehouse with teal curved roof, rounded clay oven wing, wheat crest, bread sign and striped shop awning.
- **lodge**: Proud two-storey riverside lodge with stepped golden gables, long welcoming porch and generous glowing windows.
- **workshop**: Asymmetric makers workshop with tall teal cottage and genuinely open timber work bay, bench, anvil and stacked lumber.
- **kennel**: Substantial keeper cottage with warm windows, lower thatched canine wing, dog-size arched entrances and paw sign.
- **ferry-house**: River-teal ferry keeper house with flat plank dock, bollards, landing rails, crossed-oar sign and welcoming lanterns.
- **house-a**: Small one-storey wheat-thatched cottage with broad curved eaves, one luminous gable eye and a flower-filled front window.
- **house-b**: Medium L-plan teal-roof home with lower side gable, projecting window bay and a little roof dormer.
- **house-c**: Broad medium farmhouse with warm golden thatch, projecting entry gable, exposed cross timber and colorful window boxes.
- **house-d**: Two-storey jettied townhome with steep teal gable, oak balcony, prominent corner braces and flower boxes.
- **market-stall-a**: Bread seller with scalloped teal-and-wheat canvas, timber trestles and scored loaves.
- **market-stall-b**: Harvest stall with teal-and-gold canvas, produce bins and hanging harvest crest.
- **cart**: Oak harvest handcart with open spoke wheels, long handles, crate and grain sack.
- **barrels-crates**: Coopered oak barrels with dark hoops and slatted harvest crates.
- **bench**: Welcoming curved oak bench with a teal back and sprouting harvest medallion.
- **signpost**: Carved river-town directional signpost, arrow boards and grain seal.
- **lamp-post**: Warm-brown cast lantern post with two glowing pointed lanterns and curved branches.
- **string-lights**: Sagging festival cable between timber poles with alternating teal and gold lanterns.
- **banner-pole**: Gold-tipped oak standard with sculpted teal swallowtail and raised wheat-sheaf emblem.
- **flower-planter**: Chamfered cream planter full of fluffy pink-and-gold garden blossoms.
- **fence-straight**: Stout oak field fence with shaped caps, two rails and crossed timber braces.
- **fence-corner**: Matching right-angle oak field fence with capped posts and diagonal braces.
- **stone-bridge**: Exactly six-metre flat-deck crossing with warm voussoir arches below and low stone parapets.
- **dock-segment**: Three-metre square flat timber river dock with pegged planks, fenders and mooring bollards.
- **statue-gardener-warden**: Friendly carved gardener guardian in a broad straw hat, holding a spade and young sprout.

## Verification

- `reports/glb_validation.md` and `.json`: decoded binary geometry, triangle and size budgets, vertex colors, normal values, materials, origins, grid footprints, matching manifest measurements, source headers and all 81 preview PNGs.
- `reports/khronos-validation.json`: official Khronos glTF Validator results for all 27 GLBs, with zero errors and zero warnings.
- `reports/blender-roundtrip.json`: all 27 delivered GLBs imported in Blender and checked for triangle counts, dimensions and ground alignment.
- `reports/clean-source-rebuild.json`: all 27 GLBs re-exported from their editable sources and compared byte-for-byte with the delivered files.
- `scripts/test_check_glbs.py`: regression tests for valid and malformed inputs, including quantized normals and compressed Blender headers.
- These checks do not certify target-engine rendering, collision, navmesh, interiors, watertight topology or gameplay behavior. Those require project integration and testing.

## Rebuild and edit

Requirements: Blender 4.3 or compatible, Python 3, Pillow for contact sheets, and zstandard for reading compressed Blender headers. The optional official validator uses Node.js and the `gltf-validator` package.

Run commands from this folder:

```sh
# Re-export all existing editable sources, without rendering.
./scripts/rebuild.sh --no-renders

# Re-export and render one source after editing it in Blender.
./scripts/rebuild.sh --only bakery

# Re-export and render everything, preserving the editable sources.
./scripts/rebuild.sh

# Regenerate procedural geometry only when you intend to replace source edits.
./scripts/rebuild.sh --regenerate

# Finish missing previews only; does not re-export GLBs or save sources.
blender -b -t 4 --python-exit-code 1 --python scripts/resume_renders.py

# Validate the delivered package and run checker tests.
python3 scripts/check_glbs.py .
python3 scripts/test_check_glbs.py

# Optional independent official glTF validation and Blender import check.
node scripts/check_khronos.cjs .
blender -b -t 4 --python-exit-code 1 --python scripts/roundtrip_glbs.py

# Refresh review sheets and this inventory.
python3 scripts/make_contact_sheets.py .
python3 scripts/write_readme.py .
```

Sources remain separated into named architectural parts for editing. Export joins a working copy into a compact mesh. Full re-rendering uses a higher-sample default than the fast completion script; delivered proof images may show light sampling grain.

## Reference material

`references/` preserves the supplied visual references and the existing character cast used only to stage the square. Reference imagery is not a texture atlas or runtime dependency of the kit GLBs. Its inclusion does not grant any third-party intellectual-property license.
