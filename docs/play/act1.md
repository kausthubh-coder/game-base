# The playable first part: "A plot of your own"

## What this is

The playable first part of act 1. One player, in the browser, about 30 minutes long. It was first built for
2026-11-10 with five quests. On 2026-11-11 Kausthubh picked the game's story, and a sixth quest, the first
night, went in between the roof and the leaftail.

The story is the handbook chapter `~/dev/sandbox/game-look-test/design/04d-new-story.md`: a hero-king
swallowed the souls of the ancients and became a god, the world's faith worships him, and the player
carries the Mark of the one companion who stopped him. Read its sections "Who you are, and how you start"
and "How the story drives the game" before you change a quest. Nobody in the first part knows any of it.

The research on scenes is `~/dev/sandbox/game-look-test/design/03b-story-guide.md`. Read its section "What
makes a scene work" before you write a line of dialogue.

## The shape of the 30 minutes

Home comes first: a plot, a shelter, a pet, a town, a harvest. On the first night the story arrives: a
door that has been shut for a thousand years opens for the player.

| # | Quest | What the player does | What it teaches |
|---|---|---|---|
| 1 | A plot of your own | Meet Tamsin at the grant stone. Get the Almanac. Watch a mossling until both columns of its page fill. | Looking closely. The Almanac's two columns: what it needs, what it gives. |
| 2 | A roof before dark | Chop wood, make a workbench, build a shelter, make a bed. | Gathering, crafting, building, the day. |
| 3 | The Shut Door | Lie down at evening. A Blighted fox keeps the player awake and follows them to the stone door north of the plot. It opens. Inside: the Mark, the Custodian, the calmed fox, the Heartstone. Sleep, and show Tamsin the Mark in the morning. | That the player is the one the ruins open for. Calming a beast instead of striking it. That the land's life is counted. |
| 4 | Leaf and tail | Find the leaftail in the dead garden. Bring it berries without startling it, three times. | Giving first. A pet that follows. |
| 5 | The queen's bread | Walk to Hollowmere. Meet Queen Maren. Get seeds from Gus. Grow and deliver 20 wheat. | Soil, water, growth. The town and its people. |
| 6 | The harvest festival | Evening. Lamps on the river, the whole town in the square, a few lines from people who noticed what you did. Then the end card. | That this is home. And one small wrong note. |

## Places

The region system owns exact positions. It must provide these named places:

| Name | What it is |
|---|---|
| `grant.stone` | A standing stone at the corner of the player's plot. The game starts here at dawn. |
| `grant.center` | The middle of the plot: flat meadow, about 28 by 28 blocks, with trees within 20 blocks |
| `grant.rocks` | Mossy rocks in the shade of trees, within 15 blocks of the stone. Mosslings live here. |
| `dead.garden` | A ruined homestead 60 to 80 blocks from the plot: a broken fence, dry beds, berry bushes nearby. The leaftail lives here. |
| `shut.door` | In front of the stone door of Ilara's Hall, a walled court of the ancients a few blocks north of the plot |
| `hall.door`, `hall.heart`, `hall.custodian`, `hall.gate`, `hall.mural` | Inside the Hall: the threshold, the Heartstone, the Custodian's plinth, the dead Gate and the mural |
| `town.gate` | Where the path from the plot reaches Hollowmere, 120 to 160 blocks from the plot |
| `town.square` | An open square with a well, the festival ground |
| `lodge` | The guild lodge, Tamsin's place in town |
| `granary` | A barn by the sawmill office. Queen Maren works here. |
| `bakery` | Odo's shop on the square |
| `gus.field` | Gus's field at the edge of town |
| `carpenter` | Mira's workshop |
| `kennel` | Keeper Wren's yard |
| `river.bank` | The bank of the Mere beside the square, where lamps are floated |
| `ferry` | A small dock down the river. Brack stands here. |

A dirt path runs from the grant stone to the town gate. The town has teal roofs.

## People

Each has a want that shows, and a habit you remember them by. Lines are short. Nobody explains the theme.

