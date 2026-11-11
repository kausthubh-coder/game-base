Gilded Hearth UI kit

Round three adds sixteen built-in image-generator assets for the two menu directions. Raw attempts are in raw/ui-kit, with prompts, source paths and the requested tabs2 mapping in ui-kit-round-three.json. Existing art and manifest entries remain unchanged. No src files changed.

Rebuild with `bun assets-src/process-ui-kit-3.mjs`, `bun assets-src/preview-ui-kit-3.mjs`, and `bun assets-src/check-ui-kit-3.mjs`. The processor preserves generated structure, crops transparent padding, resizes, cleans the icon backing and normalizes its gold. Leather repeat edges are blended and matched. Page edges match vertically. Paper and leather-panel grain receive slight smoothing with their original alpha preserved. Sharp compresses the final PNGs to 381,324 bytes, or 381.324 decimal KB.

I inspected preview-3.png on cream and navy, including small, wide and tall nine-slices, the tileables repeated 3x3, 48px and 24px icon cells, a satchel with twelve pockets and a tag, and a paper scroll between rollers. No letters or visible matte remain. Icons used three attempts: the first had a cream backing and bevelled strokes; the second matched the thin linework but drew a handled bag; the third changes that glyph to a drawstring pouch. All other pieces use attempt one.

Round-three limits:

- icons2: the thin gold lines have low contrast on cream at 24px. Prefer navy behind these icons. The person, creature and hand retain more detail than the simple navigation marks.
- leather: grain is very quiet after colour normalization and compression, almost flat at CSS size.
- rail, roller and keycap: use the intended CSS heights of 60px, 64px and 64px. The deliberately tall preview distorts their caps and ornament.
- leather-panel and pocket: stretching changes stitch spacing and the grain's proportions. Use moderate aspect changes as shown in the satchel.
- bookmarks: the four independent generations have small differences in weave and notch proportions.
- tabs2: parseManifest accepts the requested additional field and still returns only ui in images and portraits, crops and materials in sheets. However, the production packager fails with `Circular asset list: ui/kit/icons2.png` when the same file is referenced by icons2 and tabs2. To preserve the build without editing code outside this brief, the manifest retains only uikit.images.icons2. The exact requested tabs2 mapping is saved in ui-kit-round-three.json for the coordinator. This is a packager limitation, not a parser rejection.

The pre-existing asset-verifier warning about uikit documentation remains. Sanity checks verify all exact sizes, true transparent exterior pixels, the card frame's empty centre, matching tile edges, the combined byte cap, unchanged earlier manifest entries and lazy loader groups. Final verification logs are in .artifacts/ui-kit, alongside preview-3.png.

Final round-three checks passed: `bun tools/verify-assets.mjs`, `bun run check`, and `bun run verify assets build shots`. The baseline passed the same checks before the change. Nothing was pushed or merged.

Built with the built-in image generator, then cropped, resized, alpha-cleaned and compressed with sharp. No palette snapping to the pixel sprite palette. All 21 finished images are in public/assets/ui/kit/. Raw generations and rejected attempts are in assets-src/raw/ui-kit/. Prompts and selections are in ui-kit-prompts.json.

The coordinator's second correction defines the manifest. Existing ui and every other existing entry remain unchanged. uikit is nested with lazy: true, images and tabs. parseManifest returns only ui in images and portraits, crops and materials in sheets. It ignores uikit. There is no uitabs entry. Game integration belongs to the coordinator.

Sizes and slices are in ui-kit-slices.json. Slice order is top, right, bottom, left, in image pixels. Buttons, hint and name-plate stretch horizontally; their top and bottom slices are zero. The tall preview deliberately exaggerates their caps. Keep their intended height when integrating them.

Rebuild from this checkout with:

    bun assets-src/process-ui-kit.mjs
    bun assets-src/register-ui-kit.mjs
    bun assets-src/preview-ui-kit.mjs
    bun assets-src/check-ui-kit.mjs

