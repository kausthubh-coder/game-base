# Hall threshold stone crosses the walking floor

The first-half Act 1 beta sight check found the hero hidden at `hall.door`, even after the door opened. The earlier Hall occlusion fix in `2026-11-12-act1-hall-occlusion.md` covered the large foreground arch. This failure was stone immediately around the hero, which the sight rule deliberately preserves.

The preserved capture is `.artifacts/first-half-beta-release/hall-ray.json`. Seed 7 places the hero at `(-16.5, 22, -254.5)` and the Hall model at `(-16.5, 22, -252.5)`. Three camera rays hit the lower frame at local heights about 0.91 to 1.35. The circular opening started 1.3 above the floor. The model's four raised steps also crossed the walking floor, because model geometry does not supply a stair surface.

Run the source regression with:

```sh
bun test src/features/props/builders/hall-threshold.test.ts
```

Before the fix, all four tests failed. Both geometry detail levels reproduced the captured three protected hits and failed the floor-level opening check. Lowering only the steps still left all four tests failing. Logs are in `.artifacts/hall-threshold/red.log` and `level-floor-only.log`.

The fix removes the five bottom frame wedges across the passage and replaces the unsupported stair stack with a flush stone threshold. The upper and side arcs retain their original stone angles, roots and materials. The circular door leaves, caller floor and sight rule stay unchanged. The frame now admits a 2.5-wide by 2.5-high floor-level passage.

The regression uses the captured camera at the actual Hall doorway and the unchanged `SightRule`. It also casts through the physical opening with double-sided material. Both checks pass at full and low geometry detail. `bun test src/features/props` and `bun tools/typecheck.mjs props` pass. Browser acceptance against a fresh build remains the coordinator's release gate.