| Id | Who | Wants | Habit | Voice | Where |
|---|---|---|---|---|---|
| `tamsin` | Retired delver, runs the lodge. Your mentor. | To see one plot kept | Replants every hole she passes | Low, dry, slow | Grant stone on day 1, then the lodge |
| `maren` | The queen, 19 | Bread for the winter | Asleep at her own table | Quick, tired | Granary |
| `odo` | Baker | His oven lit before dawn | Names every loaf | Warm, bouncy | Bakery |
| `gus` | Farmer | Rain | Thinks every problem is a soil problem, and is right | Slow, flat | His field |
| `mira` | Carpenter | To measure something | Measures you while you talk | Bright, fast | Workshop |
| `wren` | Pet keeper | Every pet fed | Talks to your pet first | Soft | Kennel |
| `juniper` | A child | Sweets | Trades secrets for them | High, fast | Square, runs around |
| `brack` | Ferryman from downriver | His river back | Smells of reeds | Gravel | Ferry |

`villager-a` and `villager-b` fill the town as people with one line each.

The Custodian is not one of the town's people. `src/game/hall` owns it: Ilara's own beast, small and patched
with brass, asleep on a plinth in the Hall until the player's key wakes it. It is a thousand years old,
short of patience, and it counts things.

## Quest steps

Step ids are for the quest system. A step is done when its condition holds.

**1. `plot`**
1. `meet`: talk to Tamsin at the grant stone. She gives the Almanac, an axe and a waterskin of advice.
2. `watch`: learn both facts on the mossling page. `needs`: "Shade and mossy stone". `gives`: "A moss tuft, when the ground under it is damp".
3. `tell`: talk to Tamsin again.

**2. `roof`**
1. `wood`: have 12 wood.
2. `bench`: place a workbench.
3. `shelter`: place a bed with a block over it.

**3. `night`**
1. `bed`: lie down in the evening. The player cannot sleep: something is moving outside. Night falling on the plot does the same.
2. `door`: back away to the stone door with the fox following. At the door the player lets the axe fall, and the door opens.
3. `mark`: go in. The lamps wake and the Mark rises on the player's hand.
4. `key`: turn the key in the beast on the plinth. The Custodian wakes: "You're late."
5. `calm`: hold out the marked hand to the fox in the doorway. The grey runs out of it, and it goes home to the dead garden.
6. `heart`: touch the Heartstone. The Custodian says what feeds it.
7. `sleep`: sleep until morning.
8. `tamsin`: Tamsin, Juniper, Gus and Brack are at the grant stone. Tamsin gives the player a glove.

**4. `leaftail`**
1. `find`: come within 10 blocks of the leaftail in the dead garden.
2. `berries`: have 3 berries.
3. `trust`: feed it three times without startling it. It bonds and follows.
4. `show`: talk to Tamsin, or to Wren in town, with the leaftail beside you.

**5. `bread`**
1. `town`: reach the town gate.
2. `queen`: talk to Queen Maren in the granary.
3. `seeds`: talk to Gus. He gives a hoe, a watering can and 12 wheat seeds.
4. `grow`: harvest 20 wheat. One ripe wheat gives 2 wheat and sometimes a seed.
5. `deliver`: bring 20 wheat to Maren.

**6. `festival`**
1. `evening`: it starts at dusk on the day of delivery. Reach the square.
2. `lamp`: float a lamp on the river at the bank.
3. `end`: talk to Tamsin on the bank. The end card shows.

## Rules of the small things

