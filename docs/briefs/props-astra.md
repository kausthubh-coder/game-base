# Brief: a second take on 3D props made in code, to compare two models

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera at about 35 degrees. He cannot model, so agents write
every 3D shape as Three.js code. He asked for the same props to be made by two different models, to see
which makes better 3D assets. Another agent (Claude) is building its set in `src/features/props/`. You
build yours, independently, so the two can be judged side by side. Do not read or copy that folder.

Read first: `AGENTS.md` (the rules and the commands), `src/engine/` (the contract) and
`docs/style-sheet.md` (the look, with reference images to open).

## What you own

- `experiments/props-astra/` (all your source: builders, a small instancing helper, the demo page at `experiments/props-astra/demo/index.html` with its `main.ts`)
- `.artifacts/props-astra/` for screenshots

Build the demo with `bun tools/demo.mjs`-style Vite build of your own: run
`bunx --bun vite build experiments/props-astra/demo --base ./ --outDir ../../../dist/experiments/props-astra --emptyOutDir`.

## What to build

Each prop is a function that returns one merged `THREE.BufferGeometry` with vertex colors. No texture
files and no model files. Chunky, slightly rounded, readable from above. Budgets: 300 triangles for a
small prop, 1,500 for a tree, 6,000 for a building piece.

1. Trees: oak, birch and pine, three shapes each.
2. Plants: three grass tufts, tall grass, flowers in six colors, reeds, three mushrooms, three bushes, a berry bush.
3. Ground: four rocks, a fallen log, a stump.
4. Town: a door, a window, a chimney, a sign, a market stall, a well, a fence, a lamp post, a bench.
5. Clutter and stations: a barrel, a crate, a cart, a workbench, a forge, a chest, a bed.
6. A demo page with `?sheet=1` that lays out every prop and variant in a labeled grid seen from the game
   camera angle, on a grass-green ground with one sun light and shadows, and prints the triangle count
   under each. Without `?sheet`, show a small village scene: a meadow, a forest edge and a few town props.

## Done: every line passes or fails

1. `bunx tsc --noEmit -p .` style type check of your folder passes (use `bun tools/typecheck.mjs` with a temporary include if needed, or `bunx tsc --noEmit --strict --skipLibCheck --moduleResolution bundler --module esnext --target es2022 --allowImportingTsExtensions experiments/props-astra/demo/main.ts`).
2. The demo builds and loads with no console errors (`bun tools/serve.mjs dist/experiments/props-astra 5317`, then `bun tools/shot.mjs`).
3. Screenshots you looked at, in `.artifacts/props-astra/`: `sheet.png` (the labeled grid at 1920 by 1400) and `village.png` (1440 by 900).
4. Every prop is inside its triangle budget. Print the table.
5. The sheet looks like one game, in the style sheet's look. Say what stands out if it does not.

## Limits

- Other agents are building in this repo. Write only in the folders above. Do not commit, and do not run `bun install` or `bun add`. Three.js is the only library.
- Your port is 5317. Stop any server by the pid it printed.
- This Mac draws WebGL in software, so a screenshot may need `--wait 4000`.
- Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`.
- Do the work yourself. Start no subagents.

## Report

Your last message: PASS, ISSUES or BLOCKED, the check output, the triangle table, and what you think is the weakest prop.
