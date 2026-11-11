# The playtest copy

Kausthubh's classmates play the new story at https://game-base.kausthubh2007.workers.dev/playtest/. The game
at `/` is `main` and stays as it was, so a player whose playtest copy breaks goes back to `/`.

## How it is served

| Address | Built from | Save in the browser |
|---|---|---|
| `/` | `main` | `greenhollow.save` |
| `/playtest/` | the branch `playtest` | `greenhollow.playtest.save` |

`tools/deploy.mjs` builds `main` into `dist/`, then builds the branch `playtest` in a checkout of its own
(`.artifacts/deploy/playtest`) and copies that build to `dist/playtest/`. Both go to Cloudflare in one deploy.
The two builds share no script, so new story code cannot break the game at `/`. With no `playtest` branch
the step is skipped.

The playtest copy is for one player. Its rules differ from the world server's, which runs `main`, so a
shared world (`?world=`) is refused there.

## What is in it

`playtest` is `main` plus slices of `docs/story-build.md`, merged as each one works:

| Slice | Branch | State on 2026-11-11 |
|---|---|---|
| 1. The first night: the Shut Door, the Mark, the Custodian, the Heartstone | `story/act1-shut-door` | Merged |
| 2. The Hall's look: ruin props, the Blighted fox's sheet | `playtest-hall`, `playtest-sprites` | Helpers building |
| 3. The Heartstone on screen, and a "Playtest" badge | `playtest-heart` | Helper building |

## Changing it

1. Branch from `playtest`, build and check there (`bun run check`, `bun run lint`, then play it).
2. The coordinator merges the branch into `playtest` and pushes `playtest` to GitHub.
3. Deploy: a push to `main` deploys both copies. To put out a playtest change alone, run `bun run deploy`
   from the main checkout (the `ship-game` skill, "By hand").

A slice goes from `playtest` to `main` once Kausthubh has played it and said yes.
