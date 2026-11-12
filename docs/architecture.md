# Architecture: fast and good-looking, for one player

Status: a proposal, written 2026-11-11, and cut to one player the same day: multiplayer and the world server
were removed. It extends chapter 15 of the design handbook (`~/dev/sandbox/game-look-test/design/15-system-design.md`),
which chose Cloudflare and rules that run apart from graphics. New here: Clerk and Convex, the save that
follows a player between devices, the bake step, four graphics levels and caching. `docs/fast-everywhere.md`
holds the Chromebook budgets.

## The parts

| Part | Service | What it holds or does |
|---|---|---|
| The game's files | Cloudflare static files, behind one Worker | The page, the script, asset packs, voice clips. Copies sit in cities near players. |
| The game | The player's browser | The `.sim.ts` rules and everything drawn. There is no game server. |
| The save | The browser's storage | One string under `greenhollow.save`, written every 60 seconds of play and when the page closes |
| Sign-in | Clerk | Who you are. It gives the browser a signed token. Convex checks it. |
| Database | Convex | Your profile, and a copy of your save that any device you sign in on picks up (`src/features/account/README.md`) |

A guest plays with no account, and their save stays in that browser. Signing in is asked for only to keep
the save in the account. Clerk's and Convex's code loads after the first frame, so it never slows the start.

## Folders and versions

```
src/               the game in the browser
server/            the Worker that serves the built game's files
convex/            the database's tables and functions
tools/             the bake step, the checks, the shots
```

- One repo. One commit is one version of the browser game and the database functions.
- A push to `main` runs `bun run check`, then deploys Convex, then the game's files.
- Three copies of everything: local (on the Mac mini), preview (one per branch) and live.
- GitHub keeps the two machines in sync, as now.

## Words

- **Cache.** A copy of a file the browser keeps on the device, so it does not download it again.
- **Cache life.** How long the browser may use its copy without asking the server. Asset files get a year.
- **Fingerprint.** A short code in the file's name made from its content, as in `house.3f9c2e.glb`. A changed
  file gets a new name, so a year-long cache life can never serve an old file. The page itself gets no
  cache life, so players always get the newest list of names.
- **Background cache (service worker).** A small script the browser runs for our site, apart from the page.
  It answers the game's requests from saved copies first, and it can download the next region's pack while
  you play. On a second visit the game starts with almost no downloading.
- **CDN.** Cloudflare keeps copies of the files in hundreds of cities. A player gets them from a near one.
- **Pack.** One file that holds every asset a region needs, so a region is one download, not two hundred.

## The bake step

Fable's code is the source of every model. The bake step turns that code into what the game ships. It
runs on our machines when we build, never in a player's browser, so a slow Chromebook does none of this
work.

For each asset, `bun tools/models/bake.mjs`:

1. **Runs the code** to get the full model.
2. **Cleans it.** Joins doubled corners and removes faces no one can see, such as the underside on the ground.
3. **Bakes shade into the colors.** Corners, undersides and places where parts meet get darker. The low
   graphics level gets depth from this with no shadow cost at all.
4. **Makes smaller versions.** A middle one, a far one, and a flat picture card for very far.
5. **Makes the icon.** A PNG for the bag, the build menu and shops.
6. **Packs the numbers small.** Dot's files do this and are about half the size of my unpacked test files.
7. **Names the file by fingerprint** and writes its row in the manifest: triangles, bytes, which regions use it.
8. **Checks it.** Triangle budget, shots from four sides at close and game distance, and a second model that
   grades the shots against the brief. A fail goes back to Fable with the shots.
9. **Builds the packs.** One per region, plus a small starter pack for the first frame.

This changes one thing from my earlier note. The game should load baked packs, not build models from code
while it loads. Baking does the cleaning, shading and smaller versions once, on our side.

## Regions

- The world is cut into regions. A region has a pack of assets and a list of what stands where.
- The game keeps a near ring fully loaded and a far ring at low detail. Past that, a painted ridge card.
- Walking toward a region starts its download before you arrive, through the background cache.
- Under memory pressure the game drops the farthest regions first.

## Four graphics levels

Low is a designed look, not the high look with things switched off. Every level keeps the palette, the
sky, the weather, time of day, wind, all animation and all rules. The menus and text are HTML over the
canvas, so they stay sharp at every level, even when the 3D picture is drawn smaller.

| | Low (Chromebook) | Medium | High | Ultra (a good graphics card) |
|---|---|---|---|---|
| 3D picture size | 0.6 to 0.75 of the screen, sharpened | 0.85 to 1 | Full | Full, with smoother edges |
| Shade and shadows | Baked shade, a soft blob under each thing | Sun shadows near the hero | Sun shadows near and far | Soft shadows far out, lamps cast shadows at night |
| Trees | Solid painted crowns | Leaf cards near | Leaf cards | Denser leaves that move leaf by leaf |
| Grass | Painted ground, sparse tufts | Tufts | Grass near the hero | A full field that bends around the hero |
| Water | Painted, moving highlights | Depth color | Reflects the sky | Reflects the world, foam, ripples |
| Light effects | Fog and sky color | Bloom | Light shafts, soft focus far away | Shade in corners, thick fog and clouds |
| View distance | Near ring, then ridge cards | Farther | Far | Farthest, with more detail far away |
| Frame rate | 60 | 60 | 60 | Up to the screen's rate, 120 or 144 |

- **Picking the level.** On the first run the game reads the graphics chip's name and runs a hidden
  two-second test. `governor.sim.ts` then moves the level down or up while you play. The player can set it by hand.
- **In code.** One table lists every feature and its value at each level. A view system reads the table.
  No view system decides quality by itself.
- **WebGPU.** Three.js has a newer renderer for it that falls back to WebGL2. Moving to it means rewriting
  our custom shaders, so Ultra starts on WebGL2. We look at WebGPU again after the first four steps below.

## Risks to test early

1. **A save past a few MB.** The browser's storage holds about 5 MB and the account takes 8 MiB. A save
   grows about 7 bytes a changed block (`convex/README.md`), so this is far off, but it is the first wall.
2. **No Chromebook yet.** Every frame rate is unproven until one is on the desk.

## Cost

- Cloudflare's static files are free, with no limit on requests.
- Clerk's free plan covers 50,000 returning users a month, by Clerk's own explainer. Check the pricing page
  before relying on it.
- Convex's free plan covers 1,000,000 function calls a month.
- A signed-in player costs Convex at most about 6 calls a minute of play: an upload is two calls and the
  live query that hears it is one, at most every 30 seconds. 1,000,000 calls is about 2,700 hours of play a
  month.
- The handbook's Cloud and hosting chapter (`15b-cloud-and-hosting.md`) has the full cost table.

## Order of work

1. **Measure.** The Chromebook, and a fixed flight that logs frame times, draw calls and triangles.
2. **Low level.** Make it hit 60 on the Chromebook and look designed.
3. **Asset system.** The builder's missing shapes, the bake step, the checks.
4. **Load fast.** Fingerprints, packs, the background cache, late voice clips.
5. **Regions.** Load near, drop far.
6. **Accounts.** Clerk and Convex: sign-in, and the save that follows the player. Done.
7. **Ultra level.**

## Sources

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (128 MB, static files)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Convex limits](https://docs.convex.dev/production/state/limits) and [Convex with Clerk](https://docs.convex.dev/auth/clerk)
- [Clerk pricing explained](https://clerk.com/articles/clerk-pricing-explained)
- [Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)
