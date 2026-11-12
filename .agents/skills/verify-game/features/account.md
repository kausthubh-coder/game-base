# Accounts

A guest plays with no account and their save stays in the browser. Signed in, the save goes to the account as the game is played, and any device the player signs in on picks it up.

## Sub-features

- `guest`: with no keys or signed out, the game is as it was.
- `sign-in`: Clerk's own box, from Account on the title screen or in the pause menu.
- `sync`: the save going up and coming down by itself (`src/features/account/README.md` has the table of what goes which way).
- `conflict`: both devices changed the save since they last matched. The panel opens by itself and asks; the save not kept is set aside in the browser, never lost there.

## How to get to it (user POV)

Account on the title screen, or Escape, then Account in the pause menu.

## Driving it

Preconditions: `.env.local` holds the dev keys (`.env.example` has the names), with Clerk's development secret key.

- **Convex functions and their refusals:** `bunx vitest run --root convex` (also inside `bun run check`). A signed-out caller, and player B asking for player A's save, are refused; an upload over a copy it never saw is `stale`.
- **The sync rules:** `bun test src/features/account`, with stand-ins for Clerk and Convex.
- **Push to the dev deployment:** `bunx convex dev --once` ends with `Convex functions ready!`.
- **Two devices for real:** `bun tools/play-cloud-save.mjs` (or `bun run verify cloud`). It makes a fresh Clerk test user, signs in through Clerk's box in two browsers, plays the save from one to the other, makes a conflict and settles it, then deletes the user. Each step leaves a picture and the page's text in `.artifacts/cloud-save/`. Look at `4-phone-asked.png`: the question and both saves' days.
- **The panel by hand:** start `bun tools/play.mjs start --mode human`, click Account on the title, take a shot. Signed out it shows a Sign in button; with no keys it says sign-in is not set up.

## Gotchas

- Clerk asks a new device for an emailed code after the password. Test addresses (`+clerk_test@example.com`) take `424242`.
- The check's test users' profiles and saves stay in the dev database. Nothing deletes a save there yet.
- Never run `bunx convex ai-files install` here. It rewrites `AGENTS.md` and adds skills.
- Everything here uses the dev deployment, `valiant-spider-493`. The live copy has its own database, `rare-lion-700`; `bun tools/play-cloud-save.mjs --url <live address>` is the only thing here that touches it, and it plays a fresh test user there.
