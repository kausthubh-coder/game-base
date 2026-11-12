---
name: ship-game
description: Take verified work on the game to main and to the live copy. Use only when Kausthubh says ship, deploy, release, or merge and deploy.
---

# Ship the game

"Ship" is the go for every step here, cleanup included. Do not stop to ask between steps. When a step fails because of this change, fix it, rerun the checks and carry on. Stop only when the cause is outside the change or the fix is Kausthubh's decision. Never force-push, never skip a check.

## What ships

The live copy is https://game-base.kausthubh2007.workers.dev. A push to `main` that passes the check deploys it from GitHub Actions (`.github/workflows/check.yml`, the `deploy` job), in about two minutes.

| Surface | What sends it | Where |
|---|---|---|
| The code | `git push origin HEAD:main` | `kausthubh-coder/game-base` on GitHub |
| The database's functions | The deploy job: `bunx convex deploy` | Convex project `game-base`, production deployment `rare-lion-700` |
| The game's files | The deploy job: `bun run deploy` | One Cloudflare Worker, `game-base` |

Clerk has nothing to deploy. The live copy uses Clerk's development instance until the game has a domain, so sign-in shows Clerk's development badge.

## Steps

1. **Ready.**
   - `git status` is clean. `git fetch origin && git merge origin/main` (or rebase) so the branch holds everything on `main`.
   - `bun run verify --full` passes. Every changed feature was driven with the `verify-game` skill and has evidence in `.artifacts/`.
   - List what goes out: `git log --oneline origin/main..HEAD`, and which surfaces it touches.
   - Roll back, if it comes to that: `git revert` the commit and push, which deploys the old code again. `bunx wrangler rollback` is faster for the Worker alone. A schema change that removed a field needs a plan before you ship, not after.
   - When `convex/schema.ts` changed: the new schema must accept the rows that exist, and work with the game code that is live now, since the functions deploy a few seconds before the files. Read `~/.skills-parked/convex-migrate/SKILL.md` for anything but an added optional field.
2. **Land.** `git push origin HEAD:main`, from your worktree.
3. **Watch the deploy.** `gh run list --branch main --limit 1`, then `gh run view <id> --json jobs -q '.jobs[] | "\(.name) \(.conclusion)"'` until `check` and `deploy` both say `success`. Look again every 30 seconds or so; do not end your turn while it runs. A red run stops the ship: read `gh run view <id> --log-failed`, fix it and push again.
4. **Check the live copy**, reading only:
   - `bun tools/live-look.mjs https://game-base.kausthubh2007.workers.dev` opens it like a player, starts a new game and ends with `PASS`. Look at `.artifacts/live/playing.png`.
   - When the account or the save changed: `bun tools/play-cloud-save.mjs --url https://game-base.kausthubh2007.workers.dev` signs a fresh test user in on two browsers and plays the save between them through the live database.
5. **Update the main checkout**, `~/dev/sandbox/game-base`: when it is clean and on `main`, `git -C ~/dev/sandbox/game-base pull --ff-only`, then `bun tools/doctor.mjs --quick` there. When it is dirty or on another branch, leave it and say so.
6. **Clean up.** Delete the merged branch here and on the remote. A thread cannot remove its own worktree: list it for removal.
7. **Report** in a few lines: what shipped, the evidence, anything skipped.

## By hand, when GitHub cannot

From the main checkout only, where `.env.live.local` holds the live settings: `bunx convex deploy`, then `bun run deploy`. The script refuses a dirty tree and refuses to point the live copy at the dev database. `bun run deploy --dry-run` builds and packages and sends nothing.

## Keys

Names only. The values live in each service's settings, in GitHub's secrets and variables, and in `.env.local` and `.env.live.local` in the main checkout on the Mac mini.

- GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY`. Variables: `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY`.
- Convex's production deployment: `CLERK_JWT_ISSUER_DOMAIN`. The Worker has no variables or secrets.
