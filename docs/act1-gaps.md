# Act 1: what exists and what is missing

The gap map that `docs/act1.md` asks for. For each of its nine systems it says what the handbook asks for, what
the code has now, what a builder has to make, and where the systems meet. The coordinator writes each builder's
brief from it.

Written 2026-11-12 from `act1` at 9161b86. `act1` has moved since (d2adf37 when this was written). The newer
commits merge the eight model groups as stand-ins and add concept sheets, and they change only `src/content/props.ts`,
`src/features/props/builders/` and `docs/act1.md`. Every `path:line` below is at 9161b86. A sample of the
claims was checked again by hand; the rest come from four readers who read the design and the code, one slice each.
A guess says it is a guess.

The handbook is `~/dev/sandbox/game-look-test/design/`. Chapter numbers below are its files: 20 version 1, 22
scenes and script, 23 fighting, 26 the map, 27 quest by quest, 28 the people, 29 the opening film, 30 farms,
machines and the bench. `content.js`, `farms.js` and `film.js` are in `game-look-test/playthrough/`.

## The state in one table

| System | What runs today | Biggest gap |
|---|---|---|
| The opening | An old five-shot camera flight and a four-button title | The painted-layers film is a demo page on `lab/opening`; Saltgate does not exist |
| Quests and scenes | A quest engine and talk with choices; 6 old quests, of which only `night` is act 1 | 20 of 21 quests, the staged and film scene kinds, choice memory |
| Dialogue | A styled box with a portrait medallion, 102 conversations, 109 voice clips | About 83 conversations and every clip are old story; no portraits or voices for the new cast |
| Fights in the world | The fight lab behind `?scene=fight` and `?scene=stag` | Nothing runs in the world; 7 of 12 fights have no rules |
| Farms and machines | Wheat, a can, a sprinkler with no power, two creatures, build mode | 10 of 11 farms, every machine part, power, the rate tag, the bench steps, the kit |
| People and the settlement | Routines, paths and friendship for the old cast; a Heartstone made of beds, crops and pets | Needs, wishes, jobs, the dinner table, arrivals, the 0 to 6 Heartstone, the settlement's steps |
| Ruins and vaults | Ilara's Hall and its first night; exterior models of every ruin as stand-ins | Shrines, memory stones, keystones, the vault interiors, the Rootworks |
| Goods and coin | Nothing: no coin, no selling, no ledger, no pump | All of it |
| The world | The plan as data and its lookups; the land itself on `world/land` and `world/biomes`, not merged | Merge those, then put story state on the land |

The baseline is green. `bun run check` passes at 9161b86 (975 tests in 76 files, and 14 Convex tests). The
whole-act test `src/game/play/act1.test.ts` still plays the old quests: plot, roof, night, leaftail, bread,
festival.

## Fix these first, before two builders start

The systems meet through `src/game/api.sim.ts` (the `GameEvents` map at `:63-117` and the `Systems` map at
`:165-185`), through flags, and through string ids that nothing checks: `ItemId`, `NpcId` and `QuestId` are all
plain `string` (`api.sim.ts:14-16`). Builders working at once will collide in `api.sim.ts`,
`src/game/content/items.ts`, `src/game/content/people.ts` and `src/game/content/dialogue.ts` unless the
coordinator lands these first, in one commit.

1. **The ids.** Quests: the 21 ids of `content.js` (`grantday, ground, night, blessing, kitchen, greywood, bench,
   copper, count, echo, pump, uphill, gallery, lights, seeds, itself, roofs, keystones, stag, green,
   pilgrimage`). Keep `night`, because the Hall keys on `quest.night.*` (`src/game/hall/index.sim.ts:94`). People:
   `hero, custodian, hobb, dax, mina, tamsin, wren, maren, gus, tansy, holt, elowen` (the Green Mother), `calla,
   aldric, ren, stag, ilara, auren`, as in `content.js`. The Guildmaster, "the girl", "the boy", "the old woman"
   and "A voice" in chapter 22 have no id yet. Places: the plan's ids in `src/game/content/greenhollow.ts:119-147`,
   with sub-spots as `<id>.<spot>` the way `hall.heart` is now. Items: one list of goods, parts, kit things and
   gear (a proposal is under Farms and machines).
2. **Flag names.** A suggestion, not agreed yet: `scene.<n>` when a scene has played; `choice.<id> = <value>` for
   the nine choices; `fight.<n>.won`, `fight.<n>.denied`; `settler.<id>`, `job.<id> = <job>`, `wish.<id>`,
   `settlement.step`, `heartstone`; `farm.<id>.built`, `farm.<id>.living`; `ledger.<section>.filled`, `pump.running`,
   `coin`; `memory.<id>`, `keystone.<n>`, `shrine.<id>`, `vault.<id>.cleared`. With flags, the quest builder never
   imports another system.
3. **Two condition fixes** in `src/game/quests/rules.sim.ts`. A `{ flag }` condition only tests equality
   (`rules.sim.ts:59`), so "coin at least 150" or "three sections filled" cannot be written; add `atLeast`. And
   `holds()` treats any condition shape it does not know as the old `short` wheat check (`rules.sim.ts:97-99`),
   so a new kind added without its own branch is wrong without an error. Make it throw.
4. **Events** in `GameEvents`. A proposal: `fight.started`, `fight.ended { fight, result }`, `fight.denied`;
   `settler.arrived`, `settlement.step`, `wish.granted`, `dinner.asked`; `farm.built`, `farm.mode`,
   `good.made { farm, item, count, at }`, `machine.state`; `goods.sold`, `coin.changed`, `ledger.filled`,
   `pump.set`; `scene.played`. Remove `festival.started` (`api.sim.ts:115`).
5. **`Systems` entries and their api types**, empty at first: `fights` (or `encounters`), `settlement`, `farms`,
   `machines`, `bench`, `goods`, `ruins`. A new `src/game/<name>/index.sim.ts` installs itself (`src/game/systems.ts:3-6`),
   but its place in `SYSTEM_ORDER` (`systems.ts:18-40`) matters: farms and machines after crops, placeables and
   creatures; settlement after them; quests and story last.
6. **The clock.** A day is 720 s (`src/game/time/index.sim.ts:22`); chapter 30 says 20 minutes, and its rates are
   written per day. The `slept` event carries only `{ day }` (`api.sim.ts:100`), so farms cannot catch up the
   skipped time. Decide the day length and add the skipped seconds to `slept`.
7. **Who owns the Heartstone.** Today `HallApi.heart()` (`api.sim.ts:701-713`) adds beds times 2, crops times 0.25
   and bonded pets times 5 (`HEART_WORTH`, `hall/index.sim.ts:46`; the sum at `:280-291`). Chapter 30 has a 0 to
   6 ladder of things alive at home. Proposal: the settlement builder owns the number and `heart()` keeps its
   signature and asks the settlement, so the gauge, the Hall's view and the Custodian's lines keep working.
8. **The hero's stats.** The game's `Player` (`api.sim.ts:39-46`) has no health or stamina; only the fight lab's
   `HERO` has health, fixed at 100 (`src/game/content/fight.ts:18`). Meals, shrines and armour all add "a heart".
   Proposal: the fights builder owns the hero's numbers and reads the inputs (armour tier, today's meal, shrine
   picks) from flags or the bench.
9. **The gear record.** One shape that the bench writes and fights read, for example
   `{ weapon, tier, fitting, armor, kit: [3 slots] }`, in a content file such as `src/game/content/gear.ts`. The
   weapon picked on grant day is written by the opening.
10. **The save.** `GameSave` is `version: 1` (`src/game/kernel.sim.ts:65`, `src/game/shell/save.ts:16`,
    `src/game/shell/game.ts:392`), and the cloud save in Convex holds the same shape. A save from the old story
    will load into the new quests. Decide whether act 1 bumps the version and starts old saves over.
11. **A name clash.** `src/game/hall` is Ilara's Hall (`createHall(game)`) and `src/game/fight/hall.sim.ts` is the
    Stag's hall (`createHall(fight, stage)`). Rename one before both run in the world.

`AGENTS.md` gives the coordinator `src/engine`, but not `src/game/api.sim.ts`. Since every builder needs to add to
it, the coordinator should own it for act 1 too, or give each builder its own section of the file.

## 1. The opening

**The design** (chapters 22, 27 quest 1, 29). A title with one button, Begin, because the browser holds sound back
until the first press, with the world loading behind the film (29:80). A 68 second film in 11 shots, told by Hobb;
any key shows "Hold to skip" (29:113). Kausthubh picked the painted-layers cut on 2026-11-12; Hobb's voice
(takes a, b or c) is still his pick. Then grant day in the guild hall at Saltgate, scenes 1 to 6: wake in the bunk
room and pick your look at the mirror; Hobb's breakfast (a meal gives an extra heart); Dax and the last lock; Mina
and the map wall; the rack (sword, bow or staff) and a spar with Dax where nobody gets hurt; sign the deed, and
"the name you write is the name the game calls you" (22:147); the quay. Then the day up the river as a watch
step, and scene 7 at the jetty. Saltgate is off the Greenhollow map (`content.js:298`).

