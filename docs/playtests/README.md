# Playtests

What agents found by playing the game like a person. The `playtest-game` skill is the method. One file here
per playtest, `<date>-<charter>.md`, with its pictures in `img/`.

## The parts of the game

A charter takes one row. Take the row played longest ago. Set the date when you file a report, and add a row
when the game grows a part.

| Part | How a player gets there | Scripts that cover it today | Last playtest |
|---|---|---|---|
| The title and its settings | Open the page | `play-ui.mjs` | 2026-11-11 |
| The opening film | New game | `play-act1.mjs` | 2026-11-11 |
| First steps: the tips, walking, the camera | Skip the film, then W A S D, Q and R, the right button, the wheel | `first-talk.json`, `play-drag.mjs` | 2026-11-11 |
| Talking, and the quest tracker | E at Tamsin by the grant stone | `first-talk.json`, `act1.test.ts` | 2026-11-11 |
| The Almanac and watching a creature | After Tamsin, at the mossy rocks | `act1.test.ts` | 2026-11-11 |
| The bag and the quick slots | The bag key, 1 to 9, dragging | `cancel-bag-drag.json`, `play-ui.mjs` | 2026-11-11 |
| Gathering: wood, stone, berries | The axe on a tree, the left button on a block | `fell-a-tree` | never |
| Crafting at the workbench | Logs to planks to a workbench, then E on it | `workbench-crafting` | never |
| Building: placing, build mode, undo | The right button with a block in hand; build mode | `build-stroke`, `play-build.mjs`, the stroke's model | never |
| Farming: till, plant, water, harvest, the sprinkler | The hoe, seeds and the can on the plot | `wheat-three-nights`, `wheat-save-load` | never |
| The day: dusk, sleep, morning | A bed under a roof at night | `wheat-three-nights`, `leaves-are-no-roof` | never |
| The leaftail | The dead garden, with berries | `befriend-a-pet` | never |
| The town and its people | The path from the grant stone to the gate | `town-is-protected`, `play-act1.mjs` | never |
| The map | The map key | `play-ui.mjs` | 2026-11-11 |
| The pause menu: graphics, view, sound | Escape | `play-ui.mjs`, `play-drag.mjs` | 2026-11-11 |
| Saving and Continue | Reload the page, Continue | `wheat-save-load` | never |
| The festival and the end card | The last quest of the first part | `festival.json`, `play-act1.mjs` | never |
| An account: sign in, back up, the world list | Settings on the title | `play-together-signed-in.mjs` | never |
| Playing together | An invite link | `play-together.mjs`, the join model | never |
