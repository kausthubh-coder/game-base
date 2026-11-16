# Act 1 world sprites

ISSUES. Work is local on `act1-sprites-world`, based on local `act1` at `8603e73`.

## Assets made

World sheets in `public/assets/sprites/`:

- `maren`, `tamsin`, `elowen`, `calla`, `aldric`, `ren`, `ilara`, `auren`.
- `custodian`, including sleep, with the existing badger frame and world height.
- `stag`, `stag-free`, `stag-fight`, preserving their existing frame, anchor, world height and animation contracts.
- `town-roan` quay runner, `town-hesper` potter, `town-pell` fisher, `town-corin` baker, `town-isolde` weaver, `town-nessa` herbalist, `town-acolyte-a`, `town-acolyte-b`.

Portraits in `public/assets/portraits/portraits.png` for Maren, Tamsin, Elowen, Calla, Aldric, Ren, Ilara, Auren, Custodian and Stag. Each has `<name>-calm`, `<name>-glad`, `<name>-troubled`. Bare names select calm. The animal expressions correspond to their concept expressions. Original portrait cells remain available at their old coordinates; Maren and Tamsin's bare names now select their new portraits.

`bun tools/sprites/people-world.mjs` rebuilds all outputs from retained generated sources. Optional sprite names rebuild just those world sheets. Sources, prompts, references and attempts are beside this report. The generator was built-in `image_gen.imagegen`; no replacement pixels were drawn in code. The frozen baselines are unchanged. Both acolytes were added to the crowd choices, and baker/weaver ambient lines match their new jobs.

## Verification

- Doctor passed before changes, including the full check.
- `bun tools/verify-assets.mjs` passed, including both sprite checks. Its existing `uikit` documentation warning remains.
- Focused asset and dialogue tests passed, 59 tests across five files.
- Ran and opened `beside.mjs` for every world sheet, including the final corrected crowd slices and freed Stag. At 1x and half, their large costume shapes distinguish them. Transposed crowd directions and uneven source bands were corrected during slicing. Roan and the baker's generated walk poses were scaled to their idle body size. Removed a disconnected fragment from the freed Stag.
- The real Stag hall played through freeing it with no console errors. Evidence is `.artifacts/fight/stag-*.png` and `.artifacts/people-world/stag-play.log`.
- Initial `bun run verify shots play`: play passed; farm and river failed their existing approved pictures before any asset change. Logs are `.artifacts/people-world/before-*.log`.
- Final `bun run check` reached rule tests after type and boundary checks, but many tests exceeded their time limits under machine contention. Stopped that test process and the final screenshot verification process after prolonged lack of progress. Full final check and `verify shots play` are incomplete, not passing evidence. No unrelated approved pictures were refreshed.

## Remaining visual issues and defaults

- Ilara's world sheet still shows teal on both hands, and its exact seven places, six lit and one dark, cannot be certified at sprite resolution. Two correction attempts repeated this error. Kept attempt one; rejected raw outputs were deleted and their prompts retained in `attempts.json`.
- The generated Order half-suns do not reliably resolve to exactly six rays. This requires another art correction before these can be approved.
- Roan's third walk pose still changes the hair outline slightly after size matching. It needs a targeted replacement for a strict same-person PASS.
- The locked palette turns some green cloth and moss towards ochre. The prescribed palette was retained.
- New named people have manifest entries and expression portraits, but no new story routines or conversations were invented for them. Automatic expression selection is not implemented; callers can request the expression keys.
- New people's world heights default to Elowen 1.7, Calla 1.95, Aldric and Ren 1.8, Ilara 1.9 and Auren 2.05. Existing sprite heights remain unchanged. These are working lineup defaults, not new canonical heights.

## Pictures

- `.artifacts/people-world/hollowmere-street.png`, real Hollowmere with the new crowd art.
- `.artifacts/people-world/dialogue-maren.png`, Maren's new calm portrait inside the game's dialogue box.
- `.artifacts/people-world/portrait-overview.png`, all generated expression strips.
- `.artifacts/sprites/beside-<name>.png`, every frame with game-size and half-size rows.

Not checked: every named person walking in the live world in all directions, every expression inside the dialogue box, Windows or weak-device performance, and a complete final full verification run.

The portrait rebuild also removes disconnected source borders. A white bar beside Maren's first portrait was caught in the final atlas review and removed. `--portraits` rebuilds only the expression atlas. The capture tool advances opening narration before waiting for Maren's spoken line.
