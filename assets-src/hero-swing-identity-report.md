# Hero swing identity: ISSUES

Three image-generation attempts completed. Attempt 3 is the closest costume and shoulder match and is committed for review, but does not satisfy the strict visual acceptance threshold. The head is still taller, with a rounder face. Front strike hands partly cover the shirt and belt. Do not treat this as an approved identity match.

The old swing sheet was a different-looking generated character. The replacement restores the cream shirt, belt, broad cape and short legs. All nine cells face correctly, back views show no face, and tools remain within their cells. The real game plays the sheet and returns to idle in all three directions.

## Rebuild

Run `bun tools/sprites/hero-swing.mjs`. This uses the existing story pipeline's slice, clean, palette snap and nearest-neighbor fit operations, followed by whole-figure horizontal scaling to approach the reference width and vertical scaling of the side row to the reference height. It writes only `public/assets/sprites/hero-swing.png`. It bypasses `build-story.mjs`'s skip-existing loop without changing the manifest. No replacement pixels, separate head/body edits or baseline changes.

During candidate previews I temporarily removed only the hero-swing manifest entry to run the existing story builder, then restored the exact original manifest. The committed rebuild script needs no such manifest edit.

`hero.png` and `manifest.json` are byte-for-byte unchanged from b14c865. All three raw attempts and the selected raw source are committed under `assets-src/raw/`. Prompts and selection are in `assets-src/hero-swing-identity-prompts.json`.

## Evidence

- `.artifacts/hero-swing/compare.png`: 3x nearest-neighbor, flat green; each pair is idle reference then swing, columns windup/strike/recovery, rows front/back/right.
- `.artifacts/hero-swing/in-game.png`: rows front/back/right; 11 frames per row, idle then 8 swing frames then 2 idle frames. Calls real actions.use and actions.hold with a ground-block hit, advancing 0.05 seconds during swings.
- `.artifacts/hero-swing/in-game-state.json`: actor identity, facing, action hit/progress, renderer and console errors per frame.
- `.artifacts/hero-swing/boxes.json` and `boxes.log`: all coordinates and dimensions below. Head windows selected manually from enlarged cells to separate hair/face from the touching tool and collar; measurements are approximate at the neck boundary. Body boxes include the held tool, whose silhouette cannot be separated by alpha alone.
- `.artifacts/hero-swing/film.mjs`, `compare.mjs`, `boxes.mjs`: reproduction scripts.

## Measurements

Widths and heights in native pixels; three values are windup, strike and recovery. Exact x/y boxes follow below.

| Facing | Hero head | Old heads | New heads | Hero body | Old body + tool | New body + tool |
|---|---|---|---|---|---|---|
| Front | 56x47 | 47x43, 50x47, 48x47 | 57x52, 57x54, 58x52 | 59x110 | 74x110, 53x112, 70x110 | 79x110, 57x112, 79x110 |
| Back | 56x45 | 54x40, 50x42, 52x42 | 57x48, 56x49, 57x48 | 59x110 | 74x109, 52x108, 69x108 | 78x110, 56x111, 79x110 |
| Right | 56x45 | 47x42, 43x42, 47x43 | 57x50, 56x50, 56x50 | 56x106 | 72x102, 71x99, 70x100 | 74x106, 58x106, 69x106 |

All new head widths are within 2 pixels; head heights exceed the reference by 3 to 7 pixels. This fails requirement 1. The neck boundary is a manual judgment, but the remaining visual mismatch is clear enough that this cannot be PASS.

## Commands and results

All commands exited 0:

