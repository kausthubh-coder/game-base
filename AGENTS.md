# Game base

Kausthubh's untitled 2.5D open-world RPG for the browser: a painted 3D world, 2D pixel-art characters, an
isometric-style camera, farms and kingdoms the player builds. The name is not picked yet, so the repo keeps
its working name. `main` is the one true game. It is on GitHub at `kausthubh-coder/game-base` (private), and
every push to `main` that passes the check goes live at https://game-base.kausthubh2007.workers.dev.

Read before a large change:

| When the change touches | Read |
|---|---|
| How agents build, play and check the game | `docs/ai-native.md` |
| Hosting, accounts, the world server, graphics levels, the bake step | `docs/architecture.md` |
| Frame rate or load time on a weak device | `docs/fast-everywhere.md` |
| The look of the world | `docs/painted-world.md` |
| Menus, HUD, dialogue, map or any interface look (with the `make-ui` skill) | `docs/ui-look.md` |
| Story, art, sound or game design | The handbook: the markdown in `~/dev/sandbox/game-look-test/design`, shown by the app in `game-look-test/handbook` (port 5361) |

## Commands

Every task in a new worktree starts with the `worktree-game` skill. Say done only after the `verify-game` skill. Ship only with the `ship-game` skill, when Kausthubh says so.

## Skills

They are in `.agents/skills`. Load the one that fits before you start.

| The task | Skill |
|---|---|
| A new worktree, or packages, keys or a port look wrong | `worktree-game` |
| Build or change a rule, a system, something drawn, a panel | `make-feature` |
| Add a check, test something, or a bug was reported | `test-game` |
| Prove a change works before saying done | `verify-game` |
| A rule where the order of events is the risk, or "model-check this" | `formal-game`, and `verify-build-stroke` for build mode |
| A menu, a panel, the HUD, dialogue, the map, or how any of it looks | `make-ui` |
| A 3D prop, or a sprite, icon, portrait or tile | `make-3d-asset`, `make-sprite`, then `verify-assets` |
| An art style behind `?style=` | `verify-style-lab` |
| Work for several agents: design it, brief helpers, merge | `coordinate-game` |
| Kausthubh says ship, deploy or release | `ship-game` |

What to build next, one line a task: `docs/backlog.md`.

| Command | What it does |
|---|---|
| `bun tools/doctor.mjs` | Makes this checkout run: packages, keys, Chrome, a port of its own. Prints the port to use. |
| `bun run check` | Types, the `.sim.ts` rule, every test, the world server's types, the Convex tests |
| `bun run verify` | Every check there is, about two minutes. `--full` adds the slow browser plays, `--list` names the parts. |
| `bun run lint` | Biome lint. The formatter is not applied to the code yet. |
| `bun tools/sim.ts scenarios` | Plays the rules with no browser. Also `bot --seed <n> --steps <n>` and `--replay <seed> --until <step>`. |
| `bun tools/play.mjs start` | One Chrome for this worktree to play in, through the debug door or like a person (`tools/play/README.md`) |
| `bun tools/shots.mjs all --check` | Six scenes against their approved pictures and the draw budgets (`docs/shots/README.md`) |
| `bun tools/shot.mjs <url> <out.png>` | One screenshot in headless Chrome. Exits 1 on a console error. |
| `bun run dev` | The game itself, on port 5300 in the main checkout |
| `bunx wrangler dev` | The built game and the world server, on port 5540 (`server/README.md`) |
| `bun server/test/check.ts` | The world server's checks, on its own `wrangler dev` |
| `bun server/test/live.ts` | Clerk, Convex and the world server together. Needs `.env.local`. |
| `bun tools/play-together.mjs` | Two browsers in one world with dev tokens: walk, build, farm, leave, a server restart (`src/game/online/README.md`) |
| `bun tools/play-together-signed-in.mjs` | The same with three real Clerk sign-ins and the invite link (`tools/play/signed-in.md`). `--url <address>` plays a deployed copy. |
| `bunx convex dev --once` | Pushes `convex/` to the dev deployment (`convex/README.md`) |
| `bun tools/load-measure.mjs` | Bytes and requests before the first playable frame, first and second visit |
| `bun run deploy --dry-run` | Builds and packages the live copy and sends nothing. GitHub does the real deploy. |
| `bun tools/live-look.mjs <url>` | Opens a deployed copy like a player, starts a new game, takes two pictures |
| `bun tools/typecheck.mjs <feature>` | Type-checks the shared code and one feature only |
| `bun tools/demo.mjs dev <feature> <port>` | Dev server for one demo. It prints its pid. `build` builds it into `dist/demos/<feature>`. |
| `bun tools/serve.mjs <folder> <port>` | Serves a built folder. It prints its pid. |
| `bun --env-file=.env.local tools/voice.ts` | Makes the voice clips of new or changed lines (`--dry` prices it first). `tools/sound.ts` does the same for recorded sounds. |

The other scripts in `tools/` shoot or measure one thing each. `docs/painted-world.md` lists the ones for the painted world, the land's shape and the hero's frames, `docs/style-lab/README.md` the style lab's, and `demos/ghibli/README.md` the meadow test scene's.

## Layout

