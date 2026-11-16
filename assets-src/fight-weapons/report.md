ISSUES

Branch: lab/fight-sprites-weapons
Worktree: /Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d
Base: fcefd6d07a3d488e707f04de78e231132eb26afc
Final commit: see git rev-parse HEAD and the handoff response. No push, main change, src change or dependency addition.

Acceptance:
1. PASS. All four manifest names, PNGs, grids, anchors, world heights and animation contracts exist.
2. PASS. Both complete sprite checks, verify-assets, bun run check, and assets/build/shots verification passed.
3. PASS. Every existing sprite PNG, baseline, atlas and manifest value remains unchanged, including hero-cut. Only three new manifest names were appended.
4. FAIL. Opened all four whole sheets on green and each frame beside matching idle at native resolution. Exact anatomical head/shoulder bounding boxes for every frame were not established. The partial measurements below are insufficient to accept the two-pixel requirement.
5. PASS once committed. Final handoff records the commit SHA and clean status.

hero-cut was NOT replaced. The best new candidate is attempt 1. It faces squarely forward and has a broader torso, but profile head/torso drift and the missing full measurements prevent establishing a clearly better replacement under the brief's rule. Original retained in assets-src/fight-weapons/hero-cut-original.png. Both generated attempts are retained. The candidate preview is /Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-candidate-vs-idle.png. The candidate final-sized PNG is /Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-candidate.png. Attempt 2 has excessive grey fringe/smear and inconsistent back strike handedness. The original's slim torso and sideways front remain defects.

Generation: image_gen.imagegen, attached approved hero.png on every call. Bow 1 attempt, staff 3, cut 2, reverse cut 1. Exact prompts and sources are adjacent JSON/PNG files. New sprites use build-story.mjs's slicing, alpha cleanup, locked palette snap and uniform fitting. No replacement pixels were drawn. Reverse cut recovery is sliced unchanged from existing hero-cut by match-recovery.mjs, so the pose and pixels match exactly. This introduces visible proportion drift in its recovery.

