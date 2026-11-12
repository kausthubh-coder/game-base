# The signed-in check failed after another worktree ran it

Found on 2026-11-11 while shipping `t3/agent-playtest`. Fixed in the same branch.

## What happened

`bun run verify --full` passed `signed` at 19:27 and failed it at 19:48 on code that had not changed where
the check looks: 2 of 10 points, in 292 seconds. The second and third players never signed in. The picture
of the failure shows Clerk's form saying "Password is incorrect".

## Cause

Ada signs in by email code. Bo and Cy sign in with passwords the tool sets through Clerk's API and keeps in
`.artifacts/signed-in/accounts.json`. That file was one per worktree, and the users are one set for every
worktree. A worktree with no file gave both users new passwords on its first run, which made every other
worktree's file wrong. Three commits reached `main` at 19:38, between the two runs here. No newer file was
left on disk to prove which worktree did it. The main checkout's own file, from 15:21, was stale as well:
with it the check failed the same way, 2 of 2 runs.

## The fix

`tools/play-together-signed-in.mjs` keeps the passwords in the main checkout's
`.artifacts/signed-in/accounts.json`, one file for every worktree. When Clerk still says a password is
incorrect (the laptop set a new one), the tool reads the file again, sets a new password if the file has
nothing newer, and signs in again. With the stale file in place the check then passed 10 of 10, and printed
`Clerk password was stale, trying the current one` for both users.

Two runs that start at the same moment with no file can still each set a password. The second to sign in
recovers by the same path.
