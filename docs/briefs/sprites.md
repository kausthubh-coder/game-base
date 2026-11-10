# Brief: sprites in the world, and the asset loader

## Goal

Kausthubh is building an untitled open-world RPG for the browser: a 3D block world with 2D pixel-art
characters, seen from an isometric-style camera that turns in quarter steps. He asked for a solid base of
general systems, in his words including "sprites and how they work, the sprite system, the asset system",
with good performance on the web.

You build the part that puts 2D characters into the 3D world and the loader that finds every asset. An
image-generation agent has already made the first assets: `public/assets/manifest.json` and the files it
lists. `docs/assets.md` is the contract.

Read first: `AGENTS.md` (the rules and the commands), `src/engine/` (the contract), `docs/assets.md`,
`docs/style-sheet.md`, and in `~/dev/sandbox/game-look-test/design/` the chapter `12-art.md` (section
"Sprites"). The older side-view scene drew sprites in `~/dev/sandbox/game-25d-test/src/actors.js`.

## What you own

- `src/features/assets/`, `src/features/sprites/`
- `demos/sprites/`
- `tools/sprites-runtime-*.mjs` if you need a script (`tools/sprites/` belongs to the asset pipeline)
- `.artifacts/sprites-runtime/` for screenshots

## What to build

1. **The loader** (`src/features/assets/`). It reads and checks `manifest.json`, then loads textures with
   nearest filtering. `assets.sprite(name)`, `assets.blockAtlas()` and `assets.icon(name)` give typed
   results. A missing entry or file fails with a message that names it. It reports loading progress.
2. **One draw call for everyone.** Pack every sprite sheet into one atlas texture at load time (more pages
   only if one cannot hold them). Draw every character from it as instances of one quad. 500 characters on
   screen must cost 3 draw calls or fewer.
3. **Standing in the world.** A sprite stands upright with its feet on its anchor, turns to face the
   camera around the up axis only, and is as tall as its `worldHeight`. Use a hard alpha cut, so sprites
   sort against blocks by depth with no sorting pass. Each gets a soft round shadow on the ground.
4. **Directions.** A character has a facing in the world. From that facing and the camera's yaw, pick the
   front, back or side row, and mirror the side row for left. It must be right from all four quarter turns.
5. **Animation.** Each instance plays a named animation at the manifest's speed. `handle.play('walk')`
   switches it. Idle characters start at random offsets so a crowd does not move in step.
6. **Light.** Sprites take a tint from the time of day in `ctx.ambient` and from `ctx.world.lightAt` where
   they stand, so a character in a dark cave is dark and one beside a lamp is lit.
7. **Color variants without new art.** `assets.variant(name, colorMap)` makes a recolored copy of a sheet
   at load time by swapping exact palette colors. Use it for a few villager and pet colors in the demo.
8. **The API.** `createSprites(ctx, { assets })` returns a `ViewSystem` with `add(spriteName, options)`.
   A handle has `setPosition`, `setFacing`, `play`, `setTint`, `setVisible` and `remove`. Nothing allocates
   per frame.
9. **The demo** (`demos/sprites/`). Flat ground from `flatWorld`. 200 characters from the real manifest
   wander: heroes, both villagers, pets, critters, in a few color variants. A simple camera with Q and E
   quarter turns and a zoom. A slider for time of day, a slider for the count up to 1,000, and draw calls
   and triangles on screen. If a sprite is missing from the manifest, draw a plain placeholder and say so
   on screen.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs sprites` and `bun tools/typecheck.mjs assets` pass. `bun run boundaries` passes.
2. `bun test src/features/sprites src/features/assets` passes, with tests for: the row and mirror picked
   for each of 8 facings at each of 4 camera turns, the frame shown at a given time, the atlas packer never
   overlapping two sheets, and manifest errors that name the missing thing.
3. `bun tools/demo.mjs build sprites` works, and the built page loads with no console errors
   (`bun tools/serve.mjs dist/demos/sprites 5314`, then `bun tools/shot.mjs`).
4. Screenshots you looked at, in `.artifacts/sprites-runtime/`: the crowd from each of the four camera
   turns, a close view of one hero walking away, toward and across the camera, noon and night, and 1,000
   characters.
5. With 500 characters the demo reports 3 draw calls or fewer for sprites and their shadows. State the number.
6. After adding and removing 1,000 characters ten times, the count of geometries and textures is flat.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`.
- Your port is 5314. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the numbers from lines 5 and 6, your
defaults, anything in `src/engine` or the manifest format you found missing, how the generated sprites
look in motion from each side, and what you could not check.
