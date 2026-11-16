# Home, farm and vault-map layout

The home label used a fixed 64-pixel anchor clamp before translating upward by its full height. A three-resident tag was taller than that clamp. Farm labels projected independently, so nearby production and symptom lines occupied the same pixels. The full map painted underneath its compass and controls.

Home and farm tags now share stable registration order, measured dimensions and screen/HUD exclusion bounds. They keep all names, needs, production rates and symptom lines. Narrow farm tags wrap within the viewport. The chart has its own bounds beside the tools and compass. Show marked places frames existing saved pins, and vault labels remain visible below the ordinary detail zoom threshold. Find me, normal zoom/pan and waypoint controls retain their actions.

Run the focused checks:

```sh
bun test src/game/views/world-label-layout.test.ts src/features/map
bun tools/typecheck.mjs --paths src/game/views/ui-home.view.ts src/game/views/ui-farms.view.ts src/game/views/world-label-layout.ts src/features/map
```

Before a build or browser, follow `docs/resource-concurrency.md` and save the output of `bun tools/resource-status.mjs`. At most two heavy jobs run together. The presentation build and browser count as one sequential job. Stop its server by its printed PID before rebuilding its output.

```sh
bun run build --outDir dist-presentation-repair
bun tools/serve.mjs dist-presentation-repair 5567
PRESENTATION_URL=http://127.0.0.1:5567 bun tools/check-presentation-layout.mjs .artifacts/echo-presentation-repair/new-run
```

The runner imports the exact historical `earned-echo.save.json` and `middle-memory.save.json` under `.artifacts/echo-input/nov15-complete-route`. These are layout fixtures, not newly earned progression. Raw copies and SHA-256 hashes are retained under `.artifacts/echo-presentation-repair/input` and `input-hashes.json`.

It checks desktop and narrow viewports at high and low graphics. Browser keys approach the home door and open Gus's resident needs and job panel, close it, then walk to bees. E opens the production panel, Why reveals the fix, and the original Give and Take targets remain available. It checks tag bounds and pairwise/HUD collisions along the walk and at home and bees. Map controls frame saved marks and exercise pan, zoom and close. The runner focuses the chart before arrow keys and asserts that the Lamp Gallery label moves. Set `PRESENTATION_MAP_ONLY=1` for that short check alone. Canvas text observations check that all three promised vault labels fit inside the chart. Inspect every resulting PNG yourself, especially the narrow HUD, farm panel and vault map.

The original production browser went red on the clipped home label in all four profiles. Its report and pictures remain in `before`. Intermediate failed runs are retained with their logs. Do not treat their screenshots or partial reports as acceptance. The separate completed Echo route establishes earned progression.

Shared approved-shot checks must run alone and remain the coordinator's responsibility while another owner's preview is active. This task never updates approved pictures or claims to resolve the Custodian, past fox, memory framing, tent or resident staging.
