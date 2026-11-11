# The world server

One Cloudflare Worker serves the built game and routes a world's address to that world's Durable Object.
The Durable Object runs the same `.sim.ts` rules the browser runs solo, 20 times a second, and keeps the
world's save in its own storage. `docs/architecture.md` says why.

Wrangler is not signed in on the Mac mini, so everything here runs with `bunx wrangler dev`. Nothing has
been deployed.

## Commands

| Command | What it does |
|---|---|
| `cp .dev.vars.example .dev.vars` | Once. Turns on dev tokens and the test tools on this machine. |
| `bun run build` | Builds the game into `dist/`, which the Worker serves. |
| `bunx wrangler dev` | The world server on port 5540. The inspector is on 5541. |
| `bun test server` | The server's tests: the room, the save store, the token check, the Convex calls. |
| `bunx tsc -p server && bunx tsc -p server/test` | The server's type check, and its tests' and scripts'. |
| `bun server/test/check.ts` | Starts its own server on port 5542 and checks it from outside. About 40 seconds. |
| `bun server/test/bench.ts` | The 128 MB test, on port 5544. About five minutes. |
| `bunx wrangler types server/env.d.ts --include-runtime=false --strict-vars=false` | Remakes `env.d.ts` after `wrangler.jsonc` changes. |

`check.ts` and `bench.ts` start `wrangler dev` themselves, with their own storage under `.artifacts/server/`,
and stop it by the pid they started. They do not need `.dev.vars`.

## Files

| File | What it holds |
|---|---|
| `index.ts` | The Worker. `/world/<id>` goes to the world's Durable Object. Everything else is the game's files. |
| `world.ts` | The Durable Object: sockets, the 20-a-second timer, saving, sleeping. |
| `room.ts` | The world as rules: the kernel, a body per player, and what each player is told. No Workers calls, so `bun test` runs it. |
| `store.ts` | The save in the Durable Object's SQLite storage. |
| `auth.ts` | Checks a Clerk token with WebCrypto. Reads dev tokens when allowed. |
| `gate.ts` | The two calls to Convex, and the stand-ins for a machine without Convex. |
| `dev.ts` | Test tools: give an item, fill a world for the memory test. |
| `stats.ts` | The shape of `/world/<id>/stats`. |
| `env.d.ts` | Made by `wrangler types`. Do not edit it. |
| `test/` | Tests and the two scripts. They run in Bun. |

The messages are in `src/engine/net/`, and the browser's client is `src/features/net/`.

## Addresses

| Address | What answers |
|---|---|
| `/`, `/assets/...` | The built game from `dist/`. |
| `/world/<id>` | A WebSocket to that world. `<id>` is 1 to 64 letters, digits, `_` or `-`. |
| `/world/<id>/stats` | What the world is doing, as JSON. Only with `DEV_TOOLS=1`. |
| `/world/<id>/dev` | Test tools, by POST. Only with `DEV_TOOLS=1`. |

## A connection

1. The browser opens a WebSocket to `/world/<id>` and sends `hello` with its build version and the player's token.
2. The server answers `welcome`, or `refuse` and closes with code 4000.
3. The browser sends one `input` for every step it plays, 20 a second, also while the player stands still. Each has a number one higher than the last.
4. After every step the server sends that player a `snap`.

