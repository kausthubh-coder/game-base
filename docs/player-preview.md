# Play the unfinished game

Open https://mac-mini.taile36082.ts.net:15796/ with Tailscale connected. The preview serves verified sprite-only runtime `72ac28d4` from `.artifacts/beta-preview-verification/sprite-only-01/new-output/dist`. It includes mobile controls, primary-spade irrigation and camera/input fixes. The opening-audio repair is still in progress and is not in this build. Earned progression is accepted through Gallery and keystone 2; later chapters remain under verification. The live public deployment is unchanged.

On a phone, use the left stick to move, swipe the world to turn, and use the action buttons on the right. The Tools menu holds less-used controls.

If you continue an old save with a ditch dug before the irrigation fix, replace dirt in the dry trench cells and dig them again once. New primary spade digs now register for water flow.

Choose Begin for a new game. Use signed-out local play. This origin has its own browser save, separate from the automated chapter origins. Keep the same browser and address to continue that save. The preview does not install the test checkpoint into a player save.

The coordinator matched the HTTPS index to the verified runtime manifest. Local browser checks passed for sprite compatibility, camera/input and mobile controls; the updated title was also checked through the private HTTPS address. Browser-driver graphics warnings remain outside the clean local proof runs. This is a preview availability check, not another full story replay or a cloud-save claim.

## Ownership

The static server listens on localhost 5796. Tailscale Serve proxies HTTPS 15796 within the tailnet only. PID and checks are in `.artifacts/player-preview/server.json`; logs are in `.artifacts/player-preview/server.log`. The server is intentionally left running for the player. Do not stop it as test cleanup.

The immutable runtime must not be edited, replaced or cleaned by a chapter runner. Future updates need a separately verified build and a deliberate server switch while preserving this origin and its browser saves. Do not point the player at a build directory that a verifier temporarily moves.

To stop the preview when requested, confirm the recorded PID still belongs to this server, then stop that PID only. Disable only its proxy with `tailscale serve --https=15796 off`. Never reset the other Tailscale services.