**What exists.**

- The title is `src/game/ui/menus.ui.ts:22-60`: New game, Continue, Settings, Account, under the old name "A plot
  of your own" (`:32`). It is wired in `src/game/uiview/book.ts:97-106` and `src/game/views/ui-title.view.ts:26-56`.
- The opening in the game is the old camera flight over the real world: data in `src/game/content/opening.ts:37-95`
  with old lines ("Tamsin signs the grants. She is waiting for you at the stone.", `:92`), played by
  `src/game/views/story-opening.view.ts`, which waits for `npc:tamsin` (`:194`). Skip is a button and Esc. It
  plays once, by the flag `story.opening` (`src/game/uiview/opening.ts:8,132-150`, tested in `opening.test.ts:17-76`).
- A new game spawns at `region.spawn()` (`src/game/shell/game.ts:399-408`, `src/game/region/index.sim.ts:112`).
- The painted-layers film is on `lab/opening` (72 commits ahead of `act1`): `demos/opening/film.ts` (the 11 shots),
  `demos/opening/cutout/` (the renderer), `demos/opening/sound/` (a score made by code, recorded effects, and
  Hobb's takes a, b and c with `sound/voice/voice.json`). It is a 2D canvas page, not a game view. It loads 162 webp
  files, 10.5 MB, through `import.meta.glob` (`cutout/scene.ts:52-53`). `git merge-tree` merges the branch into
  `act1` cleanly, and it touches only `demos/opening/**` and `docs/opening-lab.md`.
- Nothing of Saltgate exists: no guild hall, no look picker, no name entry, no weapon item (`content/items.ts`
  has none), no ferry. A `jetty` prop exists, and `landing` is a plan place (`greenhollow.ts:125`) but not yet a
  region place (see The world).

**What is missing.**

1. A title with one Begin button. The design does not say where Continue, Settings and Account go. That is
   Kausthubh's call.
2. The film in the game: a story view that plays the cut-out renderer, `film.ts` and its sound, replacing
   `story-opening.view.ts` and `content/opening.ts`. It needs hold-to-skip, the world loading behind it, and a
   plan for 10.5 MB of art on a Chromebook (`docs/fast-everywhere.md`). The voice waits for his pick of Hobb's take.
3. Saltgate's guild hall as its own small set, apart from the Greenhollow map: the bunk room with the painted wall
   and the mirror, the lock, the map wall, the yard with the rack, the grant table, the quay. Its look waits on the
   `rooms` concept sheet (`docs/act1.md`, Concepts).
4. Grant day's actions: the look picker, breakfast, the key in the lock, the weapon choice (written to the gear
   record), the safe spar (a fight lab fight with no harm, which needs the fights builder), and the deed with name
   entry. The name goes in the save and into lines that use it.
5. The ferry and the river as a film, then the jetty, with the spawn moved to `landing`.

**Seams.** The weapon choice goes to fights and the bench. The spar is a fight. Saltgate's spawn and the jetty are
the world's. The scenes are dialogue's. The look picked at the mirror is the hero's sprite, which the sprite work
owns.

## 2. Quests and scenes

**The design** (chapter 27, `content.js:20-269`). 21 quests in five chapters. Each step has a kind: film, talk,
go, do, watch, fight, scene, choice, sleep (`content.js:5`). Counted in `content.js`: 39 do, 33 scene, 15 fight,
10 go, 9 choice, 6 watch, and one each of film, talk and sleep. The three vaults can be done in any order
(27:452). There are nine choices, and the notes say what each changes later (`content.js:28,68,81,116,143,156,166,215,228`):
the weapon; the pump, taken or left (it dims the Heartstone, and scene 17 branches); Hobb's room and Dax's job;
give or take with the burrowers; the dinner grant; show the stone to Calla or not (scene 25 branches); give or
take with the gearlings (the Custodian is silent that day); Gus's arm; Mina's room. The scene kinds (film, staged,
talk) are a proposal in `experiment:docs/cutscenes.md:32-36`, not yet his decision.

**What exists.**

- The quest engine, `src/game/quests/index.sim.ts`: steps, gates, marks, waypoints, saving by step id (`:296-313`).
  `tracked()` is the first active quest (`:233`). `skipTo` sends Tamsin to `grant.stone` or `lodge` by name
  (`:263-264`).
- Conditions and effects: `src/game/content/quests.ts:8-59`, judged in `src/game/quests/rules.sim.ts` (see the two
  fixes above).
- Talk: `src/game/talk/index.sim.ts` has choices with effects and `then` branches (`:162-168`) and `once` (`:136`).
  Effects run only when a conversation ends (`:118-139`).
- Six quests (`content/quests.ts:99-187`): `plot`, `roof`, `night`, `leaftail`, `bread`, `festival`. Only `night`
  is act 1; its title is "The Shut Door" and its steps (bed, door, mark, key, calm, heart, sleep, tamsin) follow
  quest 3. It waits for the roof quest (`quests.ts:131`).
- Scenes: ten scene conversations listed in `src/game/hall/index.sim.ts:38`, plus `tamsin.mark`
  (`content/dialogue.ts:133`). Seven have a counterpart in the 38 scenes: 8 `door.shut` (`dialogue.ts:909`), 10
  `night.door` (`:917`), 11 `hall.mark` (`:927`), 12 `custodian.wake` (`:982`), 13 `fox.calm` (`:970`), 14
  `heart.first` (`:995`), 15 `tamsin.mark` (`:133`). Only 11 and 12 match the script word for word.
- All scenes are talk in the box. Nothing frames the camera for a staged scene.
- The film director is on `experiment` (18 commits ahead): `src/game/content/cutscenes.ts`,
  `src/game/uiview/cutscene.ts`, `src/game/views/story-cutscene.view.ts`, `world-camp.view.ts`, `film-sound.ts`, and
  scene 9 as a film. A film starts on a flag plus being near a place, sets `cut.<id>`, and its `setup.quest`
  points at the old `night` quest. Merging it into 9161b86 gives two conflicts, both where each side added lines:
  `src/features/props/builders/index.ts` and `tools/sprites/story-config.mjs`. Against act1's newer tip there is a
  third, `src/content/props.ts`. In `story-config.mjs`, keep `experiment`'s 12-row `fox-blighted`.
- The story director `src/game/story/index.sim.ts` is all old story (see the leftovers).

**What is missing.**

1. The 21 quests as data, with a kind and a scene number on each step.
2. New condition kinds, or flags for them: the Heartstone at least n, a fight's result, a scene played, how many
   of a thing are placed, days passed (Tansy's "nothing on Take for three days"), a farm's rate, a ledger section
   filled, the settlement's step, an item made.
3. More than one quest open at once, with the player picking which is tracked (the vaults).
4. A runner for staged scenes (camera framing, people placed), and the film director merged from `experiment`.
   Which scenes are films is still open (`docs/cutscenes.md` on `experiment`).
5. Choice memory: one flag per choice, and the later effects each note names.
6. A new story director: the end of the act after scene 38, an end card ("End of act 1. The Mark."; today
   `menus.ui.ts:225-240` says "End of the first part"), the never-stuck rules for the new quests, new hints
   (`src/game/content/hints.ts:24-46`).
7. Skip effects in `skipTo` for every quest, so tests and the debug door can start anywhere.
8. Replacements for the tests and tools that play the old quests (see Tests and tools).

**Seams.** Every other system finishes quest steps, through flags or events. Fights need a way to be armed by a
quest step: an effect `{ fight: n }` in `Effect` (`quests.ts:46-59`) or an encounter that arms itself on a flag.
Arrivals of people and the settlement's steps come from quest steps. The conversation id scheme for scenes is shared
with dialogue: today `SCENE` (`dialogue.ts:59`) and the Hall's `SCENES` (`hall/index.sim.ts:38`) are held in step
by `src/game/hall/hall.test.ts:19`.

## 3. Dialogue

**The design** (chapter 22, rules at 22:27-39). At most a minute a scene and 18 words a line, the player never
speaks, nobody states the theme, each person has a voice. 125 spoken lines and 72 narrated lines across the 38
scenes (by the reader's count: the Custodian 28, the Green Mother 13, Dax 11, Maren 10, Hobb 10, Wren, Tamsin and
Mina 8 each, the Stag and Calla 6, Aldric and Auren 3, the rest one or two).

**What exists.**

- The box, `src/game/views/ui-talk.view.ts`, in the Gilded Hearth look with a round portrait. A missing portrait
  falls back to an initial (`:191-192`). Choices are wired (`:204,230`). A voice clip types the line in time.
- Speakers come from the people system or `SPEAKERS` (`dialogue.ts:42-45`, the old cast and the Custodian),
  resolved in `talk/index.sim.ts:89-97`.
- Portraits in the manifest: tamsin, maren, odo, gus, mira, wren, juniper, brack, hero. No Custodian and none of the
  new cast.
- Blip voices for the old cast only (`src/game/uiview/voices.ts:6-25`). A new speaker gets no blip
  (`ui-talk.view.ts:194-195`).
- 102 conversations in `dialogue.ts`. About 19 are the new story (the ten scenes, five Custodian talks, four
  morning-after lines); about 83 are old.
- Voice: `tools/voice.ts` reads `CAST` (`src/game/content/cast.ts:13`, `VoicedId` is tamsin, maren, gus, juniper)
  and `DIRECTION` (`cast.ts:74-84`, old lines). 109 lines are voiced (Tamsin 51, Maren 25, Gus 19, Juniper 14), all
  old story; 110 files are tracked in `public/assets/voice`. The tool drops the clip of a line that is gone and stops
  a run at 40,000 credits. There is no `ELEVENLABS_API_KEY` in this worktree's `.env.local` (the key name was
  checked, not its value). Chapter 20:81 says the voices wait until later.

