# Reduced motion holds the lens but continues moving the actors

Priority: P2, design mismatch. Tested build: experiment 57cff58, 1280 by 720, high graphics.

Set prefers-reduced-motion to reduce before loading the title. Click Play scene 9 and watch shot 4. The camera holds, but the fox still walks across the frame; fireflies, grass and flame continue moving too. The seated hero changes pose in shot 3.

The design says: "With reduced motion on, each shot holds one still." Expected: one composed still per shot under that preference, or an explicit change to the design if only camera movement is intended to stop.

Reproduce with `bun tools/cut-player-test.mjs reduced-live`. The context uses Playwright's real reducedMotion media emulation. One continuous reduced-motion run reproduced this (1/1). This is a visual check, not an automatic image-difference assertion.

The page's camera position was identical in all three shot 4 samples: x -20.175, y 24.05, z -230.15. The pictures show the fox moving from near the trunks toward the bottom right despite the held lens:

- `.artifacts/cut-test/reduced-live-13.png`
- `.artifacts/cut-test/reduced-live-15.png`
- `.artifacts/cut-test/reduced-live-16.5.png`

All three pictures were opened and reviewed. Raw page state: `.artifacts/cut-test/reduced-live.json`.
