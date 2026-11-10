# Astra prop study

49 deterministic builders, each returning one merged BufferGeometry with linear vertex colors. Coordinates use meters, y up, and ground at y = 0. The front of town props faces +z. `catalog` in `props.ts` lists every variant and budget. Dispose returned geometry when no longer needed.

`instances.ts` batches placements into an InstancedMesh. Low quality disables cast shadows; medium and high retain them. The caller owns geometry and material. Dispose the returned mesh separately. No frame loop or allocations per frame are needed for static props.

## Verification

Run from the repository root:

```sh
bunx tsc --ignoreConfig --noEmit --strict --skipLibCheck --types bun --moduleResolution bundler --module esnext --target es2022 --allowImportingTsExtensions experiments/props-astra/demo/main.ts experiments/props-astra/check.ts
bun experiments/props-astra/check.ts
bunx --bun vite build experiments/props-astra/demo --base ./ --outDir ../../../.artifacts/props-astra/dist --emptyOutDir
bun experiments/props-astra/serve.mjs .artifacts/props-astra/dist 5317
bun tools/shot.mjs 'http://[::1]:5317/?sheet=1' .artifacts/props-astra/sheet.png --w 1920 --h 1400 --wait 4000
bun tools/shot.mjs 'http://[::1]:5317/' .artifacts/props-astra/village.png --w 1440 --h 900 --wait 4000
```

Stop the server with `kill` and the PID it prints. The local server uses IPv6 localhost because an unrelated server already owns 127.0.0.1:5317. Build output stays under the allowed artifact folder. TypeScript 7 requires `--ignoreConfig` for the brief's file-based command. The extra `--types bun` checks the geometry audit script too.

Inspect both screenshots. The contact sheet fits each object separately, so it compares silhouette and craft rather than world size. Village placement uses actual meter scale. One directional sun casts shadows, with hemisphere fill. No textures, imported models, or other runtime libraries.

## Result

PASS on the five checks. Type check exits 0. Vite builds successfully, with its standard bundle-size warning for Three.js. Both screenshot commands report `no console errors`. The sheet includes every variant with a name and triangle count. All 49 builders pass their budget and geometry checks.

The weakest prop is the grass tuft: its narrow triangular blades look sharper and less rounded than the rest of the set. The palette and materials still read as one game. The tree and bush variants could support further silhouette refinement, but all requested variants are present.