**What is missing.**

1. The second pass of every line: the 38 scenes, plus first meetings, fallbacks and barks for every new person.
   `VILLAGER_LINES` (`dialogue.ts:1057-1070`) and `JOB_BARKS` (`content/people.ts:85-94`) are rewritten.
2. Ids for the unnamed speakers, and a scene kind on a conversation (shared with quests).
3. Portraits for the new cast, from the people sheets once he approves them (`docs/act1.md`, Concepts), then
   `verify-assets`.
4. A blip voice for each new speaker.
5. Voices: his picks for the cast, the key in `.env.local`, `tools/voice.ts --dry` to price it, then a run. A
   guess at the cost: about 125 scene lines of about 70 characters, roughly 4,000 to 5,000 credits, plus barks.
6. The tests that hold old words, rewritten (see Tests and tools).

**Seams.** Quests own when a conversation plays; dialogue owns what it says. The Custodian hands over the field
book in scene 14, not Tamsin (today `dialogue.ts:103-106` and `src/game/views/story-almanac.view.ts:1-5`). The
field book is the Almanac (`content/almanac.ts:44`, flag `has.almanac`).

## 4. Fights in the world

**The design** (chapter 23, 106-128; each quest in chapter 27; `content.js:314-327`).

| # | Fight | Place id | Foes, depth | Quest, step | What it teaches |
|---|---|---|---|---|---|
| 1 | A Blighted fox | `hall` | fox, 1 | 3, step 2 (scene 10) | Back to the door and lower your weapon; no blow is struck (22:192) |
| 2 | A Blighted thistlehog | `plot` | thistlehog, 1 | 5, step 8 (scene 19) | Break the guard, then calm; Dax holds the charge |
| 3 | Three Blighted foxes | `boar` | 3 foxes, 2 | 6, step 3 | A pack; Wren pins two |
| 4 | The boar | `boar` | boar, 5 | 6, step 4 (scene 21) | Out of reach: the hand is held out and nothing happens |
| 5 | A Blighted lynx | `arches` | lynx, 3 | 9, step 6 | Wait for the pounce; a quill strip where it lands |
| 6 | A gearling | `ruin-mill` | gearling, a machine | 11, step 1 | Shut down, not calmed; iron slides off, strike its back |
| 7 | The Sluice Keeper | `pumphouse` | a large gearling | 11, step 4 | Flood its channel and its wheels stall |
| 8 | A Blighted rootsnare | `caves` | rootsnare, 2 | 13, step 1 | It holds your companion; cut them free |
| 9 | The Lamplighter | `lampgallery` | a brass sentry | 13, step 3 | Break its line of sight with lamps |
| 10 | The Wild Harvester | `seedvault` | an arm and root pods | 15, step 4 | The companion holds the arm, you break the pods |
| 11 | The boar again | `boar` | boar, 5 | 17, step 4 (scene 31) | Everything at once, at Heartstone 5 |
| 12 | The Verdant Stag | under the terraces | the Stag | 19, steps 1 to 3 | Four pins, light the hall, climb and break the collar |

Chapter 30:292 adds night visits: about one night in three a Blighted beast tests your fence, never deeper than
your Heartstone and never while you are away.

The rules around them. A beast's depth is in its name, and the Mark calms it only at depth no higher than the
Heartstone (23:82-89); a deeper beast's guard can still be broken. The Heartstone never rises from fighting
(27:11, 30:339). Power also comes from the Mark's rank (only from freeing a god), pacts, four gear steps, a meal a
day, shrines, full field-book pages and settlers; there is no XP and nothing breaks (23:91-100). Gear: four steps,
each with two fittings (30:227-243), and brass is needed against iron. The kit is three slots of things used up
when they work (30:245-256). Four companions with four jobs, one at a time, each acting on its own: Dax guards,
Wren strikes, the fox heals ("gets you up once"), the Stag's young makes you stronger (23:33-35,
`content.js:340-345`).

**What exists.**

- The lab runs only behind `?scene=fight` or `?scene=stag` (`src/game/views/lab-fight.view.ts:76-80`). The
  `src/game/fight` folder has no `index.sim.ts` on purpose (`src/game/fight/README.md:5`); the reason given there,
  a world server, went with multiplayer.
- `createFight(stage, options)` is at `src/game/fight/fight.sim.ts:442`, its options at `:264-278`. The Mark's
  reach works: `reach` (default Infinity, `:445`) denies a beast deeper than it (`:901-905`, tested at
  `fight.test.ts:254-262`). The lab never passes `reach` (`lab-fight.view.ts:112-121`).
- A fight starts with `bring(kind, also?)` (`fight.sim.ts:1901-1914`), at most two beasts, and ends in `finish()`
  (`:1264-1279`) with `onEnd`. There is no losing: you wake at the stage's wake point with full health. Nothing
  ends a fight when you walk away.
- A `Stage` (`src/game/fight/arena.sim.ts:9-24`) answers solid, inside and water. Only `arenaStage` and `hallStage`
  exist. The bot reads `ARENA.radius` and `ARENA.trees` directly (`fight/bot.sim.ts:12,219,226,324`).
- The fight steps at 60 Hz from the hero's body (`src/game/fightview/keys.ts:94-139`, `HERO_STEP` in
  `src/features/hero/hero.sim.ts:44`), not in the 20 Hz kernel. It takes over the keys (`keys.ts:63,79-82`), draws
  its own hero (`fightview/draw.ts:113`), and saves under its own key (`src/game/shell/save.ts:7-11`).
- Beasts (`content/fight.ts:219-260`): the thistlehog (depth 1), the gearling (depth 2, `machine: true`) and the
  boar (depth 5). A gift is a display string, not an item (`:214`).
- Kit-like rigs (lamp, snare, plate, channel, `content/fight.ts:386-391`) work only in the traps way:
  `canPlace` returns "Rigs belong to the traps." otherwise (`fight.sim.ts:1577`).
- Boss hooks `addTarget`, `threaten` and `cancel` (`fight.sim.ts:339-401`, from `:1601`) are the pattern for the
  keepers. The Stag's hall is `src/game/fight/hall.sim.ts` and `hall-layout.sim.ts`, at milestone 3, with a redesign
  pending (`docs/fight-lab.md:306,403-414,428`).
- Calming is drawn in `src/game/fightview/calm.ts` (gift pictures for three kinds, `:51-56`). Depth shows on the
  lab card's bars only (`fightview/panel.ui.ts:611`). There are no fight rows in `src/content/quality.ts`.
- The plan already places all twelve: `FIGHTS` in `src/game/content/greenhollow.ts:149-163`. Nothing reads it.
  Some points differ from `content.js` (fight 2 is a map point, not `plot`; fight 3 is a point, not `boar`).
