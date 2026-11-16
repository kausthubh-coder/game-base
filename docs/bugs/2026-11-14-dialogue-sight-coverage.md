# Dialogue coverage beyond the forest

The all-dialogue sight replay at high and low exposed two visible failures beyond the original twelve-scene coverage. During A hamlet, the Custodian's lines leave the hero's feet below the dialogue clearance. During Leaving at low quality, Dax overlaps Hobb's chest. Inspect `.artifacts/bench-copper-input/hamlet-red/scene-30-05.png` and `sight-low/scene-38-03.png`.

A hamlet now uses the existing authored camera-distance option with a minimum of 32. The hero remains at the normal arrival position. Leaving uses authored, separated marks for its four speakers. No body, crop or scenery thresholds changed.

The memory fixtures also incorrectly required the hidden present-day hero. The game's memory director deliberately hides that actor. The body observer now checks the authored memory cast without requiring an invisible hero. Non-memory scenes still require the hero. The retained failing test demonstrates the mismatch.

Reproduce individual scenes with `bun tools/play-sight.mjs scenes --only 30,38 --shots --bodies --quality high --out <empty-directory>`. Full evidence uses separate output directories for each quality and retains previous failures. Each body capture now includes its projected frame JSON.
