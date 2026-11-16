The earned western caves approach starts fight 8 with its rooted foe at (220.5, -301.5), on an unreachable rock pad. Navigation returns null to that point. The full-size red picture also shows the foe behind the cave rock. A rooted foe cannot walk toward the hero to resolve this placement.

Replay the focused diagnostic with `bun test src/game/fights/gallery-route.test.ts`. It restores the unchanged accepted uphill save, stages the approach separately from earned browser play, and checks a real navigation route to the spawned foe. The original failure is retained in `.artifacts/gallery-input/actual-spawn-red.log`.

The fight now checks the den for a rooted foe using the existing navigation system. If the nominal den cannot be reached, it selects the closest traversable point on the returned approach that is still inside the arena and open in the fight grid. No model, terrain, weapon, reward or encounter balance changes.

The first connected-grid experiment did not fix the actual route and was removed. Its diagnostic remains separate in `.artifacts/gallery-input/`. The passing focused test and earned browser evidence must both be reviewed; the test alone does not establish Gallery completion or visual acceptance.
