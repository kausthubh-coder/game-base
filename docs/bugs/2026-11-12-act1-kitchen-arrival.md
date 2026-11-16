# Hobb and Dax speak before the camera can show them

Priority: P2, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

From plot, walked south then east toward the kitchen quest marker. Advanced their arrival dialogue with E.

Dialogue starts with the marker still 12 blocks away. Only the hero, grass and objective beam are visible; Hobb, Dax and their crate are absent from the shot. They are visible back by camp after skipping to bench.

Expected: Chapter 22 scene 18 shows Hobb arriving with Dax carrying a large crate and assessing the tent and pot. Keep the speakers and props in the dialogue shot.

## Reproduction and limits

Original route and fresh checkpoint replay: 2/2. Both start dialogue before the speakers are visible. Natural arrival after constructing the kitchen prerequisites was not reached.

```sh
bun tools/play.mjs replay docs/bugs/2026-11-12-act1-kitchen-arrival.json
```

This recording reaches the scene. Visibility is a manual visual judgment; it has no automatic pixel assertion.

## Pictures

- `.artifacts/playtest-1/057-gate.png`
- `.artifacts/playtest-1/058-kitchen-plan.png`

State: fixed. Fixed on `act1-camera`. A scene that starts with its people out of reach stands the hero beside them on a clear mark and cuts there, so the first line already frames everyone who speaks (`src/game/views/story-stage.view.ts`). Check: scene 18 in `bun tools/play-sight.mjs scenes`, which arrives 11.5 blocks off as a player does; it failed before (the hero off the bottom of the frame while Hobb spoke).