- Fight 1 is not a fight. It is the scripted first night in `src/game/hall/index.sim.ts` (the prompt "Hold out your
  hand", `:332-333`). `experiment` reworks it so the fox waits at the camp's edge.

| # | Today |
|---|---|
| 1 | Scripted in `src/game/hall`, not a fight |
| 2 | In the lab, full rules |
| 3 | No fox beast; `bring` takes two at most |
| 4 | `reach` works, but you must empty 2,100 guard first; the design wants a hand held out (guess: a short scripted denial) |
| 5 | Nothing |
| 6 | In the lab, without "iron slides off" or "strike its back" |
| 7 | Nothing; the channel rig and the water stall are the nearest pieces |
| 8 | Nothing; no rule lets a companion be held |
| 9 | Nothing; the lamp rig and the hall's lamp targets are the nearest pieces |
| 10 | Nothing; the hall's pods (`STAG.pod`, `content/fight.ts:438`) are the nearest piece |
| 11 | In the lab, full rules |
| 12 | In the lab as the milestone 3 hall, stamped at `grant.center` (`lab-fight.view.ts:92,225`) |

Companions in the lab are the leaftail, a pebblepup, a lanternfly and a mossling (`content/fight.ts:327-344`), with
the leaftail as the default (`fight.sim.ts:460`). Sprites for the thistlehog, gearling, boar, the Blighted fox
(idle and walk only), the hero's moves and weapons, Wren and the Custodian are in the manifest. The `stag`,
`stag-fight` and `stag-free` sheets exist and nothing uses them (`fightview/hall.ts:380` builds the Stag as a
mesh). There are no sprites for the lynx, the rootsnare, Dax, the keepers or the Stag's young.

**What is missing.**

1. An encounter system (for example `src/game/encounters/index.sim.ts`): one entry per fight with its place, foes,
   depth, the flag that arms it, the flags it sets, and the companion and gear it needs. It saves outcomes only. A
   guess at the split: the kernel side knows which fight is armed and done, and the 60 Hz fight runs in the view as
   in the lab.
2. A stage made from the world at a place and radius, with the radius moved from `ARENA` onto the stage so the bot
   works anywhere, and a rule that walking out of the circle leaves the fight.
3. A world fight view that reuses `fightview`, takes the keys only during a fight, hides the game hero and any
   companion's person, and replaces the lab card with a game HUD (health, stamina, the skill, beast bars with depth),
   made with `make-ui`. `lab-fight` keeps working behind its flag.
4. The Heartstone passed in as `reach`, with machines exempt, and a denial path for fight 4.
5. Gear in the fight: a tier per weapon, armour on beasts, the six fittings as small changes to moves, health from
   armour, meals and shrines. All read from the gear record.
6. The kit in an ordinary fight: lift the traps-only rule, and the six kit things.
7. New beasts: the fox (and a pack of three, so `bring` takes a list and the beasts take turns), the lynx, the
   rootsnare (with a held companion), the gearling's armour and back.
8. The three keepers as boss modules like `fight/hall.sim.ts`, each with a bot and a test.
9. The four act 1 companions, chosen from who you have (flags), with a way to pick one.
10. The Stag in the world, under the Rootworks, drawn from its sprite sheets.
11. Gifts as items and flags: `{ item, count }[]` and the flags a calm sets (the beast comes home, its page).
12. Night visits: one night in three, capped at the Heartstone, turned by lamps or Dax's watch.
13. Field-book pages for each beast; their facts are already in `BeastDef.rules`.

**Seams.** Quests arm and close fights by flag or event. The bench writes the gear record and the kit; calmed
beasts go home to the farms builder's beast farms, so the kind ids in `content/fight.ts` and `content/creatures.ts`
must match (the gearling is both a fight and a pit farm). The settlement gives the Heartstone number, and Dax and
Wren come from people. The keepers' rooms are the ruins builder's; the keeper fights are the fights builder's;
they agree a stage per room and an end flag per keystone. The world owns the twelve places and must leave about 15
blocks of open, fairly flat ground at each (the arena is 30 across, `arena.sim.ts:30`). Gift items come from the
shared item list (`content/drops.ts` is block breaking, not fight drops).

## 5. Farms and machines

**The design** (chapter 30, `farms.js`). Watch a creature until its page fills, build round its rule, read the
rate tag over the farm (its rate and one line saying what is wrong), move the goods, make better things at the
bench. A day is 20 minutes, and farms run the skipped time while you sleep. Give is the steady rate and counts as
living; Take gives two days at once, then the creatures stay away three days and the farm does not count.

| Farm | Kind | Quest | Rule | Gives |
|---|---|---|---|---|
| Wheat field, then the terrace | crop | 2, 9, 12, 16 | wet soil; a sprinkler wets 8, the shaft's cell grows nothing | wheat |
| Mossling pen | wild | 5 | damp mossy stone in shade; first good stone wins | moss fiber |
| Thistle run | beast | 7 | scratches on posts; a clapper makes it run | quills |
| Bait field | wild | 8 | burrowers come to the darkest carrots in reach, not under light | copper |
| Fox hedge | beast | 8 | fed, the fox brings seeds | carrot, then sunroot seed |
| Bee boxes | wild | 10 | flowers within 10, living land; wall-to-wall planting drives them off | honey, wax |
| Gearling pit | wild | 12 | gearlings walk at a running machine; stop in an unlit pit; fences turn them | gear springs |
| Lamp pond | wild | 12 | lanternflies to the brightest light; frogs eat them | frog slick |
| Lamp trap | wild | 14 | a lamp over a collector chest, away from water | glow dust |
| Rootsnare patch | beast | 14 | sleeps in sun under a roof with a hatch and lever | vine rope |
| Bramble's furrow | beast | 17 | tills where he walks; follows Wren | tilled ground, old brass, tusk tips |

The parts, in five families, each needing one farm good. Hands: ditch, axe, lamp, workbench. Water power (Pump
House, quest 11): waterwheel (4 power, 6 at a drop), gear shaft, lever, sprinkler (1 power). Moving: chute,
collector chest, pusher. Light (Lamp Gallery, quest 13): sensor, switchable lamp. Cutting (Seed Vault, quest 15):
harvester arm, saw arm. Too little power makes parts slower, never stopped; a lever or sensor switches its whole
shaft; every part shows working, starved or backed up. The concepts list adds the bee box, pit, clapper, hatch
roof, fence and posts. The bench has four steps (guild issue, copper-bound in quest 8, brass-fitted in quest 15,
tusk and root in quest 18), each from one farm good and one found thing, each with two fittings; from step 2 it
also makes the two weapons you did not pick. The kit has three slots: quill strip, lamp post, slick patch, clapper,
pusher plate, salve. `playthrough/tinker.js` (482 lines) has working toy rules for the pit, the bait field and the
terrace, with their symptom lines, which can serve as expected values in tests.

**What exists.**

- Crops (`src/game/crops/index.sim.ts`, data `content/crops.ts:9-14`): wheat, turnip and carrot, but only wheat has
  a seed item (`content/items.ts:18`). A stage is 45 s, against a day in the design. Soil gets wet from the can,
  rain or a sprinkler; no water block wets soil, so there is no ditch. Sleep adds two stages (`crops.ts:20`).
- Sprinklers (`src/game/sprinklers/index.sim.ts:1-47`): any placeable with `waters` wets the tilled cells round
  it every 20 s. No power, no shaft. Its recipe is planks and moss tufts (`content/recipes.ts:13`).
- Crafting (`src/game/crafting/index.sim.ts:6-49`): a plain recipe at a station within 5 blocks. No fittings, no
  unlocks, no steps. `crafting.test.ts:19-41` pins the exact recipe list. The Make panel is `makePanel` in
  `src/game/ui/bag.ui.ts:376`. A chest only says "The chest is empty." (`src/game/views/ui-panels.view.ts:79-85`).
- Placeables (`src/game/placeables/index.sim.ts`): workbench, bed, chest, fence, sprinkler
  (`content/placeables.ts:4-11`). A placed thing holds no state (`Placed`, `api.sim.ts:304-311`). Any placeable with
  a prop entry draws itself (`world-stations.view.ts`).
- Build mode (`src/game/build/`) has till, plant, water, block and place strokes (`StrokeKind`, `api.sim.ts:391`),
  and lays `joins` things in lines. It has no dig stroke for a ditch or a pit.
- Creatures (`src/game/creatures/engine.sim.ts`, data `content/creatures.ts:20-87`) run from data: conditions
  always, on, near, damp; appear near a block or place under a light range; move toward a block kind; give an item
  every N s, which reaches the bag only when you are near (`creatures/README.md:19`). Two kinds: the mossling
  (`creatures.ts:90-108`, moss tuft when damp) and the lanternfly (`:109-127`, gives nothing). Light levels 0 to 15
  exist (`src/features/world/light.sim.ts`) and creatures read them.
- The leaftail pet finds wheat seeds while you stand on grass (`pets/index.sim.ts:359-364`), the nearest thing to
  the fox hedge.
- The Almanac has pages for the mossling, leaftail, wheat, lanternfly and the old cast, and no best rate.
- No coin, no parts beyond the five placeables, no tiers on weapons (`content/fight.ts:115-131`).

**What is missing.**

1. Every good, part, kit thing and gear piece as an item. A proposal for the ids: goods `wheat, carrot_seeds,
   carrot, sunroot_seeds, sunroot, moss_fiber` (replacing `moss_tuft`), `quill, copper, gear_spring, frog_slick,
   honey, wax, glow_dust, vine_rope, old_brass, tusk_tip, shed_pelt, heartwood, meal, travel_meal`; parts `spade,
   waterwheel, gear_shaft, lever, sprinkler, chute, collector_chest, pusher, sensor, switch_lamp, harvester_arm,
   saw_arm, bee_box, post, clapper, hatch`; kit `quill_strip, lamp_post_kit, slick_patch, clapper_kit,
   pusher_plate, salve`. Gear as a tier on a weapon, not an item per step (a guess).
2. The day length and sleep catch-up (see "Fix these first").
3. The creature engine, still data-driven: fear of light, the brightest light in a radius, drawn to a running
   machine and turned by fences, stopping in an unlit pit with a limit, a predator eating within 3, visiting flowers,
   the first good spot wins (which makes rivals), Give or Take with the three-day absence, a fed pair bringing a
   third, goods dropped on the ground. New kinds: burrower, gearling, frog, bee; the lanternfly made to give.
4. Beast farms: a calmed beast comes home with one habit (the thistlehog's posts and clapper, the rootsnare's roof
   and hatch, Bramble's furrow, the fox hedge from the pet `finds` code).
5. A farms system (`src/game/farms/`): each farm's kind, mode, living or not, rate, best rate, symptom and fix.
6. The rate tag in the world, in the Gilded Hearth look (`make-ui`).
7. Water: a ditch that water fills and that wets the soil beside it; the waterwheel with power by the water's drop;
   gear shafts; the lever; the powered sprinkler.
8. Moving: the chute, a collector chest that takes in goods within 3 (chests that hold things), the pusher.
9. Light: the sensor, the switchable lamp, a switch over a whole shaft.
10. Cutting: the harvester arm that cuts and replants, the saw arm.
11. A machines system: shaft networks, shared power, each part's state shown on it.
12. Simple builds: bee box, pit, post, clapper, hatch roof, fence, rope ladder.
13. The bench as a system: steps, the choice of two fittings, the other weapons from step 2, writing the gear record.
14. The kit: three slots, made at the bench, carried into fights.
15. The field book recording facts as you watch and each farm's best rate.
16. Counts the Heartstone needs: living farms, a terrace that out-yields a pumped field, goods that move by themselves.

**Seams.** Quest steps in quests 5, 7, 8, 10, 12, 14, 15, 16 and 18 check this system; through flags they need no
import. `src/game/play/invariants.sim.ts:53-63` (`SOURCES`) says where every item a quest asks for can come from;
every new good must be listed there, or the "can still finish" invariant fails. Fights give the found things
(pelts, quills, springs, tusk) and read the gear record. People's jobs change farm rules (Gus rests rows, Wren lets
two beasts share, Holt lights lamps, Dax carries between chests, Mina's survey shows rates), the kitchen eats wheat,
honey and sunroot, and dinner asks and Tansy's arrival read each farm's mode. The world gives the plot its stream,
pond, strip and den. Goods read the rates.

## 6. People and the settlement

**The design** (chapters 27, 28, 30). Each person has three needs shown on their door (a bed under a roof, a meal
a day, a lamp) and works when all three are met. Each has one wish; granting it gives hearts, and hearts feed the
Heartstone. You pick a job by walking the person to a room:

| Person | Job A | Job B | Wish |
|---|---|---|---|
| Hobb | Kitchen: a meal a day for everyone | Smokehouse: travel meals | A river window |
| Dax | The watch | The yard: carries goods between two chests | A post that sees the gate |
| Gus | His own field: rested rows, a rare seed in two weeks | The seed shed: replants | One row in four rested |
| Wren | The beast yard | The wood: brings a creature with no page | Bramble's yard by water |
| Mina | The map room: marks one small ruin a day | The survey: the map shows each farm's best rate | North light, a bigger table |

Tansy (bees give half again) and Holt (plain lamps light at dusk) have no choice. An arm on Gus's field stops his
hearts. Tansy comes for three bee boxes, twenty flowers and no farm on Take for three days; Holt for a lamp on every
home and along your path. The dinner table: every third evening once a second person lives with you, two people
ask; you grant one for 10 hearts, and the other says one line, once; about six dinners in act 1 (asks in
`farms.js:213-216`). The Heartstone, 0 to 6 (chapter 30): 1 water in a field and a fire; 2 a kitchen, three beds and
a living farm; 3 three living farms and every need met; 4 a wheel turning and a terrace that out-yields a pumped
field; 5 three households, six living farms, goods that move by themselves and 60 hearts; 6 the Stag freed. A farm
on Take does not count, and the Order's pump reads one step lower while it runs, so 5 cannot be reached with it.
The steps of the settlement: camp (quests 1 to 4), homestead (5), hamlet (17: three households and a lit Gate),
freehold (20: the queen's charter). The plot starts at 48 blocks; coin buys a ring of 8 more for 150.

Who comes when: Hobb, Dax and Mina at Saltgate (quest 1); Hobb and Dax at your gate (5); the Custodian wakes in 3
and rides in your pack from 4; Tamsin the morning after (3, step 8), then the lodge; Aldric and the Green Mother
(4); Calla, your escort, from 4; Wren at the boar (6), moving in at 17; Maren at the granary (9), walking your rows
(12), with the charter (20); Gus under the lit arches (9), his own house at 17; Holt (14); Tansy (16); Mina from the
jetty (17); Ren only in quest 21.

**What exists.**

- The people system (`src/game/people/index.sim.ts`): routines by hour, wandering, `send`, `hold`, `befriend`
  (friendship 0 to 5), marks, nav paths, saves. `NpcState` (`api.sim.ts:609-622`) has only a place and friendship:
  no needs, wish, job or home. `send()` ignores a place the region does not have (`index.sim.ts:389`), so a person
  cannot be sent to a home the player built.
- The cast (`content/people.ts:49-71`): tamsin, maren, odo, gus, mira, wren, juniper, brack and ten villagers.
  Tamsin, Maren, Gus and Wren are in their old roles; none of the other new cast exist.
- The Heartstone is the hall's sum (see "Fix these first"). The Custodian speaks at 3, 6 and 10
  (`dialogue.ts:1044-1048`, `hall/index.sim.ts:297-311`), the gauge fills toward 3, 6 and 10
  (`src/game/views/ui-heart.view.ts:6,18`), and the Hall lights its court at 10 (`world-hall.view.ts:25`).
- No oven, dinner table, home, smokehouse, seed shed, map room or beast yard; the `stove` and `forge` props exist
  (`src/content/props.ts:144-145`).
- The grant is fixed at 28 by 28 (`content/region.ts:179`, `RegionApi.grant()`).

**What is missing.**

1. A settlement system (`src/game/settlement/index.sim.ts`): who lives here, their home, needs met, job, wish;
   the step; the hearts counter; the Heartstone 0 to 6 by chapter 30's table, with the pump's step down.
2. Arrival rules for Hobb and Dax, Gus, Mina, Wren, Tansy and Holt, each bringing a person from off the map or
   town to your plot.
3. Jobs set by walking a person to a room, as hooks other systems read; the Gus-or-the-arm rule.
4. The dinner table: the every-third-evening trigger, two asks as a talk choice, 10 hearts, the line said once.
5. Night visits (with fights).
6. The settlement's rooms and pieces: oven and table, a home (bed and roof), smokehouse, seed shed, map room, beast
   yard, dinner table, the Heartstone's court.
7. Each person's needs shown on their door, and the gauge redrawn as 0 to 6, "a brass ring of seven notches"
   (`content.js:574`).
8. The new people with routines at their new places: Aldric at the chapel, Calla following you, Wren at the boar,
   Gus at his field by the arches, Tamsin at the lodge, Maren at the granary, the townsfolk.
9. The plot growing from camp to freehold, and the 150-coin ring (with goods).

**Seams.** Fights read the Heartstone as `reach`. The settlement reads from farms: living farms, a wheel turning,
the terrace against a pumped field, goods that move, the pump on or off. The kitchen eats goods. Quests bring people
and steps. Dialogue needs every new speaker in `SPEAKERS` and, later, `cast.ts`.

## 7. Ruins and vaults

**The design** (chapters 23, 26, 27).

- Five small ruins (26, `content.js:307-311`), each one or two rooms with a guardian or a puzzle and a memory
  stone or old brass: `ruin-tower` (a room and a memory stone), `ruin-stair` (a stone, and Wren's way to the Seed
  Vault), `ruin-mill` (fight 6, old brass), `ruin-wall` (a mural with a figure cut out), `ruin-post` (a view of the
  Order's engine, Calla's seal on the door). Mina's map room marks one a day.
- Six shrines: `shrine-oak, shrine-bend, shrine-knoll, shrine-forest, shrine-marsh, shrine-terrace`. Restoring one
  gives a heart or stamina for good, your pick; the oak shrine is quest 10. Whether a shrine also raises the
  Heartstone is his open decision (chapter 23, decision 3).
- Memory stones: the dull stone under the Hall's mural (quest 10, scene 24), the Pump House (11, scene 26), the Lamp
  Gallery (13, scene 28), the Seed Vault (15, scene 29). Calla burns a stone you show her (scene 25). The Custodian
  marks the three vaults on your map in quest 10.
- The three vaults, in any order. The Pump House (south-east): the mill gearling first, across Lantern Marsh,
  half-flooded halls where each room is a machine you can read; the Sluice Keeper; keystone 1, water power, old
  brass. The Lamp Gallery (north-east): the rootsnare at the cave mouth, lamps switched by glass eyes; the
  Lamplighter; keystone 2, lamps and the sensor. The Seed Vault (west): Wren takes you down the forest stair, Calla's
  seal is on the door and Wren knows a way through the roots; the Wild Harvester; keystone 3, the harvester arm.
- The Rootworks (quest 18): the Old Gate with three sockets opens for you and shuts on Calla (scene 32); you climb
  down on your own vine rope through three levels, each with a waystone home and a dead machine to rebuild (a wheel,
  a lamp on a sensor, an arm). Then the Stag (quest 19). After it the grey wood turns green and the Hall's second
  level opens (quest 20).
- The first Gate wakes under the Hall in quest 17 (scene 30) and links it to Hollowmere. Ruins are lit, overgrown
  and open to the sky (`content.js:589`).

**What exists.**

- The plan as data: every vault, shrine and ruin id in `PLACES` (`greenhollow.ts:119-147`), the fights in `FIGHTS`
  (`:150-163`), the models in `LANDMARKS` (`:172-189`).
- Exterior models only, merged into `act1` after 9161b86 as stand-ins (`src/content/props.ts` at the tip):
  `pumpHouse`, `oldMill`, `galleryMouth`, `caveMouth`, `vaultRoots` (sealed and open), `oldGate` (sealed only),
  `shrine` (dormant and restored), `waystone` (sleeping and waking), `sunkTower`, `forestStair`, `muralWall`,
  `watchPost`, `standingStones`. `docs/act1.md` at the tip lists what they still need from the game ("Waiting to be
  wired in": the Pump House's wheel, the weir's water, the Hall door's parts, the Dawn's material, the forest
  stair's depth, the High Road stair's opening).
- Ilara's Hall works: the door, the Mark, the Custodian, the mural and the Gate's looks
  (`hall/index.sim.ts:316-353`; props in `src/features/props/builders/ruin.ts`). `muralSlab` has an "eight figures"
  variant (`props.ts:132`). There is no stone under the mural and no first Echo.
- The map can pin a `vault` or a `waystone` (`src/features/map/marks.sim.ts:40`), but pins show only for labelled
  region places within 30 blocks of you (`src/game/views/ui-map.view.ts:309-316`).
- Not in the code at all: shrines you can use, memory stones, keystones, Calla's seals, any vault interior, the
  Rootworks, waystone travel, the Gate waking, the Hall's second level.

**What is missing.**

1. A ruins system (`src/game/ruins/index.sim.ts`): state per ruin, shrine and vault (found, restored, cleared,
   sealed); prompts at the place ids; the heart-or-stamina pick; keystones and old brass.
2. Memory stones that start a scene (talk or film), set `memory.<id>`, and offer the show-Calla choice.
3. The vault interiors and the Rootworks. **A decision is needed first:** courts built in the world and open to the
   sky, as the Hall is (`RegionPlan.sealed`), or separate stages like the lab's arena. `docs/greenhollow-world.md`
   plans the outsides only. The `rooms` concept set covers the insides, and nobody owns building them yet.
4. The Rootworks' dead machines, rebuilt from the farms builder's parts.
5. Calla's seals: the watch post sealed from the start, the Seed Vault sealed before you, each ruin sealed behind
   you (the `vaultRoots` sealed and open states).
6. An open state for the Old Gate's model.
7. Map pins by story: three vaults in quest 10, one small ruin a day from Mina.
8. Waystones as travel, and the Hall's Gate to Hollowmere waking in quest 17.
9. After the Stag: the grey forest healed and the Hall's second level.

**Seams.** The keepers, the gearling, the rootsnare and the Stag are the fights builder's; the rooms are this
builder's. The Rootworks needs the farms builder's parts and the bench's gear steps as gates. Quests 10, 11, 13, 15,
18, 19 and 20 drive it through flags. The world gives the place ids. Dialogue writes scenes 24 to 29 and 32 to 33.

## 8. Goods and coin

**The design** (chapter 30, "Where the goods go"; chapter 27). The granary takes wheat, 40 a day at first and 20
more for each pump pulled, and it does take wheat from a pumped field. The market green takes honey, moss fiber and
quills, 10 of each a day, twice that on market day (every 7th day), with a rush order for twice your daily rate by
nightfall. Your kitchen takes wheat, honey and sunroot; your bench takes the found things. Coin buys a ring of 8
more blocks (150), a house's porch, garden and upper floor (150, 250, 500), furniture in three grades (better
grades give more hearts), and on the road an inn bed, a ferry or a guide.

The queen's ledger has four sections, filled in any order, and refuses wheat from a pumped field: the granary (40
wheat, 10 moss fiber; her seed store opens), the mill (120 wheat, 10 honey; "Bread takes one wheat, not two"), the
lamp house (20 glow dust; lamps on the road to town), the wheelwright's yard (20 gear springs, 10 copper; the town
builds its own wheels). The fourth pulls the last pump and the gold road above town goes dark. Then standing orders:
road lamps (one more a night toward the vaults), the town's next wheel (each takes one family's field out of the
grey, and the queen names the family), the Rootworks' parts, the road west (travel meals, a kit, rope).