The processor retains generated art. It removes exterior flecks and transparent padding, normalizes the fills and restores opaque alpha inside the tooltip's generated closed rim. Edge strips repeat a clean source profile, and panel centres use a flat source sample. This removes generated diamonds from the stretchable middles. The stars fade at the tile edges and peak at 22% alpha. The preview shows their 3 by 3 repeat. The sanity script verifies exact sizes, transparent ground, ring holes, repeated edge profiles, the icon grid, lazy loading and the folder cap.

I inspected preview.png and enlarged crops on grass #7FB04A and night #141824. I checked all three stretched shapes and the star repeat. No visible matte, exterior pale halo, text or smeared edge ornament remains. The compass and clock centres are transparent.

Weak pieces and limits:

- panel: the grain is largely lost after fill normalization. It is intentionally quiet, almost flat parchment.
- name-plate: the parchment field is more solid than a softly disappearing banner. Only the outer tips fade.
- tabs: the person bust has hair detail, and the crafting/book/map icons are busier than the play and diamond marks. They are recognizable at the intended 48 CSS pixels but do not have identical visual density.
- minimap-ring: the cream-and-gold ornament is heavier than a fine compass hairline. It should suit a prominent minimap, but may compete with a very small map.
- button, button-light, button-gold and hint: horizontal stretches are clean. Large height changes distort their generated caps, as shown in the tall preview. name-plate has the same limitation.

The first two tooltip attempts had unwanted transparent interior regions; attempt 3 plus enclosed-alpha cleanup is kept. The first tab sheet was filled illustration and included an exclamation mark; the second line-art sheet is kept. Other pieces use attempt 1.

Round two adds eleven generated pieces for the book, map, pause tiles and bag detail pane. They total 390,592 bytes, or 390.592 decimal KB. Each has its requested size. Existing manifest entries are unchanged, and the loader still returns only ui in images and portraits, crops and materials in sheets. uikit now contains 31 lazy images.

Rebuild this round with `bun assets-src/process-ui-kit-2.mjs`, then `bun assets-src/preview-ui-kit-2.mjs` and `bun assets-src/check-ui-kit-2.mjs`. The processor uses the committed raw PNGs. The round-two JSON files record original specifications and retry prompts. The combined prompts and slices files remain the integration records.

Gutter attempt 1 drew unwanted gold ornament. Attempt 2 supplies the stitched shadow. Slot-empty attempt 1 was too ornate; attempt 2 supplies the plain inset well. Other pieces keep attempt 1. Processing crops and removes detached flecks, normalizes leather and tile fills, repeats plain edge profiles, blends texture offsets at tile boundaries, attenuates paper contrast, and compresses PNG palettes with sharp. Fog retains cream RGB under its partial alpha. Gutter fades to zero alpha at both sides. Opposing repeat edges match pixel for pixel after compression.

I inspected preview-2.png on cream #ece5d8 and navy #141824, including small, wide and tall nine-slices, 3x3 repeats, the two-page spread and a 36-slot grid. No text, matte, exterior halo or smeared ornament remains. The pages in the spread cover part of the cover's corner caps; allow a wider leather margin if those caps should be fully visible.

Weak pieces and integration limits for round two:

- map-fog: seamless and soft, but its repeated cloud clusters can become noticeable over a large uniform dark region.
- tile and tile-hover: fill normalization makes the upper glow read as a broad vertical fade rather than a tightly radial glow. Their corner accents also have small leaf curls around the diamonds.
- page: fibres are very faint after contrast reduction and compression.
- slot-empty: keep square proportions for the intended bag grid. Its central diamond stretches with the nine-slice centre in exaggerated wide or tall shapes.

Verification passed for exact sizes, alpha, repeat edges, the combined byte cap and unchanged existing manifest entries. `bun tools/verify-assets.mjs`, `bun run check`, and `bun run verify assets build shots` passed. The asset verifier still gives the pre-existing uikit documentation warning even though docs/assets.md describes the section. No src files changed, no dependency was added, and nothing was pushed or merged into another branch.

Verification evidence lives in .artifacts/ui-kit/. The asset verifier has one documentation warning because docs/assets.md does not yet describe the new lazy uikit section. The verifier explicitly checks its PNG paths and the 384 by 288 tab sheet with 96 px tiles. Global PNG and folder size caps also apply. No source files changed, no dependency was added, and nothing was pushed or merged.
