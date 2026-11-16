# Grass covers the fox during its entrance

Priority: P2, visual. Tested build: experiment 57cff58, Chrome on Apple M4, high graphics, 1280 by 720.

Click the title badge's Play scene 9 button. During shot 4, around the middle of its walk, a large foreground grass blade crosses the fox's face and hides most of its body. The introduction spends part of its time on ears and grass. The fox becomes clearer as it reaches its stop. A held frame can hide the face even later because the world grass continues moving.

Expected: the fox's face, low head and frightened walk remain readable through the important entrance. Keep foreground grass clear of the shot's path or frame it differently. This is an art judgment against storyboard shot 4, not a claim that the actor is absent.

Observed in three independent paths: continuous normal playback, continuous reduced-motion playback, and the builder's held shot pass (3/3). Low graphics has less grass and reads more clearly.

Reproduce: `bun tools/cut-player-test.mjs watch` and inspect the entrance pictures, or `bun tools/film-shots.mjs --url http://127.0.0.1:5410/experiment --at 16.5 --out .artifacts/cut-test/grass-repro`. The scripts capture evidence; this visual judgment needs a person and has no automatic pixel assertion.

Pictures, opened and reviewed:

- `.artifacts/cut-test/live-15.png` (continuous normal playback, face covered)
- `.artifacts/cut-test/high/shot-4.png` (held frame, blade across face)
- `.artifacts/cut-test/reduced-live-15.png` (continuous reduced-motion playback)
- `.artifacts/cut-test/low-16.5.png` (comparison: clearer face)

## State

Fixed in the commit after 49967e6 on `experiment`: shot 4's lens is 1.3 blocks higher, so it looks over the grass. Checked at 13, 15 and 16.5 s (`.artifacts/fix-fox/`).
