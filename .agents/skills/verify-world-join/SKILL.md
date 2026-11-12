---
name: verify-world-join
description: Recheck joining and leaving an online world, and the world's card in the world list, against their TLA+ model. Use after changing server/world.ts, postCard or mayEnter in server/gate.ts, join or leave in server/room.ts, writeCard in convex/worlds.ts, how src/features/net/net.ts reacts to a close, or when server/test/world-model.test.ts or convex/world-card-model.test.ts fails.
---

# Verify joining a world

A player opens a tab, the socket says hello, the server checks the token and asks Convex, the player joins, and later leaves: by a closed tab, a dropped line, a second tab, silence, or a restart of the server. Each join and leave posts the world's card to Convex, which shows it in the world list. The design of all of it is `docs/verify/world-join/WorldJoin.tla`. A model checker walks every order of its events. Two tests hold the real code to that design:

- `server/test/world-model.test.ts` plays 600 random runs of 200 events on the real `WorldServer` of `server/world.ts`, and after every event compares it with `Model`, which is WorldJoin.tla's actions in TypeScript.
- `convex/world-card-model.test.ts` posts random cards in random orders to the real `writeCard` and compares the world list with the model's `Land`.

## The rules, and the harm when one breaks

| Rule in WorldJoin.tla | In plain words | The harm |
|---|---|---|
| `OneTabPlaysEachPlayer` | One player is played from one tab at a time | Two tabs steer one body, or both get its snaps |
| `NoBodyWithoutATab` | Every body in the world has a socket the server hears it through | A body stands in the world for good, and the world never sleeps and keeps costing |
| `NoTabWithoutABody` | Every welcomed session has its body, and is the one that body is played through | A player is let in and stands frozen, told nothing |
| `AwakeExactlyWhileSomeoneIsIn` | The world steps while someone is in, and only then | An empty world steps and costs money, or players freeze |
| `CardMatchesTheWorld` | Once nothing is left on its way, the world list shows exactly who is in the world | The list shows a player who left as playing now, or hides one who is there |
| `SleepsOnceEveryoneHasGone` | Once every tab is closed, the world stops stepping | A world that never sleeps |

The last is a liveness property: it says "in the end". The others hold in every state.

## Known to break

The checker found two orders of events where the code breaks `CardMatchesTheWorld`. Both are filed, and both are played on the real code by tests marked `.failing` in `world-model.test.ts`:

| Bug file | The path |
|---|---|
| `docs/bugs/2026-11-11-world-list-keeps-player-after-restart.md` | A player is let in, the server restarts, and nothing tells Convex they are gone |
| `docs/bugs/2026-11-11-world-list-keeps-player-when-a-card-fails.md` | A card post fails, and is never sent again |

The random runs skip `CardMatchesTheWorld` once a run has had a restart or a failed post. Every other rule is checked in every run. When a fix lands, its `.failing` test passes and bun reports it as a failure: remove the mark, mark the bug file fixed, and check `WorldJoinRestart.cfg` or `WorldJoinLostPost.cfg` again (below), where the rule must then hold.

## Does your change touch it

| Model action | The code it stands for |
|---|---|
| `OpenPage`, `Connect`, `ClosePage`, `Drop`, `HearClose`, `Talk` | The browser: `start()` and `ws.onclose` in `src/features/net/net.ts`. `Connect` is also `fetch()` in `server/world.ts`, which makes the session and its hello timer. `Talk` is an input on a socket the server does not know |
| `HelloArrives` | `webSocketMessage()` in `world.ts` up to `session.checking = true` |
| `Answer` | The rest of `webSocketMessage()`: `this.check()`, `gate.mayEnter()`, the `this.sessions.get(ws) !== session` check, `wake()`, the replacement of `before`, `room.join()` in `server/room.ts`, the `full` refusal, the welcome, `start()` and `postCard()` |
| `CloseArrives` | `webSocketClose()` and `webSocketError()`, then `gone()` and `sleep()` |
| `HelloTimeout` | The hello timer set in `fetch()` |
| `QuietDrop` | `dropQuiet()` in `tick()` |
| `CardTimer` | The `CARD_EVERY` line of `tick()` |
| `Restart` | A new `WorldServer` on the same storage, with the sockets still open |
| `Post`, `Land`, `Lost` | `postCard()` in `world.ts` and in `server/gate.ts`, and `writeCard` in `convex/worlds.ts` |

Last confirmed against the code at commit `b14c865`. Run `git diff b14c865 -- server/world.ts server/gate.ts server/room.ts convex/worlds.ts src/features/net/net.ts`. When that prints nothing, stop: the verification still describes the code. A change to `room.ts` outside `join` and `leave` does not touch it.

## Check a change

