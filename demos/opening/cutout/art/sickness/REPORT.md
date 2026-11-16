PASS for the second round's static mask review and checks. No remaining background halos or accidental paint holes were found in the fresh rest and isolation sheets at the reviewed scale. This is a visual finding, not a mathematical guarantee about every alpha pixel.

Branch: lab/opening-art-b. No merge or push. The first delivery was 89f3ef0; these are the follow-up shot commits:

- ba01eaf, sickness flower mattes and removal of king paint from the grave.
- 9646af8, sickness lily interiors.
- 1b3ff52, gods band masks, neighbouring fragments and cloud paint.
- 9eb85b1, keep detached floral paint in the wreath rather than dropping it from the composition.
- ed57705, Mark curved fingertips, hand edge and cloud repairs.
- 779f253, original night canopy rim and transparent king replacement.

What changed:

- Sickness: close narrow extraction cuts and fill bounded paint holes; preserve the first grave's upper lily with its own matte; discard the king's knee paint. Restore pale lily interiors without changing the bed stone repair.
- Night: use the approved canopy's rim and outer paint. Reconstruct the areas hidden behind the city and king using the retained empty-canopy drawing, with feathered transitions. Replace the king extraction with a transparent drawing referenced directly to the approved plate. The complete hoe, hand, legs, skin and clothes are intact.
- Gods: compare the original gold paint with the unbanded drawing, discard colour that did not change into a band, remove disconnected scraps, and fill the cloud interiors. Remove neighbouring creature fragments from the beast crops. Keep detached leaves and flowers in the wreath.
- Mark: replace straight polygon corners with a supersampled curved silhouette, remove plaster from the boundary, round the fingertips, and repair the elephant and tortoise cloud interiors.

Reproduction, from the repository root:

- `bun demos/opening/cutout/art/sickness/build.mjs` rebuilds all four. Append sickness, night, gods or mark to rebuild just that shot.
- `bun demos/opening/cutout/art/sickness/check.mjs` writes the rest and isolation sheets.
- `bun demos/opening/cutout/art/sickness/alpha-check.mjs` checks ten opaque/clear points on the repaired areas. Initial run caught the first grave's king paint. Its point checks supplement visual review; they do not certify every edge.
- `bun demos/opening/cutout/art/sickness/shared-check.mjs demos/opening/cutout/art/<shot> .artifacts/opening/art-b/shared-round-2` runs the unchanged art-a checker. Ran for all four shots.
- `bun demos/opening/cutout/art/night/src/compare.mjs` writes the original king beside the replacement.

Final check output:

- PASS sickness: 21 layers, 29 files, 429836 shipped WebP bytes.
- PASS night: 5 layers, 5 files, 565502 bytes.
- PASS gods: 15 layers, 15 files, 456724 bytes.
- PASS mark: 9 layers, 9 files, 305388 bytes.
- Both manifest checkers pass all four shots. Dimensions, frame bounds, IDs, pivots, alpha and the 1.5 MB budget pass.
- Alpha regression points: 10 PASS, 0 FAIL.
- `bun tools/typecheck.mjs opening`: exit 0.
- `bunx biome lint demos/opening`: exit 0, 30 files checked, no fixes applied.
- `bun run check`: exit 0, output in `.artifacts/opening/art-b/check-round-2.log`.
- `bun tools/verify-assets.mjs`: TOTAL PASS, 9 passed, 0 failed. Existing warning about undocumented uikit manifest section remains. This command checks the game's public assets; the lab WebPs are checked by the two manifest checkers.
- `git diff --check`: exit 0.

Fresh pictures, all opened:

- `.artifacts/opening/art-b/sickness-rest.png`
- `.artifacts/opening/art-b/night-rest.png`
- `.artifacts/opening/art-b/gods-rest.png`
- `.artifacts/opening/art-b/mark-rest.png`
- `.artifacts/opening/art-b/sickness-pieces-1.png` through `sickness-pieces-3.png`
- `.artifacts/opening/art-b/night-pieces-1.png`
- `.artifacts/opening/art-b/gods-pieces-1.png` and `gods-pieces-2.png`
- `.artifacts/opening/art-b/mark-pieces-1.png`
- `.artifacts/opening/art-b/night-king-comparison.png`

The rest images show approved picture left, rebuilt stack right. Isolation sheets show every piece and alternate drawing on dark grey and bright red. Full-resolution versions from the art-a checker are also in `.artifacts/opening/art-b/shared-round-2/`, named `<shot>-rest.png` and `<shot>-pieces.png`.

Drawing differences and limits:

- Sickness: no remaining hole or king-paint defect seen. Bed pieces still share the original flower-stem boundaries; separate movement of those flowers was not requested or checked.
- Night: no canopy fringe seen on the new king. It is a regenerated drawing, so face, tunic folds and relative proportions differ slightly. The outer canopy matches the original rim; its formerly occluded central paint is reconstructed, not pixel-identical to the plate. Painted trails and the separate stars still need the animator's chosen reveal/fade.
- Gods: no neighbouring creature fragments or cloud pinholes seen on the cleaned beast pieces. Original paint texture and natural negative spaces between antlers, limbs, bands and leaves are retained. Some foreground foliage travels with beasts; detached foliage is in the wreath.
- Mark: no pale hand fringe or cloud holes seen. The wrist deliberately fades into the ground; the curved silhouette is slightly tighter than the first delivery.

New generated source: `night/src/king-raw.png`, exact prompt and tool in `night/src/king-generation.json`. The generated source and original plate were compared in the king comparison picture. All other raw generated sources and prompts from the first delivery remain in their shot src folders. No new dependency was added.

Not checked: playback in the merged cutout renderer, breathing or deformation, canopy closure, emitted light paths, Mark timing, audio, browser load, or the seam into the engine. This round checks the local static art, masks and repository regressions.
