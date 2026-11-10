# Overnight build, 2026-11-09 to 11-10

Kausthubh went to sleep and asked for a solid base of general systems that need no story, the research
saved and a story written from it, and the handbook updated. He reads all of it in the morning.

The coordinator is the design thread (T3 "Design a Farm Hacking Web Game"). It keeps this file current.

## Waves

| Wave | Feature | Brief | Who | State |
|---|---|---|---|---|
| 1 | world, camera, hero, perf | `docs/briefs/world.md` | Claude Fable | started |
| 1 | audio | `docs/briefs/audio.md` | Claude Fable | started |
| 1 | sky, weather, water, effects, post | `docs/briefs/sky.md` | Claude Fable | started |
| 1 | sprite assets and pipeline | `docs/briefs/sprite-assets.md` | GPT Sol | started |
| 2 | sprites at runtime, asset loader | to write | Claude Fable | waiting on wave 1 |
| 2 | props, trees, buildings, `make-3d-asset` skill | to write | Claude Fable | waiting |
| 2 | map, minimap, waypoints, HUD, input, touch, dialogue | to write | Claude Fable | waiting |
| 3 | join everything in `src/main.ts`, speed pass | coordinator | | waiting |

Never more than three Claude agents at once: the Mac mini and the laptop share one account.

## Also for the morning

- The research report: `~/dev/sandbox/game-look-test/design/reports/Story and worldbuilding craft.md`.
- A third story draft written from it, in the handbook with the two older drafts.
- The handbook rebuilt: `~/dev/sandbox/game-look-test/design/design.html`.
- Two skills: `.agents/skills/make-sprite` and `.agents/skills/make-3d-asset`.

## Log
- 22:25 Wave 1 started: world, audio, sky (Claude Fable) and sprite assets (GPT Sol).
- 22:45 Handbook: research report added as a chapter, a plain summary of it, and the third draft of Lore, Story and Kingdoms ("You only keep what you give back to"). Older drafts kept behind a switch. Other chapters swept to match. Critly check passes on the changed pages.
- 22:50 Wave 2 briefs written: `sprites.md`, `props.md`, `map.md`.

## What the coordinator does when an agent finishes

1. Read its report. Rerun its strongest check yourself (`bun tools/typecheck.mjs <feature>`, its tests, build its demo, look at a screenshot).
2. Commit its folders with a message that names the feature.
3. Start the next waiting brief, keeping at most three Claude agents running. Order: sprites (needs the sprite assets), props (needs `src/content/blocks.ts`), map.
4. When all seven are in: join them in `src/main.ts` as one walkable scene, run `bun run check`, build, screenshot.
5. Write `.agents/skills/make-sprite/SKILL.md` (load `writing-for-agents` first) from what the asset agent built.
6. Add a chapter "The base" to the handbook (`~/dev/sandbox/game-look-test/design/16-base.md`) with what exists, how to run each demo, the numbers, and what is not proven. Update `14-v1.md`'s experiment table. Rebuild with `node build.mjs`.
7. Leave a short morning note as the last message.