The Order's pump triples a field with no parts and no upkeep. While it runs the Heartstone reads one step lower and
the grass round it greys; pull it out any time and the ground heals in three days.

By quest: 4 the pump, taken or left; 9 the queen's seed, the first sacks sold, the ledger shown and a section
picked (with a hoe, a can and a sack of seed); 12 a section filled and the pumps go quiet (scene 27); 14 the lamp
house; 16 the last section and the standing orders; 18 the Rootworks order; 21 the road west. The market green has
no quest step.

Chapter 30 gives no prices. The old `18-game-design.md:115-160` has some under old names (wheat 2 a sack, honey 8,
glow dust 6, moss fiber 3); using them is a guess.

**What exists.** None of it. A search of `src` for coin, sell, price, ledger, market and pump finds no game code.
There is a `coin` icon in the manifest. The granary is a model and a region place (`content/town/b.ts:75`, the town
in use per `region.ts:185`) with a map icon (`ui-map.view.ts:44`), and Maren stands there (`content/people.ts:54`).
Two stall models stand on the green (`town/b.ts:125-126`) with no place name. The only delivery in the game is the
old bread quest: a step counts wheat in the bag (`content/quests.ts:168-169`) and Maren's line takes 20
(`dialogue.ts:330-341`). `flags.add` exists (`api.sim.ts:137`), but the `{ flag }` condition cannot test "at least".

