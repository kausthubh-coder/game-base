# Explicitly equipped strips were reusable

The earned visitor replay placed the workbench-crafted strip and the fight record reports one placement and one trigger. The final raw save still held the strip in both bag and equipped slot. Read `visitor-diagnostic/replay.json` and `earned-copper.save.json` under `.artifacts/bench-copper-input`.

Fight setup tracked only kit things automatically filled into empty slots as coming from the bag. The same list now includes explicitly equipped slots. The existing placement event removes the item and clears its bench slot when the last one is gone. Costs, payouts and combat values are unchanged.

`bun test src/game/fights` retains a failing-before, passing-after regression at the real fight-event seam. The fresh earned consumables replay retests placement, the trigger, copper crafting and ordinary visitor combat with the fitting. Fixture tests remain separate from earned acceptance.
