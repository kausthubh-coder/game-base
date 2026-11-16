# Act 1's look, beside its sheets

Every moment of act 1 a player sees, shot from the game's own camera beside the approved sheet it must match, and
graded as hard as Kausthubh grades it. He found three gaps by eye on 2026-11-12 that every check had passed (the
market's fountain off to the side, Gus standing in a box at dinner, Ilara's Hall a dark boxy yard with a grey egg):
this page and its tool are how a builder finds them first. `docs/act1-systems.md` item 3b makes it part of done.

## The tool

```sh
bun tools/look-beside.mjs all              # every moment: 4 to 10 minutes, by how busy the Mac is
bun tools/look-beside.mjs dinner market    # the ones you touched
bun tools/look-beside.mjs --list           # the ids
bun tools/look-beside.mjs all --site <built folder> --out .artifacts/look-base   # another branch's build
```

It builds the game once into `.artifacts/look/site`, serves it on `PLAY_PORT + 2`, and plays every moment in one
headless Chrome tab: a new game, `skipTo` the quest, the moment's setup, the hero stood, the time set, any film the
skip left playing ended, the camera turned. It writes `.artifacts/look/game/<id>.png` (the game's picture),
`.artifacts/look/<id>.png` (that picture beside the sheets) and `.artifacts/look/contact.jpg`. A moment it cannot
reach, or a console error, fails the run. The moments are data in `tools/look/moments.mjs`: id, quest, setup, where
the hero stands, time of day, camera and the sheets. Add one there when you build a place.

How to read a pair: open `<id>.png` and ask what a player would say looking at both. Name the gap in the words a
player would use ("the fountain is off to the side", "Gus stands in a box"), not "improve the market".

The 2.5D camera looks north-west from the south-east, so a moment stands the hero south-east of its subject.
`tools/look/moments.mjs` says this beside the offsets.

## The grades

Run over `act1` at `b0c1f91` (with `act1-camera`): 48 moments, ANGLE Metal on an Apple M4, 1280x720, all reached
with no console error. The whole run took 427 s through `tools/slot.mjs` on the shared Mac, about 9 s a moment in
one Chrome; on a quiet machine it took 225 s. This branch's own run took 536 s with its build. The contact sheet is
`docs/look/act1-contact.jpg`; the full-size pairs are in `.artifacts/look-act1/`.

Each moment has four grades from 1 to 5: **L** layout (is everything where the sheet puts it, and in the frame),
**M** materials and colour, **S** shapes (a model where the sheet has one, not a box), **Li** life (people, goods,
light, motion). 5 is the sheet; 3 is "a player can tell it is the same place"; 1 is "a different place". Owners
are the systems of `docs/act1-foundation.md`.

| Id | How it is reached | Sheets | L | M | S | Li | Where it falls short | The one change | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `sg-bunks` | `?opening=wake`, 0.30 | `rooms/guildHall`, `cine/p1-wall` | 3 | 3 | 2 | 2 | The bunks stand in a row under the painted mural, with coloured quilts, as the sheet has them. The walls are white plaster blocks at waist height with no ceiling, beams or mezzanine, and no lamp is lit. | Timber posts and ceiling beams, and one warm lamp over the bunks. | The opening |
| `sg-kitchen` | `?opening=breakfast`, 0.30 | `rooms/guildHall` | 3 | 2 | 2 | 2 | An oven, a table and two crates in a corner of half-height white walls on bare planks. The sheet's hearth, hanging pots, shelves and long table are missing. | A hearth wall with pots and shelves behind Hobb. | The opening |
| `sg-maps` | `?opening=map`, 0.35 | `rooms/guildHall`, `scenes/03-book` | 3 | 2 | 2 | 2 | The map wall is grey panels with small green squares; the sheet's wall is maps floor to rafters. Mina is a small figure at the ladder's foot, not up it. | Painted maps covering the wall to the rafters. | The opening |
| `sg-yard` | `?opening=deed`, 0.50 | `rooms/guildHall`, `scenes/02-grant` | 2 | 2 | 2 | 3 | An empty grey cobble court with wards standing in rows. The grant table and the weapon rack are out of the frame where the deed is signed. The Guildmaster's portrait is a letter "T". | Stand the grant table, its tray of deeds and the Guildmaster in the frame of the deed. | The opening |
| `sg-quay` | `?opening=quay`, 0.55 | `region-saltgate/vista-harbour`, `kit-port` | 1 | 2 | 2 | 1 | The quay moment starts the river film at once ("The Mere"): flat water with lily pads, a shrine and a stilt hut. Saltgate's quay itself, its ships, warehouses and ferry, is never on screen. | Ships and the ferry at the quay before the film cuts away. | The opening |
| `sg-street` | `?opening=deed`, 0.50, 8 east 12 south | `region-saltgate/vista-guild`, `kit-saltgate` | 2 | 3 | 2 | 1 | Half-timbered fronts and bunting over cobbles, close to the kit, but not a soul in the street, and the deed panel covers the middle of the picture. | Townsfolk and carts in Guild Street. | The opening |
| `landing` | quest `ground`, `landing`, 0.45 | `region-home/vista-arrival`, `4-water/jetty`, `scenes/01-ferry` | 2 | 3 | 2 | 1 | The jetty, the weir and the river are now in the frame; no ferry poling away, and the plot up the slope is out of the frame. | Turn the camera to the plot as the ferry leaves. | Quests and scenes |
| `plot-tired` | quest `ground`, `plot`, 0.40 | `region-home/vista-tired`, `plan` | 2 | 1 | 2 | 1 | The plot is lush green meadow with flowers. The sheet is straw-gold tired ground inside a broken fence, the green only where water reaches. With green everywhere the act's first lesson has nothing to change. | Tired straw ground on the plot and round it until water reaches it. | The world |
| `pond` | quest `ground`, `plot.pond`, 0.45 | `region-home/vista-tired`, `kit-meadow` | 2 | 2 | 2 | 2 | The pond is a pale flat disc under a tree with no stone rim; the dry field the ditch must reach is as green as the rest. | Dry ground between the pond and the field. | The world |
| `door-day` | quest `night`, `shut.door`, 0.45 | `3-sacred/hallDoor`, `cine/p9-doorstep-day`, `3-sacred/vista` | 2 | 2 | 2 | 1 | The round door stands free between brick pillars in front of an open yard, not in a hillside under roots; the Hall behind it is in plain view. | Set the door into the hill, with the hill's turf and roots over it. | The world |
| `camp-dusk` | quest `night`, `camp`, 0.77 | `settlement/camp`, `region-home/vista-night`, `scenes/04-fox` | 3 | 2 | 1 | 2 | The fire and tent stand where the sheet puts them and the dusk light is good. The tent is a flat translucent grey box with a dark frame (this is the "box" Gus stood in at dinner). The sheet has a patched canvas A-frame. | Model the tent as the sheet's A-frame. | People and the settlement |
| `door-night` | quest `night`, `shut.door`, 0.85 | `scenes/05-door`, `3-sacred/hallDoor` | 2 | 2 | 2 | 2 | The same freestanding door at night, with a teal crack of light; no hill, no lamps in the arch. | As `door-day`. | The world |
| `hall-heart` | quest `greywood`, `hall.heart`, 0.55 | `rooms/hallInside`, `settlement/heartstone`, `scenes/06-hall` | 2 | 3 | 3 | 3 | The Heartstone is now a pale crystal in a brass cradle with gold veins, and lanterns stand in the court: close to the sheet. The court is still an open cobbled yard ringed by grey brick stubs, not warm limestone arches. | Limestone arches in place of the brick stubs. | People and the settlement (the Hall's look) |
| `hall-custodian` | quest `greywood`, `hall.custodian`, 0.55 | `rooms/hallInside`, `people-old/custodian` | 2 | 3 | 2 | 2 | The court seen whole: pale wall slabs like gravestones behind the new crystal, the Custodian a small brown shape on its plinth. No arches, no book on the plinth. | Limestone arches round the court in place of the slabs. | The world, with the settlement |
| `hall-night` | quest `greywood`, `hall.heart`, 0.90 | `rooms/hallInside`, `cine/p3-hall` | 2 | 2 | 1 | 3 | At night the teal light pools on the floor, which reads as magic; the walls are still brick stubs, and no amber lamp burns. | Seven lamps on the walls, six lit. | People and the settlement |
| `hall-mural` | quest `echo`, `hall.mural`, 0.50 | `rooms/hallInside`, `6-ruins/muralWall` | 2 | 2 | 2 | 2 | The leaf over the shot is gone. The mural wall is plain grey slabs with no figures, and the dull stone is not marked out under it. | Paint the mural's seven figures and the cut-away eighth on its wall. | Quests and scenes, ruins |
| `blessing` | quest `blessing`, `grant.stone`, scene 16 | `scenes/08-blessing`, `people-world/elowen` | 3 | 2 | 2 | 3 | A crowd stands in two groups along a path by the grant stone, and the Mother is among them. Nobody kneels, there are no arches over the path, and the hero stands apart at the frame's corner. | The crowd kneeling along the path as she passes. | Quests and scenes |
| `hobb-dax` | quest `kitchen`, `grant.stone`, scene 18 | `scenes/09-kitchen`, `people-home/hobb` | 3 | 2 | 3 | 3 | Hobb and Dax at the stone, Dax with a crate taller than he is: the scene's words now show. The ground round them is the same lush meadow. | Nothing for this scene; the meadow is gap 1. | Quests and scenes |
| `homestead` | quest `greywood`, the homestead built, 0.42 | `settlement/stages`, `kitchen`, `homes` | 3 | 3 | 3 | 2 | The thatched cottage is close to the sheet and the first building that feels like home. The camp tent and fire still stand beside it, the dinner table is a lone square, and the ground is meadow, not fields. | Take the tent and fire away once the cottage stands. | People and the settlement |
| `dinner` | quest `echo`, the homestead built, Gus home, 0.74, "Sit down to dinner" | `settlement/dinner`, `scenes/29-dinner`, `interface/dinner` | 1 | 2 | 1 | 1 | A big cream panel over an empty meadow. One square table, nobody at it; Gus stands inside the camp tent because he has no bed yet, and only the two who ask come at all. | **Fixed on this branch**: see below. | People and the settlement |
| `hamlet` | quest `roofs`, the hamlet built, 0.45 | `settlement/stages`, `scenes/21-hamlet`, `workrooms` | 2 | 3 | 2 | 2 | The beast yard and the watch post stand; the camp tent is still in the middle; three wish toasts stack over the hotbar. | As `homestead`: the tent goes when homes stand. | People and the settlement |
| `oak-shrine` | quest `copper`, `shrine-oak`, 0.45 | `3-sacred/shrine`, `3-sacred/vista` | 1 | 2 | 1 | 1 | The cut-away thins the oak round the hero, but the shrine is still under leaves outside it. | Move the shrine out from under the oak, or widen the cut-away there. | The world |
| `dead-garden` | quest `copper`, `garden`, 0.45 | `region-home/kit-garden`, `6-ruins/deadCottage` | 2 | 1 | 1 | 1 | L-shaped walls of square logs on lush grass with berry bushes. The sheet is a roofless limestone cottage among dry beds, a well and grey grass. | Build the dead cottage from its sheet, on dry grey ground. | The world |
| `home-alive` | quest `pilgrimage`, the hamlet built, 0.45 | `region-home/vista-alive`, `settlement/stages` | 2 | 3 | 2 | 2 | As `hamlet`; the land round it no greener than on the first day, since it was never tired. | As `plot-tired`: the change needs the tired ground first. | The world |
| `greywood` | quest `greywood`, 14 west 22 south of `boar`, 0.30 | `region-forests/vista-grey`, `cine/p6-grey-wood`, `scenes/18-wren` | 2 | 3 | 2 | 1 | The hero stands on the High Road's deck: the boar's place is under the road, so a teleport lifts them onto it. Below, pale grey trees under the arches, the clearest world-telling in the act; no fox, no Wren. | Move the boar's place out from under the deck. | The world |
| `boar` | quest `greywood`, `boar`, 0.40 | `scenes/11-boar`, `creatures/boar` | 1 | 2 | 1 | 1 | All deck: the road hides the clearing and the boar under it. | As `greywood`. | The world, fights |
| `high-road` | quest `count`, by `arches`, 0.45 | `1-high-road/vista`, `region-north/vista-road` | 2 | 3 | 2 | 1 | One pier and an arch soffit beside a tree; the run of arches across the valley never fits the game camera. | A look-out view (a key that pulls the camera back and up) for vistas. | The world (camera) |
| `arches-lit` | quest `count`, by `arches`, 0.78 | `scenes/16-road`, `scenes/23-relit`, `region-north/vista-road` | 2 | 2 | 2 | 1 | At dusk the pier is in shadow and no gold light shows along the tops; the grass under the arches is green. | Light the arch tops so they glow and throw gold on the stone. | The world |
| `bridge` | quest `count`, `bridge`, 0.45 | `region-hollowmere/vista-wide` | 2 | 2 | 1 | 1 | A zigzag stair of plank blocks over flat blue water with white stripes; the sheet's stone bridge with lamps and banners, and the city beyond, are missing. | The stone bridge from the city kit. | The world |
| `town-gate` | quest `count`, `town.gate`, 0.45 | `region-hollowmere/vista-wide`, `kit-street` | 2 | 3 | 2 | 2 | One brick pillar with two lamps standing in a hedge beside a house. No wall, no gateway. | A stone gateway in a wall. | The world |
| `town-square` | quest `count`, `town.square`, 0.45 | `region-hollowmere/vista-street`, `plan` | 2 | 3 | 2 | 3 | Cobble paths cross a lawn with lamp posts, a cart and a dozen townsfolk. The Hollow Oak is a dark canopy at the frame's edge; no shop fronts face the square. | Shop fronts and stalls round the green. | The world |
| `market` | quest `count`, market day, `town.market`, 0.42 | `region-hollowmere/vista-marketday`, `kit-parts` | 2 | 2 | 2 | 1 | Market day: bare stall frames under striped awnings, nothing on the counters and nobody behind them. Half the court is a speckled dither where the cut-away fades the stalls. The fountain is not in the frame. | Sellers and goods at every stall, and twice the crowd on market day. | People and the settlement, goods |
| `granary` | quest `count`, by `town.granary`, 0.45 | `scenes/19-granary`, `people-world/maren` | 2 | 3 | 2 | 2 | The camera now cuts the canopy away: Maren and the granary's steps show, through a green dither and leaf edges. The sheet's open barn with sacks and light shafts is inside; nothing of it is seen. | Open the granary's doors on the scene, with sacks inside. | The world |
| `chapel` | quest `count`, by `town.chapel`, 0.45 | `5-order/chapel`, `5-order/vista` | 1 | 2 | 2 | 1 | A cobble plaza with a bench and a well; the chapel is a teal roof corner at the edge. No rise, no bell, no gold dome. | Set the chapel on a rise at the end of the plaza. | The world |
| `town-quay` | quest `count`, by `town.quay`, 0.50 | `region-hollowmere/kit-quay`, `scenes/25-quay` | 2 | 2 | 2 | 1 | A plank dock and two rowboats on flat water. No warehouses, crane, cargo, nets or people. | Cargo, a crane and people on the quay. | The world |
| `town-night` | quest `count`, `town.square`, 0.90 | `region-hollowmere/vista-night` | 2 | 2 | 2 | 2 | Lamp posts and a few townsfolk on a dull lawn; the lamps barely light the ground, no strings of lanterns, no lit windows. | Strings of lanterns over the square and lit windows. | The world |
| `mill` | quest `copper`, by `ruin-mill`, 0.45 | `4-water/oldMill` | 2 | 2 | 2 | 1 | A tall half-timbered town house and a wooden wheel on a cream base at the frame's edge. The ruined plaster-and-limestone mill is not there. | The ruined mill from its sheet. | The world |
| `pumphouse` | quest `pump`, by `pumphouse`, 0.45 | `4-water/pumpHouse`, `region-southeast/vista-pumphouse`, `scenes/12-pump-house` | 1 | 3 | 2 | 1 | The hero stands in the river; the house and its wheel are a corner at the top. No path or landing reaches its door. | A path and steps to the door from the bank. | Ruins and vaults, the world |
| `caves` | quest `gallery`, by `caves`, 0.45 | `region-southeast/vista-caves`, `7-ways-down/caveMouth` | 2 | 2 | 2 | 2 | A green hill and the rootsnare's fight; the cave mouth in lilac rock wrapped by an oak's roots is not in view. | The cave mouth from its sheet where the fight is. | The world |
| `gallery` | quest `gallery`, by `lampgallery`, 0.45 | `7-ways-down/galleryMouth`, `scenes/13-gallery` | 2 | 3 | 2 | 1 | Lilac rock, crystals and the gallery's arch at the frame's corner: the sheet's colours, but the arch is small and no lantern is lit. | The arch in full, its lanterns lit. | Ruins and vaults |
| `seedvault` | quest `seeds`, by `seedvault`, 0.45 | `region-forests/vista-seedvault`, `7-ways-down/vaultRoots` | 2 | 2 | 2 | 1 | The canopy is cut away and the ground shows: ferns, logs, dithered trunks. The vault's door under its roots is still not in the frame, only a limestone post at its edge. | Stand the door where the cut-away shows it. | The world (trees) |
| `old-forest` | quest `seeds`, `shrine-forest`, 0.45 | `region-forests/vista-oldforest`, `kit-trees` | 2 | 3 | 2 | 1 | The cut-away shows the floor between the giant trunks: ferns, stumps, roots. The trunks are faceted planks, and no light falls through. | Shafts of light through the canopy. | The world (trees) |
| `marsh` | quest `pump`, `shrine-marsh`, 0.50 | `region-southeast/vista-marsh-day`, `8-set-pieces/boardwalk` | 2 | 2 | 2 | 1 | Sandy islands, reeds, lily pads and grey faceted rocks. No boardwalk, no stilt hut, no lanterns. | The boardwalk and the stilt hut. | The world |
| `sunk-tower` | quest `copper`, by `ruin-tower`, 0.45 | `6-ruins/sunkTower` | 2 | 3 | 2 | 1 | Lawn with dark bushes; the tower is an arch at the frame's corner. | Frame and clear: the tower stands in open ground on its sheet. | The world |
| `terraces` | quest `keystones`, by `terraces`, 0.45 | `2-terraces/vista`, `oldGate`, `region-north/vista-terraces` | 2 | 2 | 2 | 1 | A grey-washed slope with low teal-capped walls; no great stair, no round gate, no colossus. | The Old Gate and the stair at the terraces' foot. | The world |
| `stag` | quest `stag`, by `terraces`, 0.45 | `rooms/stagHall`, `scenes/15-stag`, `people-old/stag` | 1 | 2 | 1 | 1 | Grey ground and a tree; no Stag, no chains, no hall. | The Stag in chains on the terraces. | Fights, ruins |
| `dawn` | quest `pilgrimage`, `terraces`, 0.30, turned | `region-north/vista-dawn`, `5-order/dawnDome` | 1 | 2 | 1 | 1 | The camera looks down at a grey slope; the horizon, where the Dawn stands, is never in the game camera. | A look-out view, as `high-road`. | The world (camera) |
| `second-blessing` | quest `pilgrimage`, `town.square`, 0.50 | `scenes/22-band`, `region-hollowmere/vista-street` | 2 | 2 | 2 | 1 | Lamp posts on cobbles; the whole valley on the green is not there. | The crowd on the green with flowers. | Quests and scenes |

## The ten worst gaps

Ranked by how much of the act a player sees them in, then by grade. The dinner was the worst of the three he named;
it is fixed below.

| # | Gap | Grade (L M S Li) | Owner |
|---|---|---|---|
| 1 | The plot and its valley are lush from the first day, so water changes nothing and "green overnight" has nothing to turn green (`plot-tired`, `pond`, `home-alive`). | 2 1 2 1 | The world |
| 2 | Hollowmere's market on market day is bare stall frames with nobody at them and nothing on them, half of it dithered away (`market`). | 2 2 2 1 | People and the settlement, goods |
| 3 | The boar's place is under the High Road's deck: the hero lands on the road and the clearing, the boar and Wren are hidden (`greywood`, `boar`). | 1 2 1 1 | The world |
| 4 | Chapter 3 and 4's landmarks are missing: no Stag in chains, no Old Gate or great stair at the terraces, no dead cottage (`stag`, `terraces`, `dead-garden`). | 1 2 1 1 | The world, fights, ruins |
| 5 | Ilara's Hall is an open yard of brick stubs behind a freestanding door, not a limestone court inside the hill (`door-day`, `hall-heart`, `hall-custodian`). | 2 2 2 1 | The world, with the settlement |
| 6 | The camp tent is a grey translucent box, and it stays in the middle of the homestead and the hamlet (`camp-dusk`, `homestead`, `hamlet`). | 3 2 1 2 | People and the settlement |
| 7 | Saltgate's quay is never seen: its moment cuts straight to the river film, and the street has nobody in it (`sg-quay`, `sg-street`). | 1 2 2 1 | The opening |
| 8 | The game camera cannot take in a vista: the High Road across the valley and the Dawn are never in the frame (`high-road`, `dawn`). | 1 2 1 1 | The world (camera) |
| 9 | The shrines and vault doors in woods stay hidden: the oak shrine under its oak, the Seed Vault's door out of the cut-away (`oak-shrine`, `seedvault`). | 1 2 1 1 | The world |
| 10 | The Pump House has no way to its door: the hero stands in the river beside it (`pumphouse`). | 1 3 2 1 | Ruins and vaults, the world |

## The dinner, fixed

Before (`docs/look/dinner-before.jpg`) and after (`docs/look/dinner-after.jpg`, and at phone size
`docs/look/dinner-after-phone.jpg`), each beside `assets-src/concept/settlement/dinner.webp`. After, graded the same
way: L 3, M 3, S 3, Li 3, against 1, 2, 1, 1 before. The table, the benches, the lantern poles and the meal are where
the sheet puts them and the three settlers sit at it; the hero stands; the light is the game's dusk, not the sheet's
gold.

**What the box was.** The camp tent (`homeTent`, drawn by `world-camp.view.ts`) is a translucent grey box with a
dark frame. On a dinner evening the settlement sent only the two who ask to the table's door; everyone else went to
their bed, and Gus, who has no bed yet, falls back to `camp.seat`, which is inside the tent.

**What changed.**

- The dinner table is 6 by 2 blocks, three 2 by 2 modules end to end, as the sheet lays it out
  (`src/game/content/people.ts`). `src/game/settlement/table.sim.ts` gives the layout: the modules, a bench along
  each long side, a chair at each end, the lantern poles at the corners of a 10 by 7 green, and seven seats.
- On a dinner evening every settler goes to the table, and in the table hours of any evening they take a seat
  rather than the door (`spot(who).seat`, `src/game/settlement/index.sim.ts`). The door side keeps its middle free
  for the hero; the row facing the camera fills first.
- A settler on their seat sits, facing the table (`src/game/people/index.sim.ts`, `anim: 'sit'`).
- `src/game/views/world-dinner.view.ts` draws the other two modules, the benches, the chairs, the lanterns and,
  from dinner time until bed, the meal down the middle.
- The asks are no longer a cream paper panel over the scene. They sit low on night glass in the dialogue box's
  look (gold names over a fine rule, gold-ringed portraits, outlined pills), side by side on a wide screen, so the
  table and the people at it stay in view (`ui-home.view.ts`, `home-panel.ts`). On a phone they stack on their own
  glass and cover most of the table: the screen is too narrow for both.
- `bun test src/game/settlement` checks that everyone sits at the table facing it, and fails without the sit rule.

**Stand-ins, listed.**

- **The sitting pose.** No sprite sheet has one, and none was asked for. A sitting person is drawn with their
  standing idle frame set 0.35 blocks lower (`SIT_DROP` in `src/game/shell/art.ts`), so the bench and the table hide
  the legs and the camera sees the body from the hips up. Someone on the near side of the table shows their back and
  full height above the bench; a real seated row of frames would read better.
- **`dinnerLanternPole`** and **`dinnerSpread`**: `act1-hall-models` landed both in `act1`, and the view draws them by
  name, so the after picture has the real poles and the real meal. Until a key exists the view stands in for it: two
  strings of lanterns along the long sides, and a cloth runner with bowls, bread and mugs built in the view.
- `homeDinnerTable`, `homeBench` and `homeChair` are used by their keys as they are; `act1-hall-models` is making them
  closer to the sheet.

**What is still short of the sheet.** The hero stands at the table rather than sitting with the others; the
light is the game's dusk, cooler than the sheet's golden evening; the camp tent still stands nearby (gap 6).

## Not covered yet

- Rooms the game has no inside for: the Pump House, the Lamp Gallery, the Seed Vault, the Rootworks and the Stag's
  hall (`rooms/*`). Add a moment for each when it is built.
- The fights as they play (chapter 23) and the farms working (chapter 30): `tools/fight-world.mjs` and
  `tools/farms-play.mjs` shoot those; their pictures belong beside `creatures/*` and `parts/*`.
- The film's painted plates (`story-opening`), which are pictures, not the game's camera.
