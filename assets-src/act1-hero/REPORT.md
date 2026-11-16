# Hero look A

ISSUES. All eight requested sheets were regenerated with the built-in image generation tool and assembled on `act1-sprites-hero`. No runtime code, manifest entry, baseline or approved screenshot was changed.

The identity reference is the approved `assets-src/concept/people-home/hero.webp`, look A. The cast style reference is the original hero sheet and `.artifacts/sprites/side-by-side-3.png`. The generated walk sheet is attached to every action generation. The equipment defaults to guild issue. The old cape is replaced by the blue canvas jacket, cream shirt and cuffs, charcoal trousers, brown satchel and brass key. The strawberry-blond wedge fringe replaces the brown spiky hair.

## Sheets

All use 128-square frames, anchor `[64,120]` and world height 2. The manifest is byte-identical to the task base.

| Manifest name | Grid | Frames used | Source attempt kept |
|---|---|---|---|
| hero | 6 by 7 | 33 | 1 |
| hero-moves | 4 by 3 | 12 | 1 |
| hero-swing | 3 by 3 | 9 | 1 |
| hero-cut | 4 by 3 | 12 | 1 |
| hero-cut-back | 4 by 3 | 12 | 1 |
| hero-bow | 4 by 3 | 12 | 1 |
| hero-staff | 4 by 3 | 12 | 3 |
| hero-call | 4 by 3 | 12 | 1 |

Rebuild with `bun tools/sprites/act1-hero.mjs`. It only slices, cleans alpha, snaps colours, scales complete figures with nearest neighbour and aligns them. It draws no replacement pixels. Actions use the new hero's own colours plus locked neutral metal and teal shades. Unused cells remain transparent. Padded source extraction avoids clipping the uneven generated walk rows; disconnected scraps outside the figure are removed. Prompt records are in `prompts.json` and `staff-retries.json`; retained generated sources are in `sources/`.

The staff's first source had a generic ball head. Attempt two added the guild disc crown but recoloured the trousers warm brown. Attempt three corrected the trousers to charcoal. Only attempt three is retained in the source folder.

## Picture review

Before pictures: `.artifacts/hero/before-<manifest-name>.png`, extracted from task base `8603e73`.

After pictures: `.artifacts/sprites/beside-<manifest-name>.png`, for each of the eight names above. Generated with `bun tools/sprites/beside.mjs <name> --sheet assets-src/concept/people-home/hero.webp --crop 200,65,210,640`.

Every beside picture was opened. The hair, jacket and satchel identify the same kid at native and half size. All back rows hide the face and side rows face right. Remaining visual issues prevent an unqualified same-costume PASS: glove visibility/handedness varies in back and gripping poses, and the staff boots are lighter than the idle boots. The front action rows retain the original three-quarter poses. Freckles and the key's tiny teeth merge at half size. No B, C or D sheets were attempted while A still has outstanding checks.

## Verification

The doctor passed. `bun run check` passed before the changes and on the first post-change run. The log is `.artifacts/hero/check-after.log`. A later duplicate check was stopped by its own process IDs after it stalled under concurrent worktree checks.

Before changes, `bun tools/verify-assets.mjs` passed, and `bun run verify shots play` passed play but failed the river image comparison. Logs: `.artifacts/hero/assets-before.log` and `.artifacts/hero/verify-before.log`.

After replacement, both complete sprite checks reach the frozen hero hash assertion. The frame sizes, anchors, binary alpha, palette and padding checks preceding it pass. The asset verifier fails only its sprite-check part, because `assets-src/block-baseline-2.json` and `assets-src/story-baseline-3.json` pin the original hero bytes. Baselines were deliberately preserved. The coordinator must resolve the approved replacement policy; this branch does not silently reapprove them. Logs: `.artifacts/hero/sprite-check.log`, `story-check.log`, `assets-after.log`.

Walking was captured with the actual game renderer and no console errors: `.artifacts/hero/walking.png`, with `.artifacts/hero/walking.log`. The first fight-pose capture could not launch Chrome and timed out; its log is `.artifacts/hero/fight-attempt1.log`. The second capture succeeded on low quality with the Metal renderer and no console errors. `.artifacts/hero/actions.png` shows the sword cuts, reverse cuts, dodge, call, bow drawing/release and staff casts in all three directions, with idle and recovery. It was opened and inspected. The production build passed. The fight poses are held through the lab's debug door; sustained combat through real keys was not checked. The separate walking strip advances actual movement.

Final results are in `verification.json`. Build passed. The latest screenshot run failed town, farm and river; its farm and town pictures show unloaded model placeholders. River already failed before edits. The play run first failed session startup. Its retry ran the recordings but timed out in `cancel-bag-drag.json` and `first-talk.json`. These failures remain unresolved; the full requested verification does not pass. Logs are `.artifacts/hero/verify-after.log`, `play-retry.log`, `shots-after.log` and `play-after.log`. Crops of the in-game contact sheet are `.artifacts/hero/sword.png`, `bow.png` and `staff.png`.

The capture server and play session were stopped. Sustained combat through real keyboard input and weak-device performance were not checked. No release, push or merge was attempted.
