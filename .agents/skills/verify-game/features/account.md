# Accounts

A guest plays with no account. Signed in, a player backs up the solo world, restores it on another device and sees their worlds.

## Sub-features

- `guest`: with no keys or signed out, the game is as it was.
- `sign-in`: Clerk's own box.
- `backup` and `restore`: the solo save to Convex and back. Restore asks first and keeps the replaced save.
- `worlds`: the list, read live from Convex.

## How to get to it (user POV)

Escape, then Account in the pause menu.

## Driving it

Preconditions: `.env.local` holds the dev keys (`.env.example` has the names). The test player is `ada.tester+clerk_test@example.com` on Clerk's development instance.

- **Convex functions and their refusals:** `bunx vitest run --root convex` (also inside `bun run check`). A signed-out caller and player B asking for player A's save or world are refused.
- **Push to the dev deployment:** `bunx convex dev --once` ends with `Convex functions ready!`.
- **The three services together:** `bun server/test/live.ts`. A real Clerk token gets the player into a world Convex made, and Convex shows them in it.
- **The panel:** start `bun tools/play.mjs start --mode human`, press Escape, click Account, take a shot. Signed out it shows a Sign in button; with no keys it says sign-in is not set up.

## Gotchas

- No script in the repo signs in through Clerk's box in a browser yet. The helper that built accounts did it once by hand-written script; `src/features/account/README.md` describes the flow.
- Never run `bunx convex ai-files install` here. It rewrites `AGENTS.md` and adds skills.
- Only the dev deployment exists. Nothing here touches production.
