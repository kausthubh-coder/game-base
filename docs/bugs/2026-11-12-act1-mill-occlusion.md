# The old mill waterwheel hides the gearling fight

Priority: P1, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

At quest pump, went to ruin-mill, tried F, Space, walking away and F again.

The wheel covers the gearling body and ground around it. Only its name and guard bar show through. Moving left reveals the hero but the enemy remains behind the wheel.

Expected: Chapter 27 quest 11 requires reading its charge, reaching its back and striking. The enemy and attack area must be visible.

## Reproduction and limits

Original encounter plus independent fresh checkpoint replay: 2/2. Several positions and a reviewed motion sheet. Gear was not earned naturally because earlier quests were skipped.

```sh
bun tools/play.mjs replay docs/bugs/2026-11-12-act1-mill-occlusion.json
```

This recording reaches the scene. Visibility is a manual visual judgment; it has no automatic pixel assertion.

## Pictures

- `.artifacts/playtest-1/076-echo-finish.png`
- `.artifacts/playtest-1/077-gearling-fight.png`
- `.artifacts/playtest-1/078-mill-fight-open.png`

State: fixed. Fixed on `act1-camera` by the camera's sight rule: each beast of a running fight is kept in sight, so the wheel is cut in front of the gearling. Check: `bun tools/play-sight.mjs places` ("the gearling at the old mill"); it failed before the fix (hidden by `landmarks: oldMill`).

Fresh replay picture: `.artifacts/playtest-1/mill-repro.png`.
