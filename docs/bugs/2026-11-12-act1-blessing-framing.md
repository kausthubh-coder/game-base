# The blessing inspects the Mark across a screen of trees

Priority: P2, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Walked toward the blessing trigger and watched Aldric then the Green Mother.

The party stands left of the grant stone while the hero stays on the far right among trees and rocks, partly off screen as the camera pushes. An objective beam stays through the stone.

Expected: Chapter 22 scene 16 is a close meeting where the hero removes the glove and the Mother looks at the Mark. Show both sides of that exchange.

## Reproduction and limits

One scene with two reviewed caption moments. Reached with skipTo(blessing), then real movement.

Replay the actions at the numbered pictures in `.artifacts/playtest-1/journal.jsonl`. This finding still needs a short isolated recording before a builder fixes it.

## Pictures

- `.artifacts/playtest-1/051-path-south.png`
- `.artifacts/playtest-1/052-blessing-view.png`

State: fixed. Fixed on `act1-camera`. Scene 16 is staged east of the grant stone, the hero on a mark facing the Green Mother, a crowd either side and the novices' crate set down beside her as the line says so; a stand-in whom something solid hides steps aside. Check: scene 16 in `bun tools/play-sight.mjs scenes`; it failed before (Aldric and Tamsin hidden by the stone).
