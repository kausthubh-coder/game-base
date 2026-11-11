Gilded Hearth UI kit

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

Verification evidence lives in .artifacts/ui-kit/. The asset verifier has one documentation warning because docs/assets.md does not yet describe the new lazy uikit section. The verifier explicitly checks its PNG paths and the 384 by 288 tab sheet with 96 px tiles. Global PNG and folder size caps also apply. No source files changed, no dependency was added, and nothing was pushed or merged.
