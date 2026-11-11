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
- `src/features/net` connects, sends numbered inputs and hands out snapshots. Nothing in the game uses it.
- The rules know one player: one bag, one set of quests, one break meter. On the server every player has a
  body, and the player who has been in longest is `game.player`.
- A snapshot carries players, nearby actors, placed things and changed blocks. It does not carry the bag,
  crops, quests, flags, conversations, toasts or sounds.

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
