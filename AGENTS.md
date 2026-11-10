# Game base

The engine base for Kausthubh's untitled 2.5D open-world RPG for the browser: a 3D block world, 2D pixel-art
characters, an isometric-style camera. This repo holds the general systems that need no story: world, camera,
sprites, assets, sky and weather, effects, sound, map, performance. It is an experiment in `~/dev/sandbox`
until the game has a name.

The design handbook is `~/dev/sandbox/game-look-test/design/design.html`. Its source is the markdown beside it.
Read `15-system-design.md`, `12-art.md` and `13-sound.md` there before a large change.

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
| `bun --env-file=.env.local tools/voice.ts` | Makes the voice clips of new or changed lines (`--dry` prices it first). Needs `ELEVENLABS_API_KEY` in `.env.local` |

## Layout

```
src/engine/            the contract between features: types, events, world-query, system
src/content/           data only: blocks, surfaces, palettes, effects, props
src/features/<name>/   one folder per feature, with its tests beside the code
demos/<name>/          one small page per feature that shows it alone
public/assets/         finished sprites and textures, and manifest.json (see docs/assets.md)
assets-src/            raw generated images, prompts and the palette
tools/                 build, serve, screenshot and check scripts
docs/                  briefs, the style sheet, the asset contract
.agents/skills/        skills for making assets
```

## Rules

1. **A `.sim.ts` file is game rules.** It will run on a server later. It imports only other `.sim.ts` files, `src/content` and `engine/types`, `events` or `world-query`. It never touches Three.js, the page or Web Audio. `bun run boundaries` fails otherwise. Drawing goes in `.view.ts`, panels in `.ui.ts`.
2. **A feature is a deep module.** It exports `createX(ctx, options)` and returns a `ViewSystem` plus a few methods of its own. No globals, no singletons, no reaching into another feature's files. Features meet through `src/engine` and through `src/main.ts`.
3. **Content is data.** A block, a sound palette, an effect or a prop is an entry in `src/content`. Adding one does not change engine code.
4. **No sound files but voiced lines. 3D models are made by code.** Code makes the music, the ambience and every effect. The one exception is spoken dialogue: `tools/voice.ts` makes a clip for each line a person in `src/game/content/cast.ts` says, ahead of time, into `public/assets/voice/` with its list `voice/voice.json` (see `docs/assets.md`). Never add a voice clip by hand, and never call ElevenLabs from the game. Simple shapes are TypeScript builders in `src/features/props/builders`. Richer models (trees, rocks, bushes) are `.glb` files built by Blender scripts in `tools/models/` and listed in `public/assets/manifest.json`; never commit a model no script rebuilds. Sprites and textures are PNG files listed there too.
5. **Space.** y is up. One unit is one block is one meter. North is -z, east is +x.
6. **Speed is part of done.** The target is 60 frames a second on a mid laptop with integrated graphics, with room to spare: 150 draw calls, 400,000 triangles, 6 ms of script per frame. Allocate nothing per frame. Every view system works at `low`, `medium` and `high` quality.
7. **This Mac draws WebGL in software.** Use screenshots to check what is drawn. Never report a frame rate measured here.
8. **bun only.** Never npm or npx. Say so before you add a dependency.
9. **Servers.** Use your own port, and stop a server by the pid it printed, never by port.
10. Never read, list or write `~/Documents`, `~/Desktop` or `~/Downloads`. Commands there hang forever.

## While several agents build here at once

- Write only in the folders your brief names. `src/engine`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` and `src/main.ts` belong to the coordinator. If the contract in `src/engine` is missing something, add what you need inside your own feature and say so in your report.
- Do not commit, and do not run `bun install` or `bun add`. The coordinator does both.
- Check your own work with `bun tools/typecheck.mjs <feature>`, since another agent's half-written code can fail the full check.
- Put screenshots and renders in `.artifacts/<feature>/`.

| Feature | Port |
|---|---|
| world | 5311 |
| audio | 5312 |
| sky | 5313 |
| sprites | 5314 |
| props | 5315 |
| map | 5316 |
| the game | 5300 |
