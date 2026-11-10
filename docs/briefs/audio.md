# Brief: the sound engine

## Goal

Kausthubh is building an untitled open-world RPG for the browser. He cannot make audio assets, so code has
to make every sound. In his words:

> Background music for each part of the map and each kingdom, then movement sounds like footsteps, NPCs,
> grass, wind, sound effects, all based on code. As you move around, the music and sounds should be
> immersive and continuous. They should blend the changes right in, instead of fading the music out and
> starting again. The tempo rises in fights. We can create a system for this.

You build that system as one feature of the game base. He will play your demo with headphones in the
morning and judge it by ear. You cannot hear it, so the checks measure what can be measured, and your
report names what you are least sure of.

Read first: `AGENTS.md` in this repo (the rules and the commands) and `src/engine/` (the contract). Then
read `/Users/dabot/dev/sandbox/game-sound-test/BRIEF.md`: its sections "The system" (14 requirements) and
"Starting palettes" apply here in full. Where that file and this one differ, this one wins.

## What you own

- `src/features/audio/`
- `src/content/palettes/` (one data file per music palette)
- `demos/audio/`
- `tools/audio-*.mjs`
- `.artifacts/audio/` for renders and spectrograms

## What changes from the older brief

1. **Place.** The engine lives in `src/features/audio/`. The parts with no Web Audio in them (conductor
   math, pattern generation, intensity smoothing, palette blending) go in `.sim.ts` files with tests, and
   must pass `bun run boundaries`.
2. **Palette names.** The story is not settled, so name the seven palettes by land, not by kingdom:
   `meadow`, `desert`, `coast`, `rainvalley`, `highlands`, `forge` and `center`. The feel, scale, tempo and
   instruments in the older brief's table stay, in that order.
3. **The engine speaks the base's language.** Besides `setState` and `emit`, give it two adapters:
   `followAmbient(ambient)` takes the `Ambient` from `src/engine/types.ts` (time of day, rain, wind, fog),
   and `onEvent(event)` takes a `GameEvent` from `src/engine/events.ts` (footstep with its surface, jump,
   land, block placed or broken, pickup, thunder, interface sounds). Footsteps cover every `Surface` in
   the contract.
4. **The demo** is `demos/audio/`, built with `bun tools/demo.mjs build audio`. Keep it a plain top-down 2D
   canvas map, as the older brief describes. There is no single-file build.
5. **The checks** run from `tools/audio-check.mjs`. Renders and spectrograms go in `.artifacts/audio/`.

## Done: every line passes or fails

The nine lines under "Done" in the older brief, with these paths:

- Line 7 becomes: `bun tools/demo.mjs build audio` works, the built page loads through
  `bun tools/serve.mjs dist/demos/audio 5312` with no console errors, and the audio context is not running
  before the first click.
- Line 8 becomes: `bun tools/typecheck.mjs audio`, `bun test src/features/audio` and `bun run boundaries` pass.

## Limits

- Follow "While several agents build here at once" in `AGENTS.md`: write only in the folders above, no
  commits, no `bun install` or `bun add`. Raw Web Audio only, no audio library.
- Your port is 5312. Stop any server by the pid it printed.
- Do the work yourself. Start no subagents.
- When the briefs do not settle a question, pick a default, note it and keep going.

## Report

Your last message: PASS, ISSUES or BLOCKED. Then the output of `tools/audio-check.mjs`, the numbers (voice
peak, node counts, scheduling cost per frame), every default you picked, and the parts you could not check,
starting with the ones most likely to sound bad to a person.