**What is missing.**

1. A goods system (`src/game/goods/`): a saved coin balance; buyers with a daily cap that resets on `day.started`
   and doubles on market day; `sell(buyer, item, count)`; the granary's cap rising with each pump pulled.
2. The ledger: four sections, progress per good, a reward per section, pumps pulled, the gold road going dark.
3. Clean wheat against pump wheat. **A decision is needed:** the item carries where it grew, or the pump's field
   gives a different item, or a rule counts it. The ledger and the Heartstone both depend on it.
4. The Order's pump: a placeable taken from its crate in quest 4 that triples its field, sets `pump.running`, greys
   the land round it, and heals in three days once pulled, with the Custodian's line.
5. Standing orders and their effects.
6. The market green, market day and rush orders, reading the farms' rates.
7. Coin sinks: land rings (`region.grant()` and the protected-land check must grow), house upgrades, furniture
   grades, the road's costs.
8. The panels: selling at the granary and the market, the ledger (after the `interface` sheet is approved), coin on
   the HUD, all with `make-ui`.
9. Meals. **Ownership needs deciding:** goods or the settlement. The mill section's "bread" assumes a bread recipe
   the kitchen does not have.

**Seams.** Goods come from farms; the rush order and "the terrace beats a pumped field" need rates on one scale.
The settlement reads the pump and the furniture's hearts, and the kitchen eats goods. The world draws the pumps in
Hollowmere's fields with their grey rings and takes them out as sections fill, turns off the gold road, adds road
lamps, and needs a `market` place by the stalls. Quests read `ledger.<section>.filled`, `pump.running` and `coin`.
Dialogue writes scenes 22 and 27 and the Custodian's pump line.

