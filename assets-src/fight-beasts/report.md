ISSUES

Branch: lab/fight-sprites-beasts. Final SHA is supplied in the handoff after commit.
Worktree: /Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada

Six sheets exist and match the exact animation names, frames and rows. All automated checks pass. Visual matching is imperfect as listed below.
Built-in image_gen.imagegen generated every source. Base references were critter.png and leaftail.png. Each fight sheet referenced its own generated base. No pixels were drawn by code or hand. Prompts, references, attempt selection and defects are in the three adjacent JSON files.
Attempts: thistlehog base 1 / fight 1; gearling base 1 / fight 2; boar base 1 / fight 3. Rejected fight attempts are retained beside this report.

Builder: build-story.mjs already supports 192-square frames; no extension was needed. Only story-config.mjs was appended. Thistlehog base additionally used the existing defringe.mjs cleanup.
worldHeight describes the whole frame, including transparent margin. Values 1.27 and 1.55 compensate for the small creatures occupying roughly 68 of 96 pixels. Boar uses 3.63 to allow its long silhouette in a 192 frame. Final world-space shoulder height and length need confirmation in the fight lab.

Manifest entries:
```json
{
  "thistlehog": {
    "sheet": "sprites/thistlehog.png",
    "frame": [
      96,
      96
    ],
    "anchor": [
      48,
      88
    ],
    "worldHeight": 1.27,
    "animations": {
      "idle": {
        "frames": 2,
        "fps": 4,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      },
      "walk": {
        "frames": 4,
        "fps": 10,
        "rows": {
          "front": 3,
          "back": 4,
          "side": 5
        }
      }
    }
  },
  "thistlehog-fight": {
    "sheet": "sprites/thistlehog-fight.png",
    "frame": [
      96,
      96
    ],
    "anchor": [
      48,
      88
    ],
    "worldHeight": 1.27,
    "animations": {
      "poses": {
        "frames": 4,
        "fps": 1,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      }
    }
  },
  "gearling": {
    "sheet": "sprites/gearling.png",
    "frame": [
      96,
      96
    ],
    "anchor": [
      48,
      88
    ],
    "worldHeight": 1.55,
    "animations": {
      "idle": {
        "frames": 2,
        "fps": 4,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      },
      "walk": {
        "frames": 4,
        "fps": 10,
        "rows": {
          "front": 3,
          "back": 4,
          "side": 5
        }
      }
    }
  },
  "gearling-fight": {
    "sheet": "sprites/gearling-fight.png",
    "frame": [
      96,
      96
    ],
    "anchor": [
      48,
      88
    ],
    "worldHeight": 1.55,
    "animations": {
      "poses": {
        "frames": 4,
        "fps": 1,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      }
    }
  },
  "boar": {
    "sheet": "sprites/boar.png",
    "frame": [
      192,
      192
    ],
    "anchor": [
      96,
      176
    ],
    "worldHeight": 3.63,
    "animations": {
      "idle": {
        "frames": 2,
        "fps": 4,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      },
      "walk": {
        "frames": 4,
        "fps": 10,
        "rows": {
          "front": 3,
          "back": 4,
          "side": 5
        }
      }
    }
  },
  "boar-fight": {
    "sheet": "sprites/boar-fight.png",
    "frame": [
      192,
      192
    ],
    "anchor": [
      96,
      176
    ],
    "worldHeight": 3.63,
    "animations": {
      "poses": {
        "frames": 4,
        "fps": 1,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      }
    }
  }
}
```

Native green previews and comparisons, all opened and inspected:
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/thistlehog-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/thistlehog-fight-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/thistlehog-comparison.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/gearling-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/gearling-fight-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/gearling-comparison.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/boar-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/boar-fight-native.png
/Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/.artifacts/fight-sprites/boar-comparison.png

Comparisons place each entire base sheet beside its fight sheet with front/back/side hero and critter crops at native pixel size. Native pixel dimensions are not world-space scale. All side views face right and all back views lack a face. No clipped parts, visible floor shadows or pale halos remain in the inspected final images.

