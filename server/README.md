# The Worker

One Cloudflare Worker serves the built game's files from `dist/`. Its address is
https://game-base.kausthubh2007.workers.dev, and GitHub deploys it on every push to `main` that passes the
check (`tools/deploy.mjs`, the `ship-game` skill).

There is no game server. The game runs in the browser, its save lives in the browser, and a signed-in
player's save is also kept in Convex so it follows them to another device (`src/features/account`).

## Commands

| Command | What it does |
|---|---|
| `bun run build` | Builds the game into `dist/`, which the Worker serves |
| `bunx wrangler dev` | The built game on port 5540 |
| `bunx tsc -p server` | The Worker's type check |
| `bun run deploy --dry-run` | Builds and packages the live copy and sends nothing |

## The world server's tombstone

Until 2026-11-11 this Worker also ran the world server, one Durable Object per online world. Multiplayer is
gone, and `wrangler.jsonc` keeps `"WorldServer": { "state": "deleted" }` so the next deploy retires that
namespace. Once that deploy is live the entry can go too.
