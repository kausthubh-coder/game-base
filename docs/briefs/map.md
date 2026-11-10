# Brief: the map, the minimap, waypoints, the HUD, input and dialogue

## Goal

Kausthubh is building an untitled open-world RPG for the browser for 1 to 8 players. He asked for a solid
base of general systems to build the game on. From his messages: "I want a minimap also with waypoints",
and NPCs with dialogue. The game must also play well on a laptop and on a phone browser.

You build what sits between the player and the world: how input is read, the map and its waypoints, the
frame around the game, and the dialogue box. None of it depends on the story.

Read first: `AGENTS.md` (the rules and the commands), `src/engine/` (the contract), and in
`~/dev/sandbox/game-look-test/design/` the chapters `03-map.md` (section "The minimap and the map"),
`12-art.md` (section "Interface") and `04-story.md` (section "How NPCs work").

## What you own

- `src/features/input/`, `src/features/map/`, `src/features/hud/`, `src/features/dialogue/`
- `src/content/dialogue-samples.ts`
- `demos/map/`
- `tools/map-*.mjs` if you need a script
- `.artifacts/map/` for screenshots

## What to build

1. **Input** (`src/features/input/`). One place that turns keys, the mouse, touch and a gamepad into
   intents: a move direction, jump, interact, turn the camera left or right, zoom, use, place, open the
   map, and the quick slots. Keys can be rebound, and the bindings save. On a touch screen it shows a move
   stick on the left and a few round buttons on the right, each at least 44 pixels across, and a pinch
   zooms. The mapping from raw input to intents is a `.sim.ts` file with tests.
2. **The map as rules** (`src/features/map/*.sim.ts`). Which cells have been seen. Pins that the game adds
   (a waystone, a shop, a quest target). Waypoints the player drops: up to 20, each with an icon and a
   color, one of them active. A rumor is a circle, never an exact point. The active waypoint's distance
   and bearing from the player. All of it saves and loads.
3. **The minimap.** A round map in a corner, about 120 blocks across, drawn on a 2D canvas. It takes a
   color for each column from a `colorAt(x, z)` function it is given, turns with the camera's yaw, and
   marks north. It shows the player as an arrow, friends as colored dots, a pet, people with a quest, and
   waypoints as arrows at its edge when they are off it. `map.invalidate(x, z, width, depth)` redraws
   part of it after the world changes. It must cost under 1 ms on a normal frame.
4. **The full map.** It opens on M. Unseen areas are blank parchment. It pans and zooms, and a click drops
   a waypoint with a small picker for icon and color. A waypoint can be marked as shared with the crew.
5. **Waypoints in the world.** The active one shows as a beam of light in the 3D scene, an arrow at the
   edge of the screen when it is out of view, and its distance in blocks.
6. **The HUD** (`src/features/hud/`). Plain HTML and CSS over the canvas, with no UI library. Health,
   stamina and mana at the top left. The minimap, a clock and a weather icon at the top right, read from
   `Ambient`. Nine quick slots at the bottom. One tracked quest at the right. Short messages at the bottom
   left. It looks like a book: parchment panels, ink lines, brass corners. It has a size setting, and it
   keeps clear of phone notches.
7. **Dialogue** (`src/features/dialogue/`). A conversation is data: lines, up to three choices, conditions
   and effects on named flags. A small interpreter runs it (`.sim.ts`, with tests). The box sits at the
   bottom with a portrait and a name, types the text out, and calls `onCharacter(letter, voiceId)` for each
   letter so the sound engine can voice it. A click or a key shows the whole line, then moves on. Write two
   sample conversations in `src/content/dialogue-samples.ts`, with a baker and a child.
8. **The demo** (`demos/map/`). A top-down colored land you generate yourself, with a 3D scene just large
   enough to show the waypoint beam. A player you move. Two people you can talk to. The minimap, the full
   map, waypoints, the HUD and the dialogue box all working. A button turns the camera a quarter turn so
   the minimap turns too.

## Done: every line passes or fails

1. `bun tools/typecheck.mjs` passes for `input`, `map`, `hud` and `dialogue`. `bun run boundaries` passes.
2. `bun test src/features/input src/features/map src/features/dialogue` passes, with tests for: keys and
   stick to a move direction, rebinding, seen cells, the 20 waypoint limit, distance and bearing, save and
   load, a conversation with a choice and a condition, and a flag set by an effect.
3. `bun tools/demo.mjs build map` works, and the built page loads with no console errors
   (`bun tools/serve.mjs dist/demos/map 5316`, then `bun tools/shot.mjs`).
4. Screenshots you looked at, in `.artifacts/map/`: the HUD at 1440 by 900, the minimap after each of four
   camera turns, the full map with three waypoints, the beam and the edge arrow, the dialogue box in the
   middle of a line and at a choice, and the whole screen at 390 by 844 with the touch controls.
5. Every touch control is at least 44 pixels across at 390 by 844. Text in the HUD has a contrast of at
   least 4.5 to 1 against its panel.
6. The minimap's draw time, measured in the page over 600 frames, averages under 1 ms. State the number.
   This Mac is slow at 3D and normal at 2D canvas, so this one number may be measured here.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`. No UI library.
- Your port is 5316. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the brief does not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the check output, the number from line 6, your defaults,
anything in `src/engine` you found missing, and what you could not check, starting with touch on a real phone.