thistlehog:
- Thistles read somewhat as pointed leaves rather than needles.
- Tell puffs less than twice roundness, especially in side view.
- Attack extends primarily sideways rather than evenly in every direction.
- Small silhouette and flower placement wobble across base frames.
- Calm sits only subtly more upright than idle.
- Fight muzzle and flowers differ slightly in proportions from base.

gearling:
- Key angle and stone seam positions drift slightly between frames and views.
- Front and back charge read as a diagonal tip rather than a strong forward lunge.
- Tell crouch and brighter eye differ only subtly from idle.
- Dim dizzy eye is a static pose; flicker needs renderer animation.
- Fight body is slightly rounder/wider than base in some poses.

boar:
- Mane, tusks and golden cracks change shape and placement across views and poses.
- Idle and walk have visible body-height and muzzle wobble.
- Fight side torso remains slightly shorter/deeper than base; front fight head is slightly larger.
- Tell head stays higher than requested, especially side view.
- Dizzy front snout hovers slightly above ground rather than resting fully on it.
- Side view shows mainly one tusk because the other is occluded.
- Texture is busier and softer than approved critter, especially gold cracks.

Additional shared limitations: walk animation has small silhouette wobble and restrained steps. Static tell/attack frames cannot prove movement, eye flicker, or a key rotating. Fight poses preserve the identity and colors but do not match every contour or body dimension exactly.

Checks, final lines:
bun tools/sprites/check.mjs --complete
```text
OK story boar-fight: sizes, anchors, transparency, palette
PASS story: 409 frames; original entries and files unchanged
OK portraits: 9 tiles, transparency, palette and padding
OK crops: 14 tiles, anchors, transparency, palette
OK icons story: 16 tiles, transparency, palette and padding
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```
bun tools/sprites/check-story.mjs --complete
```text
OK story boar-fight: sizes, anchors, transparency, palette
PASS story: 409 frames; original entries and files unchanged
OK portraits: 9 tiles, transparency, palette and padding
OK crops: 14 tiles, anchors, transparency, palette
OK icons story: 16 tiles, transparency, palette and padding
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```
bun tools/verify-assets.mjs
```text
TOTAL PASS: 9 checks, 9 passed, 0 failed, 0 warnings
```
bun run check
```text
Ran 837 tests across 74 files. [19.90s]

 RUN  v5.1.0 /Users/dabot/.t3/worktrees/game-base/t3-9261a7af-85e97d99e2265ada/convex


 Test Files  5 passed (5)
      Tests  31 passed (31)
   Start at  13:46:21
   Duration  338ms (transform 38%, tests 25%, environment 23%, import 13%, worker 2%)
```
bun run verify assets build shots tools
```text
$ bun tools/verify.mjs assets build shots tools
pass tools      0.0 s  the tools' own tests
pass assets     1.5 s  every asset against the asset contract
pass build      0.6 s  a production build
pass shots     15.0 s  six scenes against their approved pictures, and the draw budgets

verify: 4 parts, nothing failed
```
bun run check also reports 837 pass, 0 fail; world-server types and Convex checks completed. Initial doctor and pre-change assets/build/shots checks passed. No regression in those checks.

Frozen assets: both sprite checks verify approved entries and files. Existing manifest values equal both 0c26a77 and current origin/main after removing the six additions. No baseline was refreshed. git diff --diff-filter=MD against the supplied base and origin/main lists no existing sprite PNG or baseline changes.
origin/main advanced to 30d40e1 after this worktree was cut from 0c26a77. Its unrelated newer code/docs therefore appear reversed in git diff origin/main; this task made no src changes. Review this branch against its merge base 0c26a77.

Not checked: fight-lab loader integration, gameplay or timed animation playback using these beasts, Blighted shader appearance and color recovery, exact in-world dimensions, weak-device performance, Windows. The coordinator owns those checks. No push, merge or deployment was performed. No server remains running from this task.

Acceptance: 1 PASS sheet files/layout; 2 PASS automated checks; 3 PASS no existing sprites/baselines changed; 4 PASS native inspection completed, ISSUES visual defects listed; 5 PASS once the final boar commit is created.
