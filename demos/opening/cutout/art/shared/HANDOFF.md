# Art A fix round

PASS for the requested asset cleanup. The fresh red/grey sheets have no visible plaster halos or unintended holes. The cloth, hand and fox silhouettes also pass an enclosed-alpha-hole check. No push or merge was made.

Each shot was committed separately on lab/opening-art-a. The first round ends at 12e2824; the fix commits follow it.

- War uses a smooth traced white banner contour. Every alternate frame now deforms the approved cloth paint slightly, pinned at its pole, so the paint facets and edge details stay the same across frames. The old generated alternate sheets remain in src as provenance but are no longer used.
- King has six traced cuff/hand mattes. Pale skin and white cloth remain solid. Boundary plaster under the wrists is removed. The rays are rebuilt as continuous, evenly spaced gold strokes, with color sampled from the approved upper rays. This replaces the previous broken color-key extraction.
- Friends uses trimmed source mattes for the figures. The fox has a complete traced silhouette. Its tail uses a smooth deformation of the original paint. There is no rectangular paste or generated body replacement. The visible face and upper torso are pixel-identical between the two frames.
- Roads keeps the approved vegetation, lamps, bread and coastline. Only footprints newly uncovered by a city or road, plus a narrow edge margin, use clean underpaint. Cities use a boundary-connected green matte, preserving enclosed green clothes. Ships lose the surrounding sea and attached wave fragments. Roads include their ivory pattern, with visible branches traced closely enough to exclude nearby plants and lamps.

Rebuild the original extraction first only if needed:

```sh
bun demos/opening/cutout/art/shared/make-wall.mjs
bun demos/opening/cutout/art/shared/extract.mjs
bun demos/opening/cutout/art/shared/finish.mjs
```

Then always apply the fix scripts. They restore source mattes and are safe to rerun:

```sh
bun demos/opening/cutout/art/war/fix.mjs
bun demos/opening/cutout/art/king/fix.mjs
bun demos/opening/cutout/art/friends/fix.mjs
bun demos/opening/cutout/art/roads/fix.mjs
bun demos/opening/cutout/art/shared/check-fixes.mjs
```

Review each shot with:

```sh
bun demos/opening/cutout/art/shared/check.mjs demos/opening/cutout/art/war .artifacts/opening/art-a-fix
bun demos/opening/cutout/art/shared/check.mjs demos/opening/cutout/art/king .artifacts/opening/art-a-fix
bun demos/opening/cutout/art/shared/check.mjs demos/opening/cutout/art/friends .artifacts/opening/art-a-fix
bun demos/opening/cutout/art/shared/check.mjs demos/opening/cutout/art/roads .artifacts/opening/art-a-fix
bun demos/opening/cutout/art/roads/review.mjs
```

The checker validates every base image and animation frame against layers.json, including alpha, file dimensions, frame bounds and the runtime image budget. It writes <shot>-rest.png, <shot>-stack.png and <shot>-pieces.png. Rest comparisons show the approved plate at left. Piece sheets show every drawing on grey and red. All four fresh rest comparisons and piece sheets were opened during review.

Road review writes roads-move-strip.png and roads-mask-move.png. Six frames combine a camera pan/crop with a center-out road reveal. The second strip isolates the moving/revealing mask on grey and red. roads-move.json records the exact camera and reveal parameters. These strips were opened. They are direct compositions of the layer assets, not a browser playback of the coordinator's renderer.

Checks run:

- bun tools/typecheck.mjs opening: exit 0.
- bunx biome lint demos/opening: exit 0.
- bun run check: exit 0. Boundaries passed, 880 Bun tests passed, 32 Convex tests passed.
- bun tools/verify-assets.mjs: TOTAL PASS. The existing warning remains that docs/assets.md does not describe the uikit manifest section. This checks shipped game assets, not the lab assets.
- shared/check.mjs on all four shots: PASS for file, alpha, dimensions, bounds and runtime image budget.
- shared/check-fixes.mjs: PASS for enclosed-hole checks on cloth, hands and fox, plus exact unchanged fox face/torso pixels.
- roads/review.mjs: PASS, six camera/reveal frames produced and inspected.

The new hole check caught eight alpha pinholes in a traced finger curve before the final fix. The rebuild review also caught Sharp expanding a saved grayscale matte into three channels. The loader now explicitly requests one channel and verifies its length. These checks do not replace visual inspection of edge colors.

No new generated paint is accepted in this fix round. An attempted generated ray field was rejected because it included broad glow and background artifacts. The existing source prompts and raw generated art from the first round remain in src. Friends still uses the approved spacing on a 3840-wide wall, with every figure shifted right by 960 pixels. Roads retains all six ships visible in the approved plate.

No further edge defect is apparent on the reviewed sheets. Intentional negative spaces between rigging and within carried objects remain transparent. The ordinary gold halos, crown highlights and fountain light are part of the painting.

Not checked: playback or motion cadence in the merged cutout renderer, mobile devices, audio, a production build or deployment. No frame rate was measured. No server was started.