## 9. The world

**The design** (chapter 26, `docs/greenhollow-world.md`). The 800 by 600 map, every place walkable from your plot,
each kind of land readable in one screenshot, every landmark a painted model, inside the budgets (150 draw calls
and 400,000 triangles at high, 80 and 150,000 at low). The regions: the meadow (the middle and south), the Old
Forest (west), the grey forest (north of the High Road, widest in the east), the marsh (south-east), the cave hills
(north-east), the terraces (far north) and the town, with the Mere and its falls, the High Road (lit east of map x
590, the stretch from x 470 to 560 lit at the end of chapter 2), the Dawn on the northern horizon, and Saltgate off
the map to the south. The land changes with the story: the relit arches grey the land under them and go dark when
the ledger fills; Hollowmere has a brass pump in every field; the grey wood turns green after the Stag. The grey
forest has two looks, `?grey=a` and `b`, for him to pick.

**What exists on `act1`.** The plan and its lookups: `content/greenhollow.ts` and `src/game/region/greenhollow.sim.ts:46-118`
(`biomeAt`, `biomeMix`, `riverBank`, `highRoadDistance`, `highRoadLit(x, relit)`, `blightAt(x, z, relit)`,
`placeAt`), with `greenhollow.test.ts`. 47 landmark concept sheets and the paintings. At the tip, the eight model
groups as stand-ins; `docs/act1.md` calls them facetted and boxy, and the prop toolkit is being rebuilt. Nothing in
the running game reads the plan: `git grep greenhollow -- src` finds only the plan, its lookups and tests.

**On branches, not merged.**

- `world/land` (11 commits ahead of `act1` when checked): the terrain from the plan
  (`src/game/region/greenhollow-land.sim.ts`), `RIDGES`, `TERRACES`, `HALL_HILL`, more `LANDMARKS`,
  `src/game/views/world-landmarks.view.ts`, `?at=<place>`, every plan id made a region place (`planStands()` in
  `region/index.sim.ts`), the map inked by kind of land, and the tools `land-costs.mjs`, `land-relief.mjs` and
  `painted-shots.mjs --views greenhollow`. It moves several places. It also moves `hall` to map [403, 287], game
  (-17, -251), next to the real door (`region.ts:268-270` puts the door at z -253). On `act1` the plan's `hall` is
  map [404, 268], game z -270, 17 blocks north of the door; `world/land` fixes that.
- `world/biomes` (9 ahead): ground, grass, trees, air and light shafts by kind of land; the two grey looks;
  `tools/biome-shots.mjs`.
- `world/landmarks-b` (2 ahead): cave entrances, the chapel, ruins and shrines. It may overlap model groups 3, 5, 6
  and 7 (a guess).
- No branch has started the walk-and-measure test slice.

**What is missing.**

1. Merge `world/land` and `world/biomes`, then the "Waiting to be wired in" list in `docs/act1.md`.
2. Story state on the land: a flag (for example `road.relit`) that `blightAt` reads; the road going dark when the
   ledger fills; a healed input after the Stag, which `blightAt` has no parameter for; Order pumps that come out of
   the fields.
3. Hollowmere in the new story: the chapel (a plan landmark outside `REGION.town`), the granary, the market green,
   the quay. Decide what happens to the kennel, the bakery, Mira's workshop, the ferry house and the Warden statue.
4. The plot as the design has it: 48 blocks, the pond on a rise above a dry field, a stream with a drop for the
   wheel, room for the terrace. Today it is 28 by 28 (`region.ts:179`) with a 2 by 2 pool (`region.ts:200-214`).
5. The vault interiors and Saltgate, if the ruins and opening builders decide they live in the world.
6. Sound by place: `src/game/content/soundscape.ts` has zones for the town, square, bank and lane only.
7. The walk-and-measure test, and budgets measured at the ten fixed places.

**Seams.** The place ids are the main contract. The plan's ids and the old region names (`grant.*`, `shut.door`,
`hall.*`, `town.*`, `lodge`, `granary`, `gus.field`, `kennel`, `ferry`; `region.ts:342-353` and the town layouts)
both exist, and people, quests (`StepDef.place`), the map's `PIN_OF` (`ui-map.view.ts:37-48`) and the opening read
the old names. Proposal: the plan ids are the region names for act 1, and `world/land` keeps the old names until
nothing reads them. The world also owns the flat ground at the twelve fight places, the farm features on the plot,
and the pumped fields round Hollowmere.

## Old-story leftovers

Act 1 removes or renames all of these. Hollowmere and Queen Maren stay; the leaftail creature stays too, since in
the new story the Blighted fox calmed in the Hall is the companion (22:236), but its quest goes. The old roof
quest's word "roof" also names act 1 things (beds under a roof, the hatch roof); only the quest goes.

