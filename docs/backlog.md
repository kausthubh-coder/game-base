# What to build next

Each row is sized for one thread. Start a thread in the game's project on `main`, paste the row's words, and
the agent takes it from there: `AGENTS.md` names the skill for each kind of work. A row marked **his call**
needs Kausthubh to pick before anything is built, so the thread should show him two options first.

Written 2026-11-11. Take a row off when it is merged.

## The game itself

| Task | Where to read first | Notes |
|---|---|---|
| Rewrite the story chapters to the picked story and rebuild the opening | The handbook's `04d-new-story.md`; branch `t3/animated-story-intro` | The intro branch is 17 commits ahead of where `main` was; bring across what still fits |
| Fights: enemy data, an arena at `?scene=arena`, and bots that fight 1,000 times | `docs/ai-native.md`, "Iterating on content"; the handbook's `07-combat.md` | Data and grey boxes before any art |
| A first boss, as phases and a timeline | The same | After fights |
| A chest that stores things | `src/game/placeables`, `docs/bugs` | Today a chest only says it is empty |
| Build pieces in the painted look: walls, floors, a roof | `docs/painted-world.md` | **His call** on the look: show two first screens |
| Countryside props: ruined cottage, footbridge, cave mouth, stump and log | `docs/painted-world.md`, the `make-3d-asset` skill | Sol |
| The story graph, a person's day and the region map as checks | `docs/ai-native.md`, "One view and one check for each kind" | Their data exists today |

## Graphics and speed

| Task | Where to read first | Notes |
|---|---|---|
| The low level's look, to fit 150,000 triangles | `docs/fast-everywhere.md`; `window.__game.costs()` and `/?bench&quality=low` | **His call**: soft blob shadows in place of the sun's shadow pass is the biggest saving |
| The town drawn by distance, and a lighter town when in it | The same | The town is one 60,719-triangle body, drawn whole from 130 blocks away |
| Ultra in the settings menu | `src/content/quality.ts`, `src/game/ui/logic.test.ts` | A test says ultra is not a setting yet |
| The bake step: far versions, baked shade, packed models, icons | `docs/architecture.md`, "The bake step" | Sol for the tool |
| The world loaded by region | `docs/architecture.md`, "Regions" | After the bake step |
| Measure on a real Chromebook | `/?bench` | Needs the device |

## Playing together

| Task | Where to read first | Notes |
|---|---|---|
| Stage 2: each player's own bag, hand and Almanac | `docs/multiplayer.md`; `src/game/online/README.md`, "What stage 2 changes" | The largest one. Design by the coordinator first |
| A link a whole class can open | `convex/invites.ts`, `docs/multiplayer.md` | An invite lets one friend in today and a world holds 8. **His call** on how a class is split into worlds |
| Stage 3: small binary messages, resume after a drop, the 8-player memory test on Cloudflare | `docs/multiplayer.md`; `server/README.md` | 85 KB a second for each player today against a goal of 20 |
| Model joining and leaving a world, and the world's card | The `formal-game` skill | Both had real ordering bugs |

## The workshop

| Task | Where to read first | Notes |
|---|---|---|
| Apply Biome's formatter | `biome.json` | 664 files change. Do it when few branches are open |
| A night playtester on a schedule | `docs/ai-native.md`, step 7; the `playtest-game` skill | Bots with new seeds, one charter from `docs/playtests/README.md`, bug files |
| Model the save, the bag and an invite | The `formal-game` skill | One model each, in that order |
| Content views and change cards in the handbook app | `docs/ai-native.md`, "The workbench" | The app is in `~/dev/sandbox/game-look-test/handbook` |
| One shots tool for the forty one-scene scripts | `docs/shots/README.md` | Sol |
| The painted-texture loader reads the manifest | `tools/asset-build.mjs` | The build patches one line of the loader today |
| Sort the branches that are only on the Mac mini | `git branch` | Looks, styles and the story intro. **His call** which to keep |
| A name and a logo | `~/dev/sandbox/game-look-test/design/img/brand/logo-options.html` | **His call** |
