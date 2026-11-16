# Act 1 rooms

Concepts for Kausthubh's approval. Each painting includes a high three-quarter view, a floor plan with block dimensions, a hero scale reference and named key props. Dimensions below are proposed clear interior footprints unless called exterior. One block is one metre.

| Sheet | Proposed dimensions | What it establishes |
|---|---|---|
| [guildHall.webp](guildHall.webp) | Complex 32 x 26; bunk room 12 x 8; kitchen 10 x 10; yard 22 x 12 | Saltgate guild home, map wall and ladder, kitchen, bunks and painted wall, locks and sea chest, weapon rack, sparring space, deed table. |
| [hallInside.webp](hallInside.webp) | Court 26 x 24, surviving arches 10 high | Open sky, Heartstone, bridges and shallow rill, Custodian plinth and book, dead Gate, eight mural niches with one figure cut away. |
| [pumpHouseInside.webp](pumpHouseInside.webp) | Exterior fixed 22 x 16 x 16; upper clear 20 x 14; underground chamber 24 x 20 x 8 | Wheel and shaft teach water power. Floodable channel 6 wide, dry routes at least 3 wide, bridges and lever, keeper, reward dais. |
| [lampGallery.webp](lampGallery.webp) | 14 x 30, vault 8 high; arena 14 x 18 | Sequential sensor lamps, beam lanes, cover inside arena, portable lamp position, sentry, north rewards. |
| [seedVault.webp](seedVault.webp) | 24 x 24 x 9 | Sealed southern oak door, west root bypass, seed storage, anchored arm, three organic root pods and companion brace position. |
| [rootworks.webp](rootworks.webp) | Three floors, each 22 x 18 x 8; descent 24 | Waterwheel, sensor lamp and arm repairs in that order. Each floor has a root lock, rope landing and waystone home. |
| [stagHall.webp](stagHall.webp) | 40 x 36 x 24; Stag shoulder 12, antlers reach height 20 | Four chain pins, fighting ring, lamps suppressing dark pods, climbable vines and last collar chain. |

## Source continuity

Read docs/act1.md including Concepts, docs/greenhollow-world.md, docs/painted-world.md and assets-src/concept/stone.md. Read handbook 22-scenes-and-script.md, 23-fighting.md and 27-act-1-quest-by-quest.md.

Opened and compared approved entrances:
- hallInside continues 3-sacred/hallDoor.webp, its round split door and 9 x 3 x 8 frame.
- pumpHouseInside continues 4-water/pumpHouse.webp, its 12-block brass wheel, teal roof and cream arches.
- lampGallery continues 7-ways-down/galleryMouth.webp, its pointed arch and paired lanterns.
- seedVault continues 7-ways-down/vaultRoots.webp, its oak doors, gold seal and living root roof.
- rootworks continues 2-terraces/oldGate.webp, its round disk and three sockets. stagHall shares its monumental masonry and roots.

Opened story scenes 06-hall.jpg, 12-pump-house.jpg, 13-gallery.jpg and 15-stag.jpg, plus cine/p3-hall.jpg and p4-key.jpg. Borrowed warmth, timber and map-filled guild atmosphere. The Stag stands, following chapter 27 rather than the reclining pose in the older story picture. It attacks throughout the fight and rests only after release.

## Defaults and remaining illustration discrepancies

These notes take priority over generated lettering or perspective proportions.

- All new interior dimensions, lamp counts except Ilara's seven, pod count and exact prop placements are proposals. Existing exterior dimensions stay fixed. Subterranean rooms can extend beyond their entrance buildings.
- Guild bunks are on a northern mezzanine in the painting. The top-down plan collapses this into the north wing. Connect it by stairs beside the map wall, keep 2-block clear routes, and avoid a ladder-only player route. Exact mezzanine elevation needs approval.
- Guild mural has a king, six gold friends and a scraped place. Ilara's older mural preserves seven figures and one removed figure. This difference follows the story. Final portraits defer to the approved old-ones sheets.
- Ilara's court has seven lamps, six intact and one broken. Its floor plan simplifies them to four icons; the main painting and story count govern. The small east table entry still says draped figure, but the corrected painting and plan show the small moss-and-brass Custodian. Do not build a tomb. Memory stones are plum-sized portable objects, not the oversized engraved slab used as their visual callout.
- Pump House rewards belong only on the downstairs north dais after the fight. The painting retains duplicate display props upstairs. Do not duplicate collectible rewards in implementation. The teaching strip's first icon was changed to the keeper during revision; the teaching part is the exterior WATERWHEEL, then shaft, lever and spray. The main keeper is shown parked beside water; the fight takes place in the 6-block channel, as the plan and flood panel show.
- Gallery revision retained a wedge-shaped keystone beside a round socket stone. There is ONE collectible keystone per vault, a round socket-sized stone for Old Gate. Ignore the extra wedge collectible and socket-stone distinction. Its purple memory crystal is a diagram symbol; use a plum-sized dull stone in final art. Keeper identity follows ../keepers/lamplighter.webp.
- Seed Vault's small round keystone and memory stone are separate portable rewards. The companion must hold the arm while the hero breaks pods. The optional low support in the painting does not win the fight for the player. Keeper identity follows ../keepers/wildHarvester.webp.
- Rootworks' arm is a smaller repair machine, not another keeper. Rope route and waystone on every level provide a way back. Repair materials come from the pack, not free complete machines.
- Stag hall dimensions are provisional until its final character sheet is approved. Four low pins break first, then lamps suppress overgrowth, then vines lead to the final collar chain. Some small phase-one text still says turn/release: strike and BREAK the pins as chapter 27 and the revised action painting show. The 20-block label means antler height; sweep range is a tuning proposal, not a fixed 20-block collision radius. Keep retreat lanes outside the actual sweep.
- Palette swatches are painterly approximations. stone.md supplies authoritative material colors. Hero scale figures and banners do not prescribe final character or faction designs.

## Production and verification

Built-in image generation produced these concepts; prompts.json preserves the actual prompts and revisions. Final images were encoded with cwebp quality 82. Drafts were kept few; only selected WebPs are in git.

PASS: all seven requested room sheets exist, decode and were individually opened after the final revisions.
PASS: every room has the requested camera view, measured plan and named props, with discrepancies recorded above.
PASS: each file is under 600,000 bytes, measured from final WebPs.
PASS: git changes are confined to assets-src/concept/keepers/ and assets-src/concept/rooms/.

The verify-game skill was read. Runtime checks, builds and browser play do not exercise source concept paintings, so the explicit art acceptance checks were used. No shipped asset or game code changed.

The requested branch act1/concept-rooms cannot coexist with Git's existing act1 branch. Work is on act1-concept-rooms, fast-forwarded from act1 at 9161b86. Shared act1, main and playtest were untouched. Nothing was pushed.

Approval is pending. These sheets authorize no final sprites or 3D models.

