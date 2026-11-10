# Map

What the player has seen, pins, rumors and waypoints, drawn three ways: a round minimap that turns with the camera, a full map on parchment, and a beam in the world for the waypoint the player follows.

## Wiring

```ts
import { createMap } from './features/map/index.ts';

const map = createMap(ctx, { colorAt: (x, z) => world.topColor(x, z) });   // 0xRRGGBB for a column
hud.minimapSlot.append(map.minimap);                 // or put map.minimap anywhere
map.setMarkers(markers);                             // friends, a pet, people with a quest

// every frame, after the camera has moved
map.setPlayer(hero.position.x, hero.position.z, hero.body.facing);
map.update(dt, ctx);                                 // reads the camera's turn from ctx.camera
if (input.intents.map) map.toggle();

// when blocks change
map.invalidate(x, z, width, depth);
```

The map reads `ctx.camera.matrixWorld`. If the camera moved this frame, call `ctx.camera.updateMatrixWorld()` before `map.update`, or the minimap turns one frame late.

## Exports

| Export | What it is |
|---|---|
| `createMap(ctx, options)` | Builds all of it. Returns a `MapView`. |
| `MapView.minimap` | The minimap's element. It fills the width it is given, up to 168 pixels. A click on it opens the full map. |
| `MapView.setPlayer(x, z, facing)` | Where the player is. Facing 0 is north and grows clockwise. |
| `MapView.setMarkers(list)` | A list of `MapMarker` the map reads every frame. Change the items in place. |
| `MapView.invalidate(x, z, width, depth)` | Redraws that patch of the minimap and the full map. |
| `MapView.open()`, `close()`, `toggle()`, `isOpen` | The full map |
| `MapView.dropWaypoint(x?, z?, options?)` | Drops a waypoint, where the player stands by default. Null when the player has 20. |
| `MapView.rules` | A `MapRules`: `rules.marks` (waypoints, pins, rumors, crew, pings) and `rules.seen` |
| `MapView.save()`, `load(save)` | The whole map as plain JSON |
| `MapView.stats` | The minimap's draw time: `frames`, `drawn`, `totalMs`, `maxMs`, `lastMs`, `reset()` |
| `MapView.yaw` | The camera yaw the minimap last drew with |
| `MapRules`, `Marks`, `SeenCells` | The rules, with no page in them. A server can run them. |
| `Waypoint`, `Pin`, `Rumor`, `CrewWaypoint`, `Ping`, `MapMarker`, `MapSave` | The data |
| `WAYPOINT_LIMIT`, `WAYPOINT_ICONS`, `WAYPOINT_COLORS`, `PIN_KINDS` | 20, eight icons, six colors, six kinds of pin |
| `distanceTo`, `bearingTo`, `compassName`, `screenAngle`, `cameraYawOf` | Distance and direction |

Options: `colorAt` (required), `parent`, `rules`, `minimapBlocks` (120), `edgeArrows` (`'all'` or `'active'`), `revealRadius` (56), `worldSize` (4096), `beam` (true), `storage` and `storageKey` (`localStorage` under `game-base.map`), `bus`, `onToggle`.

## Marks

```ts
const marks = map.rules.marks;
marks.setPin({ id: 'bakery', kind: 'shop', x: 263, z: 252, label: "Odo's bakery" });
marks.setRumor('leaftail', spotX, spotZ, 36, 'Something green');   // keeps a circle, never the spot
const w = marks.addWaypoint(x, z, { icon: 'star', color: 'tide', shared: true });   // null at 20
marks.setActive(w.id);                                 // one at a time. It gets the beam.
marks.setCrew('Ana', waypointsAnaShares);              // replaces what Ana shared before
marks.ping(x, z, 'Ana');                               // shows for 10 seconds
map.rules.headingFrom(playerX, playerZ, out);          // out.distance in blocks, out.bearing
```

## How it draws

- **Minimap.** The land's colors live in a 192 by 192 picture, one pixel a block. A frame draws that picture once, turned, then a few marks from a sheet drawn once. New land is painted a strip at a time as the player walks, 1024 pixels a frame at most (`fillBudget`). `colorAt` is called for those strips only. A frame where nothing moved draws nothing.
- **Full map.** A seen cell is 8 by 8 blocks. Seen land is painted into 128 by 128 tiles soon after the player first sees it: 12 cells a frame while the game is played, 256 while the map is open. Unseen land is blank parchment. A fully explored world of 4096 blocks would hold about 64 MB of tiles, and nothing frees them yet.
- **Beam.** One mesh and one draw call: a glow, a bright core and a glow on the ground. It stands on `ctx.world.heightAt`. The distance chip and the edge arrow are one HTML element.

## Land that has not loaded

`colorAt` may return a negative number for a column it cannot answer yet. The minimap draws that land as blank parchment and asks again every third of a second. The full map leaves the cell unpainted and asks again every 60 frames. So the game does not have to call `invalidate` when a chunk loads, only when blocks change.

The full map paints a cell once and keeps the picture, so land the world has let go of still shows for the rest of the visit. After a reload the tiles are gone. Seen land far from the player then stays blank until `colorAt` can answer for it. If the world can give the color of a column that is not loaded, from its terrain function for example, the whole map comes back at once.

## Notes

- The map saves itself half a second after a waypoint changes, every 15 seconds while walking fills it in, and when the page closes. Pass `storage: null` to save it yourself.
- The full map handles Esc, the arrow keys, `+` and `-` while it is open. It does not listen for M. The game toggles it, so one key cannot both close and reopen it.
- Set the input mode to `'menu'` while `map.isOpen`.
- First frame, or after a teleport of 192 blocks or more: the minimap paints its whole picture at once, about 37,000 calls to `colorAt`.
- Tests: `bun test src/features/map`. Screenshots and page checks: `bun tools/map-shots.mjs`. Timing: `bun tools/map-measure.mjs`.
