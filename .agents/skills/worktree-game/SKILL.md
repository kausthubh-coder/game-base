---
name: worktree-game
description: Start a task in a new game worktree, repair install, env or port problems, or prepare a helper's checkout.
---

# Worktree game

1. From the worktree root, run `bun tools/doctor.mjs`. Read every line. Continue when it exits 0 and every item says `ok` or `fixed`. Fix any `FAIL` reason and rerun. `--quick` skips the game check; `--json` gives the same results as data.
2. Run the exact `export PORT=… PLAY_PORT=…` line it prints, then `bun run dev`. Vite uses `PORT`; the play scripts use `PLAY_PORT`. Run dev and play checks separately because each binds that port. Rerun the doctor after stopping your server if the port was occupied. The main checkout keeps 5300; worktrees use 5400 through 5999.
3. Put screenshots in `.artifacts/<feature>/`, using `bun tools/shot.mjs <url> <out.png>`. Stop only processes you started, by PID.

The doctor installs dependencies, copies missing `.env.local` from git's first worktree, starts headless Chrome and runs `bun run check`. Missing keys are healthy today. It does not start or deploy a backend.

For a helper, create its branch with `git worktree add -b <branch> <sibling-path> origin/main`, then run the doctor there. Keep edits in that checkout. `git worktree list --porcelain` identifies the main checkout in its first entry. Leave that checkout untouched.

After the helper's work is merged or removal is authorized, stop its own processes by PID and run `git worktree remove <sibling-path>`. Check that no live thread uses it first.
