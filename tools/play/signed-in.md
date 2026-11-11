# Signed-in multiplayer browser check

Run `bun tools/play-together-signed-in.mjs`. It builds with `.env.local`, starts its own world server on
5570 and inspector on 5571, signs three development users in through Clerk's UI, and checks the ten
requested player flows. `--port 5572` moves both ports. Run checks sequentially. A new build replaces
`dist`, which a running Wrangler watches.

The users are `ada.tester+clerk_test@example.com`, `bo.tester+clerk_test@example.com`, and
`cy.tester+clerk_test@example.com`. The latter two are created if missing. The tool gives them test
passwords when its password file is missing. It keeps those passwords in the ignored, mode-600
`.artifacts/signed-in/accounts.json`. Clerk's email verification uses its documented `424242` test code.
The tool obtains a Clerk testing token to bypass bot detection. This does not bypass sign-in or the
world server's token validation. A signs in by email code. B and C use their password and email code
when Clerk asks for device verification.

Local runs need all five nonempty variables listed in `.env.example`. They use Clerk development keys,
the dev Convex URLs and the matching `WORLD_SERVER_SECRET`. The server accepts real Clerk tokens only.
Local fixture items come from its dev item tool. Walking uses real keyboard events; block actions use
the same browser methods the shell calls. Conversations use E, Enter and choice buttons. Crafting uses
the Make panel. A chest currently answers with "The chest is empty." and has no storage panel.

`--out .artifacts/signed-in/my-run` selects the evidence folder. Each checkpoint writes state and online
debug JSON beside screenshots. `report.json` contains all ten verdicts; `interactions.json` splits the
conversation, workbench and chest checks. An assertion failure exits 1 and preserves evidence.
`--no-build` reuses an existing local build for debugging.

For a deployed check, run:

```
bun tools/play-together-signed-in.mjs --url https://THE-DEPLOYED-ADDRESS
```

That mode starts no server and performs no build. Put the deployed database's `VITE_CONVEX_URL` and
`VITE_CONVEX_SITE_URL` in ignored `.env.live.local`. It overrides `.env.local`, including Bun's loaded
environment. The deployed app must use the same Clerk development instance and those Convex URLs.
The same three accounts work. The script signs in afresh and uses the deployed build's own version.
It obtains fixture wood by walking to unprotected trees and cutting them through the game's action
methods, then crafts the test supplies. That fixture route has not been run against a deployment.

The tool leaves Clerk users in place. It closes browser connections, waits for Convex's world card to
become empty, and removes its world with `worlds.remove`, which also removes its invites and members.
It attempts removal even when the empty-card assertion fails. It revokes its separate cleanup session.
Browser contexts are discarded at the end. It never prints passwords, secret keys or JWTs.

No read exists for deleted invite rows after a world is removed. Cleanup checks that the owner's world
list no longer contains the world and relies on the tested cascade in `convex/worlds.ts` for those rows.

`--reorder-cards` is a local-only network probe. A proxy on 5578 forwards real, authenticated card posts
to dev Convex. During cleanup it holds the one-player card until the empty card finishes, then forwards
that older card. This checks that a delayed presence write cannot bring a departed player back into the
world list. The test keeps its empty-card assertion and exits 1 if Convex retains that player. The
proxy is stopped with the local server. `leave-card.json`, `leave-server.json`, and `server.log` record
both sides. Do not combine this option with `--url`.
