# A card post that fails is never sent again, so the world list stays wrong

Found on 2026-11-11 by the model checker on `docs/verify/world-join/WorldJoin.tla` with `WorldJoinLostPost.cfg`,
at `b14c865`, and played again on the real `server/world.ts` by `server/test/world-model.test.ts`. Not fixed.

## The rule and the harm

`CardMatchesTheWorld`: once nothing is left on its way, the world list shows exactly who is in the world.

When a card's post fails, the list stays as the card before it left it:

- A failed card while the world steps: the list hides a player who is there, or names one who has left, for
  up to 5 minutes, until the next card.
- A failed card as the world goes to sleep: the list names the last players as playing now, for good. A
  sleeping world sends nothing more.

## The shortest path

1. Ada opens the game, and her tab opens a socket to the world.
2. The hello arrives, and Convex lets her in. The card that names her goes out.
3. The post fails: Convex is down, slow past the 5-second limit, or answers with an error.

Ada plays, and the list shows nobody in the world.

The path to the lasting harm, also played in the test: Ada plays and her card reaches Convex, she closes
the tab, the close arrives, the world sleeps and posts the empty card, and that post fails.

## Cause

`postCard()` in `server/gate.ts` catches every failure, logs it and returns. `world.ts` hands the post to
`ctx.waitUntil()` and never looks at the result, so a failed card is not sent again.

## See it

```
bun test server/test/world-model.test.ts
```

The test `when a card fails on its way, the world list still comes to show who is in the world` is marked
`.failing`. Take the mark off and run it again: it fails with
`CardMatchesTheWorld: the world list shows [] and the world holds [a]`. The fix is to remove the mark.

The model's path: check `WorldJoin.tla` with `WorldJoinLostPost.cfg` and `view.ts` from `docs/verify/world-join`
with the `/statechart` skill (the `verify-world-join` skill has the steps).

## Toward a fix

Not done here. Sending the card again until Convex takes it closes both cases, as long as the object stays
in memory to send it. A card that holds for a time in Convex would also close
`2026-11-11-world-list-keeps-player-after-restart.md`.