| Message | Fields |
|---|---|
| `hello` | `build`, `token` |
| `welcome` | `you` (the player's actor id), `build`, `seed`, `step` |
| `refuse` | `why`, and `text` to show the player |
| `input` | `n`, `mx`, `mz` (the wanted direction in world space, -1 to 1), `jump`, `acts` |
| `snap` | `step`, `ack`, `you`, `day`, `time`, and what changed near the player (below) |

An act is a click the rules judge on the server: `slot` picks a quick slot, `use` is one click on a block
face, `hold` keeps the primary button on a block for a step.

| The server refuses with | When | The browser should |
|---|---|---|
| `reload` | Its build is not the browser's | Reload the page |
| `token` | The token is missing, wrong or out of date | Sign in again |
| `closed` | Convex says this player may not enter | Go back to the world list |
| `full` | The world has 8 players | Go back to the world list |
| `hello` | The first message was not a hello | Fix the client |

| Close code | Meaning | `createNet` then |
|---|---|---|
| 4000 | A `refuse` came first | Stops, with `refusal` set |
| 4001 | The same player connected again | Stops |
| 4002 | The server restarted and forgot this connection | Connects again |
| 4003 | Nothing was heard for 15 seconds, or no hello in 10 | Connects again |
| Anything else | The line dropped | Connects again after 0.5 seconds, then 1, 2, 4, 8 |

### What a snap holds

`ack` is the number of the last input of this player the server used. `you` is the player's own body
after that input: position, speed, facing, on the ground, in water. The rest is only what is near the
player and new to them.

| Field | What | Range | How often |
|---|---|---|---|
| `actors`, `gone` | Other players, creatures, pets, people | 56 blocks | When one changes. Players every step, the rest every fourth step. |
| `chunks` | Every changed block of a chunk that came into range | 8 chunks each way | Once, when it comes into range |
| `blocks` | Blocks that changed in this step | In a chunk the player was told | When it happens |
| `placed`, `unplaced` | Stations and furniture | 8 chunks each way | When one is set down, taken away or comes into range |

A snap is a difference, so the browser adds them up. `applySnap` in `src/engine/net/near.ts` does that for
actors and placed things. Changed blocks go into the browser's own world: `chunks` holds pairs of cell
index and block id, the form `buildChunk` takes.

Encoding is behind the `Codec` interface in `src/engine/net/codec.ts`. Today it is JSON. A binary codec
comes later and fits the same three functions.

### Inputs

The server uses one input a step for each player. A step with no input from a player steps their body
with no steering. A player earns one input a step and can save up three, so two inputs that arrive
together after a late one are both used and nothing waits a step behind. More than six waiting inputs
means the browser ran ahead, and the oldest are dropped.

## Awake and asleep

- The world loads its rules when the first player is let in. A refused connection loads nothing and writes nothing.
- It steps 20 times a second while a player is in. A late timer runs up to three steps to catch up. Past that the time is let go.
- It saves every 30 seconds and when the last player leaves. A save writes only the rows that changed: one row per changed chunk, and `meta`, `game` and `places`.
- When the last player leaves it saves, stops its timer and holds nothing that keeps it in memory. Cloudflare then puts it to sleep.
- A crash loses at most 30 seconds. Durable Objects have no shutdown hook, so there is no save at shutdown.
- After a deploy or a restart the server no longer knows its connections. It closes them with 4002 and the browser says hello again.

## Who gets in

The server checks the token before anything else. A Clerk token is a JWT. `auth.ts` checks that it is
RS256, that the signature fits one of Clerk's public keys, that `exp` and `nbf` hold, and that `iss` is
`CLERK_ISSUER`. It fetches the keys once from `<CLERK_ISSUER>/.well-known/jwks.json` and keeps them for
every world in the isolate, so checking a token makes no network call. An unknown key id makes one new
fetch, at most every five minutes.

A Clerk session token lasts one minute. `createNet` asks for the token again on every try, so pass it a
function that calls Clerk's `getToken`.

| Variable | Where | What |
|---|---|---|
| `CLERK_ISSUER` | `wrangler.jsonc` vars | Clerk's Frontend API URL. Empty means no Clerk token is taken. |
| `CLERK_AUDIENCE` | vars | When set, the token's `aud` must be this. Convex's Clerk tokens carry `convex`. |
| `CLERK_PARTIES` | vars | When set, a token's `azp` must be one of these origins, separated by commas. |
| `CONVEX_URL` | vars | The Convex deployment, `https://<name>.convex.cloud`. |
| `CONVEX_SITE_URL` | vars | Its HTTP actions, `https://<name>.convex.site`. |
| `WORLD_SERVER_SECRET` | a secret | Shown to Convex with the world card. |
| `DEV_TOKENS` | `.dev.vars` only | `1` takes `dev:<id>` and `dev:<id>:<name>` tokens, and lets everyone in while `CONVEX_URL` is empty. |
| `DEV_TOOLS` | `.dev.vars` only | `1` turns on `/stats` and `/dev`. |

With `CONVEX_URL` empty and `DEV_TOKENS` not `1`, nobody enters any world. A deployed server never falls
back to letting everyone in.

## The calls to Convex

`gate.ts` makes two calls. `server/test/gate.test.ts` holds them to these exact shapes.

**1. May this player enter?** Once per join, after the token's signature checked out.

```
POST <CONVEX_URL>/api/query
Authorization: Bearer <the player's own token>
Content-Type: application/json

{ "path": "worlds:mayEnter", "args": { "worldId": "<id>" }, "format": "json" }
```

The server lets the player in when the answer is `{ "status": "success", "value": { "allowed": true, ... } }`.
It takes `playerId` (the player's profile id) and `playerName` from that answer: the name is what other players
see, and the id is what the card lists. Anything else, an error or no answer in 5 seconds keeps the player out.
`worldId` is the `<id>` of `/world/<id>`. Convex reads who is asking from the token, the same token the
browser shows Convex. `convex/README.md` has Convex's side of both calls.

**2. The world's card.** When a player joins or leaves, and every 5 minutes while the world is awake.

```
POST <CONVEX_SITE_URL>/world-server/card
Authorization: Bearer <WORLD_SERVER_SECRET>
Content-Type: application/json

{ "worldId": "<id>", "playersNow": ["<playerId>"], "lastPlayedAt": 1794412800000 }
```

`playersNow` is the `playerId` of everyone in the world now, and empty after the last one left. `lastPlayedAt`
is milliseconds since 1970. Any 2xx answer is fine. A failed post is logged and not tried again. The world's
name is Convex's: the menu that makes a world gives it there, so the server sends none.

## What the rules cannot do yet

The rules know one player: one `game.player`, one bag, one break meter. `room.ts` stands in like this.

- Every player has a real body, the hero's own rules, and is an actor named `player:<user id>`.
- A click runs through the rules as the player who made it. Reach and facing are judged from where they stand.
- While the rules step, `game.player` is the host, the player who has been in the world longest. Creatures wake, sleep and flee around the host. Pets, people and quests follow the host.
- The bag, the quests and the story belong to the world. Everyone shares them.
- Two players who break blocks at once share one break meter.

Making the rules know many players is its own task, in `src/game`.

## Not on the wire yet

The bag, crops and wet soil, quests, flags, conversations, toasts and the events that make sound. Drawing
other players and predicting the hero are the next task.

## The 128 MB test

The open risk was whether a world fits in a Durable Object's 128 MB. On this machine it does, with room:
the world in the test holds 9 MB after a garbage collection, and a step takes about half a millisecond
of the 50 it has. Local `workerd` does not enforce the limit, so only a run on Cloudflare settles it.

`bun server/test/bench.ts` puts 8 fake players in one world on `wrangler dev`. Each sends an input 20
times a second through `src/features/net` and walks a square. The test tool adds 300 creatures (mosslings,
all within reach of the host, so the rules step every one) and 3,000 placed things. The rules have no
machines yet, so the placed things are sprinklers, fences and chests in turn. Only the sprinklers do work.

Measured on 2026-11-11: Mac mini, Apple M4, 10 cores, workerd 1.20261110.1, wrangler 4.160.1. Five runs,
each a fresh server, 8 seconds of warm-up and 30 seconds timed. The table gives the median, with the
least and the most in brackets.

| What | Number | How it was measured |
|---|---|---|
| The rules' step | 0.24 ms mean (0.19 to 0.25). Worst single step 5 ms | `performance.now()` around `room.step()` in the Durable Object |
| Making and sending 8 snaps | 0.30 ms mean (0.29 to 0.36). Worst 5 ms | `performance.now()` around the send loop |
| Steps a second | 20.0, none lost | The step count over the timed seconds |
| CPU of the workerd process | 5.9% of one core (5.3 to 6.4) | CPU time from `ps` over the timed seconds |
| Memory held after a garbage collection | 6.4 MB of heap (6.4 to 6.7) and 2.7 MB of buffers | `Runtime.getHeapUsage` over the inspector, after `HeapProfiler.collectGarbage` |
| Most memory the isolate had claimed | 42 MB of heap (35 to 42) and 4.3 MB of buffers | The same call once a second, the highest `totalSize` |
| Memory of the whole workerd process | 213 MB (144 to 215), 121 MB before any world | `ps` resident size |
| Sent to each player | 85 KB a second (84.9 to 85.4) | Bytes the fake players received |
| From an input to the snap that answers it | 43 ms median (21 to 43), 53 ms at the 95th percentile | Timed in the fake players |
| A save | 2 ms, 267 KB | `performance.now()` around the write, one save on demand |

Checked in every run: 8 players in the world, 301 creatures and all 301 stepped, 3,000 placed things,
160 inputs a second received and 160 used, no input dropped, no step lost, no step threw.

A second run, `--spread`, sends the 8 players walking apart for the whole time, which keeps the most
land in memory. Three runs: 272 chunks in memory against 64, 9.2 MB of buffers after a collection against
2.7, the same 6.5 MB of heap, a step of 0.31 ms mean with a worst of 8 ms where a player crosses into new
land. A chunk is 33 KB. Eight players as far apart as they can be keep about 650 chunks, 21 MB.

Where the time goes, from one run under the CPU profiler that is not in the table: 61% of the isolate's
running time is telling players (31% encoding and sending JSON, 20% making snaps, 10% noting which actors
changed), and about a quarter is the rules. The step rate is held by the 50 ms timer, not by the CPU.

What the numbers do not prove:

- **Cloudflare's limit.** Local workerd is the same runtime, but it does not stop at 128 MB, and with nothing pressing on it V8 lets garbage pile up. That is the 42 MB. What the world needs is the 9 MB.
- **Cloudflare's machines.** Their CPUs are slower than an M4 and shared. A step ten times slower would still be 5 ms of 50.
- **Many worlds at once.** Cloudflare may run several Durable Objects of one class in one isolate, and then they share one 128 MB. At 9 MB a world that is room for about ten, but only Cloudflare decides how many it puts together.
- **Machines.** A real machine part that works every step costs more than a fence. Run the test again when machines exist.
- **A quiet machine.** The load average was 21 to 29 on 10 cores while this ran, from other work. The timings are no better than that allows.
- **Exact percentiles.** workerd's clock ticks in whole milliseconds, so a single step reads as 0 or 1 ms. The means are sound.
- **A real network.** Everything ran over loopback.

One number is over the plan: 85 KB a second to each player, against a goal of 20. It is the JSON, with 300
creatures in range of everyone. A player walking alone among the town's own people gets 4.6 KB a second.
The binary codec is the fix, and it is the next task.

The round trip is at most one step because an input waits for the next step and its snap leaves at once.
Where in that step a browser's inputs land is chance, which is the spread between 21 and 43 ms.

## A first deploy

Nothing here has been deployed. A first deploy needs, from Kausthubh:

1. `bunx wrangler login`, on a Cloudflare account. The free plan is enough to start: the Durable Object uses SQLite storage.
2. Clerk's Frontend API URL in `CLERK_ISSUER`, and `convex` in `CLERK_AUDIENCE` when the browser sends the Convex token.
3. The Convex URLs in `CONVEX_URL` and `CONVEX_SITE_URL`.
4. One secret, the same value in both places: `bunx wrangler secret put WORLD_SERVER_SECRET`, and `WORLD_SERVER_SECRET` in Convex's environment.
5. A build version. Add `define: { __BUILD__: JSON.stringify(process.env.BUILD ?? 'dev') }` to `vite.config.ts`, then deploy both halves from one commit:
   `BUILD=$(git rev-parse --short HEAD) bun run build && bunx wrangler deploy --define "__BUILD__:\"$(git rev-parse --short HEAD)\""`.
   Until then both sides say `dev` and every browser is let in.
6. `DEV_TOKENS` and `DEV_TOOLS` stay unset on a deployed server.

`bunx wrangler deploy --dry-run` packages the Worker without sending it. It makes a 359 KiB script, 97 KiB
gzipped, and reads 277 files from `dist/`.

Not set up: a code update strategy for deploys, a preview per branch, and a production environment in
`wrangler.jsonc`.
