# Build mode

Press G. Drag the hoe over grass to till a rectangle, drag seeds over soil, drag a fence along a line. Z takes back the last stroke.

## Sub-features

- `stroke`: press, drag, release, cancel.
- `undo`: Z takes back the last stroke and gives the items back.
- `snap`: a chest backs onto a wall, fences join, a sprinkler shows its reach.

## How to get to it (user POV)

In a game, press G. The build lab is the same mode on a flat meadow: add `?scene=build` to the address.

## Driving it with `bun tools/play-build.mjs`

Preconditions: `bun tools/doctor.mjs` is clean.

- **The whole mode with the real mouse:** `bun tools/play-build.mjs` ends with `38 of 38 checks passed` and writes a screenshot of each step to `.artifacts/build/`.
- **The rules alone:** `bun tools/sim.ts scenarios` runs `build-stroke` and `nothing-left-floating`.
- **The formal model:** the `verify-build-stroke` skill, after any change to `src/game/build/index.sim.ts`.

## Gotchas

- A right-drag in the middle of a stroke drops the stroke. That is intended.
- Opening the pause menu in the middle of a drag once left a stroke stuck. The browser check covers it; keep that check.