- **Day length.** 12 minutes of real time for this build. Dawn at the start.
- **Wheat.** 4 stages. A stage takes 45 seconds in wet soil. Water lasts 3 minutes, and rain waters everything. Sleeping grows every wet crop two stages.
- **Mossling.** Appears on mossy stone in shade, up to 3 near the grant rocks. It wanders within 6 blocks. Every 20 seconds, when the block under it is damp (within 2 blocks of water, or watered, or after rain), it leaves a moss tuft. Seeing it stand on mossy stone teaches `needs`. Seeing it leave a tuft teaches `gives`. Watering the ground near it with the can from quest 4 works, and so does the pond by the rocks: put one mossy rock within 2 blocks of water so the first lesson needs no tool.
- **Leaftail.** It tends the dead garden: it walks from bed to bed. If the player moves faster than a slow walk within 6 blocks, it is startled, backs off and will not eat for 15 seconds. Holding Shift walks slowly. Drop a berry within 3 blocks (use it on the ground) and stand still: it comes and eats. Three berries and it bonds.
- **Bonded leaftail.** It follows within 3 blocks. Once a minute or so, on grass, it digs up one wheat seed and brings it to you. That is the pet giving before it is asked.
- **Berries.** Berry bushes near the dead garden and the path. Use one to pick 1 to 2 berries. It regrows in 2 minutes.
- **Tools.** The axe cuts logs 3 times faster. Hands can break grass, leaves, dirt and placed blocks. Nothing breaks.
- **Blocks you place stay** inside your grant. Town blocks cannot be changed.
- **Recipes.** By hand: 1 oak log makes 4 planks. Workbench (by hand): 4 planks. Bed (workbench): 6 planks and 3 fiber. Chest (workbench): 8 planks. Lamp (workbench): 1 plank and 1 moss tuft. River lamp (given by Odo at the festival). Fiber comes from breaking leaves (one time in two) and grass (one time in five).
- **Weather.** Day 1 is clear. Light rain falls for 90 seconds in the afternoon of the day the wheat is planted, so the player sees rain water a field. The festival evening is clear.
- **Never stuck.** If the player has no axe, Tamsin gives another. If they have fewer seeds than they need, Gus gives 4 more. If the leaftail is lost, it comes back when called from the plot.

## Voice

Three sample exchanges. Match this length and tone everywhere.

> **Tamsin:** Twelve people have asked me for this plot. You are the first who looked at the ground before the view.
> **Tamsin:** Take the book. It has been blank for forty years. I only ever looked at things to price them.

> **Maren:** *(waking)* Forty sacks. I counted twice. It is not enough, and counting again will not make it enough.
> **Maren:** Twenty sheaves by the festival. I can pay you in thanks and one good meal.

> **Gus:** Soil's tired. Not lazy. Tired. You'd be too.

The last scene, on the river bank, lamps on the water:

> **Tamsin:** Good harvest. Small, and good.
> **Tamsin:** *(looking west)* Evening came early again. A little sooner every week.
> **Tamsin:** Go on. Float your lamp.

## The end card

"End of the first part." Under it: days played, wheat grown, blocks placed, Almanac pages complete, and
one line: "The second part is not built yet. You can keep playing." Then the game goes on.

## What the build must have

- A title screen with New game, Continue and Settings (quality, volumes, key hints).
- Saving on sleep, on quest steps and every minute. Continue restores the world, the bag, the quests and the pet.
- The HUD: quick slots, a quest tracker, the clock, the minimap with the quest's waypoint, prompts ("E: Talk to Tamsin").
- Hints the first time each thing matters, one line each, never twice.
- Sound from the engine: meadow music at the plot, the town arrangement in Hollowmere, night, footsteps by surface, voices in dialogue, a stinger on a quest step.
- The sky and weather features, effects on steps, block breaks and crop growth, and post-processing with quality levels.
- 60 frames a second in mind: the budgets in `AGENTS.md` hold.

## The debug door

Tests cannot play at one frame a second, so the game exposes `window.__game` in every build:

| Call | What it does |
|---|---|
| `state()` | Plain data: player, clock, quests, bag, flags, counts of actors |
| `advance(seconds)` | Steps the simulation that many seconds without drawing |
| `teleport(place or x, y, z)` | Moves the player |
| `give(item, count)` | Adds to the bag |
| `key(name)`, `click(button, x, y, z)` | Presses a game key or uses the held item on a block |
| `interact()` | Runs the nearest prompt |
| `talkThrough()` | Clicks through the open conversation, taking the first choice |
| `skipTo(quest)` | Puts the game at the start of a quest |
| `counters()` | Draw calls, triangles, frame and simulation milliseconds |

A scripted play of all five quests through this door, start to end card, must pass. That script is the
main check.

## How good is good enough

Judges score these from 1 to 10. The target is 8 on every line.

1. First impression: the title screen and the first minute.
2. One look: blocks, props, sprites and light belong to one game.
3. Reading the scene: the hero is always visible, and it is clear what can be used.
4. The flow: every step is reachable, and the next thing to do is always clear.
5. Words: every line sounds like its speaker and is short.
6. Feel: nothing stutters in the script, inputs answer at once, prompts are exact.
7. Sound hooks: every action that should sound sends its event.
8. Interface: readable, aligned, consistent, and it passes the Critly check.
9. Speed: inside the draw call, triangle and script budgets.
10. No bugs in the scripted play.
