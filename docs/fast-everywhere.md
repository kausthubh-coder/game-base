# Fast everywhere

The goal: the game runs at a steady 60 frames a second and starts quickly on a cheap Chromebook, with no
hitches, and later with other players in the same world. Roblox already does this on weak devices, so this
plan copies its ideas where they fit a browser game.

## The target device

A low-end Chromebook: an Intel Celeron N4500 or MediaTek Kompanio 520, 4 GB of memory, a 1366 × 768 or
1920 × 1080 screen, Chrome with WebGL2. It is several times weaker than the "mid laptop" in `AGENTS.md`.

Nothing on hand can measure it. This Mac draws WebGL in software, and the Windows laptop is much faster.
**Buy or borrow one such Chromebook.** Every frame-rate claim in this plan waits for it.

## Budgets for the low tier

| | Low tier (Chromebook) | High tier (today's rule) |
|---|---|---|
| Frame rate | 60, never under 50 | 60 |
| Draw calls | 80 | 150 |
| Triangles on screen | 150,000 | 400,000 |
| Script per frame | 4 ms | 6 ms |
| Render size | 0.6 to 0.75 of the screen, scaled up | full |
| Download before the first frame | 3 MB | 3 MB |
| Time to the first playable frame on 10 Mbps | 5 s | 5 s |

## Where the game is today (2026-11-11)

- The build is 11 MB in all. The script is 1.3 MB, 404 KB gzipped. The rest is files: 4.2 MB of voice
  clips, 3.3 MB of models, 0.8 MB of sprites.
- `src/features/perf/governor.sim.ts` already lowers render size, then effects, when the frame rate drops,
  and raises them again when there is room.
- Props draw one instanced call per kind and keep their copies in 32 × 32 block cells.
- The world's meshing runs in a worker (`mesher.worker`).
- Game rules live in `.sim.ts` files that never touch the page, so a server can run them later.
- There is no network code yet.
- The painted look's trees use alpha-tested leaf cards drawn on both sides. Cheap GPUs pay for every
  layer of leaves they fill, so trees are the first suspect on a Chromebook.

## Act 1 inside the budgets (2026-11-12)

`bun tools/speed-costs.mjs` flies the bench and stands at the ten Greenhollow places, five views of Hollowmere
(one from the rise north of it) and Saltgate's yard at each level, and keeps a picture of each in
`.artifacts/speed/`. Every one of them is inside 80 draw calls and 150,000 triangles at low and 150 and 400,000
at high. The worst at low is the bridge into Hollowmere (67 calls, 149,000 triangles) and the city quay (76
calls); at high, the boar's clearing (380,000 triangles) and the view of the city across the Mere (116 calls).
What did it:

| Change | Quality row |
|---|---|
| The painted water is one mesh, one draw call, not one a chunk | |
| Tree variants with the same shape and leaves share a stand; a stand off screen is not drawn | |
| Trees stand leaf by leaf no farther than 40 blocks at low, then they are their pictures | `treeReach` |
| Boulders and bushes stop at a reach; a bush wears full leaves only near; a boulder's shadow only within 32 blocks | `scatterReach`, `fineBushReach` |
| The old town is four squares, whole near the hero and nearest first, far versions past that | `townTriangles`, `cityReach` |
| The far land is a point every 14 blocks at low | `farLandCell` |
| A little less grass and 36,000 tree triangles at low | `grassSpacing`, `treeTriangles` |

At high the pictures are the same as before. At low trees fade into their pictures nearer, and bushes past 64
blocks are gone.

A building past the distance it is drawn whole is its far version (`src/features/painted/far-buildings.ts`), at
every level: a few dozen triangles in the shape of its roofs and walls, wearing pictures of the real model taken
from above and from each side when the game starts. So the town keeps its roof lines, timber, plaster and
windows at any distance, where it was a plaster box under a teal lid. All of the city's far buildings are one
draw call, the old town's another. They do not light their windows at night.

## What Roblox does, and our version

| Roblox | What it does | Our version | Status |
|---|---|---|---|
| Assets by id on its CDN | Each mesh, image and sound has an id. The client downloads it the first time it is needed and keeps it in its cache. | Every asset file gets a content hash in its name and a long cache life. A service worker keeps a copy, so a second visit downloads nothing. The built page preloads what the first frame needs, and PNGs ship as lossless WebP. | Done |
| Instance streaming | The server sends only the part of the world near the player. A minimum radius always stays loaded. A target radius loads when there is room. Far parts are dropped when memory runs low. | The world is cut into regions. The game downloads and builds the regions near the hero, and drops far ones. Props already sit in 32-block cells. | Partly |
| SLIM and mesh LOD | At publish, Roblox's servers make several detail levels of each model and strip hidden faces. The client picks one by distance and by device. | The bake step makes a far version of every asset. The low tier uses far versions sooner. Far trees and NPCs become flat cards. | Missing |
| Automatic graphics quality | The client lowers quality on weak devices by itself. | `governor.sim.ts`. It needs a low tier that changes the look on purpose: no leaf cards, blob shadows, no post effects. | Partly |

Sources: [instance streaming](https://create.roblox.com/docs/workspace/streaming),
[SLIM](https://create.roblox.com/docs/workspace/streaming/slim),
[mesh LOD](https://devforum.roblox.com/t/levels-of-detail-for-mesh-parts/280769),
[ContentProvider](https://create.roblox.com/docs/reference/engine/classes/ContentProvider),
[server authority](https://create.roblox.com/docs/projects/server-authority),
[network ownership](https://create.roblox.com/docs/physics/network-ownership).

## How the game should load

1. The page downloads the script (404 KB gzipped today) and the hero's region.
2. The first frame shows the hero's region at low detail.
3. The game fetches the nearby regions' baked packs (see the bake step in `docs/architecture.md`).
4. Far regions fill in as cards and far versions.
5. Voice clips and music download when they are first needed, never before the first frame.

Baked packs do the cleaning, the shade and the far versions once, on our machines, so a slow Chromebook only
downloads and draws.

## Order of work

1. **Measure.** Get the Chromebook. Add a `?bench` route that flies a fixed path through the town and the
   meadow and logs frame times, draw calls and triangles. Record today's numbers at low, medium and high.
2. **Low tier.** Make the low quality level hit the low-tier budgets on the Chromebook: render size, solid
   tree crowns, blob shadows, no post effects.
3. **Load fast.** Hash file names, add the service worker, load voice and music late, and split the script so
   the first frame needs only the hero's region.
4. **Asset system.** The code-first builder, bake step and far versions (see the asset route test on
   `test/asset-routes`).
5. **Regions.** Stream the world by region, with a minimum and a target radius, and drop far regions under
   memory pressure.

Steps 1 and 2 come first because every later step is judged by the Chromebook's numbers.
