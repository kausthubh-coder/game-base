# Goods concepts

2026-11-12. Five sheets for Kausthubh's approval. These are painted references for later icons, with 36 item studies and six kit deployments. Approval is pending for every sheet.

Based on `act1` at `9161b86`. Git cannot create `act1/concept-goods` while the local branch `act1` exists, so this work uses `act1-concept-goods`. Nothing was pushed.

## Sheets

| Sheet | Contents | Change from today's icons and reason |
|---|---|---|
| [kit.webp](kit.webp) | Quill strip, lamp post, slick patch, clapper, pusher plate, salve. Each packed and deployed. | Today's lantern supplies the warm light language. The other kit objects need their own silhouettes. Folded pelt, stake, open pot, hinged boards, square copper plate and cream jar identify six different uses. The salve helps a companion rise rather than becoming a trap. |
| [farm-goods.webp](farm-goods.webp) | Wheat, carrot, sunroot, seeds, moss fiber, quills, copper, gear spring, frog slick, honey, wax, glow dust, vine rope, tusk tip, shed pelt. | Today's wheat, fiber and moss tuft become similar yellow-green marks when small. Fiber is a bound sage bundle, quills are a clean ivory fan, and rope is an olive coil with an open centre. Raw copper is red and angular. Wax is matte and pale, honey is an amber jar, slick is a low open dish, and magical dust has a teal vial. New goods share the existing warm highlights and brown shadows. |
| [found.webp](found.webp) | Old brass, heartwood, planks. Main view, side/back or end views, material details, hand for scale. | Today's single plank has fine grain that disappears at 32 px. Three offset boards preserve dark seams. Old brass is a salvaged bracket with a large hole, distinct from copper's solid nugget. Heartwood is a dark red oak wedge with broad rings, distinct from golden boards. |
| [story.webp](story.webp) | Your brass key, Pump House keystone, Lamp Gallery keystone, Seed Vault keystone, memory stone, blessing stone, queen's charter, writ for the road. | Today's small brass key gains its story cord. The new keystones share stone and brass but have different socket silhouettes and water, lamp and sprout motifs. The dead memory stone is rough and dull; the blessing pendant is polished and publicly reassuring. Broad charter and narrow folded writ remain different shapes when their seals disappear. |
| [meals-coin.webp](meals-coin.webp) | Hobb's meal, travel meal, bread, coin. Main objects and material details. | Today's bread stays an oval loaf with bold scoring. A bowl and tied parcel distinguish daily meals from provisions. The coin keeps the current round golden silhouette, with one large grain emblem instead of tiny ornament. |

Every sheet has actual 64 by 64 and 32 by 32 pixel studies in its bottom strip. Object content occupies at most three quarters of each square, matching the current asset contract. View the file at 100% to judge those pixels. These are reductions of the large paintings, not generated illustrations claiming to be pixel-size samples. The large paintings retain their parchment backdrop; the small studies remove edge-connected cream and sit on Gilded Hearth navy wells. Pale edges and the bowl's shadow will need proper alpha cleanup in final sprites.

## Source check

Read `docs/act1.md`, `docs/style-sheet.md`, `docs/assets.md`, `docs/ui-look.md`, handbook chapters `30-farms-machines-and-the-bench.md`, `04d-new-story.md` and `27-act-1-quest-by-quest.md`, and `playthrough/farms.js` in `~/dev/sandbox/game-look-test/`.

Compared against the current manifest's `icons/icons.png`, `icons/icons-2.png` and `icons/mark.png`. Those include wheat, seed, wheat_seeds, fiber, moss_tuft, plank, bread, coin, key, lantern and lamp. Most act 1 goods have no named icon in that manifest yet. New subjects are proposals, not replacements for approved files.

The farm list supplies the fifteen goods. The gear tiers supply old brass and fallen-oak heartwood, with planks coming from felled trees. The kit recipes use those same materials: quills and shed pelt; planks and wax; frog slick; planks and spring; copper and spring; slick and honey. Kitchen, market and ledger uses were checked against the same data. Shed pelt is a grey coat left by a calmed beast, and tusk tip is shed by Bramble. Neither is a hunting trophy.

The story text specifies three keystones from three vaults, dead lumestones holding memories, blessing pendants worn by people, and the inherited brass key on its cord. The Mark is on a hand, so it is not an inventory object here. Its existing teal sigil remains the reference for later hand art.

## Defaults and open decisions

- Sunroot has no locked botanical design. Chosen as a knobbly golden tuber with a russet leaf, so it differs from the carrot and belongs in travel food.
- The three keystone outlines and motifs are proposals. The story locks their vaults and three sockets, not their geometry. Coordinate those sockets with the Old Gate before modelling.
- The blessing stone's ivory teardrop and sun cage, the charter's green oak seal, the writ's gold sun seal, and the coin's grain emblem are proposed symbols. No denomination or legal wording is invented.
- Food plating, the leaf parcel and ceramic containers are proposals. The recipes establish wheat, honey and sunroot; the painting does not add recipe requirements.
- The clapper caption says the boards snap open. For final animation the spring opens the boards and their closing impact makes the crack. Treat this sheet as the shape study; do not copy that caption into the game.
- At 32 px the keystone motifs, coin emblem, paper seals, honey tag and individual moss strands become texture. Their main silhouettes still differ. Final icons should use fewer marks and wider dark gaps, especially the quills and spring. The blessing pendant must remain distinct from a coin through its teardrop outline.
- Hand-scale planks illustrate an inventory token, not a construction board's physical length. Exact deployed kit dimensions remain for the parts/gear coordinator.
- Only the found set has explicit side/back and hand-scale studies. The other sheets prioritise the requested icon and deployment comparisons; they are not full modelling turnarounds.

## Production and checks

Made with the built-in `image_gen.imagegen` tool, one generation per sheet, using the two current icon atlases and the approved `standingStones.webp` concept as visual references. Full prompts are in [prompts.json](prompts.json). Pillow only cropped, removed background from preview crops, resized, laid out labels/wells and encoded the selected paintings. No replacement item art was drawn in code.

All five final WebPs were opened and inspected, including their small studies. All 36 requested item studies and six kit deployments are present. Each file is below 600,000 bytes. The change is limited to this folder. No game code, shipped assets or manifest entries changed, so runtime, asset-pipeline and browser checks do not apply to these approval references.
