# The pump refusal choice overlaps the dialogue log button

Priority: P2, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Pressed E at the pump choice, then chose Leave it in its crate.

The lower choice button intersects L Log at the bottom right. The click at the choice centre still works, but the button boundaries conflict.

Expected: Chapter 27 quest 4 requires an unambiguous choice. Both the choice and log should have independent hit areas.

## Reproduction and limits

One choice presentation. The supplied journal contains its real click and subsequent lid-back-on confirmation.

Replay the actions at the numbered pictures in `.artifacts/playtest-1/journal.jsonl`. This finding still needs a short isolated recording before a builder fixes it.

## Pictures

- `.artifacts/playtest-1/054-crate.png`

State: fixed. Fixed on `act1-camera`: a line with choices keeps the row of key cues under them (`src/game/views/ui-talk.view.ts`). Check: `tools/play/scenarios/pump-choice.json`, whose `clean` failed without the fix ("Leave it in its crate" overlaps L Log) and passes with it.
