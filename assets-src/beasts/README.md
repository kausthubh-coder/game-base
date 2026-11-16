# Act-1 beast sprites

PASS for the requested asset, build, scene and play checks.

Production sheets from the coordinator-approved creature concepts, built with `image_gen.imagegen`.
Rebuild from the ten retained sources with `bun tools/sprites/beasts-act1.mjs`.
Exact prompts, references, attempts and retained source hashes are in `prompts.json`.
Original style references are the public sprite files at base commit `553e6d1`.

## Sheets

All names below are manifest keys and PNG filenames under `public/assets/sprites/`.
Each world sheet has two idle frames and four walk frames in front, back and right-facing side rows.
Each fight sheet has four columns: tell, attack, hurt/dizzy, calmed or shutdown.
Idle comes from the world sheet, matching the existing fight renderer.

| Creature | World sheets | Fight sheet |
|---|---|---|
| Fox | `fox`, `fox-blighted` | `fox-blighted-fight` |
| Thistlehog | `thistlehog`, `thistlehog-blighted`, `thistlehog-calmed` | `thistlehog-fight` |
| Bramble | `boar`, `boar-blighted`, `boar-calmed` | `boar-fight` |
| Lynx | `lynx` | `lynx-fight` |
| Gearling | `gearling` | `gearling-fight` |
| Rootsnare | `rootsnare`, `rootsnare-calmed` | `rootsnare-fight` |

Existing frame sizes, row counts, animation names, anchors and world heights remain unchanged.
Bramble uses 192-square cells; the other beasts use 96-square cells.
The new lynx world height is 1.3 and rootsnare is 1.6, including cell padding.
`thistlehog` and `boar` remain living forms for the lab's existing draining shader.
Explicit Blighted names allow story content to select grey world forms.
The lynx's calm pose stays grey and relaxed: the concept README does not request a separate healthy design.
Gearling shuts down with a dark core. It has no Blighted or calmed organic form.

## Processing and corrections

Scripts only slice generated pixels, remove background, harden alpha, snap the locked palette and scale.
No creature pixels are drawn by code. Combat colours are snapped to that creature's own world colours.
The generated transparent rows are separated at their actual gaps because equal slicing clipped feet.
Boar source column four contained healthy world poses; its grey world loop uses column two there.
The healthy rootsnare source put directions in columns; the rebuild maps those cells into direction rows.
The well sources had smooth opaque backdrops. Two background-removal retries did not remove them.
A border flood removes the smooth backdrop and stops at the pixel outline, then alpha cleanup removes specks.
Only retained sources are needed to rebuild; discarded attempts are recorded without being committed.

## Visual evidence

For every manifest name in the table, the reviewed same-creature and game-size picture is:

`.artifacts/sprites/beside-<manifest-name>.png`

Each contains every frame at 3x, native and half size, beside its concept sheet.
Before pictures of the seven replaced sheets are `.artifacts/sprites/before-<manifest-name>.png`.
All beside pictures were opened. Directions, silhouettes, action continuity, padding and half-size readability
were checked. The grey coats intentionally differ from their recovered colours.
Fine flowers and bark details merge into colour clusters at half size; species silhouettes and amber/teal
cores remain readable. The new thistlehog uses a broader leaf silhouette than the earlier shipped sheet.

The actual game's rendered fight poses were opened too:

- `.artifacts/fight/poses/thistlehog.png`
- `.artifacts/fight/poses/gearling.png`
- `.artifacts/fight/poses/boar.png`

## Checks

- `bun tools/doctor.mjs`: pass before edits, including `bun run check`.
- `bun tools/sprites/check.mjs --complete`: pass.
- `bun tools/sprites/check-story.mjs --complete`: pass.
- `bun tools/verify-assets.mjs`: pass. Existing warning: the verifier does not recognise the documented `uikit` section.
- `bun run verify check assets build shots play`: pass after publication.
- `bun run verify assets build shots play`: assets, build and play pass after the creature-specific colour snap. Its screenshot step hit our own temporary fight server on port 5424.
- `bun run verify shots play`: pass after stopping that server, rechecking the final art.
- `bun tools/fight-poses.mjs --port 5424 --only <beast>`: thistlehog, gearling and boar, no console errors.
- `bun tools/fight-play.mjs --port 5424 --beast <beast>`: pass with sword and leaftail against those three beasts, all calmed or shut down, no console errors.

Logs are `.artifacts/sprites/verify-before.log`, `verify-after.log`, `verify-final.log`,
`verify-final-shots-play.log`, `check-story.log`, `verify-assets.log`, `fight-poses.log` and `fight-play.log`.

Not checked: playable fox, lynx or rootsnare fights, because the present lab contains only thistlehog,
gearling and boar. Their assets and manifest entries are ready for the coordinator to wire.
No new combat rules, other weapons, multiplayer, phone or Windows runs were added to this art task.
Nothing was pushed, deployed or merged back.

## Beside paths

- `.artifacts/sprites/beside-thistlehog.png`
- `.artifacts/sprites/beside-gearling.png`
- `.artifacts/sprites/beside-thistlehog-fight.png`
- `.artifacts/sprites/beside-boar.png`
- `.artifacts/sprites/beside-gearling-fight.png`
- `.artifacts/sprites/beside-boar-fight.png`
- `.artifacts/sprites/beside-fox-blighted.png`
- `.artifacts/sprites/beside-fox.png`
- `.artifacts/sprites/beside-fox-blighted-fight.png`
- `.artifacts/sprites/beside-thistlehog-blighted.png`
- `.artifacts/sprites/beside-thistlehog-calmed.png`
- `.artifacts/sprites/beside-boar-blighted.png`
- `.artifacts/sprites/beside-boar-calmed.png`
- `.artifacts/sprites/beside-lynx.png`
- `.artifacts/sprites/beside-lynx-fight.png`
- `.artifacts/sprites/beside-rootsnare.png`
- `.artifacts/sprites/beside-rootsnare-calmed.png`
- `.artifacts/sprites/beside-rootsnare-fight.png`
