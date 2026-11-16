# Act 1 beasts, second pass

Based on act1 at 92c2279. No frozen baseline changed. Original frame sizes and anchors stay intact.

The user designated the creature concepts as approved for this task, overriding the older pending labels in their READMEs.
Three generated edits were kept, one attempt each. The exact prompts and references are in provenance.json.
The generated sources are retained in assets-src/raw and committed so another checkout can rebuild them.

Rebuild with `bun tools/sprites/beasts-act1.mjs`, then `bun tools/sprites/camp-sprites.mjs`, then
`bun tools/sprites/custodian-wake.mjs`. The camp tool restores the fox's authored stalk and shake rows.
`--only lynx` rebuilds just that creature and its fight sheet.

| Creature | Frame and anchor | Frame height in blocks | Visible side body in blocks | Frames |
|---|---|---|---|---|
| Blighted boar | 192 square, 96/176 | 3.45 | 2.95 long, 2.19 high | Idle 2 and walk 4 per direction. Fight sheet 4 poses per direction: tell, charge, stagger, calmed. |
| Calmed boar | Same | 3.45 | 3.18 long, 2.48 high including its full mane | Same idle and walk contract. Existing healthy source retained. |
| Lynx | 96 square, 48/88 | 1.65 | 1.29 long, 0.86 high in its low side crouch | Idle 2, walk 4, fight poses 4 per direction. |
| Custodian wake | 96 square, 48/88 | 1.3 | Awake 0.79 wide, 0.92 high including key | Four held poses on four rows: sleep, eye, waking, idle. Front scene art only. |
| Thistlehog | 96 square, 48/88 | 1.00, previously 1.27 | 0.77 long, 0.68 high | Existing idle 2, walk 4, fight poses 4 per direction. |
| Gearling | 96 square, 48/88 | 1.30, previously 1.55 | 0.69 long, 0.88 high including key | Existing idle 2, walk 4, fight poses 4 per direction. |

The fight renderer reads the manifest worldHeight directly at scale 1. The boar already had cart-scale art in this
newer act1 base, unlike the old feel-test build. This pass adds gold cracks and tunes its occupied size. Its body
radius remains 1.3 blocks and charge lane remains 2.6 wide. The visible side body fits that footprint with tusk
and bristle overhang. No damage, reach, speed or collision rules changed. The two gearling-based keeper stand-ins
compensate for the field gearling's smaller frame height, preserving their existing displayed sizes.

The Hall uses custodian-wake. Scene 12's first spoken line holds eye, its next line holds waking, and later lines
hold idle. The sleep mark clears at the eye reveal. Only sprite/frame selection changed in the Hall; no quest or
dialogue content changed. The original Custodian sprite remains frozen. The Hall test checks the actual dialogue
advances before the awake flag is set.

## Other creature audit

Inspected beside sheets and game-camera pictures beside the hero. Dimensions exclude transparent padding.
The thistlehog and gearling were the largest proportional errors among the small beasts and were reduced.
Mossling 0.45 high and rootsnare 1.13 high agree with their sheets. Burrower 0.47 versus 0.55 and frog 0.33 versus
0.4 are modestly low. Fox is 0.56 high versus the proposed 0.75 ear-tip size and remains small and cute. Bee 0.33
and lanternfly 0.52 include their wings and remain deliberately exaggerated for visibility. Stag is 10.83 high
including antlers and reads as enormous; the frame can exceed the default camera. The keepers still use stand-ins,
not the proposed keeper artwork. Dedicated keeper art and room staging remain outside this pass.

The boar's healthy mane is visibly bulkier than its blighted mane. The lynx keeps a low silhouette; its ears and
cream ruff survive the night view, but geometry can still hide it under the arch deck. The camera audit uses the
ground beside the arches so that sprite contrast can be judged. This pass does not repair world occlusion or add
light to the arches. The fox's current camp stalk art was preserved, not redrawn. It still needs a less cute reveal.

## Evidence and checks

Pictures and logs are in `.artifacts/beasts-2/`. `beasts-2-look.mjs` draws production sheets at the real camera
beside the hero, and drives scene 12 through its real conversation. `beasts-2-measure.mjs` prints occupied sprite
sizes. Beside pictures were made with `beside.mjs` and inspected, including every boar and lynx fight pose.
No screenshot baseline was approved or refreshed.

- Asset verification passes all nine checks. One existing uikit documentation warning remains.
- Lint exits 0 with existing warnings and infos.
- Focused Hall tests pass, including the eye reveal. Hall and fightview type checks exit 0.
- Production build passes.
- Full check has unrelated timeouts in prop builders, effects and region generation under heavy shared-machine load.
  The initial doctor's check also did not finish within its intended timeout; its own remaining processes were stopped.
  This does not establish a clean full-check baseline. See check.log for the actual failures.
- Six approved camera scenes and their draw budgets pass on the rerun using this worktree's port. No baseline changed.
- The full check was stopped after recording 23 failing tests while the shared machine was heavily loaded. Most
  were timeouts. The two ledger assertions and goods-market-day are also documented in the original feel report.
  The final targeted eye test passes after making frame selection tolerate removal of the printed stage cue.

Status: ISSUES. Re-run the full check on a quiet machine and resolve the existing goods failures before a clean
merge gate. Arch occlusion, the fox's small cute appearance, and dedicated keeper art remain visible limitations.
No push, main merge or playtest-branch change was made. The dev server and interrupted check processes started
by this task were stopped by PID; the screenshot runner cleaned up its own server and Chrome.
