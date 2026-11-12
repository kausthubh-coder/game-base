# Settings offers 3D characters whose model is missing

Found by playing on 2026-11-11 at `e7844a8`. Open, not fixed. Existing bug files were read after play; none describes this failure.

## What a player hits

Open Settings, scroll to View, select Characters > 3D models. The option stays highlighted, but the game keeps drawing sprites. There is no visible error explaining the fallback. The browser reports `/assets/models/cast-hero.glb` as 404 and says the 3D characters did not load.

Expected the selected character style to load, or a visible explanation that it is unavailable. Reproduced 2 of 2 manual attempts, once from title Settings and once from in-game Settings in a fresh session.

[Picture of the selected option](../playtests/img/2026-11-11-menus-small-screen/039-models-second-try.jpg).

## Failing recording

The recording beside this file uses real clicks from the title, at 1366x768. A recording now carries its size, so replay opens it at that size:

```sh
bun tools/play.mjs replay docs/bugs/2026-11-11-settings-3d-models-missing.json
```

Run on this commit, it exits 1 with `Failed to load resource: the server responded with a status of 404 (Not Found)`. Replay treats console errors as failures. The preceding manual observation identifies the failing resource as the hero model. This check catches the missing resource, not the lack of a player-facing fallback message.

The model files in this local built copy may differ from production. No claim about the deployed copy was tested.