```text
bun tools/doctor.mjs
ok dependencies; ok env; ok chrome; ok port PORT=5613
ok check: 880 pass, 0 fail

bun tools/sprites/check.mjs --complete
PASS: 105 sprite frames; 40 block tiles; 16 icons
PASS story: 319 frames; original entries and files unchanged
PASS all six story sets complete

bun tools/sprites/check-story.mjs --complete
PASS story: 319 frames; original entries and files unchanged
PASS all six story sets complete

bun tools/verify-assets.mjs
TOTAL PASS: 9 checks, 9 passed, 0 failed, 1 warning
Warning: manifest.json has a "uikit" section that docs/assets.md does not describe.

bun run check
880 pass, 0 fail, 1228001 expect() calls; 79 files
Convex: Test Files 5 passed (5); Tests 32 passed (32)

bun x vite build --outDir .artifacts/hero-swing/dist --emptyOutDir
built successfully
Warnings: large chunks; ineffective dynamic import of GLTFLoader

bun .artifacts/hero-swing/film.mjs
serving .../.artifacts/hero-swing/dist on http://127.0.0.1:5973/ pid 8096
Chrome renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
PASS real actions.use/hold: front, back, right side idle → swing → idle; no console errors

bun run verify shots
pass shots: six scenes against their approved pictures, and the draw budgets
verify: 1 parts, nothing failed
```

Server PID 8096 stopped in the recording script's finally block and was confirmed absent. No push, merge, deploy, or other branch modification.

## Full bounding boxes

```text
hero 0 0 head {"x":37,"y":11,"width":56,"height":47} body + tool {"left":35,"top":11,"width":59,"height":110}
hero 1 0 head {"x":37,"y":11,"width":56,"height":45} body + tool {"left":35,"top":11,"width":59,"height":110}
hero 2 0 head {"x":36,"y":15,"width":56,"height":45} body + tool {"left":36,"top":15,"width":56,"height":106}
old 0 0 head {"x":27,"y":14,"width":47,"height":43} body + tool {"left":27,"top":11,"width":74,"height":110}
old 0 1 head {"x":38,"y":9,"width":50,"height":47} body + tool {"left":38,"top":9,"width":53,"height":112}
old 0 2 head {"x":30,"y":11,"width":48,"height":47} body + tool {"left":29,"top":11,"width":70,"height":110}
old 1 0 head {"x":43,"y":14,"width":54,"height":40} body + tool {"left":27,"top":12,"width":74,"height":109}
old 1 1 head {"x":38,"y":13,"width":50,"height":42} body + tool {"left":38,"top":13,"width":52,"height":108}
old 1 2 head {"x":47,"y":13,"width":52,"height":42} body + tool {"left":30,"top":13,"width":69,"height":108}
old 2 0 head {"x":29,"y":23,"width":47,"height":42} body + tool {"left":28,"top":19,"width":72,"height":102}
old 2 1 head {"x":42,"y":22,"width":43,"height":42} body + tool {"left":29,"top":22,"width":71,"height":99}
old 2 2 head {"x":29,"y":21,"width":47,"height":43} body + tool {"left":29,"top":21,"width":70,"height":100}
new 0 0 head {"x":43,"y":11,"width":57,"height":52} body + tool {"left":25,"top":11,"width":79,"height":110}
new 0 1 head {"x":36,"y":9,"width":57,"height":54} body + tool {"left":36,"top":9,"width":57,"height":112}
new 0 2 head {"x":27,"y":11,"width":58,"height":52} body + tool {"left":25,"top":11,"width":79,"height":110}
new 1 0 head {"x":44,"y":11,"width":57,"height":48} body + tool {"left":25,"top":11,"width":78,"height":110}
new 1 1 head {"x":36,"y":10,"width":56,"height":49} body + tool {"left":36,"top":10,"width":56,"height":111}
new 1 2 head {"x":28,"y":11,"width":57,"height":48} body + tool {"left":25,"top":11,"width":79,"height":110}
new 2 0 head {"x":44,"y":15,"width":57,"height":50} body + tool {"left":27,"top":15,"width":74,"height":106}
new 2 1 head {"x":35,"y":15,"width":56,"height":50} body + tool {"left":35,"top":15,"width":58,"height":106}
new 2 2 head {"x":30,"y":15,"width":56,"height":50} body + tool {"left":30,"top":15,"width":69,"height":106}
```
