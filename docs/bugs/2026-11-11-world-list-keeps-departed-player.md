# The world list can keep a player after everyone leaves

Found on 2026-11-11 while testing signed-in multiplayer at `85295d1`. Fixed the same day: every card now
says when it was made (`sentAt`), and Convex drops one made before the card it holds. A test in
`convex/http.test.ts` posts the two cards in the wrong order.

## What happened

Ada and Bo signed in through Clerk, joined a world through the Account panel's invite, walked, built,
and used the conversation, workbench and chest. Both pages then navigated to `about:blank`.

The world server had no players or sockets and stopped stepping. Convex's `worlds.list` still named Bo
in `playersNow`. The check kept reading that card for 20 seconds, then failed. The world list should
show an empty world after both players leave.

This happened in 1 of the latest 3 complete default runs. `trial2` and `trial3` passed all ten points.
`trial4` passed points 1 through 9 and failed the empty-card assertion in point 10. An earlier run,
`final1`, hit the same assertion, before the last corrections to the browser check.

## Evidence

All paths below are relative to this checkout, under the ignored `.artifacts/signed-in/` folder.

- `trial4/leave-card.json` shows `playersNow` containing Bo.
- `trial4/leave-server.json` shows `sockets: 0`, `stepping: false`, and `loaded: false`.
- `trial4/report.json` holds the assertion failure. Screenshots and page state at each gameplay
  checkpoint show that both players had joined correctly before leaving.

The exact world in that run was `jn77cvxptjxz7ejbhaq39fhe858j03wt`. The test removed it afterward,
including its invites and members. It left the Clerk test users in place.

## Replay

```
bun tools/play-together-signed-in.mjs --out .artifacts/signed-in/presence-replay
```

Use the development keys in `.env.local`. The check starts its own server with dev tokens off,
signs three users in through Clerk, and cleans up its world even if the empty-card assertion fails.
The default replay depends on the order in which the two leave posts reach Convex.

## Cause

`server/world.ts` sends a card after each departure without waiting for the previous post to finish.
`convex/worlds.ts` takes the maximum `lastPlayedAt` but replaces `playersNow` even when the incoming
card is older. An older one-player card arriving after the empty card can therefore restore a departed
player to the list. The world is asleep, so no periodic card is due to correct it.

## Controlled replay

```
bun tools/play-together-signed-in.mjs --reorder-cards --out .artifacts/signed-in/reordered
```

Reproduced in 1 of 1 controlled runs. The proxy changes only network ordering. It forwards real
world-server card posts to dev Convex with the original authentication. When both pages leave, it
holds the one-player post until the empty post completes, then forwards the older post. The test
waits until both posts finish before reading Convex.

The run passed all gameplay checks, then printed:

```
FAIL 10 Leave, verify empty, remove world and invites: Error: Timed out: empty Convex card
ISSUES: 9/10 points passed
```

`reordered/leave-card.json` names Bo. `reordered/leave-server.json` has no sockets and no running world.
`reordered/server.log` records both departures and the world going to sleep. The test still removed
the world and its invites. The controlled result confirms that accepting an older card can cause the
stale presence. It does not establish the network order of the earlier uncontrolled failures.
