# Groups 7 and 8: concept handoff

PASS: nine model sheets cover every requested variant, plus two vistas. Each final WebP was opened after compression and compared with the supplied map pieces, story scenes, town shot, and painted rock and meadow textures. All images are 1600 pixels wide and under 600,000 bytes. Only `assets-src/concept/` changes.

## Sheets

| Path | Coverage |
|---|---|
| `7-ways-down/galleryMouth.webp` | Three-quarter, front, side; dead lamps and dark mirrors |
| `7-ways-down/caveMouth.webp` | Three-quarter, front, side; roots over natural rock |
| `7-ways-down/vaultRoots.webp` | Three-quarter, front, side; living roots and Calla's seal |
| `7-ways-down/crystals.webp` | Small and large, three views each |
| `7-ways-down/vista.webp` | Cave hills, underground Gallery, Old Forest Vault, in separate labeled views |
| `8-set-pieces/rockArch.webp` | Three-quarter, front, side; grand walk-under arch |
| `8-set-pieces/boulders.webp` | One, pair, pile, three views each |
| `8-set-pieces/fallenGiant.webp` | Three-quarter, end, full-length side; hollow oak tunnel |
| `8-set-pieces/stiltHut.webp` | Three-quarter, front, side; raised hut and approach |
| `8-set-pieces/boardwalk.webp` | Three joined modules, front, side, underside joint |
| `8-set-pieces/vista.webp` | Marsh at early dusk, lanternflies, dry forest margin and rock ridge |

## Defaults and instructions for Astra

- The group 1 stone note was absent on its local branch. `stone-4.md` records provisional honey limestone for the coordinator to reconcile.
- The table gives one crystal envelope. Large uses 3 x 3 x 4; small uses 1.5 x 1.5 x 2. Boulders use 5 x 4 x 4, 6 x 5 x 5, and 6 x 6 x 5 respectively.
- Gallery lamps are non-emissive smoke-grey glass in aged brass. Bright marks in the painting are reflected daylight. Do not add point lights or emissive cores.
- The Gallery's exterior vegetation on its isolated sheet describes surface treatment. Place the actual door underground, as the vista shows.
- Vault door material follows its model sheet: oak panels and bronze fittings with a gold sun seal across the seam. The vista's lighter door is an atmospheric simplification.
- The fallen oak's 5-block diameter excludes the two incidental broken branch tips. Keep a 3-block clear bore for its entire 24-block length. Use forest soil for the floor; painted paving is approach context.
- Boardwalk deck is 1 block above its base; hut porch is 2. Use a short transition ramp or the hut's approach steps. Straight boardwalk modules remain level and meet without a gap. Shared boundary posts should be emitted once.
- Vistas describe atmosphere and scale rather than surveyed placement. The marsh composition gathers dry-land set pieces at its margin. Group 7 is a triptych because its landmarks occupy separate places.
- Use the labeled dimensions and main views to build. Incidental leaves, flowers, backdrop trees and surface strokes can use the existing biome dressing and painted materials. These are concepts, not measured mesh drawings; the 6,000-triangle limit still needs checking on the eventual models.

## Generation and checks

Built-in `image_gen` made these paintings. `prompts-4.json` records the shared prompt, subjects and vistas. The Gallery sheet used the lamp-gallery map piece and game's rock painting as image references. Other first sheets used the Gallery sheet for visual continuity; vistas additionally used the whole map. Crystal and boulder sheets were regenerated without an image reference to correct scale and unwanted copied content. Their rejected drafts were deleted.

References opened: `docs/shots/approved/town.png`; `public/assets/painted/rock.webp` and `meadow.webp`; handbook `greenhollow-map.png`; map pieces `lamp-gallery.png`, `seed-vault.png`, `ruin.png`; story scenes `13-gallery.jpg` and `15-stag.jpg`. Read `docs/painted-world.md`, `docs/greenhollow-world.md`, and `04d-new-story.md` before painting.

Compression: `cwebp -q 85 -resize 1600 0`. Recheck file acceptance with `bun assets-src/concept/verify-4.mjs` from the repository root.

`bun tools/doctor.mjs --quick` passed. `bun tools/verify-assets.mjs` passed all nine checks. Its existing warning is that `docs/assets.md` does not describe `manifest.uikit`; this task changes neither file. No runtime assets, code, manifest, or approved shots changed, so no game build or new play session was needed for this source-art handoff.
