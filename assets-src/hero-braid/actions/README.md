# Braid action attempts

ISSUES. All seven new sheets exhausted three genuine referenced image-generation attempts. None passed identity continuity. No new sheet is registered or published. Normal play remains on Copper.

`provenance.json` records all21 prompts, attached references, tool output records, raw filenames and rejection reasons. Raw sources remain intact. The first cut was taken through source processing, native review and exact-frame high/low renderer review before extending the pipeline.

Candidate rebuild, from this checkout:

```sh
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs cut
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs cut-back
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs moves
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs call
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs bow
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs staff
ATTEMPT=3 bun tools/sprites/hero-braid-actions.mjs camp
bun tools/sprites/hero-braid-actions-check.mjs 3
bun test tools/sprites/hero-braid-actions.test.mjs
```

Outputs are candidates under `.artifacts/hero-braid-actions/<action>-attempt-<n>`, never public assets. `BRAID_OUT` selects another candidate folder. The builder slices, cleans alpha, snaps the character/weapon palette and aligns complete figures. Camp attempt2/3 row boundaries use inspected source gaps; no identity pixels are painted. All three camp rise endpoints copy accepted Braid idle frame zero; unused cells remain transparent. Camp attempt1 refuses uniform slicing because it cannot fit at body scale.

Twenty processable candidates rebuild byte-identically. The first camp attempt remains a rejected raw source. Automated art and geometry checks can pass candidates whose heads visibly differ. Each of the seven files under `assets-src/art-reviews/hero-braid-*.md` records a FAIL, with the native and world paths inspected. Evidence, source/reference hashes, exact-frame capture audits and command logs live in `.artifacts/hero-braid-actions`.

The shared look resolver, mirror selection, fight and camp integration remain later work after the complete family passes. No 3D, other looks, cloud, Act1 or weak-device acceptance is implied.
