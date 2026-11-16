# Braid core sheets

Status: PASS for the two core sheets. The repaired pixels in candidates/anchor are published under new names. The corrected Ilara portrait ranking is preserved. Neither sheet is selected by normal play.

The attempt-1 raw sources and original rejected candidates are unchanged. One generation attempt has been used per sheet; two remain per sheet. This repair uses whole-figure translation only. Every generated RGBA pixel is preserved at the original fitted scale. No replacement character pixels were drawn.

Rebuild from the repository root:

```sh
bun tools/sprites/hero-braid.mjs
bun tools/sprites/hero-braid.mjs --swing
bun test tools/sprites/hero-braid.test.mjs
cmp assets-src/hero-braid/candidates/anchor/hero-braid.png .artifacts/hero-braid-anchor/hero-braid.png
cmp assets-src/hero-braid/candidates/anchor/hero-braid-swing.png .artifacts/hero-braid-anchor/hero-braid-swing.png
```

The builder outputs to .artifacts/hero-braid-anchor, overridable with BRAID_OUT. The --legacy flag reproduces the original alignment for comparison. ATTEMPT values other than 1 are rejected until their own stance metadata exists. Action palette snapping reads the retained base-identity-reference.png, eliminating the old dependency on a pre-existing artifact.

stance.json records boot-pair landmarks in the original fitted 128px cells. The builder converts these to raw-cell coordinates before placement. The explicit action ROIs exclude the axe even when it reaches the ground. Idle frames align their boot pairs; walking applies one direction-wide offset from idle so it retains its stride and body sway. The original per-sheet scales remain 0.6111111111111112 and 0.5188679245283019, with 128-square frames, manifest anchor [64,120], worldHeight 2, idle 4 at 4 fps, walk 6 at 10 fps, tool 3 at 9 fps, front/back/right.

The actual-asset regression fails on the original tool frames and passes on the repaired output. Tool boot-origin spans shrink from 19, 22.5 and 17 pixels to 0.5 pixels in front/back/right. All nine repaired origins sit within half a pixel of column 64. Walking keeps a constant translation in each direction. The all-frame test also verifies that every figure, braid and axe retains its exact pixels and opaque area.

All native direction timelines and high/low diagnostic timelines have been inspected, alongside Copper, Hobb and Dax on an unobscured diagnostic floor. No face appears on the back; all profiles face right. The torso no longer follows the moving axe. Side strike and recovery remain close in silhouette. The action keeps a slight source-authored forward lean. The diagnostic is not mirror integration.

## Published core sheets

The accepted repaired sheets are appended as hero-braid and hero-braid-swing.
Normal play stays inactive until combat/camp sheets and the shared look resolver
are ready. The generated pixels and stride are unchanged from source 31515f61.

The optional offline support contract now measures actual pixels inside retained
regions in ground-contact.json. Both complete commands use the same validator.
See docs/assets.md for region constraints and the sole-band review requirement.
Side strike/recovery remain close in silhouette. The publication evidence and
commands are in .artifacts/hero-braid-publish/report.md. Earlier failed evidence
and registration.patch remain historical records.
