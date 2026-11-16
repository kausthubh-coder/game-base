---
name: worktree-game
description: Start a task in a new game worktree, repair packages, env, browser or port setup, or prepare a helper checkout.
---

# Worktree game

1. Run `bun tools/setup.mjs` in the task checkout. Continue when it exits zero and prints `ready`. It installs only when the lock changes, copies dev env without deployment credentials, links `.claude/skills`, and reserves a port in git's common directory. Main keeps 5300; task ports are 5400 through 5999.
2. Run `bun tools/doctor.mjs --quick` for a read-only inspection. Without `--quick` it also runs the game check. A failure prints the repair command. An occupied reserved port fails rather than changing the checkout's browser origin and losing its save.
3. Run `bun run dev`. It reads `.artifacts/checkout.json`, uses the reserved port and prints its child PID. For browser tools, export the `PORT` and `PLAY_PORT` printed by the doctor. Run dev and browser tools separately when both bind that port.
4. Run `bun run check` before editing. Keep screenshots in `.artifacts/<feature>/`.

Chrome uses the shared launcher. `CHROME_PATH` selects an explicit executable. Otherwise it uses installed Chrome or the Chromium executable expected by this checkout's Playwright version. Missing Chromium is a setup failure. Compare approved images with the same renderer.

## Backend and saves

Setup leaves deployment credentials in the main checkout and excludes them from copied dev env. It starts and deploys no backend. Local saves are isolated by the checkout's browser origin. Signed-in cloud saves still use the configured shared dev backend. Use signed-out local saves for chapter work. A task that changes or tests the backend must arrange isolation with the Convex skill before writing data or functions there. The doctor prints this limitation.

## Helpers and cleanup

Create helpers with `git worktree add -b <branch> <sibling-path> origin/main`, then setup in that checkout. Main is `~/dev/sandbox/game-base`; leave it untouched. Each helper owns its checkout.

Stop only your processes by the PIDs you recorded. Check live T3 threads before removal. After work is merged, run `bun tools/remove-worktree.mjs <path>` from a surviving checkout. It refuses main, the current checkout, dirty or unmerged work, and a checkout whose reserved port is occupied. It removes the skills link without traversing it. Setup prunes removed worktrees' reservations on its next run.