Manifest entries:
```json
{
  "hero-bow": {
    "sheet": "sprites/hero-bow.png",
    "frame": [
      128,
      128
    ],
    "anchor": [
      64,
      120
    ],
    "worldHeight": 2,
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
  "hero-staff": {
    "sheet": "sprites/hero-staff.png",
    "frame": [
      128,
      128
    ],
    "anchor": [
      64,
      120
    ],
    "worldHeight": 2,
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
  "hero-cut": {
    "sheet": "sprites/hero-cut.png",
    "frame": [
      128,
      128
    ],
    "anchor": [
      64,
      120
    ],
    "worldHeight": 2,
    "animations": {
      "cut": {
        "frames": 4,
        "fps": 10,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      }
    }
  },
  "hero-cut-back": {
    "sheet": "sprites/hero-cut-back.png",
    "frame": [
      128,
      128
    ],
    "anchor": [
      64,
      120
    ],
    "worldHeight": 2,
    "animations": {
      "cut": {
        "frames": 4,
        "fps": 10,
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

Partial measurements, pixels:
Head: manually selected horizontal hair span near crown+24, not a full head bounding box. Shoulder: warm-colored cross-section 30 pixels below head scanline; includes arms/weapons where they occlude the cloak. Height: first warm hair-colored pixel to foot anchor inclusive; dark crown outline may add 1-2px. These are partial inspection measurements. They DO NOT establish the requested anatomical head/shoulder dimensions within two pixels. Requirement 4 fails.
These are inspection aids, not verified maximum anatomical widths. In particular, the shoulder spans are contaminated by extended arms/weapons; do not treat them as shoulder-size measurements. Head intervals are manually selected cross-sections rather than segmented full heads. Exact requested measurements remain unchecked. Height can undercount a dark outline by 1-2 pixels.

| Sheet | Row/column | Marked head span | Warm shoulder-level span | Crown-color to foot height |
|---|---|---:|---:|---:|
| hero | 0/0 | 49 | 39 | 110 |
| hero | 1/0 | 50 | 30 | 110 |
| hero | 2/0 | 52 | 21 | 106 |
| hero-bow | 0/0 | 49 | 62 | 107 |
| hero-bow | 0/1 | 49 | 62 | 107 |
| hero-bow | 0/2 | 49 | 64 | 107 |
| hero-bow | 0/3 | 49 | 62 | 107 |
| hero-bow | 1/0 | 46 | 48 | 106 |
| hero-bow | 1/1 | 46 | 67 | 106 |
| hero-bow | 1/2 | 46 | 50 | 106 |
| hero-bow | 1/3 | 47 | 54 | 107 |
| hero-bow | 2/0 | 45 | 45 | 107 |
| hero-bow | 2/1 | 46 | 65 | 107 |
| hero-bow | 2/2 | 45 | 51 | 108 |
| hero-bow | 2/3 | 46 | 41 | 107 |
| hero-staff | 0/0 | 50 | 52 | 108 |
| hero-staff | 0/1 | 50 | 39 | 107 |
| hero-staff | 0/2 | 50 | 39 | 107 |
| hero-staff | 0/3 | 49 | 39 | 109 |
| hero-staff | 1/0 | 47 | 54 | 106 |
| hero-staff | 1/1 | 47 | 49 | 106 |
| hero-staff | 1/2 | 48 | 44 | 107 |
| hero-staff | 1/3 | 48 | 39 | 108 |
| hero-staff | 2/0 | 52 | 39 | 105 |
| hero-staff | 2/1 | 51 | 41 | 105 |
| hero-staff | 2/2 | 51 | 36 | 105 |
| hero-staff | 2/3 | 54 | 14 | 107 |
| hero-cut | 0/0 | 48 | 31 | 105 |
| hero-cut | 0/1 | 49 | 45 | 105 |
| hero-cut | 0/2 | 46 | 37 | 102 |
| hero-cut | 0/3 | 49 | 35 | 104 |
| hero-cut | 1/0 | 53 | 27 | 105 |
| hero-cut | 1/1 | 47 | 40 | 105 |
| hero-cut | 1/2 | 46 | 35 | 103 |
| hero-cut | 1/3 | 47 | 42 | 105 |
| hero-cut | 2/0 | 49 | 18 | 107 |
| hero-cut | 2/1 | 50 | 51 | 105 |
| hero-cut | 2/2 | 50 | 32 | 103 |
| hero-cut | 2/3 | 46 | 45 | 104 |
| hero-cut-back | 0/0 | 49 | 42 | 108 |
| hero-cut-back | 0/1 | 49 | 39 | 108 |
| hero-cut-back | 0/2 | 50 | 37 | 108 |
| hero-cut-back | 0/3 | 49 | 35 | 104 |
| hero-cut-back | 1/0 | 49 | 43 | 108 |
| hero-cut-back | 1/1 | 48 | 44 | 108 |
| hero-cut-back | 1/2 | 49 | 44 | 108 |
| hero-cut-back | 1/3 | 47 | 42 | 105 |
| hero-cut-back | 2/0 | 48 | 26 | 108 |
| hero-cut-back | 2/1 | 48 | 34 | 108 |
| hero-cut-back | 2/2 | 48 | 35 | 108 |
| hero-cut-back | 2/3 | 46 | 45 | 104 |

Visible defects:
- All generated sheets retain approximate identity rather than exact idle pixels. Hair highlights, fringe shape, face details, cloak folds, satchel and torso proportions drift. No visual PASS is claimed.
- Bow: side/back heads are smaller than idle. Nock and full draw are too similar in back view. The full draw hand is across the chest rather than unambiguously at the cheek. The lower pose's hand stays near the shoulder instead of reaching far over it. String/arrow readability is weak in front/back, and bow grip changes slightly between frames. Quiver is small and visually merges with raised hands. Side bow aim is clear. Release is distinct and arrow-free.
- Staff: cast light remains adjacent to the tip rather than clearly travelling away. Hold is beside the head, not high overhead; this was chosen after the earlier tall light clipped or forced the hero smaller. Both hands are readable in front/side hold, but hidden in back. Some teal snaps near white at native size. The burst round knot is at the foot baseline; in back view the shaft is largely hidden by the body and can look like a dangling brown dot. No separate burst effect is present. The raised staff is shorter than requested shoulder-tall in some views. Staff/hand position drifts.
- Published cut: original slimmer body and turned front remain. It has broad grey smear, uneven crown height and head silhouettes. The replacement candidates do not meet the strict measured identity gate.
- Reverse cut: rising swing is distinct in profile. Front low blade crosses toward image center instead of extending clearly left. Front follow-through is held diagonally at the right rather than far over the shoulder. Some back sword detail is obscured by the cloak. The sliced recovery switches to the original smaller, more sideways hero, so its scale and silhouette jump. Anchoring by full silhouette also moves the hero horizontally as the weapon extends. Smear becomes angular after snapping.
- No obvious clipped weapons, faces in back rows, left-facing profiles, floor shadows, stray specks or pale outline halos were seen in the selected published sheets. Rejected staff attempt 1 clips its large light; attempt 2 keeps an oversized overhead effect and ground splash. Selected staff attempt 3 avoids those.

Previews opened, native size, green background:
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-bow-green.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-bow-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-bow-pairs.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-staff-green.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-staff-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-staff-pairs.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-green.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-pairs.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-back-green.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-back-vs-idle.png
/Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites/hero-cut-back-pairs.png

Checks, final output:

bun tools/verify-assets.mjs
```text
TOTAL PASS: 9 checks, 9 passed, 0 failed, 0 warnings
```

bun tools/sprites/check.mjs --complete
```text
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```

bun tools/sprites/check-story.mjs --complete
```text
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```

bun run check
```text

 RUN  v5.1.0 /Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/convex


 Test Files  5 passed (5)
      Tests  31 passed (31)
   Start at  18:47:20
   Duration  779ms (tests 35%, environment 30%, transform 20%, import 13%, worker 2%)
```

PORT=5575 PLAY_PORT=5575 bun run verify assets build shots
```text
$ bun tools/verify.mjs assets build shots
pass assets     1.6 s  every asset against the asset contract
pass build      1.0 s  a production build
pass shots     16.8 s  six scenes against their approved pictures, and the draw budgets

verify: 3 parts, nothing failed
```

The doctor passed before changes, including 930 game tests. The first assets/build/shots run overlapped the bow's config publication and saw a transient missing-hero-bow manifest entry. Its build and shots passed; final assets/build/shots all pass. This initial assets run is not valid evidence of the unchanged baseline. Logs remain in /Users/dabot/.t3/worktrees/game-base/t3-c57532cf-d23fc4b8e1839d1d/.artifacts/fight-sprites. No baseline refresh or screenshot approval was performed.

Not checked: exact isolated head and shoulder bounds in all frames, two-pixel identity acceptance, fight-lab renderer integration or animated weapon transitions in gameplay, weak-device performance, sound or deployment. No source code was changed. No processes remain from the completed verification commands.

Rebuild: bun assets-src/fight-weapons/restore-raw.mjs restores selected new sources. build-story skips existing published entries. If rebuilding the reverse sheet after deliberately removing its new entry, run match-recovery.mjs afterwards. build-cut.mjs creates a candidate preview and restores the published original and manifest in finally. Do not publish either cut candidate without further review.
