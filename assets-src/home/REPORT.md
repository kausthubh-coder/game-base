# Home cast sprites

ISSUES. Asset and visual checks pass; full suite verification remains limited by simulation test timeouts under concurrent machine load. Work stays on `act1-sprites-home`; nothing pushed.

## Delivered

World sheets in `public/assets/sprites/`: `hobb.png`, `dax.png`, `mina.png`, `gus.png`, `wren.png`, `tansy.png`, `holt.png`.
Each has 128-square frames, anchor `[64,120]`, two idle frames and four walking frames, front/back/right profile in rows 0–5. Gus and Wren replace their existing files. Other approved sprites and both baseline files remain unchanged.

Portraits are in `public/assets/portraits/portraits.png`, with a separate rebuild row for each person at `assets-src/home/<name>-portraits.png`. All seven have `<name>-calm`, `<name>-glad`, `<name>-troubled` manifest names. The plain name selects calm. Existing unrelated portraits retain their original pixels and coordinates. The same portrait loader reads the larger atlas; no new loader contract or runtime code was needed.

Rebuild with `bun tools/sprites/home.mjs`, or one person with `bun tools/sprites/home.mjs wren`. Sources are in `assets-src/home/sources/`. `prompts.json` records the built-in image generator prompts, references and attempts. Hobb, Dax, Mina, Tansy and Holt used one attempt; Gus used two; Wren used three. Raw outputs selected for processing were saved under `assets-src/raw/<name>-3.png`, which Git ignores. The tracked sources retain their generated figure pixels, with unused alpha cleared where recorded.

## Defaults and review

The user brief treats these concept sheets as approved, superseding the concept README's proposal wording. Heights use the lineup's relative metre values normalized to the approved hero's two-block frame. Dax therefore keeps the lineup's 1.8-to-1.54 ratio to the hero. Equipment stays within the cells. No new NPC scheduling or conversation content was added; the five new sprite names are ready for the coordinator's content wiring.

All seven final beside pictures were opened, checking all frames at 3x, native size and half size. Identities, costumes and direction rows stay consistent, and the seven remain distinct at half size. Pixel shading simplifies the concepts' fine embroidery, ink marks and individual bees. Holt's pole stays on the same side of the image in the back row rather than preserving handedness; no pole hand was specified.

Fixed during review: rows in several generated sheets were unevenly spaced, admitting scraps of the next head into a cell. The rebuild now finds the seven separated alpha bands before slicing. Gus and Wren's initial outputs had opaque backgrounds. Wren's background-removal pass browned her coat; the final recolor restores forest green without changing poses or identity. Only selected sources are retained.

## Evidence

- `.artifacts/sprites/beside-hobb.png`
- `.artifacts/sprites/beside-dax.png`
- `.artifacts/sprites/beside-mina.png`
- `.artifacts/sprites/beside-gus.png`
- `.artifacts/sprites/beside-wren.png`
- `.artifacts/sprites/beside-tansy.png`
- `.artifacts/sprites/beside-holt.png`
- Before replacements: `.artifacts/home/before-gus.png`, `.artifacts/home/before-wren.png`
- In-game group beside hero: `.artifacts/home/together.png`
- Actual dialogue box with Gus portrait: `.artifacts/home/dialogue.png`
- In-game walking: `.artifacts/home/walk-front.png`, `walk-back.png`, `walk-side.png`
- Door state and console results: `.artifacts/home/state.json`, `console.json`

The reproduction tool is `bun tools/sprites/home-play.mjs`, using this worktree's doctor port 5442. It opens the real game and stages proof actors through the debug door. It does not add those actors to game content. The dialogue uses the real `gus.first` conversation. It captures idle, three walk directions and return to idle. Final capture passed without console errors.

## Checks and limits

Before edits, doctor passed `bun run check`; baseline asset and production build checks passed. Baseline shots failed at farm and river. Baselines were not reapproved.

Both complete sprite checks passed after the first build. Final asset verification also runs those complete checks, including the expanded portrait atlas, palette, alpha, margins and frozen baselines. It warns about the existing `uikit` documentation detection despite that section already being documented.

The first full post-change check passed type checks and boundaries but hit timed-out simulation tests under heavy concurrent machine load. No game rule or TypeScript code changed. The production build passed. The post-change shots run also encountered a browser timeout. A direct `bun run check` retry reproduced timeouts in asset, combat and save tests and was stopped by its own recorded PIDs to avoid adding load. Both runs used the unchanged timeout limits. Final asset verification passes after Wren's final recolor. Results are recorded in `.artifacts/home/assets-final.log`, `check-final.log`, `after-verify.log` and `play-final.log`. The final full-suite PASS requirement is not met.

Not checked: a full story playthrough, mobile or Windows, low/medium/ultra rendering, every portrait expression inside a running conversation, new NPC scheduling/content integration. This task supplies the sprite and portrait assets; it does not change the game's 3D cast.
