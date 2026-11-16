# Gear concepts for approval

Seven concept sheets for Act 1. These propose the next asset pass. They do not replace the shipped sprites or imply approval. All paintings were made with the built-in image_gen tool. Full prompts are in `prompts.json`.

The starting point was local `act1` at `9161b861ff8455e876effbf7879c37e110ad09bc`. Git cannot create `act1/concept-gear` while a branch called `act1` exists. I used `act1-concept-gear`, preserving the integration branch.

## Sheets

| Sheet | Contents and change from today | Why |
|---|---|---|
| [sword.webp](sword.webp) | Guild iron, copper-edged, spring-hilted brass, tusk and heartwood. Front silhouettes, side and reverse hilt details, held hero studies. | Today's small pale sword has little material identity. Broad edges, a copper perimeter, a brass guard and an ivory curve distinguish the four steps. |
| [bow.webp](bow.webp) | Guild bow, copper-tipped arrows with a copper-braced bow, spring bow, tusk bow. Each has an arrow, held study and reverse grip detail. | Today's narrow brown bow blends into the brown hero. Pale grip breaks, exposed brass housings and ivory tips improve separation. The copper upgrade still belongs chiefly to the arrowhead. |
| [staff.webp](staff.webp) | Guild staff, copper-shod, brass-capped, rootwood. Front and reverse heads and shoes, front and side held studies. | Today's little knob reads like a stick. Round, split-petal, cage and fork crowns make the tiers different even without colour. Teal stays on magic. |
| [armour.webp](armour.webp) | Canvas jacket, padded jacket, quill coat, root-weave on the same hero, front and back with material details. | The existing hero has one ochre-and-brown outfit. These add visible padding, ivory shoulder panels and branching ribs while preserving the cape, hair and boots. |
| [fittings.webp](fittings.webp) | All six fittings, each attached to a weapon, with a detached component and held study. | The current inventory atlas has no fitting family. Shape and material identify each choice rather than a small colour change. |
| [tools.webp](tools.webp) | Axe, hoe, spade, watering can and hand saw. Large portraits, reverse details, inventory views and held working poses. | Today's axe head is tiny, and the narrow farm tools are hard to separate. A broad wedge, perpendicular hoe blade, D-grip spade, open can handle and toothed saw give each a different outline. |
| [icons.webp](icons.webp) | All 27 items: twelve weapons, four coats, six fittings and five field tools. Each appears at exactly 64 and 32 pixels, plus the same 32-pixel image enlarged three times with nearest neighbour scaling. | This tests the proposed silhouettes on the UI's actual dark navy wells. Today's two manifest atlases provide one icon per weapon and no armour progression. |

Each of the first six sheets also has a bottom strip of actual 128-square held studies. View at 100% to judge size. The large painted examples have illustrative pixel studies; the bottom strip supplies the measured frame size. These are resampled concept studies, not palette-snapped animation frames.

## Bench check

Read against `playthrough/farms.js` and chapter 30 in the handbook, with chapter 23 for the hero's three fighting tools.

| Step | Weapon and armour check | Inputs and fitting choices |
|---|---|---|
| Guild issue | Guild sword, bow and staff; canvas jacket | Guild loan. No fitting. |
| Copper-bound | Copper-edged sword, copper-tipped arrows, copper-shod staff; padded jacket | Bait-field copper and shed pelts. Quill edge from quills, or padded grip from moss fiber. |
| Brass-fitted | Spring-hilted sword, spring bow, brass-capped staff; quill coat | Pit springs and old brass found at the mill or Pump House. Spring hilt or glow cap from glow dust. |
| Tusk and root | Tusk blade, tusk bow, rootwood staff; root-weave | Bramble's shed tusk tip, vine rope and heartwood from a fallen oak in the grey forest. Slick sheath from frog slick, or honey binding from wax and honey. |

Quill edge empties more guard every third hit. Padded grip lengthens the dodge. Spring hilt charges one heavy strike. Glow cap marks a beast for the companion and makes light-fearing beasts flinch. Slick sheath leaves a slip hazard after a dodge. Honey binding restores stamina faster. The paintings' abbreviated captions do not replace these rules.

The six consumable kit things belong to the separate `goods` concept set in `docs/act1.md`. I read the kit to keep quill edge distinct from quill strip and the slick sheath distinct from a slick patch. They are not extra weapons on these sheets.

## Defaults and questions for approval

- The handbook names both a spring-hilted base sword and an optional Spring hilt. I treated the base as a spring-ready housing and the optional fitting as the charge-and-release cartridge. This distinction needs design approval before implementation. Likewise, a brass staff's ordinary crown is not automatically the glow-cap fitting.
- Rootwood comes from the fallen oak. Treat the leaf and root shapes as carved motifs with vine binding. Generated captions that say "living wood" or "living vine" describe the visual treatment, not an added living-tree ingredient or new mechanic.
- The quills read somewhat like feathers in the painting. Default to short stiff ivory thistlehog quills in final sprites, with the same flat fan silhouette. Avoid a lethal-looking spike coat.
- I kept the current hero identity. The concept model is a little more rounded and expressive than today's sprites. Approval is for equipment and materials; a separate hero concept should settle any face or proportion change.
- At 32 pixels the copper arrowhead is a very small cue. Default to a broader orange tip and a clear copper grip collar in final pixel art. Coils, stitches and saw teeth must collapse into simple blocks. The icon master also leaves cream inside some bowstrings; those holes must become transparent when final icons are painted.
- Fitting examples use one appropriate weapon each. Cross-weapon mount variants are not settled here. The slick sheath is shown with a sword; the staff and bow equivalents need the same functional reservoir rather than a sword scabbard forced onto them.
- The armour sheet includes incidental held props and an exaggerated teal staff in its small studies. Those are pose aids, not additional approved equipment. Use `staff.webp` for staff proportions. Field tools share guild workshop materials; the handbook does not specify upgrade tiers for them.
- The printed material swatches are a concept palette. Final sprites must use the locked palette, transparent backgrounds, tinted outlines and the existing anchor contract. Painted ground and shadows on these reference sheets must not enter final sprites.

## Verification and source

Opened every source painting and every final sheet. Compared the designs with `hero.png`, `hero-swing.png`, `hero-bow.png`, `hero-staff.png`, `hero-cut.png`, and both icon sheets located through `manifest.json`. Checked all four bench steps and the six fitting pairs above. The saw is newly proposed; it has no matching current item icon.

All seven sheets decode as WebP at 1600 by 1210 pixels. Every file in this directory tree is below 600,000 bytes. The native icon sizes are set explicitly by `build-review.mjs`; the enlarged view uses the actual 32-pixel sample. The saved icon master is in `sources/icons-master.webp`. It is a source painting, not an eighth approval sheet.

`bun install` completed without changes. `bun assets-src/concept/gear/build-review.mjs` builds the native-size review strips and inventory board using the existing Sharp dependency. It crops and scales generated paintings; it does not invent gear by code. The first six paintings remain in the top 1568 by 1003 region, so the script can be rerun. Original generated PNGs remain in the tool's external output folder; no duplicate draft PNGs were added here.

The `verify-game` skill was read. This is a concept-only change outside the runtime manifest; the relevant proof is decoded pictures, bench coverage, native-size review, file bounds and a scoped git diff. No game behavior, shipped asset, manifest or approved screenshot changed, so runtime checks were not run.

Result: all requested sheets and file/scope checks pass. Approval questions and final-sprite cleanup remain as listed above. Nothing was pushed or merged to main or playtest.
