---
name: ship-game
description: Take verified work on the game to main and to the live copy. Use only when Kausthubh says ship, deploy, release, or merge and deploy.
---

# Ship the game

"Ship" is the go for every step here, cleanup included. Do not stop to ask between steps. When a step fails because of this change, fix it, rerun the checks and carry on. Stop only when the cause is outside the change or the fix is Kausthubh's decision. Never force-push, never skip a check.

## What ships

| Surface | What sends it | Where |
|---|---|---|
| The code | `git push origin HEAD:main` | `kausthubh-coder/game-base` on GitHub. The Check workflow runs on every push. |
| The database's functions | `bunx convex deploy` | Convex project `game-base`, the production deployment |
| The game's files and the world server | `bun run deploy` | One Cloudflare Worker, `game-base` |

Clerk has nothing to deploy. It stays on its development instance until the game has a domain.

**State on 2026-11-11: the live copy does not exist yet.** Wrangler is not signed in on the Mac mini and Convex has only its dev deployment. Until the first deploy has run, steps 2, 4 and 5 are unproven: do them slowly, read every output, and write what you learned back into this file.

## Steps

1. **Ready.**
   - `git status` is clean. `git fetch origin && git merge origin/main` (or rebase) so the branch holds everything on `main`.
   - `bun run verify --full` passes. Every changed feature was driven with the `verify-game` skill and has evidence in `.artifacts/`.
   - List what goes out: `git log --oneline origin/main..HEAD`, and which surfaces it touches.
   - Roll back, if it comes to that: `bunx wrangler rollback` puts the last Worker version back. For Convex, check out the last good commit and `bunx convex deploy` again. A schema change that removed a field needs a plan before you ship, not after.
2. **Database first**, when `convex/` changed: `bunx convex deploy`. Read `~/.skills-parked/convex-deploy-guard/SKILL.md` first: say which deployment the command targets before you run it. A schema change must work with both the old and the new game code, since browsers with the old code are still playing.
3. **Land.** `git push origin HEAD:main`, from your worktree. Then `gh run list --branch main --limit 1` until the Check run is green. A red run stops the ship: fix it.
4. **Deploy**, when anything under `src/`, `server/`, `public/` or the build changed: `bun run deploy`. It refuses a dirty tree, builds with the commit's short hash as the version and sends the files and the world server together. Awake worlds save and restart on the new code; an older browser is told to reload.
5. **Check the live copy**, reading only:
   - The page answers 200 and names the new script: `curl -s <url> | grep -o 'index-[^"]*\.js'`.
   - The asset headers: a file under `/assets/fingerprinted/` says `immutable`, the page says `no-cache`.
   - A world refuses a wrong version: `server/README.md` has the hello message.
   - Open the game in `bun tools/play.mjs` against the live address and take one screenshot.
6. **Update the main checkout**, `~/dev/sandbox/game-base`: when it is clean and on `main`, `git -C ~/dev/sandbox/game-base pull --ff-only`, then `bun tools/doctor.mjs --quick` there. When it is dirty or on another branch, leave it and say so.
7. **Clean up.** Delete the merged branch here and on the remote. A thread cannot remove its own worktree: list it for removal.
8. **Report** in a few lines: what shipped, to which surfaces, the evidence, anything skipped.

## Keys

Names only; the values live in each service's settings and in `.env.local` and `.dev.vars` on the Mac mini.

- Cloudflare Worker variables (`wrangler.jsonc`): `CLERK_ISSUER`, `CLERK_AUDIENCE`, `CONVEX_URL`, `CONVEX_SITE_URL`. Secret: `WORLD_SERVER_SECRET` (`bunx wrangler secret put WORLD_SERVER_SECRET`).
- Convex deployment variables: `CLERK_JWT_ISSUER_DOMAIN`, `WORLD_SERVER_SECRET`, the same value as the Worker's.
- The browser build: `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`.
