# Blender models

Only when the brief allows model files: a `.glb` built by a Blender script in `tools/models/`, not a Shape
builder. The concept sheet and the side-by-side check of `SKILL.md` apply all the same.

- `bun tools/models/build.mjs` rebuilds every seeded GLB and its counts in the manifest. `--renders` adds front
  and three-quarter PNGs in the design's `img/options/models/` folder.
- Each model script imports `common.py` for the leaf atlas, vertex colours, export and studio. Add a seed or a
  model script to `build.mjs`, keep its origin at the base, one Blender unit a block. Blender's Z up exports to
  glTF's Y up.
- One mesh and one material a variant, so its copies take one draw call. Trees use outward normals on
  alpha-tested leaf cards, never sphere meshes. Caps: 1,500 triangles a tree, 300 a small prop.
- `public/assets/manifest.json` lists each under `models` with `file`, `seed`, `triangles`, `budget` and
  `bytes`; `bun tools/verify-assets.mjs` checks them against the real GLB (`docs/assets.md`). Add no compression
  that needs a decoder package without the brief's word.
- `src/game/views/look-models.view.ts` loads them only with `?models=1` and instances each variant. Add
  placements there for a look test; keep the region and felling rules as they are.
- Build with `bun run build --outDir dist-models`, serve it on your port, and compare matching shots with and
  without `?models=1` at high, then low and medium. Read `window.__game.counters()` once it settles.
- Run `bun run check`, `bun tools/verify-assets.mjs` and `bun tools/play-smoke.mjs`, and open the PNGs before
  you report. Stop your own server's pid.
