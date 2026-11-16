# Copper return walks to Dax's old position

The coordinator's full copper replay finished both visitor fights, then timed out on Talk to Dax while Stock the larder showed. Its raw checkpoint remains `.artifacts/bench-copper-review/input/last-earned-checkpoint.save.json`, SHA256 `9865912499b1f6d8dd5c4ac1ca2ee0f05cb2d363b7bfea6ccac5a9a6df0a30fa`.

A reduced real-input reproduction imports that checkpoint, restores watch, assigns yard and restores watch again. The old single-position walk fails on the last transition. In `stale-repro/replay.json` under `.artifacts/copper-return-recovery`, Dax moves from x -22.095, z -236.095 to x -22.5, z -240.5 while the hero walks to the earlier position. The hero ends at x -22.008, z -235.887. Waiting there does not bring Dax back. The checkpoint's first watch restoration succeeds, so the original failure depends on movement timing rather than a permanently broken resident panel.

The runner now checks the ordinary prompt after each navigated walk and samples Dax again if he moved. It uses the same keys and resident panel, with no job/flag writes or timeout increase. An intermediate short-leg approach failed because its constructed waypoint lay in an obstacle; `follow-recovery` preserves that failed experiment. Full navigation to the sampled actor position avoids inventing intermediate destinations.

Regression command:

```sh
PLAY_PORT=5559 bun tools/play-bench-copper.mjs --recover-dax --save .artifacts/bench-copper-review/input/last-earned-checkpoint.save.json --out <empty-directory>
```

This diagnostic checks watch, yard and watch through real input. Complete acceptance still requires the default fresh route and strict raw audit; the diagnostic is not a substitute.
