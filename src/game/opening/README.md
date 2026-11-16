# opening

Act 1's opening as rules: grant day at Saltgate, from the film's end to the ferry, then the landing. It implements
`OpeningApi` as `game.systems.opening` (its section of `src/game/api.sim.ts`).

## Saltgate

The port where the hero grew up, 1,500 blocks south of Greenhollow at x 800, z 1600. Its layout is data in
`src/game/content/saltgate.ts`, from the approved sheets `assets-src/concept/rooms/guildHall.webp` and
`assets-src/concept/region-saltgate/plan.webp`: the guild hall (bunk room, Hobb's kitchen, the map hall, the yard),
Guild Street, the quay lane, the harbour quay and the ferry's pier.

`land.sim.ts` gives the terrain Saltgate's shape and blocks: `saltgateHeight` in `landHeight`, `inSaltgate` keeps
trees off it, and `stampSaltgate` lays its floors, walls and invisible fences in `generateChunk`. So the page, the
worker and the rules all make the same Saltgate, and none of it is in a save. The walls on a room's south and east
sides are two blocks high, the north and west four, since the camera looks down from the south-east.

This system wraps two of the region's answers once both are installed: `isProtected` is true in Saltgate, and
`place('saltgate.<name>')` answers Saltgate's spots (`PLACE_SPOTS` in `content/opening.ts`), which the story's scenes
and the quest waypoints name.

## Grant day

| Step | Done by | How |
|---|---|---|
| film | `story.opening` | `filmDone()`, from `views/story-opening.view.ts` |
| wake | `scene.1` | the story director plays it in the bunk room; the mirror (`setLook`) any time after |
| breakfast | `step.grantday.breakfast`, `meal.day` | E at Hobb's porridge |
| lock, map | `scene.2`, `scene.3` | the director, as the hero comes near |
| rack | `choice.weapon` | E at the rack, or the director in the yard |
| spar | `scene.4` | Dax's "Go on. Hit me" starts the bout; three swings that land (`swing()`) end it with `grantday.bout` |
| deed | `scene.5`, `hero.name` | the director plays the grant; the deed panel (`sign()`) opens as it ends |
| quay | `scene.6` | the director, on the quay |
| river | `step.grantday.river` | the view plays the river and calls `ferryDone()` at the landing; scene 7 follows |

The guild's people are actors this system places for each step. While the director stands someone in for a scene
(`stage:<who>`), this system's own stands aside. The clock holds Saltgate in the morning; the landing moves it to
the afternoon. `?opening=<step>` in the address starts a game at a step, every step before it done.

## Checks

`bun test src/game/opening`, `bun tools/sim.ts scenarios grant-day`, and `tools/play/scenarios/first-talk.json`
(Begin, the film skipped, Hobb's lines, the mirror) in `bun tools/play.mjs replay all`.
