# Two checks failed once and passed on the next run

Seen on 2026-11-11 at `79ba547`, in one `bun run verify --full` while other threads were building and
running Chrome on the same Mac mini. Both passed when run again alone (`bun run verify server signed`).
Neither cause is proven. Not fixed.

## The world server check

`bun server/test/check.ts`, the item "a player who goes silent is taken out after 15 seconds": the
connection closed with code 1006 (the network dropped it) after 12.3 seconds, where the server closes it
with 4003 at 15. `.artifacts/verify/server.log` has the run.

A guess: `wrangler dev` watches `dist/`, and something rebuilt `dist/` in the same checkout during those
seconds, which restarts the local server. `tools/play/signed-in.md` warns of the same thing. A check that
serves its own copy of the build, as `tools/play.mjs` does in `.artifacts/play/site`, would not have this.

## The signed-in check, the chest step

`bun tools/play-together-signed-in.mjs`, point 9: a wait timed out in the chest step. The screenshot
(`.artifacts/signed-in/1794431043373/interaction-chest-a.png`) shows the hero beside Tamsin with the
prompt "Talk to Tamsin", no chest in the bag and none in view.

A guess: the step picks the first free cell near the hero for the chest and walks to it, and the nearest
prompt there can be a person's. Standing the players away from the grant stone before this step would
remove the guess.
