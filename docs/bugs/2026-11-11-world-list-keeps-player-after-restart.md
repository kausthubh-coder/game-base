# The world list keeps a player after the world server restarts

Found on 2026-11-11 by the model checker on `docs/verify/world-join/WorldJoin.tla` with `WorldJoinRestart.cfg`,
at `b14c865`, and played again on the real `server/world.ts` by `server/test/world-model.test.ts`. Not fixed.

## The rule and the harm

`CardMatchesTheWorld`: once nothing is left on its way, the world list shows exactly who is in the world.

Here the list shows Ada playing now in a world that is empty and asleep. It stays that way until someone
next enters that world, which may be never.

## The shortest path

1. Ada opens the game, and her tab opens a socket to the world.
2. She shuts her laptop before her hello is handled. No close reaches the server.
3. The hello arrives. Convex lets her in, and the card that names her goes out.
4. The world server restarts: a deploy or a crash.
5. The card reaches Convex.

Nothing is left to happen. The world holds nobody and does not step. Convex names Ada.

The same cause has a plainer path, also played in the test: Ada plays, the card that names her is in
Convex, a deploy restarts the world, and her tab is gone before it can connect again (closed, offline, a
shut lid). Every push to `main` deploys, so every deploy is a chance.

## Cause

A restart forgets the room and every session, and nothing tells Convex. `world.ts` posts a card when a
player joins or leaves, when the world goes to sleep, and every 5 minutes while it steps. The new object
has no players, does not step and posts nothing, so the old object's last card stands. A close from a socket
the old object knew reaches the new one, where `gone()` finds no session and returns before `postCard()`.

## See it

```
bun test server/test/world-model.test.ts
```

The test `after a restart, the world list stops naming a player who has gone` is marked `.failing`. Take the
mark off and run it again: it fails with `CardMatchesTheWorld: the world list shows [a] and the world holds []`.
The fix is to remove the mark.

The model's path: check `WorldJoin.tla` with `WorldJoinRestart.cfg` and `view.ts` from `docs/verify/world-join`
with the `/statechart` skill (the `verify-world-join` skill has the steps).

## Toward a fix

Not done here. One fix may close this and `2026-11-11-world-list-keeps-player-when-a-card-fails.md`
together: a card that holds for a time. The server posts every 5 minutes while it steps already, so Convex
could show `playersNow` as empty once a world's last card is older than that and a margin. Posting a card
from `gone()` for a socket the object does not know would cover only the paths where a close arrives.
