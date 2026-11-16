# The Hall door hides the hero inside the Hall

Priority: P1, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Walked through the opened door and toward the sleeping Custodian using W, D and S.

The foreground door arch and stone hide the hero completely in several positions. I interacted with the wrong landmark while trying to find the plinth.

Expected: Chapter 27 quest 3 asks the player to walk into the Hall and turn the key in the beast. The hero and route must remain legible.

## Reproduction and limits

Observed repeatedly while entering and returning to the fox in one first-night route. No independent full-route replay yet.

Replay the actions at the numbered pictures in `.artifacts/playtest-1/journal.jsonl`. This finding still needs a short isolated recording before a builder fixes it.

## Pictures

- `.artifacts/playtest-1/038-custodian.png`
- `.artifacts/playtest-1/040-across-hall.png`
- `.artifacts/playtest-1/045-return-fox.png`
- `.artifacts/playtest-1/046-fox-hand.png`

State: fixed. Fixed on `act1-camera` by the camera's sight rule: the Hall's walls (blocks) and its door (a landmark) are cut in a soft hole between the camera and the hero. Check: `bun tools/play-sight.mjs places` ("the Hall of the Shut Door", six spots through the door, the court and the plinth); it failed before the fix at `hall.door` (hidden by the hall door landmark).
