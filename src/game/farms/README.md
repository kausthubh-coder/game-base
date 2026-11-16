# Farms, machines and the bench

Handbook chapter 30 and `playthrough/farms.js`, built. Three systems, one builder's files.

| Folder | System | What it does |
|---|---|---|
| `src/game/machines` | `machines` | Parts on the block grid (`parts.sim.ts` says what each does on a shaft). Shafts join touching parts; wheels make power (4 on flat water, 6 where it drops); short of power runs slower, never stopped; a lever or a sensor switches its shaft; each part is working, starved, backed up or off. The spade digs holes, which fill from water beside them as ditches. Loose goods on the ground, collector chests, chutes, pushers, harvester and saw arms. |
| `src/game/farms` | `farms` | Reads each farm off the ground (`sites.sim.ts`), scores it by its rule (`rules.sim.ts`, the Build tab's three farms word for word, tested against `tinker-expect.json`), plays its creatures as actors, drops its goods at its rate, Give or Take, the field book's facts, and the quest steps a farm finishes. |
| `src/game/bench` | `bench` | The four steps with two fittings each, the other weapons from step 2, armour, the kit's three slots. Writes the gear record the fights read. |

The words and numbers are content: `src/game/content/farms.ts` (each farm's name and lines), `gear.ts` (steps, fittings, costs, icons), `recipes.ts` (parts, kit, meals, and which vault teaches each family), `placeables.ts` (each part's model), `crops.ts` (the act 1 clock).

The views: `src/game/views/world-machines.view.ts` draws the parts from the `part*` models in the variant of their state with their moving piece, holes and ditches, and loose goods as icons. `src/game/views/ui-farms.view.ts` is the rate tag, the farm panel (E at a farm), a collector chest, the Workbench (the gold pill on the Make panel) and the Road kit (K).

## Checks

- `bun test src/game/farms src/game/machines src/game/bench`
- `bun tools/sim.ts scenarios three-farms`: the gearling pit, the terrace and the bait field built by clicks east of the pond.
- `PLAY_PORT=<port> bun tools/farms-play.mjs` after `bun tools/play.mjs start`: the same in Chrome, with pictures in `.artifacts/farms/`.

## Where a farm stands

A gearling pit is the frame of eight by six blocks out from a turning wheel, on the side with a pit dug in it. A bait field is the patch of carrots nearest the hero, two blocks round. The wheat field is every wheat crop, with the sprinklers on its own shafts. A mossling pen is good stone (damp, shaded) by a fence. A thistle run is two or more posts near each other, once fight 2 is won; Bramble's gatepost is a post on its own, once fight 11 is won. A lamp at the water's edge is a lamp pond; a lamp over a collector chest away from water is a lamp trap. A bee box is the bee farm, a hatch the rootsnare's once fight 8 is won, and three berry bushes the fox's hedge.
