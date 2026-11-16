# Check the stance of asymmetric sprites

Continue the two-sheet Braid delivery. Source 31515f61 fixes the stance by
placing inspected boot pairs at x=64. Helper evidence e9494dc5 retains the
native and renderer checks. The coordinator repeated the real-pixel tests
and inspected front/right timelines. The stance repair passes; the old tool
origins still fail the negative control. Neither candidate is published.

The remaining incompatibility is in tools/sprites/check-story.mjs. It calls
the centre of the complete opaque bounding box the horizontal anchor. That
is a useful default for simple symmetric figures, but includes the braid and
moving axe. The repaired tool windup has a silhouette centre of 50.5 while
its boot-pair origin is 64. Both values are correct measurements of different
things. Increasing the six-pixel limit or moving the body back is not a fix.

## Decision and scope

Use GPT-6.1 Sol in the existing forest checkout. This brief explicitly permits
a narrow checker/asset-contract change, superseding the earlier briefs'
prohibition on checker changes. It does not permit looser numeric limits,
asset-specific skips or exceptions, ledger changes, altered baselines or
replacement of approved art. Keep the portrait rank repair intact.

Add optional, explicit ground-contact metadata for asymmetric grounded sprites
to the offline sprite build/check contract. It belongs in the sprite tools and
source/config data, not the runtime engine or player flow. Existing entries
without it keep their exact current geometry validation. Both complete sprite
commands must enforce the new validation through one shared implementation.

Each used frame must describe the complete visible boot/support region that
defines its stance. The checker must measure actual opaque pixels within the
declared region, not accept a claimed x coordinate. Require valid bounded
integer regions, real support pixels at the baseline, adequate region extent
and complete metadata for the animation's used frames. Reject empty regions,
regions that slice through a foot, clipping and malformed/missing entries.
Preserve the full-frame transparency, palette, padding, vertical baseline,
animation, size and review checks. Weapons and braids outside the support
region still undergo those full-frame checks.

The measured support origin must satisfy the existing horizontal tolerance or
a stricter one; do not increase it. Walking must keep its source stride and
body sway, rather than independently chasing each contact foot. A documented
stance/support region can include both feet. Validate the ground-reaching axe
frame explicitly, since a naive bottom-row average could count it as a foot.
Store and inspect support-region overlays beside the actual pixels so a wrong
region cannot be hidden behind a successful number. Use the existing stance
landmarks as source evidence, not as unconditional expected answers.

Implementation may choose the smallest sound representation of those regions.
Do not build a rig system or introduce dependencies. If the representation
cannot distinguish foot/support pixels without a meaningful review and
regression, explain that concrete limitation and keep publication blocked;
do not introduce a pass-by-name branch for Braid.

Own the shared sprite geometry validator and meaningful tests, its integration
in complete sprite checks, Braid-only contact metadata and builder wiring,
the two Braid reviews, append-only registration, relevant docs/skills and new
.artifacts/hero-braid-publish evidence. Runtime code, other sprites, models,
mirror choices, thresholds, ledger and screenshot approvals remain protected.

## Tests before publication

Write a real red-to-green regression for the aligned asymmetric candidate
that the current silhouette-centre check rejects. Keep negative controls:

- The old body-shifting Braid candidate must fail the new stance validation.
- A translated body/foot must fail even when the silhouette centre looks good.
- A stretched axe or braid must not move the measured stance; clipping still fails.
- Missing, empty, out-of-frame or foot-truncating support metadata must fail.
- A genuinely different support position must fail without a matching pixel change.
- Every existing no-metadata asset must still receive its current checks.

Exercise the exported validator used by the actual complete sprite commands,
not a parallel test-only formula. Then register the two aligned candidates and
inspect every native frame and motion transition against approved option D,
plus diagnostic high/low animations on an unobscured floor beside the cast.
Update the current FAIL reviews only after the images actually pass. Keep
the side strike/recovery similarity explicitly documented if it remains.

Run complete sprite checks, targeted art review/checks, global assets, relevant
tools tests, lint, build and all default verify parts with six unchanged
approved screenshots. Confirm all existing asset hashes and manifest values,
earned saves, portrait checker and prior evidence are preserved. Rebuild from
retained raw sources and verify reproducible outputs. Keep both new sheets
inactive in normal play until the full Braid action family is ready.

Finish with published core sheets and green meaningful checks if achievable,
or the precise remaining defect and evidence. Commit source slices and final
evidence separately. No helpers, branch/worktree changes, push, merge or
deployment. Finish every owned job and stop only owned processes. Report
PASS/ISSUES/BLOCKED, source/evidence SHAs, commands, positive and negative
controls, reviewed contact overlays/native/world images and remaining scope.
Do not claim mirror runtime, full Act 1, other looks, 3D, cloud or weak devices.
