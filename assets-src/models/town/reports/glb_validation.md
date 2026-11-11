# Hollowmere binary export validation

Generated: 2026-11-10T19:16:24.406013+00:00

**Result: PASS**. 27 / 27 assets passed.

All measurements below are read from delivered GLB bytes, not copied from Blender statistics.

| Asset | Category | Triangles | GLB bytes | Dimensions X/Y/Z (m) | Grid X/Z (m) | Result |
|---|---|---:|---:|---|---|---|
| granary-hall | landmark | 7714 | 359072 | 13.950 / 13.120 / 10.070 | 14 / 12 | PASS |
| rootworks-gate | landmark | 5312 | 236936 | 10.943 / 7.490 / 5.900 | 12 / 8 | PASS |
| town-well | landmark | 2800 | 122824 | 4.090 / 5.120 / 3.740 | 6 / 6 | PASS |
| bakery | building | 2893 | 140248 | 8.770 / 6.327 / 6.615 | 10 / 8 | PASS |
| lodge | building | 3923 | 187456 | 11.540 / 8.767 / 8.925 | 12 / 10 | PASS |
| workshop | building | 2629 | 125644 | 9.050 / 6.426 / 5.980 | 10 / 8 | PASS |
| kennel | building | 3031 | 146564 | 9.060 / 6.167 / 6.690 | 10 / 8 | PASS |
| ferry-house | building | 3507 | 167800 | 8.775 / 6.316 / 9.045 | 10 / 10 | PASS |
| house-a | building | 2463 | 121684 | 5.750 / 5.176 / 5.050 | 7 / 6 | PASS |
| house-b | building | 3603 | 173936 | 7.940 / 6.506 / 6.750 | 9 / 8 | PASS |
| house-c | building | 3294 | 159272 | 8.550 / 5.686 / 6.200 | 10 / 7 | PASS |
| house-d | building | 3255 | 160008 | 6.920 / 8.697 / 6.840 | 8 / 8 | PASS |
| market-stall-a | street | 684 | 32592 | 2.650 / 2.511 / 1.895 | 3 / 3 | PASS |
| market-stall-b | street | 684 | 34872 | 2.650 / 2.511 / 1.895 | 3 / 3 | PASS |
| cart | street | 660 | 30496 | 2.200 / 1.565 / 2.930 | 3 / 4 | PASS |
| barrels-crates | street | 552 | 26540 | 2.341 / 1.422 / 1.365 | 3 / 2 | PASS |
| bench | street | 512 | 24444 | 2.340 / 1.280 / 1.009 | 3 / 2 | PASS |
| signpost | street | 400 | 19740 | 2.450 / 2.570 / 0.813 | 3 / 2 | PASS |
| lamp-post | street | 652 | 31580 | 2.385 / 2.780 / 0.600 | 3 / 2 | PASS |
| string-lights | street | 754 | 36132 | 5.783 / 3.090 / 0.277 | 6 / 2 | PASS |
| banner-pole | street | 352 | 19072 | 1.715 / 3.275 / 0.680 | 2 / 2 | PASS |
| flower-planter | street | 728 | 40144 | 2.520 / 1.408 / 1.237 | 3 / 2 | PASS |
| fence-straight | street | 308 | 15684 | 2.976 / 1.320 / 0.427 | 3 / 1 | PASS |
| fence-corner | street | 336 | 17048 | 2.976 / 1.320 / 2.976 | 3 / 3 | PASS |
| stone-bridge | street | 692 | 31876 | 6.000 / 1.380 / 2.980 | 6 / 3 | PASS |
| dock-segment | street | 728 | 34260 | 2.986 / 0.830 / 3.000 | 3 / 3 | PASS |
| statue-gardener-warden | street | 768 | 36716 | 1.720 / 2.480 / 1.720 | 3 / 3 | PASS |

## Checks

- GLB v2 header, chunks, embedded buffer, accessor ranges/strides, indices and finite numeric values.
- One merged mesh; one mesh instance; baked identity transforms; glTF Y up; ground pivot and X/Z centering.
- Indexed triangles within 8,000 landmark / 4,000 building / 800 street limits and manifest budgets.
- GLB strictly below 400,000 bytes; dimensions/triangles/bytes agree with manifest; integer grid footprint contains bounds.
- Body uses white base factor and nonblack COLOR_0; optional Glow is emissive; all material and vertex alpha opaque.
- No textures/images, Draco/meshopt compression, lights, cameras, animation, or skinning.
- Signed normalized normals require declared KHR_mesh_quantization; decoded normals are checked for unit length.
- Source .blend presence and header; render PNG presence, dimensions, chunk integrity and CRCs.

## Scope

This independent validator does not replace the complete Khronos glTF Validator or visual review. It does not prove artistic quality, engine appearance, mesh manifoldness, or that a Blender source opens; source verification here reads the Blender header through uncompressed, gzip or Zstandard storage. glTF Y-up orientation and intended front direction still require visual review.
