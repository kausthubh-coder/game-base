# Scene 9 loses its subjects in portrait

Priority: P1. Tested build: experiment 57cff58, at http://127.0.0.1:5410/experiment/.

A player opens the film in a 390 by 844 window. In shot 1 the hero and fire fall off the left edge. In shot 5 both the hero and fox are outside the picture; the player reads about something at the edge of the light while looking at empty grass. Shot 6 initially clips the hero at the right edge.

Expected: reframe or widen each shot for this aspect ratio so its subjects remain visible together. The subtitle and Skip button already fit.

Reproduce with a fresh browser context: open `?scene=9&cut-at=20.5` at 390 by 844. Run `bun tools/cut-player-test.mjs portrait-check`. This exits 1 today because both actor projections return null. Three of three independent contexts failed, and the six-shot narrow pass showed the same failure.

Exact output:

```text
portrait-1 [{"name":"camp.seat","screen":null},{"name":"camp.edge","screen":null}]
portrait-2 [{"name":"camp.seat","screen":null},{"name":"camp.edge","screen":null}]
portrait-3 [{"name":"camp.seat","screen":null},{"name":"camp.edge","screen":null}]
FAIL: shot 5 must contain hero and fox; projected actors are outside the viewport.
```

Pictures, opened and reviewed:

- `.artifacts/cut-test/portrait-repro-1.png`
- `.artifacts/cut-test/portrait-repro-2.png`
- `.artifacts/cut-test/portrait-repro-3.png`
- `.artifacts/cut-test/narrow-3.5.png`
- `.artifacts/cut-test/narrow-23.5.png`

The test uses the real rendered camera and the named actors' landing positions. It does not assert a camera implementation detail.

## State

Fixed in the commit after 49967e6 on `experiment`: on a screen narrower than 16:9 the director widens the lens to show as much across as at 16:9. Checked at 390 by 844, shots 2 and 5 (`.artifacts/fix-portrait/`).
