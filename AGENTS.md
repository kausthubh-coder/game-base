# Game base

Kausthubh's untitled 2.5D open-world RPG for the browser: a painted 3D world, 2D pixel-art characters, an
isometric-style camera, farms and kingdoms the player builds. The name is not picked yet, so the repo keeps
its working name. `main` is the one true game. It is on GitHub at `kausthubh-coder/game-base` (private).

Read before a large change:

| When the change touches | Read |
|---|---|
| How agents build, play and check the game | `docs/ai-native.md` |
| Hosting, accounts, the world server, graphics levels, the bake step | `docs/architecture.md` |
| Frame rate or load time on a weak device | `docs/fast-everywhere.md` |
| The look of the world | `docs/painted-world.md` |
| Story, art, sound or game design | The handbook: the markdown in `~/dev/sandbox/game-look-test/design`, shown by the app in `game-look-test/handbook` (port 5361) |

## Commands

| Command | What it does |
|---|---|
| `bun run check` | Type check, the `.sim.ts` rule and the tests. Run it before you say done. |
| `bun tools/typecheck.mjs <feature>` | Type-checks the shared code and one feature only |
| `bun test src/features/<feature>` | One feature's tests |
| `bun tools/demo.mjs build <feature>` | Builds `demos/<feature>` into `dist/demos/<feature>` |
| `bun tools/demo.mjs dev <feature> <port>` | Dev server for one demo. It prints its pid. |
| `bun tools/serve.mjs <folder> <port>` | Serves a built folder. It prints its pid. |
| `bun tools/shot.mjs <url> <out.png>` | Screenshot in headless Chrome. Exits 1 on a console error. |
| `bun run dev` | The game itself, on port 5300 |
| `bun tools/play-build.mjs` | Plays build mode in the build lab (`?scene=build`) with the real mouse, and writes a screenshot of each step to `.artifacts/build/` |
| `bun tools/painted-shots.mjs` | Pictures of the painted world from fixed places, into `.artifacts/painted` (see `docs/painted-world.md`) |
| `bun tools/land-relief.mjs` | Draws the shape of the land from above into `.artifacts/painted/relief.png`, without starting the game |
| `bun tools/sprite-fringe.mjs` | Measures the pale rim a white background leaves round a sprite. The sprite check fails a sheet that has one |
| `bun tools/hero-frames.mjs` | Films the hero walking, a twentieth of a second a frame, into `.artifacts/painted/hero-frames.png`, to see a frame that is drawn wrong |
| `bun tools/hero-ground.mjs` | Walks the hero over sloping ground and fails if the drawn hero is ever off the drawn land |
| `bun tools/style-lab.mjs --style <name>` | The style lab's shots and motion strips for one art style (see `docs/style-lab/README.md`) |
| `bun tools/ghibli-assets.mjs` | Remakes the painted meadow test scene's textures from `assets-src/ghibli/raw`, and copies the game's twelve into `public/assets/painted` (see `demos/ghibli/README.md`) |
| `bun --env-file=.env.local tools/voice.ts` | Makes the voice clips of new or changed lines (`--dry` prices it first). Needs `ELEVENLABS_API_KEY` in `.env.local` |

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
6. **Speed is part of done.** The target is 60 frames a second on a mid laptop with integrated graphics, with room to spare: 150 draw calls, 400,000 triangles, 6 ms of script per frame. Allocate nothing per frame. Every view system works at `low`, `medium` and `high` quality.
7. **This Mac draws WebGL in software.** Use screenshots to check what is drawn. Never report a frame rate measured here.
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

| Feature | Port |
|---|---|
| world | 5311 |
| audio | 5312 |
| sky | 5313 |
| sprites | 5314 |
| props | 5315 |
| map | 5316 |
| painted-shots | 5470 |
| ghibli (the painted meadow test scene) | 5460 |
| the game | 5300 |