| What | Where |
|---|---|
| The old quests: plot, roof, leaftail, bread, festival, and their constants | `src/game/content/quests.ts:94-97,100-125,147-186`; `night` waits for `roof` at `:131` |
| Tamsin's old role (the grant stone, the book, the axe, the roof, the leaftail, bread, the festival) | `src/game/content/dialogue.ts:89-323`; `content/people.ts:53` (at `grant.stone` until `quest.plot.done`); `quests/index.sim.ts:263-264`; `content/opening.ts:5-8,92`; `story-almanac.view.ts:1-5` |
| The festival | `story/index.sim.ts:41-64,178-230` and `FESTIVAL_SPOTS`; `api.sim.ts:115` (`festival.started`); `dialogue.ts:62-69,119-129`; `people/index.sim.ts:307-313`; `world-lamps.view.ts:1-13,241-256`; `content/creatures.ts:117`; `items.ts:49` (`river_lamp`); `props.ts:117,120` (banners, bunting); `town/b.ts:4-10` |
| Juniper | `content/people.ts:59`; `dialogue.ts:759-843`; `cast.ts:13,60-64` (voiced); `cast-models.ts:51,89-90`; `uiview/voices.ts:11-22`; `src/content/dialogue-samples.ts` (a feature demo) |
| Brack | `content/people.ts:60`; `dialogue.ts:845-904`; `cast-models.ts`; the morning crowd at `hall/index.sim.ts:49-52` |
| Odo and Mira | `content/people.ts:55,57`; `dialogue.ts:543-677`; `items.ts:19` (Odo's bread); `town/b.ts:82` (the bakery), Mira's workshop in `town/b.ts` |
| Wren as the kennel keeper | `content/people.ts:58`; `dialogue.ts:679-757`; `content/almanac.ts:107-114` ("Keeper Wren"); `town/b.ts:79`, `town/now.ts:74-77` |
| Maren's bread and Gus's seeds | `dialogue.ts:325-541`, `GUS_GIFT` at `:71-82`; `play/invariants.sim.ts:58-61` |
| The leaftail quest and pet | `content/pets.ts:54-70`; `content/almanac.ts:70-83`; `dialogue.ts:176-197,1024-1028`; `story/index.sim.ts:267-286`; the lab companions at `content/fight.ts:327-344` |
| The old Heartstone | `hall/index.sim.ts:46,280-291` (`HEART_WORTH`, beast 5), Custodian at 3, 6, 10 (`dialogue.ts:1044-1048`); `ui-heart.view.ts:6,18`; `world-hall.view.ts:25`; "one roof" at `dialogue.ts:1000`; "lower the axe" at `hall/index.sim.ts:4-5` |
| The old recipes and items | `content/recipes.ts:1,7-13`; `items.ts:15` (`moss_tuft`), `:40` (moss light); `crops.ts:12` (turnip); `crafting/README.md:31`; `ui-panels.view.ts:79` |
| The old title, opening, hints and end | `menus.ui.ts:32,225-240`; `content/opening.ts:37-95`; `hints.ts:24-46`; `ui-show.view.ts:42,44`; `ui-playtest.view.ts:49` |
| The old lore in the town | `town/b.ts:53-54` (the Warden statue), `town/a.ts:4,50-52` and `town-kit.ts:20` (a Rootworks gate on the quay), `props.ts:124` and `builders/hollowmere.ts:224` (the Rootworks' brass roots) |
| The gearling at depth 2 giving gear springs | `content/fight.ts:233,242` (act 1: a machine at depth 0, giving old brass) |
| Stale docs | `docs/story-build.md:21,26,34-37`; `docs/play/act1.md`; `docs/backlog.md:14-15`; `docs/fight-lab.md:222-223`; `src/game/quests/README.md:3`; `src/game/region/README.md`; the people, pets, talk and story READMEs |

## Questions the design leaves open

These need Kausthubh or the coordinator before the builder who hits them can finish. The builder picks a default
and says so.

1. Hearts means two things: the settlement's counter (10 a dinner, 60 for level 5) and the hero's health (a meal or
   a shrine gives "a heart").
2. Whether calmed beasts count for the Heartstone. Chapter 23 says it rises with "every home, field, beast and
   settler"; chapter 30's table counts only farms and people; the code counts a bonded beast as 5.
3. Whether a shrine raises the Heartstone (chapter 23, decision 3).
4. The gearling's depth: 2 in the lab, 0 in `content.js:320`.
5. The salve and the rootsnare hurt or hold a companion, and the lab's rule is that nothing hurts a companion
   (`src/game/fight/README.md:61`).
6. The lamp needs wax, which comes from bees in quest 10, but lamps are there from day one and quest 8 needs them.
   The salve is learned "with bees" but needs frog slick from quest 12. The padded jacket is made in quest 7 but sits
   at bench step 2.
7. No recipe for the pit, posts, hatch roof, bee box, clapper or spade. The saw arm has no quest.
8. "A pump triples a field" has no measured base to compare the terrace with. No good has a price.
9. Four memory scenes for "three memories" of Ilara (chapter 28), and stones in the sunk tower and forest stair
   with no memory named.
10. Where the vault interiors, the Rootworks, the Stag's hall and Saltgate live: in the open world or as their own
    stages.
11. Who owns the Blighted fox of the first night: the Hall's script, `experiment`'s camp-edge fox, or the fights
    builder.
12. The title's other buttons, and which scenes are films.

## The order to build in

1. **The coordinator, before anyone.** The contract commit from "Fix these first". Merge `world/land`,
   `world/biomes`, `lab/opening` (clean) and `experiment` (two or three conflicts, all where both sides added lines).
   Pick the start quest that the eight scenarios starting at `roof` and the one starting at `leaftail` will use
   instead, so the checks that pass now keep passing.
2. **The first wave, at once.** The world (story state on the land, the plot's features, Hollowmere). Quests and
   scenes (the 21 quests as data with stub steps, the engine changes, the scene runner). Farms and machines (items,
   the clock, the creature engine, the machines system, the bench and the gear record). Fights in the world (the
   encounter system, the world stage and view, the fights that already have rules: 2, 6, 11, 12). People and the
   settlement (the settlement system and the Heartstone, the new cast as data). The opening (the title, the film as a
   game view, Saltgate on stand-in art).
3. **The second wave, once their inputs exist.** Ruins and vaults, after the world's place ids and the fights'
   keeper modules, and with the farms' parts for the Rootworks. Goods and coin, after the farms' rates and the
   pump's place. The fights that need new rules (3, 5, 7 to 10) and night visits.
4. **Dialogue last, in two parts.** The second pass of lines can start once the quests builder fixes the scene and
   conversation ids. Portraits wait for the approved people sheets, and voices wait for his picks.

## Risks

- **Regressions from the old quests.** Old quest ids are in many tests: `talk.test.ts:9,66-115`, `quests.test.ts:6-19,316`,
  `story.test.ts:80,332+`, `play/script.ts`, `play/act1.test.ts`, `play/bot.sim.ts:33-36`, nine scenarios and
  `scenarios.test.ts:81,131,135`, `tools/play-act1.mjs`, `tools/play-ui.mjs:364,800`,
  `tools/play/scenarios/festival.json` and `first-talk.json`. `bun run verify` runs `play-act1` (`verify.mjs:43`).
  Removing the old story breaks them; each one needs its act 1 replacement in the same change.
- **Hot files.** `api.sim.ts`, `content/items.ts`, `content/people.ts`, `content/dialogue.ts`,
  `content/quests.ts` and `systems.ts` are touched by nearly every builder. The contract commit and one owner per
  file prevent most conflicts.
- **The 60 Hz fight and the 20 Hz kernel.** The fight runs in the view off the hero's body. Saving in the middle of
  a fight, a quest step during a fight and the bot all need a clear rule for what the kernel knows.
- **Speed on a Chromebook.** The film's 10.5 MB of art, the land's triangles with every landmark, many machines
  and creatures ticking at once, the farms' catch-up after sleep. Each builder checks `window.__game.costs()` and
  `/?bench`, and a view reads its values from `src/content/quality.ts`.
- **Art gates.** Portraits, interface panels and rooms wait for his approval of the concept sheets. Builders use
  stand-ins and say which.
- **Old saves.** `GameSave` is still version 1, in local storage and in the cloud save.
- **`act1` keeps moving.** Builders cut from the tip of `act1`, not from 9161b86.

## Tests and tools each builder should use

Every builder: `bun run check`, `bun run lint`, `bun tools/typecheck.mjs <feature>`, `bun run boundaries` for the
`.sim.ts` rule, `bun tools/sim.ts scenarios` and `bot --seed <n> --steps <n>`, `bun tools/play.mjs` for playing it,
the `verify-game` skill before done, and `playtest-game` after anything a player sees.

| System | Tests and tools |
|---|---|
| The opening | `bun test src/game/uiview` (`opening.test.ts`); `?opening-at=`; on `lab/opening`: `bun tools/demo.mjs dev opening <port>`, `demos/opening/{cutout,page}/check.mjs`, `demos/opening/sound/check.ts`, `bun tools/typecheck.mjs opening`; `bun tools/load-measure.mjs` for the bytes |
| Quests and scenes | `bun test src/game/quests src/game/story src/game/hall src/game/play src/game/scenarios`; the debug door's `skipTo` and `talkThrough` (`src/game/shell/door.ts:242-255`); on `experiment`: `?scene=9&cut-at=`, `tools/film-check.mjs`, `tools/film-shots.mjs`, `tools/cut-player-test.mjs`, `uiview/cutscene.test.ts` |
| Dialogue | `bun test src/game/talk`, `tools/voice/lines.test.ts`; `?show=talk` and `?show=choice`; `tools/voice.ts --dry` and `--recheck`; `make-ui` for the box; `verify-assets` for portraits |
| Fights in the world | `bun test src/game/fight` (`fight.test.ts`, `hooks.test.ts`, `hall.test.ts`); `bun tools/fight-sim.ts` (`one`, `traps`, `stag --seeds 30`); `bun tools/fight-play.mjs`; `tools/fight-poses.mjs`, `tools/fight-strip.mjs`; `window.__fight`; `.agents/skills/verify-game/features/fight-lab.md`. Never write to `.artifacts/fight/ratings.jsonl` while a copy is out with him |
| Farms and machines | `bun test src/game/build src/game/crafting src/game/creatures src/game/crops`; the `verify-build-stroke` skill if `build/index.sim.ts`, the `letGo` and `use` presses in `shell/keys.ts` or the build view's calls change; `?scene=build` and `bun tools/play-build.mjs`; `tinker.js` for expected values; `bun tools/shots.mjs all --check` (the approved `farm` scene); `formal-game` for the bag, chutes and chests |
| People and the settlement | `bun test src/game/people src/game/hall src/game/play`; `src/game/story/fakes.ts` `stage()`; `tools/npc-lineup.mjs`, `tools/npc-proof.mjs` |
| Ruins and vaults | `bun test src/game/fight src/game/region`; `bun tools/props-preview.mjs` and the group previews on act1's tip, not at 9161b86 (`tools/preview-sacred.mjs`, `tools/models-4-preview.mjs`, `tools/models7-preview.mjs`); `bun tools/verify-assets.mjs`; the playthrough site's Map tab (port 5362) for the ids |
| Goods and coin | New scenarios per buyer cap, ledger section and the pump; `formal-game` for deliveries in any order, the pump on and off and a save in the middle |
| The world | `bun test src/game/region src/features/world`; on `world/land`: the walk tests in `greenhollow.test.ts`, `tools/land-costs.mjs`, `tools/land-relief.mjs`, `tools/painted-shots.mjs`; on `world/biomes`: `tools/biome-shots.mjs`; `bun tools/play-region-map.mjs`, `tools/map-shots.mjs`, `tools/sound-walk.mjs`; `/?bench`, `window.__game.costs()`, `bun tools/shots.mjs all --check` |

## What this map did not read or check

- Read in part: `fight.sim.ts` (its types, calming, finish and bring), `creatures/engine.sim.ts` after line 140,
  `crops/index.sim.ts` inside, `world-build.view.ts`, the cut-out renderer's internals, `experiment`'s
  `story-cutscene.view.ts`, the whole of `dialogue.ts`.
- Not read: handbook chapter 04d and the research notes; `docs/architecture.md` in full; the code on `world/biomes`
  and `world/landmarks-b` (only the files they change); the concept sheet pictures.
- Not run: any test beyond `bun run check` at 9161b86, any browser tool, any branch's own checks.
- Not checked: whether the land at each fight place is built and flat; whether the painted world's trees are solid
  blocks a world stage could read (a guess: logs are blocks).
