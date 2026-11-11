# Approved pictures

The approved set uses medium quality. High-quality farm and rain exceeded the triangle budget during setup; those game rendering changes are outside this tool.

Run `bun tools/shots.mjs all --approve`, inspect the six PNGs, then run `bun tools/shots.mjs all --check`. A single scene name also works. Scenes in `tools/shots/scenes.json` define the URL flags, seed, location, camera, hour and weather. Capture takes fixed animation steps and freezes the draw loop before reading pixels. Output and counters go to `.artifacts/shots/`. The tool builds the game and owns a server on port 5526. With `PLAY_PORT` set, it uses the next port so a persistent play session can stay open. `--port` or `SHOTS_PORT` overrides that choice.

Approved PNGs are 960 by 540. Each JSON records the renderer, scene settings, draw counters and total built JavaScript bytes. A check fails if over 2.5% of pixels differ by more than 24 color levels, scene settings changed, console errors occurred, the rendered geometry is empty, or the picture exceeds 150 draw calls or 400,000 triangles. Script bytes are reported without a size limit, since the repo has no approved script-size budget.

Renderer mismatches warn and skip the image comparison. Budgets and console checks still run. Use `--software` or `CHROME_SOFTWARE=1` to draw in software. Approve and check using the same renderer.

The six scenes cover parts of `painted-shots.mjs`, `town-shots.mjs`, `cam-shots.mjs` and `view-shots.mjs`. Those scripts remain for their other angles and special checks. The new tool does not replace UI, asset, hero motion, style-lab or build-stroke checks.
