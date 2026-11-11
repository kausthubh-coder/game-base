# Architecture: fast, good-looking, multiplayer

Status: a proposal, written 2026-11-11. It extends chapter 15 of the design handbook
(`~/dev/sandbox/game-look-test/design/15-system-design.md`), which already chose Cloudflare, one server per
world and rules that run apart from graphics. New here: Clerk and Convex, the bake step, four graphics
levels, caching, and how multiplayer should feel. `docs/fast-everywhere.md` holds the Chromebook budgets.

## The parts

| Part | Service | What it holds or does |
|---|---|---|
| The game's files | Cloudflare static files | The page, the script, asset packs, voice clips. Copies sit in cities near players. |
| Sign-in | Clerk | Who you are. It gives the browser a signed token. |
| Database | Convex | Your profile, the worlds you own or joined, friends, invites, settings. |
| A live world | Cloudflare Durable Object, one per world | Runs the `.sim.ts` rules 20 times a second and keeps every player in step. |
| The world's save | The world server's own storage | Changed chunks, bags, pets, quests, the clock. |
| Backups | Built into the world server's storage | Cloudflare keeps 30 days of history, so a world can be rolled back. |

## The one rule that keeps things in sync

**Every piece of data has one owner. Everything else asks the owner or gets told by it.**

| Data | Owner | Who else sees it, and how |
|---|---|---|
| Who you are | Clerk | Convex and the world server check Clerk's token. Neither stores a password. |
| Profile, world list, friends, invites | Convex | Menus read it live. A friend coming online shows in your menu with no extra code. |
| Positions, creatures, machines, placed blocks, while a world is awake | The world server, in memory | It sends each browser what is near that player. |
| A world's save | The world server's storage | It writes every 30 seconds and when the last player leaves. |
| A world's card: name, who is in it, last played, a picture | The world server writes it to Convex | The world list reads it from Convex. |
| A solo world | The browser | It becomes an online world when you upload it. |

Convex does not carry movement. Its free plan allows 1,000,000 function calls a month, and one player
sending 20 inputs a second would spend that in 14 hours. Convex is for things that change a few times a
minute. The world server is for things that change 20 times a second.

Signing in works like this:

1. Clerk signs you in and gives the browser a token.
2. The browser shows the token to Convex. Convex checks it (`convex/auth.config.ts` names Clerk as the issuer).
3. The browser shows the same token when it opens the connection to a world. The world server checks the
   token's signature with Clerk's public key, then asks Convex whether you may enter this world.

A guest can play a solo world with no account. Sign-in is asked for only to save online or to play with
friends. Clerk's and Convex's code loads after the first frame, so it never slows the start.

## Folders and versions

```
src/               the game in the browser, as today
src/engine/net/    the messages the browser and the world server send each other, defined once
server/            the world server. It imports the same .sim.ts rules the browser runs solo
convex/            the database's tables and functions
tools/             the bake step, the checks, the shots
```

- One repo. One commit is one version of the browser game, the world server and the database functions.
- A push to `main` runs `bun run check`, then deploys Convex, then the world server, then the game's files.
- Every build carries a version number. A world server refuses an older browser and tells it to reload.
  The reload is quick because the files are cached.
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
- The world server uses the same regions to decide what to send each player.

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

## Multiplayer that feels good

The handbook's plan stands: the world server steps the rules 20 times a second, and the target is 8
players a world in about 20 KB a second each. What makes it feel good:

| What the player feels | How |
|---|---|
| My hero moves the instant I press | The browser runs the same rules at once and does not wait. Each input has a number. The server answers with the last number it used, and the browser replays the rest. |
| No rubber-banding | A small disagreement is blended away over about a tenth of a second, never snapped. |
| My actions are instant | Placing, planting and swinging show and sound at once. The server confirms, or the browser undoes it. |
| Other players move smoothly | They are drawn about a tenth of a second in the past, between two real updates. Near players update 20 times a second, far ones less often. |
| My hits land | The server rewinds to what I saw when I swung, then decides. |
| Low delay | A world server starts in a Cloudflare city near its first player. |
| Bad wifi does not kick me | The connection resumes by itself in seconds. The world keeps drawing meanwhile. |
| Menus never wait | Bags, crafting and the map read local state first. |

Messages are small binary packets that hold only what changed.

## Risks to test early

1. **A world server has 128 MB of memory.** A small test comes before any real network code: 8 fake players,
   300 creatures and a few thousand machine parts in one Durable Object, measuring memory and step time. If
   it does not fit, the same rules move to a Bun server on a host such as Fly.io. The rules are plain
   TypeScript, so that is a move.
2. **WebSocket waits on lost packets.** One lost packet holds back those behind it. We test on throttled,
   lossy wifi, and keep packets small.
3. **No Chromebook yet.** Every frame rate is unproven until one is on the desk.

## Cost

- Cloudflare's static files are free, with no limit on requests.
- Clerk's free plan covers 50,000 returning users a month, by Clerk's own explainer. Check the pricing page
  before relying on it.
- Convex's free plan covers 1,000,000 function calls a month.
- World servers run on Cloudflare's free plan for about 28 hours of awake worlds a day. Past that they stop
  until the next day, so the $5 a month plan comes before real players do. It includes about 868 hours of
  awake worlds a month, then about half a cent an hour. An empty world sleeps and costs nothing.
- The handbook's Cloud and hosting chapter (`15b-cloud-and-hosting.md`) has the full cost table.

## Order of work

1. **Measure.** The Chromebook, and a fixed flight that logs frame times, draw calls and triangles.
2. **Low level.** Make it hit 60 on the Chromebook and look designed.
3. **Asset system.** The builder's missing shapes, the bake step, the checks.
4. **Load fast.** Fingerprints, packs, the background cache, late voice clips.
5. **Regions.** Load near, drop far.
6. **World server test.** The 128 MB test above.
7. **Accounts.** Clerk and Convex: sign-in, the world list, online saves.
8. **Multiplayer.** The world server, prediction, smoothing, rejoining.
9. **Ultra level.**

## Sources

- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and
  [limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (128 MB, static files)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Convex limits](https://docs.convex.dev/production/state/limits) and [Convex with Clerk](https://docs.convex.dev/auth/clerk)
- [Clerk pricing explained](https://clerk.com/articles/clerk-pricing-explained)
- [Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)
- Gabriel Gambetta, Fast-Paced Multiplayer: [prediction](https://gabrielgambetta.com/client-side-prediction-server-reconciliation.html),
  [interpolation](https://gabrielgambetta.com/entity-interpolation.html), [lag compensation](https://gabrielgambetta.com/lag-compensation.html)