```
src/engine/            the contract between features: types, events, world-query, system
src/engine/net/        the messages the browser and the world server send each other
src/content/           data only: blocks, surfaces, palettes, effects, props
src/features/<name>/   one folder per feature, with its tests beside the code
src/game/              the game itself: rules, content, views and the shell that starts it
server/                the world server, a Cloudflare Durable Object that runs the .sim.ts rules
convex/                the database's tables and functions
demos/<name>/          one small page per feature that shows it alone
public/assets/         finished sprites and textures, and manifest.json (see docs/assets.md)
assets-src/            raw generated images, prompts and the palette
tools/                 build, serve, screenshot and check scripts
docs/                  plans, briefs, the style sheet, the asset contract
.agents/skills/        this repo's skills
```

## Rules

1. **A `.sim.ts` file is game rules.** It will run on a server later. It imports only other `.sim.ts` files, `src/content` and `engine/types`, `events` or `world-query`. It never touches Three.js, the page or Web Audio. `bun run boundaries` fails otherwise. Drawing goes in `.view.ts`, panels in `.ui.ts`.
2. **A feature is a deep module.** It exports `createX(ctx, options)` and returns a `ViewSystem` plus a few methods of its own. No globals, no singletons, no reaching into another feature's files. Features meet through `src/engine` and through `src/main.ts`.
3. **Content is data.** A block, a sound palette, an effect or a prop is an entry in `src/content`. Adding one does not change engine code.
4. **Sound files are made by tools, never by hand. 3D models are made by code.** Code makes the music and every sound that works better made: the wind, the made creatures, spells, the interface. Two kinds of files are made ahead of time with ElevenLabs. Spoken dialogue: `tools/voice.ts` makes a clip for each line a person in `src/game/content/cast.ts` says, into `public/assets/voice/` with its list `voice/voice.json`. Recorded ambience beds, footsteps, tool strikes and spot sounds: `tools/sound.ts` makes each from its prompt in `src/content/sound-samples.ts`, into `public/assets/sound/` with its list `sound/sound.json`. Both are small mp3s listed in the manifest (see `docs/assets.md`). To change a recorded sound, change its prompt and run the tool. Never add an audio file by hand, and never call ElevenLabs from the game. Simple shapes are TypeScript builders in `src/features/props/builders`. Richer models (trees, rocks, bushes, characters) are `.glb` files listed in `public/assets/manifest.json`, built by a Blender script in `tools/models/`, or modelled by hand with the `.blend` source kept beside an export script that rebuilds the `.glb` and checks its triangles, scale and animation names. Never commit a model that nothing rebuilds. Sprites and textures are PNG files listed there too.
5. **Space.** y is up. One unit is one block is one meter. North is -z, east is +x.
6. **Speed is part of done.** The target is 60 frames a second on a mid laptop with integrated graphics, with room to spare: 150 draw calls, 400,000 triangles, 6 ms of script per frame at high; 80 draw calls and 150,000 triangles at low (`docs/fast-everywhere.md`). Allocate nothing per frame. Every view system works at `low`, `medium`, `high` and `ultra`, and reads its values from the one table in `src/content/quality.ts`; a test fails a view that keeps its own. `window.__game.costs()` gives draw calls and triangles by feature, and `/?bench` flies a fixed path and records them for a level.
7. **Chrome uses the graphics chip.** Browser tools print their renderer; `--software` or `CHROME_SOFTWARE=1` selects software drawing. Compare approved pictures only with the same renderer. Draw calls, triangles and shader counts are exact here. Never report a frame rate measured on this Mac: it says nothing about a Chromebook.
8. **bun only.** Never npm or npx. Say so before you add a dependency.
9. **Servers.** Use your own port, and stop a server by the pid it printed, never by port.
10. Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`. Commands there hang forever.

## Branches and agents

- **One task, one branch, one worktree.** Cut the branch from a fresh `origin/main`. Commit there as you go, one commit per slice. It merges back within a day or two.
- **The coordinator merges.** A helper pushes or merges `main` only when its brief says so.
- **A look test that will not merge** stays behind a URL flag on `main` (`?style=`, `?ui=`, `?look=`), not on a long branch.
- **Write only in the folders your brief names.** `src/engine`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts` and this file belong to the coordinator. If the contract in `src/engine` is missing something, add what you need inside your own feature and say so in your report.
- **Packages.** `bun install` in your own worktree is fine. `bun add` only for a package your brief names.
- Check your own work with `bun tools/typecheck.mjs <feature>` as well as `bun run check`, since another agent's half-written code can fail the full check.
- Put screenshots and renders in `.artifacts/<feature>/`.

Ports. `bun tools/doctor.mjs` gives each worktree one of its own in 5400 to 5999. These are fixed:

| Port | What |
|---|---|
| 5300 | The game in the main checkout |
| 5311 to 5316 | The feature demos: world, audio, sky, sprites, props, map |
| 5361 | The handbook app |
| 5460, 5470 | The painted meadow test scene, `painted-shots` |
| 5525, 5526 | `tools/play.mjs` and `tools/shots.mjs` when `PLAY_PORT` is not set |
| 5540 to 5548 | The world server: `wrangler dev`, its check, its memory test, the live check, `play-together` |
| 5570 to 5578 | `play-together-signed-in` |
