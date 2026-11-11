# Playing together

The plan for 1 to 8 players in one world. `docs/architecture.md` has the design it follows: the world server
owns the live world, the browser sends inputs and draws what the server says. `server/README.md` has what
the server does today. This page is the order of work and what each stage must prove.

Decided in the handbook (`06-mechanics.md`): a world belongs to the player who made it, and friends join by
link after they sign in. Each player keeps their own character, bag and Almanac. The kingdom, its stores and
the story belong to the world.

## Where it stands (2026-11-11)

- The world server runs the rules 20 times a second on Cloudflare, lets a signed-in player into a world
  Convex says is theirs, sends each player what is near, and saves the world.
- Stage 1 is built on `t3/stage-one-multiplayer-1`: `/?world=<id>` opens an online world, and the browser is a
  copy of it (below). `bun tools/play-together.mjs` plays it in two real browsers on this machine. It has not
  been tried against the live copy.
- The rules know one player: one bag, one set of quests, one break meter. On the server every player has a
  body, and the player who has been in longest is `game.player`.

## Stages

Each stage ends with something two people can do together, and a check that plays it in two real browsers.

| Stage | Two players can | What it needs |
|---|---|---|
| 1. See each other | Open one link, walk around the same land, see each other move, build and farm on the same ground, live the same day and weather | The browser as a copy of the server's world: the join flow, every system's state and the rules' events on the wire, the player's own hero moved at once and corrected quietly, other players drawn between two updates. The bag and the quests are still the world's, shared. |
| 2. Your own character | Each carry their own bag, hold their own tool, fill their own Almanac | Player-scoped state in the rules (`src/game`): the bag, the hand, the break meter, the Almanac. The story and the stores stay the world's. |
| 3. Feels good on bad wifi | Play on a slow, lossy connection without rubber-banding, and come back after a drop | Small binary messages (the goal is about 20 KB a second for each player), hits judged at what the player saw, resume after a drop, the 8-player memory test on Cloudflare itself. |
| 4. A kingdom together | Vote on story choices, share pins on the map, set who may build where | The Chronicle, votes, owner permissions. Game design first. |

## Rules for every stage

- Solo play does not change, and needs no server and no account.
- The rules run in one place for an online world: the server. The browser never decides what happened.
- A stage is done when `bun run verify --full` passes and its two-browser check passes on this machine and
  against the live copy.

## How the copy works (stage 1)

In an online world the browser does not step the rules. It keeps the same kernel and systems as solo play
and loads into them what the server sends. `src/game/online/README.md` has the details.

| What | How it gets to the browser |
|---|---|
| The land | Changed blocks in each snap, laid over the land the seed makes |
| Bodies and actors | Positions in each snap: players every step, everything else every fourth. Others are drawn 2 or 5 steps in the past, between two real updates |
| The rules' state | Each system's own `save()`, sent when what a player can see of it changed (`src/game/online/copy.sim.ts`), and loaded into the browser's copy of that system |
| Clock and weather | `day`, `time` and `game.ambient` in the snap |
| Events | The rules' events of each step, emitted again on the bus the views hear. A toast, a hint, a panel or a conversation goes only to the player whose act made it |
| What the player does | An act in the next input. The browser's system methods that change the world send the act instead (`online.ts`), so the shell and the views are the same as in solo play |
| The player's own hero | Moved at once by the same body rules. Each input carries the steering of its three body steps. The server's answer names the last input it used, and the browser replays the rest on top. A disagreement is let go over a tenth of a second |

Why the state is each system's save: every system already saves and loads all of its state, and the act 1
test loads a save 20 times in one play. So one path covers every system there is and every system added
later, with no second description of the state to keep in step. The cost is size: a save goes whole when
it changes. `copy.sim.ts` keeps counters that tick every step (a crop's growth, a person's place on a path)
out of what counts as a change, so a quiet world sends no state at all.

Measured with `bun tools/play-together.mjs`, two players, each socket slowed by 100 ms each way, while one
walks: about 5 KB a second to the walker and 6 KB to the one watching, most of it the other player in
`actors` and the player's own body in `you`. The prediction matched the server exactly in every answer of
the run (largest gap 0 blocks): the browser and the server run the same body rules on the same blocks with
the same numbers. `bun server/test/bench.ts`, with 8 fake players among 300 creatures, still sends 85 KB a
second to each player, as before stage 1: the creatures' positions in JSON. The binary codec of stage 3 is
the fix for both.

## What stage 2 changes in the copy

- The bag, the hand, the break meter and the Almanac become each player's, in the rules. The copy then has
  a part for each player beside the world's part, sent only to that player.
- `breaking` and `talk` in the snap are stand-ins for player-scoped state the rules do not have yet. They
  become ordinary state.
- An item gained goes only to the player who gained it.
- Each player needs their own conversation and their own `busy`. Today one conversation holds everyone.
- Invites let one friend in each. A class of 20 to 30 needs a link many can use, and more than 8 players a
  world: both are Kausthubh's to decide (`convex/model/limits.ts`, `MAX_PLAYERS` in `server/room.ts`).

