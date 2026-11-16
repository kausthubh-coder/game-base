# settlement

The people who come to live on the player's land, what they need and wish for, the work they choose, the dinner
table, the settlement's steps from camp to freehold, and the Heartstone. It implements `SettlementApi` (the
"act 1: settlement" section of `src/game/api.sim.ts`). The design is handbook chapters 27, 28 and 30 and
`playthrough/farms.js` (`people`, `heart`, `heartNote`).

## Files

| File | What |
|---|---|
| `index.sim.ts` | The system. It looks at the land once a second and keeps everything below. |
| `ladder.sim.ts` | The Heartstone's ladder: what each of the six steps asks for, from a few facts. Pure. |
| `table.sim.ts` | The dinner table's layout from its footprint: three modules, benches, chairs, lantern poles and seven seats. Pure. The dinner view draws by it. |
| `settlement.test.ts` | The ladder alone, then each rule played through the real game. |
| `src/game/content/people.ts`, second half | The data: `SETTLERS`, `BUILDINGS`, `HEART_LADDER`, the numbers. |
| `src/game/views/ui-home.view.ts`, `ui-heart.view.ts`, `src/game/uiview/home-panel.ts` | The card, the dinner table's asks, the door tags, the banners, the gauge and its "next step". |
| `src/game/views/world-dinner.view.ts` | The long table on the green: the other modules, the benches, the chairs, the lanterns and the meal. |

## The rules

| What | How it is read |
|---|---|
| Who comes | Hobb and Dax at `scene.18`, Gus at `fight.5.won`, Wren at `fight.11.won`, Mina at `quest.roofs.started`. Tansy when three bee boxes (placeables of kind `bee_box`) and twenty flowers stand (the bee farm living, which counts open meadow in the boxes' reach, or twenty sunroot) and no farm has been on Take for three days. Holt when every home has a lamp and six lamps stand. Each sets `settler.<id>` and walks in from the grant stone. |
| Needs, for the story | `need.<id>.<bed\|meal\|lamp>` is true while that need is not met, so the walk-up lines say it (the card's Talk). |
| A bed under a roof | Households take a home each (Hobb and Dax share one; Mina prefers the map room), then anyone left takes a spare bed in a home, then a bed placed under a roof. |
| A meal | At evening the kitchen (a `kitchen`, or an `oven` with a `prep_table` within 5 blocks) feeds everyone the larder holds, if Hobb lives here. Fed yesterday or today counts. Hobb brings 12 meals; "E" at the kitchen stocks it from wheat, carrots, sunroot, berries, honey and bread. |
| A lamp | A `lantern` (or another lamp placeable) within 5 blocks of where they sleep, or a lamp block near it. |
| Glad | All three met and a job. Each morning a glad settler gives a heart, one more when Hobb keeps the kitchen. With `choice.gus` = `arm`, Gus walks to town by day and gives none. |
| Jobs | `lead(who, job)` walks them behind the hero; the job is theirs once both are by its room. Sets `job.<id>`, and `choice.hobb`, `choice.dax` or `choice.mina` the first time. Tansy and Holt start their one job. |
| Wishes | Read from the land: Hobb's kitchen by water, Dax's watch post near the grant stone, Gus's tilled soil one row in four bare, Wren's beast yard by water, Mina's map room facing south (its window north) with a table by it, Tansy seven days with nobody taking, Holt a lamp by the Hall's door. Ten hearts, `wish.<id>`. |
| Dinner | From the first evening of the echo quest with two settlers and a table (a `dinner_table`, or the kitchen), then every third evening. Two ask; the first dinner is Gus's and Hobb's (`choice.dinner`). `grant()` gives ten hearts, sets `dinner.<id>` and returns the other's one line. |
| The Heartstone | `ladder.sim.ts`. Living farms are `FarmsApi.all()` on Give, or the `farm.<id>.living` flags. A wheel, a terrace and goods that move fall back on their quests' flags until the machines say so. One step lower while `pump.running`. Written to the flag `heartstone`; the Custodian says each step's line once, after it is awake. |
| Steps | Homestead when Hobb lives here and a kitchen stands; hamlet with three households in lit homes; freehold at `scene.34`. Never back. |

It sets these quest flags as the land makes them true: `step.kitchen.kitchen`, `.beds`, `.meal`, `step.count.gus`,
`step.lights.holt`, `step.itself.tansy`, `step.roofs.houses`, `step.roofs.yard`.

## Where people stand

`spot(who)` gives each settler a place by the hour: their job's room by day (6 to 18), the table in the evening
(18 to 21), their door at night, and the table on a dinner evening, everyone, not only the two who ask. At a
`dinner_table` the place is their own seat (`spot.seat` is the way they face): the row that faces the camera first,
then the ends, then the door's row, whose middle stays free for the hero. The people system walks them there
(`src/game/people`) and sits them down facing the table (`anim: 'sit'`). The settlement's buildings with a door (oven, kitchen, dinner table, smokehouse, cottage,
map room) have their prompt there, from this system, so the words say what "E" does.

## Saved

The settlers (when they came, job, wish, hearts given, fed, asked), the larder, the travel meals, the last day,
supper and Take, the dinner days and tonight's dinner, and the Custodian's lines said. A walk to a room is not
saved: it starts again from the card.

## Not here yet

Night visitors (the fights' encounter system reads `job.dax` for the watch), the ring of land that coin buys, and
the tells from the road (smoke, the noon bell, the hat on the fence) as things drawn: the card says them in words.

The jobs others read: Tansy's hives give half again and Gus's field keeps the bees (`farms/sites.sim.ts`), Wren's
yard puts a second beast on the thistle strip, Holt lights the switchable lamps nothing switches at dusk and Dax on
the yard carries loose goods into a collector chest (`machines`), Mina's survey pins each farm on the map
(`ui-map.view.ts`). Still to come: Gus's seed shed replanting, Wren's wood, Mina's map room marking a ruin a day,
Gus's seed nobody sells, and Dax's two marked chests, since a plain chest holds nothing yet.
