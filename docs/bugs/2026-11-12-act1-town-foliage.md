# Foreground leaves hide the town and Maren

Priority: P1, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Jumped to count, entered town and then town.granary; pressed E and advanced Maren with real keys.

The screen is almost entirely opaque leaves. The street, hero, queen and sack cannot be seen while her portrait and dialogue remain visible.

Expected: Chapter 27 quest 9 and chapter 22 scene 22 introduce Maren asleep on a sack in the granary. The camera must show that meeting and the approach.

## Reproduction and limits

Original town route and independent clean checkpoint replay: 2/2. Both show opaque leaves throughout Maren's dialogue.

```sh
bun tools/play.mjs replay docs/bugs/2026-11-12-act1-town-foliage.json
```

This recording reaches the scene. Visibility is a manual visual judgment; it has no automatic pixel assertion.

## Pictures

- `.artifacts/playtest-1/067-town.png`
- `.artifacts/playtest-1/068-queen.png`
- `.artifacts/playtest-1/069-queen-end.png`
- `.artifacts/playtest-1/town-repro.png`

State: fixed. Fixed on `act1-camera`. The camera's sight rule (`src/features/camera/sight.sim.ts`, cut by `paintSee` in `src/features/painted/paint.ts`) fades tree crowns near the lens and cuts a soft hole in anything between the camera and the hero, the person speaking or a beast; the granary's roof lifts while the hero is inside it. Check: `bun tools/play-sight.mjs places` ("the queen in the granary") and scene 22 in `bun tools/play-sight.mjs scenes`; both failed before the fix (the great oak hid the hero and Maren).
