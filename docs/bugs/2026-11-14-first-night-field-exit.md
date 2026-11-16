# First-night field exit steering

The coordinator replay at a1223370 and an earlier helper replay stop while collecting camp wood, at x17.72135337268721, z-230.6999, targeting the nav cell at 17.5,-231.5. Original evidence remains in `.artifacts/first-night-framing-review/input` and `.artifacts/first-night-framing`.

`bun test tools/lib/field-exit.test.ts` reproduces the exact seed-41 position with the real HeroBody and painted-world step height. The original camera-key thresholds fail. Seed 1 passes, which explains why a generic movement fixture misses this failure.

At this position the hero's half-width overlaps column 18. The next row in that column rises two blocks. The intended nav cell in column 17 rises only one and is clear at its center. Steering truncates the small westward correction and keeps pressing due north. Moving at x17.5 traverses the normal terrain. Neither collision nor the terrain needs changing.

The keyboard sampler now carries fractional camera-axis demand between samples. A fresh follow-up run also exposed oscillation against the same ledge: individual steps moved, so the old stuck detector never requested a nav path. The runner now additionally detects lack of net progress and approaches each nav cell within 0.2m before turning. The original stuck threshold remains intact. These are runner changes, with no game, terrain, reward or art changes.

The regression covers the exact failure, normal outward/return movement at four camera headings, and the actual nav fallback with the real collision body. Red and green logs and browser evidence are in `.artifacts/homestead-input`. The complete `first-night-progress` replay passes from the original unedited landing save, retains the irrigation Continue, explicitly walks back into and out of the field, checks scenes 8–15 and one-time gifts, and exports an unedited morning save. The earlier `first-night-committed` oscillation failure is retained too.
