ISSUES

Branch: lab/fight-sprites-stag. Final commit SHA is in the handoff message.
Worktree: /Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf

Three sheets are published, each 1536 by 1152 with 384-square frames and anchor [192,364]. Standard build-story.mjs already supports this size. No builder extension, dependency, src change, baseline update, push, merge or deployment.
Built-in image_gen.imagegen used the approved boar and hero for idle, then selected idle for both action sheets. Prompts and all attempts are in adjacent JSON files. Selected sources are committed under assets-src/raw; rejected sources are here. Attempts: idle 2, fight 3, free 2. No replacement pixels drawn by hand or code.

worldHeight 13.2 describes the whole frame. A 320-pixel drawn height occupies eleven blocks. The selected idle side back is roughly 7.5 blocks above the hoof baseline, close to the eight-block target. This was judged in the sprite, not measured in the running fight lab. World comparison uses each manifest's frame/worldHeight at a uniform 32 pixels per block, common anchor baseline, nearest-neighbor scaling. It compares standing Stag, boar and hero with their actual manifest size ratios. Perspective and terrain integration remain unchecked.

Visual defects:
- Moss reads olive/ochre or golden brown after palette snapping instead of the requested warm green. Thus the collar is the only intentional metal, but other areas also look gold. This misses the requested color separation.
- Idle crown branches, flower placements and ears wobble between frames and views; breathing and ear flick are restrained. Idle head stays fairly upright rather than weary and low.
- Back crown is shorter/flatter than front crown. Crown and muzzle shape differ in profile. The leaf clusters read as layered leaves more than soft moss.
- Fight crown, blossoms, neck length, chest width and collar thickness change between poses and compared with idle. Side legs look somewhat shorter and thicker. Front rear turns toward profile.
- Fight windup antlers remain well above ground and are not level with it. Front windup and sweep show opposite head arcs, but side windup does not pull fully back to the opposite side. Windup and stamp silhouettes are similar in profile.
- Stamp reads as a braced lunge, particularly from the side. A static frame does not communicate the downward impact by itself.
- Free sheet is warmer/redder than idle, with bushier crown/foliage, wider-looking eyes and muzzle, thicker legs and different cream patches. Free standing is narrower through the torso than idle.
- Stagger reads as a crouch with a lifted front leg rather than a sharp head jerk. Strain reads as a forward diagonal lean more than pulling hard sideways against a collar.
- Front bow reads clearly head-down; side bow can read as grazing. Back bow is subtle. Side bow nose hovers above the ground rather than touching it.
- Small changes in body size and silhouette across all three sheets remain. Grounded silhouettes all end at anchor y364, as checked automatically; individual hoof positions differ with pose.
- Shipped sheets have no visibly clipped antler tips, pale halos, floor shadows or stray detached pieces in inspected previews. Antler margins on the rear are tight but intact. Back rows have no face; side rows face right. Collar is present in idle/fight and free columns0/1, absent in free columns2/3.
- Texture is busier and less chunky than hero, closer to the boar. No teal visible. Full visual identity/color/pose consistency therefore FAILS despite passing automated checks.

Opened at native pixel size on green: all three full sheets and comparisons containing every frame. Each direction was compared with the approved boar and hero.
Preview absolute paths:
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/stag-native.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/stag-fight-native.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/stag-free-native.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/comparison-front.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/comparison-back.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/comparison-side.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/directions-native.png
/Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/.artifacts/fight-sprites/world-scale.png

Rebuild previews: bun assets-src/fight-stag/preview.mjs

Bytes:
stag.png 326902
stag-fight.png 349268
stag-free.png 376408
Three shipped sheets add 1052578 bytes.
All public/assets files total 15095586 bytes, versus 25165824-byte limit. Verifier prints 14.40 MB of 24 MB. Source attempts are not shipped.

Acceptance:
1 PASS: exact names, grids, animation names, fps and rows.
2 PASS: all requested checks.
3 PASS: git diff fcefd6d has no modified existing sprite or baseline. Every prior public asset is byte-identical, including atlas. After removing only three additions, manifest is exactly equal to fcefd6d.
4 PASS inspection and comparison performed; FAIL full visual consistency as above.
5 PASS after final commit amendment; final status is in handoff. Three commits, one per sheet.

Not checked: fight-lab loader integration, actual combat timing/readability, animation playback, drained shader and color return, chain/collar attachment rendering, exact in-world back height, perspective in a running hall, Windows or weak-device performance. Coordinator owns integration. No task server remains running.


Manifest entries:
```json
{
  "stag": {
    "sheet": "sprites/stag.png",
    "frame": [
      384,
      384
    ],
    "anchor": [
      192,
      364
    ],
    "worldHeight": 13.2,
    "animations": {
      "idle": {
        "frames": 4,
        "fps": 3,
        "rows": {
          "front": 0,
          "back": 1,
          "side": 2
        }
      }
    }
  },
  "stag-fight": {
    "sheet": "sprites/stag-fight.png",
    "frame": [
      384,
      384
    ],
    "anchor": [
      192,
      364
    ],
    "worldHeight": 13.2,
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
  "stag-free": {
    "sheet": "sprites/stag-free.png",
    "frame": [
      384,
      384
    ],
    "anchor": [
      192,
      364
    ],
    "worldHeight": 13.2,
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

bun tools/sprites/check.mjs --complete
```text
OK story stag-fight: sizes, anchors, transparency, palette
OK story stag-free: sizes, anchors, transparency, palette
PASS story: 523 frames; original entries and files unchanged
OK portraits: 9 tiles, transparency, palette and padding
OK crops: 14 tiles, anchors, transparency, palette
OK icons story: 16 tiles, transparency, palette and padding
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```

bun tools/sprites/check-story.mjs --complete
```text
OK story stag-fight: sizes, anchors, transparency, palette
OK story stag-free: sizes, anchors, transparency, palette
PASS story: 523 frames; original entries and files unchanged
OK portraits: 9 tiles, transparency, palette and padding
OK crops: 14 tiles, anchors, transparency, palette
OK icons story: 16 tiles, transparency, palette and padding
OK UI: panel 96x96, button 96x32, title 480x270, palette and alpha
PASS all six story sets complete
```

bun tools/verify-assets.mjs
```text
  blocks/oak-boards.png                        0.4  32 x 32
  total                                    14741.8  14.40 MB of 24 MB

TOTAL PASS: 9 checks, 9 passed, 0 failed, 0 warnings
```

bun run check
```text
(pass) messages from a browser > a hello and an input come back as they went [0.33ms]
(pass) messages from a browser > anything that is not exactly a message is null [0.18ms]
(pass) messages from a browser > what a message does not name is not carried along [0.03ms]
(pass) messages from the server > the three kinds are read, and nothing else [0.07ms]
(pass) messages from the server > snaps add up to what is near [0.11ms]

 930 pass
 0 fail
 1229783 expect() calls
Ran 930 tests across 77 files. [21.03s]

 RUN  v5.1.0 /Users/dabot/.t3/worktrees/game-base/t3-33f8987c-a0ee6577cd345cdf/convex


 Test Files  5 passed (5)
      Tests  31 passed (31)
   Start at  18:48:14
   Duration  502ms (tests 32%, transform 30%, environment 22%, import 14%, worker 2%)
```

bun run verify assets build shots tools
```text
$ bun tools/verify.mjs assets build shots tools
pass tools      0.0 s  the tools' own tests
pass assets     1.5 s  every asset against the asset contract
pass build      1.1 s  a production build
pass shots     19.2 s  six scenes against their approved pictures, and the draw budgets

verify: 4 parts, nothing failed
```
