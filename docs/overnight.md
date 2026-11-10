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
- 22:36 Sprite assets finished (ISSUES): characters hold from three sides, icons good, several block textures band. Committed. Started a second Sol run to fix the textures and add tile names the block data uses.
- 22:50 Second Sol run fixed colors and names but flattened every tile to noise. Coordinator added compose-blocks.mjs to bring the first run's shapes back on correct color ramps. Check passes, committed.
- 23:11 Sky, weather, water, effects, post finished (PASS). Reran type checks and 32 tests, looked at the day sheet. Adds 9 draw calls and 4,641 triangles at high. Committed. Started the sprites agent.
- 23:27 Sound engine finished (PASS, 23 check lines). Reran type check and 43 tests, built the demo, looked at the crossing spectrogram: no gap at either border. Nobody has heard it. Committed. Started the props agent.

## New goal at 23:35: a playable first part of the story by 6 am

Kausthubh asked for a polished, playable first part of the story by about 6 am, built in a worktree so it
can stay a reference if he does not like it, checked with verification skills and improved in rounds
toward 8 or 9 out of 10. He also asked for a skill that verifies every asset, skills for making sprites
and 3D assets, and for Astra to make 3D props too, to compare. Ultracode is on, so Workflow is allowed.

- **Worktree:** `/Users/dabot/dev/sandbox/game-base-play`, branch `play/greenhollow`. The base stays on `main` here.
- **Design:** `docs/play/act1.md` there (five quests, 20 to 30 minutes, ends at the harvest festival).
- **Contract:** `src/game/api.sim.ts`, `kernel.sim.ts`, `move.sim.ts` there.
- **Provisional copies:** the worktree holds uncommitted copies of world, camera, hero, perf, sprites, assets and blocks.ts (listed in its `PROVISIONAL.txt`). Delete them, then `git merge main`, once those features are committed on main.

| Stage | What | State |
|---|---|---|
| Base, still running on main | world (Fable), sprites runtime (Fable), props (Fable), map/HUD/input/dialogue (Fable), story art (Sol), props second take (Astra) | running |
| 1 | Workflow `play-stage-1-systems` (run `wf_bf74a342-2b3`): items, farm, creatures, people, story, ui, skills. Seven agents in the worktree. | running |
| 2 | Commit stage 1. When base features are committed on main: delete provisional copies, merge main into the branch. Then a Workflow for: the shell (boot, loop, every feature wired, actors to sprites, save, the `window.__game` debug door), the region (Greenhollow slice, town from blueprints, named places), views (crops, placeables as props, audio, effects, HUD, minimap, dialogue box). `src/game/boot.ts` loads `src/game/views/*.view.ts` by glob so agents do not share a file. | waiting |
| 3 | A scripted play of all five quests through the debug door. Write `.agents/skills/verify-greenhollow` with `create-verification-skill`. | waiting |
| 4 | Hill climb: judges score the ten lines in act1.md from screenshots and the script's log, fixers take the lowest lines, repeat until 8 or time runs out. Stop new work at 05:30. | waiting |
| 5 | Compare the two prop sets. Update the handbook (`16-base.md`, `14-v1.md`). Morning note. | waiting |
- 23:52 Astra's props finished (PASS): 49 props, all within budget, a clean low-poly sheet. Committed under experiments/props-astra. Compare with the Fable set when it lands.
- 00:02 Story art finished (ISSUES, minor): eight people hold from three sides and are distinct, leaftail, lanternfly, crops, 16 icons, panel, button, title. Check exits 0. Committed, merged into the play branch.
- 00:04 World, camera, hero, perf finished (PASS). Reran type checks and 58 tests, looked at the start view and the house with its roof cut away. 36 draw calls and 146k triangles at the start view on high. Committed. Replaced the provisional copies in the play branch by a merge.
- 00:06 Started the shell agent in the play worktree (brief: docs/play/brief-shell.md there). It owns boot, the loop, base feature wiring, actors to sprites, saving, the debug door and a smoke test. Views plug in through src/game/views/*.view.ts. Still to start after it and after props and map land: region, crops and stations drawing, HUD and panels wiring.
- 00:10 Sprites runtime and asset loader finished (PASS). Reran type checks and 80 tests. 2 draw calls for 500 characters. Committed and merged into the play branch.
- 00:25 Stage 1 finished: all seven system groups PASS. 213 tests pass together, the whole src/game type-checks, boundaries pass. Committed on play/greenhollow.
- 00:27 Stage 2 started as Workflow play-stage-2-join (run wf_a99c36d7-019): region (then a full play of the rules with every real system), world views (crops, stations, land dressing, festival lamps), interface views (title flow, panels, HUD, minimap, talking). The worktree again holds provisional copies of props, buildings, hud, map, input, dialogue and three content files (see its PROVISIONAL.txt): when props and map are committed on main, delete them and merge main.
- Known joins to check after stage 2: pets.bond for skipTo, time.onThunder to sound, the M key, a barrier block for stations, chests store nothing, Juniper's pale fringe, the mossling is hard to see on grass.
- Then: stage 3, a scripted play in the browser through window.__game plus the verify-greenhollow skill; stage 4, judged rounds; stop new work at 05:30.
- 00:30 Props, buildings and make-3d-asset finished (PASS). Reran type checks and 40 tests, looked at the contact sheet. 34 draw calls for 2,000 props. Committed and merged into the play branch. Verdict on the comparison: use the Fable set (more variants, better trees, instancing, wind, shadows); Astra's set is clean and stays under experiments/.
- 00:31 Shell finished (PASS, 34 smoke checks, no console errors). Type check passes. Looked at the turned-camera shot: world, hero sprite, an actor with a quest mark, the cutaway, water and dawn light all draw. Committed on play/greenhollow. Region, people and pets join by glob once region has an index.sim.ts. Note for the judged rounds: characters are small at the default zoom.
- 00:44 Map, HUD, input, dialogue finished (PASS). Reran type checks and tests. Committed. The base on main is complete: all wave 1 and wave 2 features are in.
- 01:39 Stage 2 finished: region, full play of the rules (279 game tests, plays new game to act.ended with fixes to four joins), world views, interface views, all PASS. 620 tests pass on the branch, type check and boundaries pass, production build is 1.08 MB (329 kB gzipped). Looked at the title, a conversation at the grant and the town: it reads as one game. Committed. Starting stage 3 and 4: browser play, then judged rounds.
