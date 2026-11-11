#!/usr/bin/env python3
"""Regenerate the kit inventory and usage notes from the delivery manifest."""
import json
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
records = json.loads((root / 'manifest.json').read_text())
total_tris = sum(r['triangles'] for r in records)
total_bytes = sum(r['bytes'] for r in records)
lines = ['# Hollowmere town kit', '',
         'An original stylized riverside town kit with warm plaster, carved timber, teal roofs, harvest details and lanterns.', '',
         '## Start here', '',
         '- Import individual assets from `models/` into a glTF 2.0-compatible engine or DCC.',
         '- Open `sources/mock-town-square.blend` in Blender 4.3 or later to inspect the assembled dusk scene.',
         '- See `renders/mock-town-square-dusk.png` and `renders/town-square-close-dusk.png` for the completed square.',
         '- Use the architecture, street and night contact sheets in `renders/` for quick visual review.', '',
         '## Delivery', '',
         f'- {len(records)} static GLBs: 3 landmarks, 9 buildings and 15 street props.',
         '- 27 editable per-asset Blender sources, plus the assembled town-square source.',
         '- 81 per-asset PNG proofs: front, three-quarter and night at 640 × 640.',
         '- Dusk square: 1000 × 750; closer square view: 900 × 675.',
         '- Labeled architecture, street and night contact sheets, plus a side-by-side reference comparison.',
         '- JSON manifest, binary validation reports and reproducible source/export scripts.',
         f'- Unique kit geometry totals {total_tris:,} triangles and {total_bytes:,} GLB bytes. The assembled scene uses repeated instances and additional stage geometry.', '',
         '## Units, pivots and materials', '',
         '- Units are metres. GLBs are Y-up, with their architectural front toward +Z. Blender sources are Z-up, front −Y.',
         '- Each GLB contains one merged mesh with baked identity transforms. Its origin is centered across X/Z at ground level.',
         '- Manifest footprints are integer-metre placement cells in X/Z, including decorative overhangs. They are not collision bounds.',
         '- `Body` uses opaque vertex colors with a white base-color multiplier. Preserve `COLOR_0` on import.',
         '- `Glow`, where present, is an opaque warm emissive material. Some unlit props only need `Body`.',
         '- Normals are signed normalized bytes through the required standard `KHR_mesh_quantization` extension. Positions remain float32.',
         '- Emission strength uses `KHR_materials_emissive_strength`. Use a compatible loader, or re-export the editable sources for a loader that lacks these extensions.',
         '- No texture images, Draco, meshopt, animation, skeletons, cameras or lights are embedded in the individual kit GLBs.',
         '- Preview lights, ground, landscaping, paving, river and the supplied character cast are stage-only. They are not included in the individual GLB budgets.',
         '- Engine bloom and scene lights must be configured separately. Emissive surfaces do not automatically produce the same lighting in every engine.', '',
         '## Per-model inventory', '',
         'Triangle counts and sizes below are measured from the delivered GLBs. Footprint is X × Z; dimensions are X × Y × Z in metres. Bytes are decimal, with a strict limit of less than 400,000 per asset.', '',
         '| Asset | Category | Triangles | Bytes | Grid footprint (m) | Dimensions (m) | Materials |',
         '|---|---|---:|---:|---|---|---|']
for r in records:
    dims = ' × '.join(f'{d:.3f}' for d in r['dimensions'])
    foot = ' × '.join(str(v) for v in r['footprint'])
    lines.append(f"| {r['name']} | {r['category']} | {r['triangles']:,} | {r['bytes']:,} | {foot} | {dims} | {', '.join(r['materials'])} |")
lines += ['', '## Asset descriptions', '']
lines += [f"- **{r['name']}**: {r['description']}" for r in records]
lines += ['', '## Verification', '',
          '- `reports/glb_validation.md` and `.json`: decoded binary geometry, triangle and size budgets, vertex colors, normal values, materials, origins, grid footprints, matching manifest measurements, source headers and all 81 preview PNGs.',
          '- `reports/khronos-validation.json`: official Khronos glTF Validator results for all 27 GLBs, with zero errors and zero warnings.',
          '- `reports/blender-roundtrip.json`: all 27 delivered GLBs imported in Blender and checked for triangle counts, dimensions and ground alignment.',
          '- `reports/clean-source-rebuild.json`: all 27 GLBs re-exported from their editable sources and compared byte-for-byte with the delivered files.',
          '- `scripts/test_check_glbs.py`: regression tests for valid and malformed inputs, including quantized normals and compressed Blender headers.',
          '- These checks do not certify target-engine rendering, collision, navmesh, interiors, watertight topology or gameplay behavior. Those require project integration and testing.', '',
          '## Rebuild and edit', '',
          'Requirements: Blender 4.3 or compatible, Python 3, Pillow for contact sheets, and zstandard for reading compressed Blender headers. The optional official validator uses Node.js and the `gltf-validator` package.', '',
          'Run commands from this folder:', '',
          '```sh',
          '# Re-export all existing editable sources, without rendering.',
          './scripts/rebuild.sh --no-renders', '',
          '# Re-export and render one source after editing it in Blender.',
          './scripts/rebuild.sh --only bakery', '',
          '# Re-export and render everything, preserving the editable sources.',
          './scripts/rebuild.sh', '',
          '# Regenerate procedural geometry only when you intend to replace source edits.',
          './scripts/rebuild.sh --regenerate', '',
          '# Finish missing previews only; does not re-export GLBs or save sources.',
          'blender -b -t 4 --python-exit-code 1 --python scripts/resume_renders.py', '',
          '# Validate the delivered package and run checker tests.',
          'python3 scripts/check_glbs.py .',
          'python3 scripts/test_check_glbs.py', '',
          '# Optional independent official glTF validation and Blender import check.',
          'node scripts/check_khronos.cjs .',
          'blender -b -t 4 --python-exit-code 1 --python scripts/roundtrip_glbs.py', '',
          '# Refresh review sheets and this inventory.',
          'python3 scripts/make_contact_sheets.py .',
          'python3 scripts/write_readme.py .',
          '```', '',
          'Sources remain separated into named architectural parts for editing. Export joins a working copy into a compact mesh. Full re-rendering uses a higher-sample default than the fast completion script; delivered proof images may show light sampling grain.', '',
          '## Reference material', '',
          '`references/` preserves the supplied visual references and the existing character cast used only to stage the square. Reference imagery is not a texture atlas or runtime dependency of the kit GLBs. Its inclusion does not grant any third-party intellectual-property license.', '']
(root / 'README.md').write_text('\n'.join(lines))
print('README.md written')
