# Old oak felling throws after awarding materials

The earned kitchen gathering continuation recorded browser errors `no block called oldOak_log` in `.artifacts/homestead-input/crated-resume3/replay.json`. Old oaks have an art identity, but no separate block identity. Felling marked the tree removed and awarded materials before trying to construct its event's block ID, so the inventory appeared to succeed while the browser reported errors.

The regression in `src/game/trees/trees.test.ts` fells a real old oak, checks that it does not throw, checks exact existing rewards, and checks the block-broken event. `tree-red.log` and `tree-green.log` retain the failing and passing runs. The event now uses oak for old oak and willow, and retains pine and birch IDs. Material quantities, protection and collision are unchanged.
