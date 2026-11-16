# The grey wood checkpoint does not start its forest encounter

Priority: P1 for checkpoint coverage; blocks the tested route. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Used newGame, skipTo(greywood), teleport(boar), waited, walked near the map quest marker and pressed E.

No Wren, boar or grey fox encounter appears. The tracker stays Follow your fox north to the forest. The fresh replay cannot see Meet Wren after waiting and E.

Expected: The authorized skip must let later coverage continue. Chapter 27 quest 6 expects the forest meeting, three foxes and the denied boar calm.

## Reproduction and limits

Route attempt plus independent fresh replay: 2/2. This proves a debug-checkpoint limitation, NOT that a naturally completed kitchen cannot advance. Heartstone stayed 1 after skip, so the setup is incomplete.

```sh
bun tools/sim.ts scenarios greywood-arrival
```

## Pictures

- `.artifacts/playtest-1/063-wren.png`
- `.artifacts/playtest-1/greywood-repro.png`

State: fixed. It was the game, not the checkpoint: the grey wood's first step was a stub done only by `step.greywood.follow`, which nothing set, so no player could reach Wren. It is now done by coming within 12 blocks of the boar's place (`src/game/content/quests.ts`). Check: `bun tools/sim.ts scenarios greywood-arrival`, which failed before (stuck on `greywood.follow`) and now plays Wren's meeting and opens the three foxes. The browser recording is replaced by it.
