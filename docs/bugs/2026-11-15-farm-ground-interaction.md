# Farm panels were above the player's reach

The earned Water uphill browser route built a working six-spring pit, saved and continued, then walked to its rate tag. E never offered the farm panel. Attempt 8 records the timeout in `.artifacts/uphill-input/attempt-8/replay.json`.

The farm registered its floating label as its interaction position. The spring tag is 2.6 metres above its ground; the interaction registry measures three-dimensional distance within a 2.5 metre radius. Even standing directly below the label could not open the panel.

The regression in `src/game/farms/farms.test.ts` uses the real farm, registry and E action. `bun test src/game/farms/farms.test.ts` first failed with an undefined nearest target. The fix keeps the label's horizontal position and uses the goods' ground height for interaction. It reuses one position object per farm. The same test then opened the spring panel and passed. Red and green logs are retained in `.artifacts/uphill-input/`.

The fresh production input replay in `.artifacts/uphill-input/attempt-14` opens the farm with E, exercises both choices from identical pre-choice bytes, and completes Water uphill with middle and final Continue. Its strict raw transaction and preservation audits pass. This closes the interaction defect; crowded farm labels remain a separate presentation issue.
