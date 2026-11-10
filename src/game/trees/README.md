# Trees

`index.sim.ts` owns tree identity, protection and felling state. `treesInArea` in the terrain module reproduces the region plan and the existing wild-tree seed distribution. Terrain stamps two invisible barrier cells at each root; it stamps no tree logs or leaves. World canopy queries provide shade while that root stands.

Each tree has a position, species, variant, size, standing state and box. `all()` returns the neighborhood around the hero. `at()` resolves roots first, then crown boxes. The shell ray-tests the boxes and reports the root as the stable action target. Reach is measured against the box. Actions supplies the existing hold meter and delegates completed felling here.

Felling clears the barriers, gives at least three logs plus fiber, and emits the existing `block.broken` and `tree.felled` events. The kernel save records felled root identities; the world save records cleared barriers. A fresh game regenerates both. Oaks within twelve blocks of the mossy-rock landmark stay protected.

`world-trees.view.ts` loads the scripted GLBs and draws one instanced batch per variant. It draws trees within 48 blocks, sways leaf vertices, and tips and dithers away felled trees. Scattered rocks use the same view's two rock batches. The optional `models=1` view remains a separate design fixture.

Rebuild with `bun tools/models/build.mjs`. Check rules with `bun test src/game/trees src/game/play/act1.test.ts`, then run the repository checks and browser scripts. `bun tools/trees-shots.mjs` captures the approved comparison positions from the build served on 5364. Its felling fixture advances the real action rules directly to freeze the chopping and falling stages; `play-act1.mjs` separately proves chopping through the real mouse button.
