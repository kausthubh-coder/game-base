# play

The first part played from a new game to `act.ended` through the real rules, as a test. It is the main check of `docs/play/act1.md`. Nothing here is part of the game: `src/game/systems.ts` finds systems by `index.sim.ts`, and this folder has none.

## Files

| File | What it holds |
|---|---|
| `harness.sim.ts` | `newPlay()` and `loadPlay(save)`: a real `World` on seed 1, a kernel on seed 7 or the seed given, every system installed in the order of `systems.ts`, and the verbs of the debug door |
| `script.ts` | `STEPS`: the five quests as 21 small steps, each a function of a `Play` |
| `act1.test.ts` | The tests |
| `inputs.sim.ts` | What a player does, as data, and `press(play, input)`, which plays one |
| `invariants.sim.ts` | What must hold after every kernel step. The list is at the top of the file. |
| `scenario.sim.ts` | `runScenario`: a seed, a start, a list of inputs and what must be true at the end |
| `bot.sim.ts` | `startBot(seed)`: random valid inputs under a seed, checked after every step |
| `state.sim.ts` | `stateHash(play)` and `summary(play)` |

`bun tools/sim.ts` runs the last five. The scenarios are in `src/game/scenarios`, and its README says how to
write one and how the bot and the replays work.

Run it with `bun test src/game/play`. It takes about two seconds.

## The harness

No system is faked, and no verb gives an item, writes a flag or skips a quest.

| Verb | What it does |
|---|---|
| `advance(seconds)`, `until(done, seconds)` | Steps the kernel 20 times a second |
| `walkTo(place or point, options)` | Moves the player along `nav.toward` paths at 4.4 blocks a second, or 2.0 with `soft`. `via` lists points to pass, `until` stops the walk early. |
| `teleport(place or { x, z })` | Stands the player there at once |
| `take(item)` | Selects the item's quick slot, and moves the item to one first when it lies deeper in the bag |
| `use(x, y, z, face)` | One secondary click with the held item on a block face |
| `hit(x, y, z, face)` | One primary click |
| `dig(x, y, z, face)` | A primary click held until the block breaks, at most five seconds |
| `prompt()`, `interact()` | The nearest prompt's words, and the E key |
| `talkThrough(choice)` | Clicks through the open conversation, taking the first choice or the one named |
| `make(recipe)` | `crafting.make`, which is what the bag panel calls |
| `save()` | The world's edits and the kernel's save as plain JSON |
| `reload()` | This game saved and loaded into a fresh world and kernel on the same seed |
| `onStep(fn)` | Runs `fn` after every kernel step |
| `tick(keys)` | One kernel step with the hero's own body: three body steps under the movement keys, then the kernel |
| `aim(yaw, pitch)` | What a ray from the hero's eyes hits within reach: a block, a tree or nothing |
| `click(button, hit)`, `hold(hit)` | A click, and the primary button held for a step, on what `aim` gave |

Three things stand in for the shell:

- The land. The harness makes 3 chunks each way when the player's chunk changes, and drops a chunk more than 7 away. Those are the shell's `LOAD_REACH` and the view's reach at low quality. A system that reads blocks beyond that gets air, as in the game.
- The body. `walkTo` moves `game.player.pos` along a nav path. It does not step the hero's body, so it does not check collisions or jumps. `tick` steps the body as the shell does, with the painted world's step up of one block. The bot moves only with `tick`.
- The pointer. `use`, `hit` and `dig` name a block and a face. `aim` casts a ray from the hero's eyes, where the game casts one from the camera. The actions system still checks reach.

`INSTALLS` repeats the order of `SYSTEM_ORDER`, because `systems.ts` uses a Vite glob that `bun test` cannot run. A test reads `systems.ts` and fails when the two lists differ.

## The tests

- The whole play, with the flags checked after each quest, and the clock and the kernel step count printed.
- The same play with a save and a load into a fresh world and kernel after every step. After each load the clock, the player, the bag, the flags, the quests, the pet, the stations, the crops, the people and the blocks around the player match the game that was saved.
- The other choices a player has: the leaftail fed with E, shown to Wren, and the wheat delivered with "I have things to do first", so dusk comes by itself.
- Every place name used by a person, a pet, a creature or a quest step exists in the region.
- `skipTo` each quest in turn, then the rest of the play from there.
- The shower: none before the afternoon, 90 seconds of rain, the field wet through it, and only once.

## Adding a step

A step reads what it needs from the `Play` it gets, such as the hut's place from `region.grant()`. It keeps nothing in a variable outside itself, because the second test hands the next step a different `Play` after each load. A step that cannot go on calls `must`, which throws with the clock, the player's place, the open quest step and the last four toasts.
