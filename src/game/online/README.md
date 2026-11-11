# Online

A page opened with `?world=<id>` plays that world on the world server. The server runs the rules. This
page is a copy of the world: it never steps the kernel, and every view works as it does in solo play.

| Address | What opens |
|---|---|
| `/?world=<id>` | The world, as the signed-in player. Signed out, the page asks to sign in first. |
| `/?world=<id>&invite=<code>` | The same, after the invite lets this player in. The Account panel's Play together makes these links. |
| `/?world=<id>&dev=<name>` | The same with a dev token, on a world server that takes them (`wrangler dev` with `DEV_TOKENS=1`). No account. |
| `&server=<host:port>` | A world server other than the one that served the page, as when the game runs on Vite |

## How the copy works

Each snap from the server is taken in, in this order:

1. **The land.** Changed blocks go into this page's own `World` with `setBlock`. A chunk not in memory is made first, so no change is lost.
2. **Placed things.** The snap's `placed` list, which holds what is in range, is loaded into this page's placeables system.
3. **State.** Each system's save that changed is loaded into this page's copy of that system with `kernel.load`, and the flags with it. `copy.sim.ts` says which systems are copied and which changes count. Every emit while a save loads is dropped: the server sends the events that go with it.
4. **The clock and the weather.** `day`, `time` and `air` go straight into `game.clock` and `game.ambient`.
5. **The others.** Actors go into `interp.ts`, which draws them two steps behind for a player and five for anyone else, between two real updates.
6. **This player's own.** The break in progress (`actions.breaking()`), the conversation (`talk.current()`), and stations used, whose panels open.
7. **The hero.** The server's body after the last input it used, with the inputs it has not used replayed on top (`predict.ts`). The hero's body goes there, and the drawn hero catches up over about a tenth of a second (`PlayerRig.correct`). A gap of more than 3 blocks moves the hero at once.
8. **Events.** The server's events are emitted on the bus the views hear, once each.

What the player does goes the other way. `online.ts` points the system methods that change the world at
the server: `actions.use` and `hold`, `interact.act`, `inventory.selected` and `move`, `crafting.make`,
`talk.advance` and `choose`, and build mode's `press`, `release` and `undo`. The shell and the views call
them as in solo play. Each call becomes an act in the next input. Build mode stays in the page. A stroke
goes up whole when the button comes up, and the server lays it.

`relay.ts` cuts the event bus in two once the systems are installed. The systems keep the bus they were
installed with, and nothing is emitted on it again. So a quest in the page never moves on by itself.

## Files

| File | What it holds |
|---|---|
| `copy.sim.ts` | Which systems are copied and when a change counts. Which events are one player's own. The server reads it too. |
| `online.ts` | `createOnline`: the connection, taking snaps in, the methods pointed at the server, drawing the others |
| `predict.ts` | The hero moved at once and put right by the server's answer |
| `interp.ts` | The others drawn in the past, and the server's clock as this page knows it |
| `relay.ts` | The bus the views hear, cut from the systems' |
| `join.ts` | The address: the world, a dev name, another server |
| `online.test.ts` | `bun test src/game/online` |

The shell makes the copy in `src/game/shell/game.ts` when the address has `world`. `view.online` is it, for
a view. `src/game/views/online.view.ts` draws the names over other players and the notice while joining.
`window.__game.online.debug()` is what a check reads.

## Checking it

`bun tools/play-together.mjs` starts its own `wrangler dev`, opens two Chrome pages on one world with each
socket slowed by 100 ms each way, and plays it: walking with real keys, building, farming, an event heard
once, leaving, a server restart, a wrong build, a link opened signed out. It is the `together` part of
`bun run verify`.

## What stage 2 changes

The rules still know one player (`server/README.md`, "What the rules cannot do yet"). The bag, the break
meter and the conversation are the world's. When the rules know each player, these change here:

- `copy.sim.ts`: the bag, the hand and the Almanac become a player's own, sent only to them. The copier then needs a per-player part beside the world's.
- `online.ts`: `breaking` and `talk` stop being stand-ins kept beside the systems and load like any other state.
- `PERSONAL_EVENTS`: an item gained goes only to the player who gained it.
