# Game base

The engine base for an untitled 2.5D open-world RPG for the browser. It holds the general systems
that need no story yet: the block world, the camera, sprites, assets, sky and weather, effects,
sound, the map and performance.

- Run the game: `bun install`, then `bun run dev` and open http://localhost:5300.
- Run one feature alone: `bun tools/demo.mjs dev <feature> <port>`, for example `bun tools/demo.mjs dev world 5311`.
- Check everything: `bun run check`.

`AGENTS.md` has the layout and the rules. The design handbook is in `~/dev/sandbox/game-look-test/design/`.
