# The first ditch objective omits the path to its tool

Priority: P2, hurts the experience. Tested Act 1 build 57bc71f, seed 7, Chrome ANGLE Metal on Apple M4, 1366x768. No game code changed.

## What happened

Read tracker and quest log at the pond. Tried clicking ground and E, then inspected Bag and By hand. Tried the axe on the tree beside the pond.

Tracker says dig a ditch and the log only describes green ground. The bag has an axe. I eventually found the spade recipe, but the nearby tree answers This belongs to the town. No visible hint teaches the log-to-plank-to-spade chain.

Expected: Chapter 27 quest 2 teaches water flow before camp. A new player needs enough instructions to start that task. This is a guidance issue, not a claim that crafting is impossible.

## Reproduction and limits

One new-player attempt. No spade entitlement bug is refiled: the earlier grant-day report already notes the missing spade.

Replay the actions at the numbered pictures in `.artifacts/playtest-1/journal.jsonl`. This finding still needs a short isolated recording before a builder fixes it.

## Pictures

- `.artifacts/playtest-1/023-pond.png`
- `.artifacts/playtest-1/024-ditch-help.png`
- `.artifacts/playtest-1/026-chop.png`
- `.artifacts/playtest-1/027-ditch-log.png`

State: open.
