# Padding was locked behind the quest it unlocks

From the unedited earned grey-wood save, Continue and let the home settle. Open the placed workbench, select gear and fittings, then armour. The bench quest asks for a padded jacket, with enough pelts and moss already earned. Make is disabled with "The copper-bound step is not open yet."

Reproduce with `PLAY_PORT=5559 bun tools/play-bench-copper.mjs --save .artifacts/greywood-input/final-earned/earned-greywood.save.json --out <empty-directory>`.

The bench applied the weapon tier's Copper quest gate to armour as well. Copper starts only after the bench quest. The repair opens tier-two armour during the bench quest. Weapon gates, ingredient costs and later armour gates remain intact.

Evidence is under `.artifacts/bench-copper-input/jacket-red`. The bench regression fails before the repair and passes afterward. The earned browser replay subsequently makes the jacket and reaches the post objective.
