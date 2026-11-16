# Act 1: the foundation

Read this page before you build any part of act 1. It fixes the shapes the act 1 builders share: the ids, the flags,
the events, the systems and their api sections, the clock and the save. The plan is `docs/act1.md`, and the map of
what exists and what is missing is `docs/act1-gaps.md`. This page records what the coordinator decided on the gap
map's "Fix these first", made on the branch `act1-foundation`.

The rule that keeps builders apart: systems meet through flags, events and the api types in
`src/game/api.sim.ts`. A builder never imports another builder's system. If you need something another system
does not give yet, add it to your own api section, read it with `?.` so a missing system reads as empty, and say
so in your report.

## Who owns what

| Builder | Owns these files | Its api section and system |
|---|---|---|
| The opening | `src/game/views/story-opening.view.ts` and a new opening view, `src/game/content/opening.ts`, `src/game/ui/menus.ui.ts` (the title), `demos/opening/` | none; it sets `story.opening`, `choice.weapon` and the grant day stub flags |
| Quests and scenes | `src/game/content/quests.ts`, `src/game/quests/`, `src/game/story/`, `src/game/content/hints.ts`, the film director from `experiment` (`content/cutscenes.ts`, `uiview/cutscene.ts`, `views/story-cutscene.view.ts`) | `QuestsApi` |
| Dialogue | `src/game/content/dialogue.ts`, `src/game/content/cast.ts`, `src/game/talk/`, `src/game/uiview/voices.ts`, the talk box | `TalkApi`; it sets `scene.<n>` when a scene ends |
| Fights in the world | `src/game/fights/` (new, the world's encounters), `src/game/fight/` (the lab's rules), `src/game/fightview/`, `src/game/content/fight.ts` | "act 1: fights": `FightsApi`, `HeroStats` |
| Farms and machines | `src/game/farms/`, `src/game/machines/`, `src/game/bench/`, `src/game/content/gear.ts`, `src/game/creatures/`, `src/game/content/creatures.ts`, `src/game/crops/`, `src/game/crafting/`, `src/game/content/recipes.ts`, `src/game/content/placeables.ts`, `src/game/sprinklers/` | "act 1: farms", "act 1: machines", "act 1: bench" |
| People and the settlement | `src/game/settlement/`, `src/game/people/`, `src/game/content/people.ts`, `src/game/hall/` (the Heartstone's look and lines) | "act 1: settlement": `SettlementApi` |
| Ruins and vaults | `src/game/ruins/` | "act 1: ruins": `RuinsApi` |
| Goods and coin | `src/game/goods/`, `src/game/content/goods.ts` | "act 1: goods": `GoodsApi` |

The world is the ninth system. It runs on the `world/*` branches (`docs/greenhollow-world.md`) and owns
`src/game/region/`, `src/game/content/region.ts` and `src/game/content/greenhollow.ts`.

The coordinator owns `src/game/api.sim.ts` (outside the seven act 1 sections), `src/game/content/ids.ts`,
`src/game/content/flags.ts`, `src/game/content/items.ts`, `src/game/systems.ts`, `src/game/kernel.sim.ts`,
`src/game/play/` and `src/engine/`. Ask for an id, an item or a flag in your report, or add it yourself in the
one list it belongs to and say so.

## The ids

All of them are in `src/game/content/ids.ts`, each a list with a type made from it. A wrong id is a type error,
and nothing else keeps its own copy of a list.

| Type | What it holds |
|---|---|
| `QuestId` | `grantday, ground, night, blessing, kitchen, greywood, bench, copper, count, echo, pump, uphill, gallery, lights, seeds, itself, roofs, keystones, stag, green, pilgrimage`. `night` keeps its old id because the Hall keys on `quest.night.*`. |
| `PersonId` | `hero, custodian, hobb, dax, mina, guildmaster, tamsin, wren, maren, gus, tansy, holt, elowen, calla, aldric, ren, stag, ilara, auren`. `elowen` is the Green Mother. |
| `NpcId` | A `PersonId`, a villager (`villager-3`), `scene` for a scene's speaker, or `voice.<name>` for a one-off speaker in a scene (`voice.girl`, `voice.boy`, `voice.old-woman`, `voice.a-voice`). |
| `MapPlaceId`, `PlaceId`, `PlaceRef` | The 27 places of `PLACES` in `greenhollow.ts` (a test keeps the two the same), plus `saltgate`, which is off the map. A spot inside a place is `<id>.<spot>`, such as `hall.mural` or `saltgate.quay`. `ShrineId`, `RuinId`, `VaultId` and `MemoryId` are parts of these. |
| `ItemId` | Every item: `BASE_ITEM_IDS` (what the game had), `GOOD_IDS`, `PART_IDS` and `KIT_IDS` from the gap map's proposal and `playthrough/farms.js`. `moss_tuft` is now `moss_fiber`, and its icon keeps the old name. A test checks that `ITEMS` in `items.ts` has every id once and no other. |
| `FarmId` | `field, moss, quill, copper, seed, spring, pond, bee, dust, rope, plough`, the ids `farms.js` uses. |
| `ChoiceId` | `weapon, pump, hobb, dax, burrowers, dinner, calla, gearlings, gus, mina`, each with its values in `CHOICES`. The first value of each is the one `skipTo` picks. The kitchen's one choice step asks two of them, Hobb's room and Dax's job. |
| `SceneNumber`, `FightNumber`, `KeystoneNumber` | 1 to 38, 1 to 12, 1 to 3. |
| `LedgerSection`, `BuyerId`, `SettlementStep`, `FarmMode` | `granary, mill, lamphouse, wheelwright`; `granary, market, kitchen`; `camp, homestead, hamlet, freehold`; `give, take`. |

The region's own place names (`grant.stone`, `hall.heart`, `town.gate`) stay plain strings in `StepDef.place`
and the people's routines until the world builder makes every plan id a region place. A quest step carries both:
`at` is the plan id, and `place` is the region name for the waypoint.

## The flags

The names are in `src/game/content/flags.ts`. Build a name with `FLAG.scene(12)` or `FLAG.farmLiving('moss')`
rather than by hand. The table `FLAGS` in that file says what each one means, and a test checks that every builder
in `FLAG` has a row there.

| Flag | Written by | Value |
|---|---|---|
| `quest.<id>.started`, `.done`, `.step` | the quest system | true, true, the open step's id |
| `step.<quest>.<step>` | the system that does the step | true. A stub step's own flag, gone once its builder gives the step a real condition |
| `scene.<n>` | dialogue (or the film director) | true when scene n has played to its end |
| `choice.<id>` | whoever offers the choice | one of `CHOICES[id]` |
| `story.opening` | the opening | true once the film has played or been skipped |
| `fight.<n>.won`, `fight.<n>.denied`, `fight.<n>.phase` | fights | true, true (fight 4), the count of phases done (the Stag's three) |
| `meal.day` | settlement | the day number of the hero's last meal |
| `settler.<id>`, `job.<id>`, `wish.<id>` | settlement | true, a job name, true |
| `settlement.step`, `heartstone`, `hearts` | settlement | a `SettlementStep`, 0 to 6, a number |
| `farm.<id>.built`, `farm.<id>.living`, `farm.<id>.mode` | farms | true, true or false, give or take |
| `coin`, `ledger.<section>.filled`, `pump.running` | goods | a number, true, true or false |
| `memory.<id>`, `keystone.<n>`, `shrine.<id>`, `vault.<id>.cleared`, `vault.<id>.sealed` | ruins | true, true, heart or stamina, true, true |
| `night.fox`, `door.open`, `mark`, `custodian.awake`, `fox.calmed`, `fox.gone`, `heart.seen`, `night.over`, `night.told`, `hall.lit` | the Hall | true. The first night, as `src/game/hall` plays it now |

A quest step can ask for a number now: `{ flag: 'coin', atLeast: 150 }`. An unset flag reads as 0. `holds()` in
`src/game/quests/rules.sim.ts` throws on a condition it does not know. A new kind of condition needs its own
branch there, and the type check reminds you, because the last branch assigns the condition to `never`.

## The events

The new events are in `GameEvents`, each in the api section of the system that sends it.

| Event | Carries | Sent by |
|---|---|---|
| `scene.played` | `{ scene }` | dialogue or the film director, after it sets `scene.<n>` |
| `fight.started`, `fight.ended`, `fight.denied` | `{ fight }`, `{ fight, result: 'won' \| 'fell' \| 'left' }`, `{ fight, depth, heartstone }` | fights |
| `settler.arrived`, `settlement.step`, `wish.granted`, `dinner.asked` | `{ who }`, `{ step }`, `{ who }`, `{ asks: [a, b] }` | settlement |
| `farm.built`, `farm.mode`, `good.made` | `{ farm }`, `{ farm, mode }`, `{ farm, item, count, at }` | farms |
| `machine.state` | `{ part, state }`, where state is working, starved, backed up or off | machines |
| `goods.sold`, `coin.changed`, `ledger.filled`, `pump.set` | `{ buyer, item, count, coin }`, `{ coin, by }`, `{ section }`, `{ running }` | goods |
| `slept` | `{ day, skipped }`, the seconds of game time the night skipped | time |

`festival.started` is gone, and so is the festival it started. `talk.started` and `talk.ended` carry `npc: ''`
for a conversation with nobody in the world, as they always did, and the type now says so.

## The systems

Seven new systems install themselves from `src/game/<name>/index.sim.ts`. Each is a stub that answers from the
shared flags, so the other builders can call it today.

| System | Its place in `SYSTEM_ORDER` | What the stub does |
|---|---|---|
| `machines` | after `pets` | no parts; `turning()` is false |
| `farms` | after `machines` | each farm is what `farm.<id>.*` say, with no rate |
| `bench` | after `farms` | the guild's issue, with the weapon from `choice.weapon` |
| `settlement` | after `people` | the Heartstone (see below); the step from `settlement.step`; the settlers from `settler.<id>` |
| `goods` | after `settlement` | coin from `coin`; the four ledger sections from `content/goods.ts`; the pump from `pump.running` |
| `fights` | after `hall` | no fight is ever armed; the hero has the lab's 100 health and 100 stamina |
| `ruins` | after `fights` | each answer from the `vault`, `shrine`, `memory` and `keystone` flags |

Quests and the story director still come last. The full order is `systems.ts`, and a test holds
`src/game/play/harness.sim.ts` to it.

Each system's types are in its own section at the end of `src/game/api.sim.ts`, under a line of `=`. A section
declares `GameEvents` and `Systems` again for its own entries, and TypeScript merges every declaration of an
interface in one file. Edit only your own section.

| Section | Types |
|---|---|
| act 1: fights | `FightsApi { hero(), active() }`, `HeroStats { health, maxHealth, stamina, maxStamina }` |
| act 1: settlement | `SettlementApi { heartstone(), step(), settlers() }` |
| act 1: farms | `FarmsApi { all(), get(id) }`, `FarmView { id, built, mode, living, rate, best, symptom }` |
| act 1: machines | `MachinesApi { parts(), turning() }`, `MachinePart`, `MachineState` |
| act 1: bench | `BenchApi { gear() }` |
| act 1: goods | `GoodsApi { coin(), ledger(), pumpRunning() }`, `LedgerView` |
| act 1: ruins | `RuinsApi { state(id), shrine(id), remembered(id), keystones() }`, `RuinState` |

### The Heartstone

The settlement owns the number, 0 to 6, by chapter 30's ladder. `HallApi.heart()` keeps its signature and returns
`settlement.heartstone()`, so the gauge, the Hall's light and the Custodian's lines all read one number. Until the
settlement builder builds the ladder, the stub returns what the design's first step gives: 0 until the first
night's stone is seen (`heart.seen`), then 1. The settlement writes the level to the flag `heartstone` whenever it
changes. Beds, crops and bonded pets no longer add to it.

The Custodian's lines still wait for levels 3, 6 and 10, and the gauge still fills toward 10
(`ui-heart.view.ts`). The settlement builder moves both to the 0 to 6 ladder.

### The hero's numbers and the gear record

The fights system owns the hero's health and stamina (`HeroStats`). It works them out from three inputs:
the armour step in the gear record (`bench.gear().armor`), today's meal (`meal.day` equal to `clock.day`), and the
shrine picks (`shrine.<id>` set to `heart` or `stamina`). The stub has no rules yet.

The gear record is `Gear` in `src/game/content/gear.ts`: `{ weapon, tier, fitting, armor, kit: [3 slots] }`.
The bench writes it and the fights read it. The same file has the four bench steps (`GEAR_STEPS`), the six fittings
(`FITTINGS`) and the six kit things (`KIT`), from `farms.js`. Gear is a tier on a weapon, not an item for each step.
The record has no list of weapons owned yet; the bench builder adds one for the two weapons made from step 2.

## The clock

A day is 20 minutes, 1,200 seconds (`DAY_LENGTH` in `src/game/time/index.sim.ts`), as chapters 18 and 30 say:
60 s of dawn, 720 of light, 60 of dusk and 360 of night, the weather clock's own day at a scale of 1. A new game
starts at 0.27, 60 s after dawn. `slept` carries `skipped`, the seconds the night skipped, so a farm can run them
at once. Crops still grow a stage in 45 s and gain two stages a night; the farms builder sets their act 1 rates.

## The save

The save is version 2 (`SAVE_VERSION` in `src/game/kernel.sim.ts`), in the browser's save file and in the game's
own part of it. `readSave()` reads only version 2. A save from before act 1 is not continued: the title offers no
Continue, and the next new game clears it and shows "Your save is from before act 1, so a new game has begun."
The account reads the same version (`SAVE_VERSION` in `src/features/account/logic.ts`, held equal by a test), so
an old save in the cloud is not offered either. Convex stores the save as text with its day and size and never
reads the version, so `convex/` needed no change.

Every system still saves its own part. Whatever `load()` reads must be what `save()` wrote.

## The quests, and how the act plays now

`src/game/content/quests.ts` holds the 21 quests in chapter 27's order, each started by the one before. Every
step has a `kind` (film, talk, go, do, watch, fight, scene, choice, sleep), and a `scene`, a `fight` and an `at`
where chapter 27 gives them. Every step except the first night's is a stub:

- A scene step is done by `scene.<n>`, a fight step by `fight.<n>.won`, and a choice step by its `choice.<id>`
  flags. These are the shared flags, so the dialogue, fights and opening builders finish them by doing their own
  work.
- Fight 4, the boar out of reach, is done by `fight.4.denied`. The Stag's three phases are `fight.12.phase` at
  least 1, at least 2, then `fight.12.won`.
- Every other step (do, go, watch, talk) is done by its own `step.<quest>.<step>` flag. The quest builder replaces
  each with the real condition (`{ flag: 'farm.moss.living' }`, `{ flag: 'coin', atLeast: 150 }`), or the
  builder of that system sets the stub flag from its own code until then.
- The night quest is real: `src/game/hall` sets its flags as the player plays the first night.

`satisfy(condition)` in `quests.ts` gives the effects that make a condition hold. `skipTo` applies them for each
quest it passes over, plus the quest's gifts: the guild's axe and spade after grant day, the field book after the night, the
fox bonded after the grey wood, and a hoe, a can and twelve seeds after the quest of Hollowmere. The end of
`pilgrimage` sends `act.ended`.

The three vaults follow one another for now. Letting more than one quest be open at once is the quest builder's.

### The checks that play it

| Check | What it plays |
|---|---|
| `bun tools/sim.ts scenarios act1` | The 21 quests from a new game to `act.ended`, a step at a time, each by the flag it asks for |
| `bun tools/sim.ts scenarios first-night` | The night quest by the rules from `skipTo('night')`: a hut, the fox, the door, the Mark, the Custodian, the Heartstone, a sleep and Tamsin |
| `bun test src/game/play` | The same two, a save and load in the middle of every third quest, `skipTo` into five quests, the joins |
| `bun test src/game/quests` | The 21 quests' ids, kinds, scenes 1 to 38 and fights 1 to 12, `skipTo` for every quest, `atLeast`, the throw, and the engine on quests made for the test |

When you give a step its real condition, the act test still plays it if a flag can make it hold. If no flag can,
the test says "cannot be done by a flag": add a scenario of your own that plays that step, and have the act test
set your system's flag instead.

The scenarios that started at `roof` now start at `ground`, and the one at `leaftail` starts at `blessing`. The
bots start at a new game, `ground`, `night`, `kitchen` or `count`.

## What is left for the builders

The old story is still in the game where nothing blocked this commit. Each item below is listed in
`docs/act1-gaps.md` under "Old-story leftovers".

- **Dialogue.** The old conversations are still in `dialogue.ts`. Each condition that named an old quest now
  reads a flag nobody sets (`old.plot.active`, `old.bread.queen`), so they never play; the talk tests set those
  flags to test them. Tamsin's first meeting at the grant stone is fenced the same way. Rewrite or remove them,
  and the voice clips with them (`tools/voice.ts` drops the clip of a line that is gone).
- **Hints.** `hints.ts` points its first hints at the new quests; the lamp, axe and seed hints are old story.
- **The story director.** The festival, the floating river lamp and the two old never-stuck marks are gone.
  Act 1's never-stuck rules go in `src/game/story`.
- **People.** The old cast is gone (fix round 1); their places (the kennel, the bakery) stay. Tamsin
  now stays at the grant stone until the first night is over, then keeps the lodge.
- **The Heartstone's lines and gauge**, as above.
- **Recipes.** The old recipes and the old `sprinkler` (planks and moss fiber) stand. No part or kit thing has a
  recipe or a placeable yet. The turnip crop is gone; carrots stay, with `carrot_seeds` an item now.
- **Browser plays.** `tools/play-act1.mjs` and `tools/play-ui.mjs` (the `slow` part of `bun run verify`, which
  runs only with `--full`) still play the old quests and fail. The recording `festival.json` is now
  `skip-to-kitchen.json`, and `cancel-bag-drag.json` gets its axe through the door, since Tamsin no longer hands
  one over at a new game. `first-talk.json` still talks to Tamsin at the grant stone.
- **Docs.** `docs/play/act1.md`, `docs/story-build.md`, `src/game/quests/README.md` and the people, pets, talk
  and story READMEs describe the old story.
