# The world server

One Cloudflare Durable Object per world runs the rules 20 times a second for everyone in it and keeps the world's save.

## Sub-features

- `join`: the build's version and the player's token are checked, then Convex is asked whether they may enter.
- `snaps`: each player gets what is near them.
- `save`: every 30 seconds and when the last player leaves. A sleeping world costs nothing.

## How to get to it (user POV)

Not reachable from the game yet: the browser does not connect. Fake players use the game's own client, `src/features/net`.

## Driving it

Preconditions: `bun run build` has made `dist/`.

- **Everything on the done list:** `bun server/test/check.ts` starts its own `wrangler dev` on port 5542 and ends with `every check passed`.
- **With real Clerk and Convex:** `bun server/test/live.ts` (port 5546, needs `.env.local`).
- **By hand:** `bunx wrangler dev` serves the game and the worlds on port 5540. Copy `.dev.vars.example` to `.dev.vars` first.
- **Memory and step time:** `bun server/test/bench.ts`. Read `server/README.md` for what its numbers do and do not prove.

## Gotchas

- Local `workerd` does not enforce Cloudflare's 128 MB limit. The live copy does: `bun server/test/live.ts --url https://game-base.kausthubh2007.workers.dev` joins one player there. Nobody has run the 8-player memory test against it.
- With `CONVEX_URL` empty and `DEV_TOKENS` not `1`, nobody enters any world. That is on purpose.
- The rules know one player: the bag and quests are shared, and creatures react to the player who has been in longest.