1. Run `bun test server/test/world-model.test.ts`. It takes about 2 seconds.
2. Run `bunx vitest run --root convex world-card-model`. It takes about 1 second.
3. Read a failure. The server test gives a seed, the rule or the difference, and the last events in words.
   - A rule's name (`NoBodyWithoutATab: …`) means the code broke that rule. That is a bug in the change.
   - `the server and the model differ` means the code and the design disagree. Decide which is right. If you meant to change the design, go to "Change the design". If not, it is a bug in the change.
   - `SleepsOnceEveryoneHasGone: …` comes from the end of a run, where every tab closes and the server gets to every event: the world still steps.
   - A count under `AT_LEAST` means the random runs stopped reaching a case. The events or their weights need another look, not the code.
   - `a short tick on a whole second …` or `that timer is not set` is the test's own driver: an event was played in a way the model cannot follow. Fix the event, not the code.
   - The Convex test gives the seed and the card that left the world list wrong: a bug in `writeCard`.
4. Run `bun docs/verify/world-join/break-code.mjs`. It breaks `world.ts`, `room.ts` and `worlds.ts` ten ways and expects the tests to catch each, in about 2 seconds. `GONE` means your change removed the text of a break: write that break again for the new code, so the tests are still shown to fail.
5. When you changed how two browsers meet in one world, also run `bun tools/play-together.mjs`. It is the only check with real sockets and a real `wrangler dev`.

Done when 1 to 4 pass, and 5 when it applies.

## Change the design

1. Change `WorldJoin.tla` first. Give every new rule as an INVARIANT, or a PROPERTY when it says "in the end", in each `.cfg` of `docs/verify/world-join`.
2. Check it with the `/statechart` skill. Give it `WorldJoin.tla`, the config and `view.ts` from `docs/verify/world-join`, and read the result with that skill: it tells each broken rule as its shortest path in plain words. Check each config:

   | Config | What it is | What must come out |
   |---|---|---|
   | `WorldJoin.cfg` | Two players, one with a second tab, three sockets, a world of one. No restart, every post lands | Every rule holds. 657,468 states, about 1 min 40 s |
   | `WorldJoinRestart.cfg` | One player with two tabs, one restart | Only `CardMatchesTheWorld` breaks, by the path in its bug file. 28,468 states, about 10 s |
   | `WorldJoinLostPost.cfg` | One player with two tabs, posts that can fail | Only `CardMatchesTheWorld` breaks, by the path in its bug file. 21,852 states, about 8 s |
   | `WorldJoinChart.cfg` | One player, one tab, one socket | Every rule holds. 48 states, small enough to draw |

   A rule that breaks anywhere else is a finding about the design: fix the design, or file it as the two above were. Never weaken the rule to make it pass. `WorldJoin.cfg` has no liveness property, to keep it to a couple of minutes: on 2026-11-11, `SleepsOnceEveryoneHasGone` held on it too, checked once with TLC on eight workers.
3. Run `bun docs/verify/world-join/break-model.mjs <a folder outside the repo>` and check each copy it writes with `/statechart`. Each must break the rule the script names for it. Add a break for each new rule.
4. Change `Model` in `world-model.test.ts` to match, and the Convex test when `Land` changed, then the code, then run "Check a change".
5. Move the commit in "Does your change touch it" forward, after you read the table against the new code and it is still true.

## What it covers and what it leaves out

Checked for every order of events, within the bounds in the table above.

Checked on 600 random runs of the real `world.ts`: that it does what the design says after every event, and keeps every rule. Half the runs are in a world of one, so a second player is turned away. One run in three may restart the world and lose posts.

The server test runs `world.ts` as it is and plays everything around it with stand-ins:

- The browser is the model's own, not `net.ts`. A welcome reaches it at once.
- The Durable Object's runtime: sockets, timers, the clock and the storage are fakes. A restart keeps the sockets open, as the hibernation API does.
- Convex's answer to mayEnter is the stand-in's. The card's rule is a copy of `writeCard` in TypeScript, and the Convex test holds the real one to the same model.
- The room is `StandInRoom`, which keeps only `join` and `leave`, with a world of one or two. The last test in the file holds the real `room.ts` to it: one body for each user, a join takes the user out first, and the world is full at `MAX_PLAYERS`.

Left out:

- A token check and Convex's answer are one wait in the model. With dev tokens the check answers at once, so the Clerk check's own awaits are not played.
- The stamps of cards across a restart. The model takes every card to be later than every card before it. `world.ts` makes that so within one run of the object. After a restart it rests on the clock having passed the last stamp, which a burst of cards in one millisecond can run ahead of by a few milliseconds. A restart inside those milliseconds would see its first card dropped.
- `dropQuiet()` in one tick ends several sessions with no event between them. The model lets other events in between, which is more than the code can do.
- `dropQuiet()` runs only when the step count lands on a whole second after a catch-up. A server that keeps running two or three steps a tick can step past it for a while. The model takes the drop to come in the end.
- Inputs, snaps, the save store, the `reload` and `hello` refusals, the stats and the dev tools.
