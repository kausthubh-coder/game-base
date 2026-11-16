PASS for the requested fix round.

Branch: lab/opening-art-you. No push or merge. Fix commits: f103b2a for alpha cleanup and walker poses; c6cd67e for street framing and camera checks. This report is committed after them.

Wall:
- Kept the reviewed room framing. Hobb's exported poses now remove the residual backdrop near boots and hair; both retain the same older woman and clean soft edges on red and grey.
- Tightened the export alpha cleanup from the old broad ramp. An additional generated cleanup attempt still contained glow and was rejected; its raw file and prompt remain in src for provenance.
- The room remains darker than the approved plate, with candle lighting reserved for the renderer. The resting child has the low candle pose. The mural surface must retain the room's depth.

Doorstep:
- Inspected the basket on fresh red and grey sheets after the same alpha cleanup. No broad glow halo remains on the basket edge. The separate lamp glow is intentional.
- Replaced the six-drawing walker with walker-v2.png. Bent knees, arms and coat hems now differ more clearly; boots share a baseline. Opened the fresh walk strip and regenerated the walk GIF.
- Corrected the extra street crop. The clean 1920 by 1080 painting now stays centered within the 2304 by 1296 overscan. Generated outer margins provide continuation. Restored the exact clean center over those margins so a new generation cannot move the street geometry. Character and basket boxes follow the wider framing.
- House/market details still differ from the approved painting because the clean edit repainted them. Framing is closer; this is not a pixel-identical restoration of the approved plate.

Morning:
- Uses the same framing correction and mask coordinates as doorstep. The open door, dry street and clear title area remain.
- Put the flower-and-ground corner on the step's depth plane. It remains separately drawable, but its attached cobblestones now move with the step instead of splitting the ground edge.
- Flags remain two independent strips. Flowers remain a corner patch, not individual botanical silhouettes.

Camera review:
- New wall/camera-check.mjs reads the actual layers.json and exported WebPs.
- Three samples per shot pan from -48 to +48 frame pixels, lift from -8 to +8, and push from scale 1 to 1.08. Each layer's shift uses 1-depth. It renders the actual stack, verifies every pixel stays opaque, and creates a short strip.
- Opened each strip. Rows show full frame, wall/wisteria detail, and ground/flower detail. I saw no exposed canvas edge or conspicuous broad-matte seam in this move.
- Coverage assertion was tested by temporarily moving the room background offscreen. It rejected the image with "exposed canvas edge or hole", then the original manifest was restored.
- This is an asset camera harness. It does not claim to test the director's final runtime choreography. Larger pans, zoom-outs and independent movement of attached ground patches remain outside the tested range.

Commands and results:
- bun demos/opening/cutout/art/wall/export.mjs: wall exported.
- bun demos/opening/cutout/art/doorstep/export.mjs: doorstep exported.
- bun demos/opening/cutout/art/morning/export.mjs: morning exported.
- bun demos/opening/cutout/art/wall/check.mjs --proofs: PASS wall, doorstep, morning. Every referenced file/frame exists, sizes match, backgrounds are opaque with overscan, budgets pass. Referenced WebPs total 979862, 1780000 and 1638350 bytes respectively, excluding retained sources.
- bun demos/opening/cutout/art/wall/camera-check.mjs: PASS all three shots, three opaque frames each.
- bun demos/opening/cutout/art/morning/check-alignment.mjs: PASS. Door frame and step edges dx=-1,dy=0; street edge dx=-1,dy=-1 pixels. Checks the two current clean edits in fixed structural regions.
- bun tools/typecheck.mjs opening: exit 0.
- bunx biome lint demos/opening: exit 0, 21 files, no fixes.
- bun run check: exit 0, log in .artifacts/opening/art-you/check.log.
- bun run verify assets build: both parts passed, nothing failed. Existing asset warning remains: public manifest's uikit section is undocumented.
- Rebuilt every shot again after disabling libvips file caching, which had retained an old WebP header during in-place resizing. Git status was clean after the rebuild, confirming identical committed exports.

Fresh pictures opened:
- .artifacts/opening/art-you/wall-rest.png
- .artifacts/opening/art-you/wall-edges.png
- .artifacts/opening/art-you/wall-camera-strip.png
- .artifacts/opening/art-you/doorstep-rest.png
- .artifacts/opening/art-you/doorstep-edges.png
- .artifacts/opening/art-you/doorstep-camera-strip.png
- .artifacts/opening/art-you/doorstep-walker-strip.png
- .artifacts/opening/art-you/morning-rest.png
- .artifacts/opening/art-you/morning-edges.png
- .artifacts/opening/art-you/morning-camera-strip.png

Also refreshed: doorstep-morning-overlay.png, Hobb/child/flame pose strips and doorstep-walk.gif. Evidence lives in this helper checkout's .artifacts/opening/art-you directory. The rest comparisons show approved plate on the left and exported stack on the right. No full-size intermediate PNGs were retained. Original generated attempts and exact prompts stay under each shot's src folder, using hard links to avoid duplicate raw-image storage.

Not checked: final film renderer, rain/light/title animation, sound timing, legend seam, mobile devices or game browser play suite. No server was started.
