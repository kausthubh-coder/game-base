# Building this game with agents

The goal: an agent can start a worktree, play the game, find a bug, fix it, and prove the fix, without
Kausthubh setting anything up. This page lists what the repo has today, what is missing, and the order to
build it in. The second half answers what the game runs on and where Vercel, Clerk and Convex fit.

Written 2026-11-11 from `world/painted`, the newest copy of the game.

## What the repo has today

| Part | Where | What it does |
|---|---|---|
| The debug door | `src/game/shell/door.ts`, `window.__game` | Reads the game's state as plain data. Steps the clock without drawing. Teleports, gives items, presses keys, clicks blocks, talks through a conversation, skips to a quest. |
| Play scripts | `tools/play-smoke.mjs`, `play-act1.mjs`, `play-build.mjs` and 6 more | Build the game, open it in headless Chrome, play through the door, fail on a console error. |
| Rules that run without a page | 65 `.sim.ts` files, `bun run boundaries` | The rules never touch Three.js or the page. `createKernel(world, seed)` takes a seed, so the same seed plays the same game. |
| Tests | 65 test files, `bun run check` | Type check, the `.sim.ts` rule, the tests. |
| Asset checks | `bun tools/verify-assets.mjs`, the `make-sprite` and `make-3d-asset` skills | Check every sprite, tile, prop and voice clip against the asset contract. |
| One formal model | `docs/verify/build-stroke` | A TLA+ model of the build stroke, with a skill that reruns it. |

## What is missing

1. **No trunk.** `main` is 64 commits behind `world/painted`. The repo has 56 branches and 49 worktrees. A new
   thread starts from `main`, so it builds on a game that is two days old.
2. **No remote.** `git remote -v` prints nothing. The repo exists only on the Mac mini. The laptop cannot
   check it and nothing backs it up.
3. **A new worktree cannot run.** It has no `node_modules` and no `.env.local`. Each agent works that out again.
4. **Ports are picked by hand.** The table in `AGENTS.md` has 8 ports and there are 49 worktrees.
5. **Every tool asks Chrome for software drawing.** The scripts pass `--use-angle=swiftshader`. Without that
   flag, headless Chrome on this Mac reports `ANGLE Metal Renderer: Apple M4`. So rule 7 in `AGENTS.md`
   ("this Mac draws WebGL in software") describes the flags, not the machine. The game's frame time on Metal
   is not measured yet.
6. **Fast play covers act 1 only.** `src/game/play` plays act 1 through the real rules in about two seconds,
   with no browser. It has no bots, no replays from a seed, and no scenario beyond act 1.
7. **No play like a person.** The door teleports and skips. No script walks with the keys, clicks the real
   buttons and gets stuck where a player would.
8. **No regression list.** A fixed bug leaves no test behind. No shot is compared with an approved one. No
   check fails when draw calls, triangles or the build size pass the budget.
9. **59 scripts in `tools/`.** About 40 of them take screenshots of one scene each. An agent cannot tell which
   one to run.
10. **No formatter, no lint, no CI.** `bun run check` runs only when an agent remembers it.
11. **No `verify-game`, `worktree-game` or `ship-game` skill.** The global rules expect all three.

## Build order

Each step makes the next one cheaper. Steps 1 to 3 are a day of work and remove most of the waste.

### 1. One trunk, one remote

- Merge `world/painted` into `main`. Kausthubh picks the branch, since it also picks the look.
- Push to a private GitHub repo.
- Rule: a branch lives for one task and merges back within a day or two. A look test that will not merge
  stays behind a URL flag on `main` (`?style=`, `?ui=`) and not on a branch.
- Delete the merged and dead branches and their worktrees.

### 2. A worktree that runs after one command

`bun tools/doctor.mjs` checks and repairs, then prints one line per item:

- `node_modules` is present. If not, it links the main checkout's copy or runs `bun install`.
- `.env.local` is present. If not, it copies it from the main checkout.
- Chrome is at the expected path and gives a GPU renderer.
- The port. The script derives one from the worktree's name, in 5400 to 5999, and checks it is free.
  `PLAY_PORT` already moves the play scripts.
- `bun run check` passes on a clean tree.

The `worktree-game` skill is three lines: run the doctor, read its output, use the port it printed.

### 3. Chrome on the GPU

- Take the swiftshader flags out of `tools/shot.mjs` and the play scripts. Keep them behind `--software`.
- Measure the game's frame time both ways with the `benchmark-checklist` skill.
- Rewrite rule 7. A frame rate from the M4 still says nothing about a Chromebook, so the rule keeps that part.

If the game draws at full speed here, a play script finishes in seconds and step 5 can run on the Mac.

### 4. Fast play: the rules without a page

`src/game/play/harness.sim.ts` already builds a kernel with every system and steps it in Bun, with no
browser and no drawing. `bun tools/sim.ts` wraps that harness and adds the three parts below.

- **Scenarios.** A scenario is a short script in `src/game/scenarios/`: a seed, a list of inputs, and what
  must be true at the end. "Plant wheat, sleep three nights, harvest, the bag holds wheat."
- **Bots.** A bot presses random valid inputs for 100,000 steps under a seed. After each step it checks rules
  that must always hold: the hero's position is a number and above the world's floor, no bag count is below
  zero, every started quest can still finish, no system threw.
- **Replays.** A failure prints its seed and step. `bun tools/sim.ts --replay <seed> --until <step>` plays
  the same game to the step before the failure.

This is the cheapest way to find rule bugs.

### 5. Play in the browser: one tool, two modes

`bun tools/play.mjs` keeps one Chrome open per worktree and takes commands, so an agent plays in a loop:
send a command, read the state as JSON, look at a screenshot.

| Mode | How it plays | What it finds |
|---|---|---|
| `door` | Calls `window.__game`: teleport, give, skip to a quest, step the clock | Whether a feature works, fast. It can reach any point of the game in one call. |
| `human` | Sends only real key and mouse events. It reads `state()` to check, and never writes through the door. | What a player hits: a fence that traps the hero, a prompt that never shows, a button under another panel. |

Both modes record the inputs they sent. A recording replays as a test.

The nine `play-*.mjs` scripts become scenarios for this tool.

### 6. Regressions: `bun run verify`

One command, and the `verify-game` skill that says which part to run for which change:

- `bun run check`.
- Every scenario from step 4.
- The play scenarios from step 5, in door mode.
- Approved shots. Fixed camera, fixed time of day, fixed seed. The tool compares each shot with the approved
  copy in `docs/shots/approved/` and fails over a set difference. `--approve` replaces the copy, and the
  commit shows the old and new picture.
- Budgets. `window.__game.counters()` gives draw calls and triangles for each approved shot. The build gives
  the script size. The check fails over the numbers in `AGENTS.md` rule 6.

Two rules for agents:

1. A bug fix starts with a scenario or a replay that fails. The fix makes it pass. The scenario stays.
2. `bun run verify` passes before and after. GitHub Actions runs it on every push.

### 7. A playtester that runs at night

A scheduled thread on the Mac:

1. Runs the bots for an hour with new seeds.
2. Plays act 1 in human mode.
3. Writes each finding to `docs/bugs/<date>-<name>.md`: what happened, the seed or the recording, a screenshot.

A fix thread takes one file, in its own worktree, and follows the two rules in step 6.

### 8. Assets

The skills and `verify-assets` stay. Three additions:

- One shots tool. `bun tools/shots.mjs <scene>` reads scenes from a data file: the URL flags, the camera, the
  time of day. It replaces about 40 scripts.
- One asset page. `/?show=asset:<name>` puts one asset on a turntable with its triangle count and its size
  beside a 1.8 m person.
- The bake step and far versions from `docs/fast-everywhere.md` on `test/asset-routes`.

Dot keeps Blender. Agents here make code-built props and sprites.

### 9. Code that agents read well

- Add Biome for format and lint. It is one dev dependency.
- Keep `AGENTS.md` short. Put each folder's rules in a `README.md` or `AGENTS.md` in that folder, as
  `src/game/shell` and `src/game/actions` already do.
- When Kausthubh corrects the same mistake twice, the `correct` skill turns it into a lint rule or a test.
  `bun run boundaries` is the model for this.
- Add the `ship-game` skill once the game deploys (see below).

### 10. From pstack

pstack is Lauren Tan's skill set for Cursor ([cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack),
with a port for Claude Code at [michael-denyer/pstack-claude](https://github.com/michael-denyer/pstack-claude)).
The global skill library already holds about half of it: `correct`, `create-verification-skill`,
`maintain-verification-skill`, `create-formal-verification-skill`, `statechart`, `benchmark-checklist`,
`sharpen`, `bro`, `in-your-own-words`, `no-comments`, `unslop` and three `principle-` skills.

pstack has no doctor. Its ideas that this repo lacks are:

- `tdd` and its bug-fix playbook: reproduce, find the cause, fix, rerun the failing case. Step 6 rule 1.
- `blast-radius`: before a change, list what else it can break. For this repo, the list is which scenarios
  and shots a folder touches, and `verify-game` holds it.
- `fix-ci` and `babysit`: useful once step 6 puts checks on GitHub.
- `interrogate`: a second agent reviews the change before it merges.

## Iterating on content

Content here means assets, regions, fights, bosses, what people and creatures do, and the story. Regions,
quests, dialogue, people and creatures are already data in `src/game/content`. Fights and bosses do not
exist in code yet, so they start as data too.

### Three levels, cheapest first

Review each piece at the cheapest level that can answer the question.

| Level | What it is | Time to make | The question it answers |
|---|---|---|---|
| Plan | A picture drawn from the data alone: a map, a timeline, a graph. No 3D. | Seconds | Is this the right idea? |
| Grey box | The piece in the game with plain blocks and stand-in shapes | Minutes | Does it play well? |
| Final | The real art, sound and voice | Hours | Does it look and sound right? |

Art starts only after the grey box plays well. A boss that is dull as grey shapes stays dull with art.

### One view and one check for each kind

| Kind | Data | What Kausthubh looks at | What the agent checks |
|---|---|---|---|
| Asset | `manifest.json`, builders | A sheet of every asset, and one asset on a turntable beside a 1.8 m person | `verify-assets`: palette, scale, triangles, size. An agent compares the sheet with `docs/style-sheet.md`. |
| Region | `content/region.ts` | A top-down map drawn from the plan, with places, paths and spawn. Then a fixed fly-through. | Every place can be reached on foot from spawn. No building overlaps another. The region's draw calls and triangles fit the budget. |
| Fight | New: one entry per creature, with its attacks, their warning shapes and timings | An arena at `?scene=arena&enemy=<id>` with one enemy. A table of each enemy's numbers. | A bot fights it 1,000 times without a browser. The report gives how often the bot wins, how long the fight takes and how much health is left, for a careless bot and a careful one. Every attack warns for at least its set time. |
| Boss | New: phases, and the attacks in each | A timeline of each phase: which attack, when, where it lands. The arena. | The same bots. Each phase can be reached and passed. The fight lasts 5 to 8 minutes for the careful bot, as `07-combat.md` asks. No attack is impossible to dodge. |
| People and creatures | `content/people.ts`, `creatures.ts` | One game day in ten seconds: each person's path on the region map, and a chart of who is where at each hour | Nobody stays stuck. Everybody reaches each stop on time. No two people stand on one block. |
| Story | `content/quests.ts`, `dialogue.ts` | A graph of quests, steps and the flags between them. Each line of dialogue under the step that says it. | Every flag a condition reads is set somewhere. Every quest can start and end. Every item a step needs can be found. Every line can be reached, and has a voice clip. Then `src/game/play` plays it through. |

Each check is one command that prints pass or fail with the reason, so `bun run verify` can run them all.

### The workbench

The workbench is the handbook app (`~/dev/sandbox/game-look-test/handbook`, port 5361), with two parts
added. That app already reads this repo's files, shows characters, props and models on a turntable, voice
lines and every picture, and redraws when a file changes. Do not build a second page.

- **Content views.** A region's map, the people's day, the story graph and the fight tables, drawn from the
  data on `main`. Saving a content file redraws the view.
- **Changes.** One card for each branch that is ahead of `main`: the kind of content it touched, the view
  before and after, the checks that ran and their results, and a link that opens the game at that spot.

An agent ends a content task by writing its card to `.artifacts/changes/<branch>.json`. The workbench reads
those files. A card with a failed check shows red, and its branch does not merge.

### Audits

A check answers one fixed question. An audit looks for what nobody asked.

- **Data audits** are scripts. They run in `bun run verify`: the story graph, item sources, people's days,
  region reach, budgets.
- **Judgement audits** are a second agent with no part in the work. It gets the views, the shots and one
  page of rules (`docs/style-sheet.md` for assets, `07-combat.md` for fights, `04-story.md` for the story)
  and writes what breaks them to `docs/audits/<date>.md`.
- The night playtester from step 7 plays the new content in human mode and adds what it finds.

### Order

1. The story graph, the people's day and the region map. Their data exists today, so these need no new
   game code.
2. The workbench page with those three views and the change cards.
3. The fight data, the arena and the fight bots, before any fight art.

## What the game runs on

| Layer | Today |
|---|---|
| Language | TypeScript 7 |
| Drawing | Three.js 0.187, WebGL2 |
| Build | Vite 8 |
| Runtime for tools and tests | Bun |
| Checks | Playwright with Chrome for shots and play scripts, `sharp` for images |
| Models | Code builders, and `.glb` files built by Blender scripts |
| Voice | ElevenLabs clips made ahead of time by `tools/voice.ts` |
| Server, accounts, deploy | None. The save is in the browser. |

## Vercel, Clerk and Convex

All three fit. A fourth part is needed for live play. The section after this one compares Vercel with
Cloudflare for hosting and recommends Cloudflare, where a Durable Object can also be the room server.

| Service | Use it for | Do not use it for |
|---|---|---|
| Vercel | Hosting the build. A preview URL for every branch, which also gives agents and the laptop a link to test. Asset files with a hash in the name and a long cache life. | The live room. Vercel Functions hold WebSockets, but Vercel's docs say a reconnect can land on another instance and rooms must never live in memory. |
| Clerk | Accounts and sign-in. The game has no React, so it uses Clerk's plain JavaScript SDK. Play as a guest first, sign in to keep the save. | |
| Convex | Everything stored: the save, the kingdom, the bag, friends, the list of open worlds, chat, a world's block edits. It checks Clerk's token. Its queries push changes to every open client. | The hero's movement. Each update would be a stored transaction. A room of players sends about 20 a second each. |
| A room server (new) | Live play. A small Bun server runs the `.sim.ts` rules 20 times a second for one world. Clients send inputs. It loads the world from Convex and saves it back. | |

Order:

1. **Vercel.** Deploy `main`. This is also what `ship-game` wraps.
2. **Clerk and Convex.** Cloud saves. The same game on the Chromebook and the laptop.
3. **Visit a kingdom.** A friend's world loads from Convex, read only or with slow edits. Convex alone carries
   this, with no room server.
4. **Live rooms.** The Bun room server, after step 4 of the build order proves the rules run without a page.

`docs/fast-everywhere.md` already plans step 4 this way. Steps 2 and 3 are new.

Adding Convex, Clerk and Biome adds dependencies. Rule 8 says to name them first, so this page does.

## Vercel or Cloudflare for hosting

Checked on 2026-11-11 against each host's own docs. The recommendation is Cloudflare for the game's files
and for live rooms. Vercel works for testing with friends.

| | Vercel Hobby (free) | Cloudflare Workers Free |
|---|---|---|
| Data sent to players | 100 GB a month | No limit, no charge |
| File requests | 1,000,000 a month | Static files are free and not counted |
| Over the limit | The project pauses for up to 30 days | Does not apply to static files |
| A game that earns money | Not allowed. Needs Pro, $20 a month. | Allowed |
| Live rooms | No. A room cannot live in a function's memory. | Durable Objects: one object per world, on the free plan |
| File limits | | 20,000 files, 25 MiB each |

What that means for this game, as an estimate from the file sizes in git on `world/painted` (7.4 MB of
voice in 149 files, 3.2 MB of models in 53 files, 1.5 MB of sprites and textures, a 1.3 MB script):

- A player who downloads everything takes about 13 MB and about 250 requests.
- Vercel's free plan then covers about 4,000 such players a month. Requests run out before data does.
- Returning players cost almost nothing on either host once file names carry a hash.

Durable Objects on the free plan allow 100,000 requests and 13,000 GB-seconds a day. Cloudflare counts 20
incoming WebSocket messages as one request and bills 128 MB while a room is awake. That is about 28 hours of
awake rooms and about 27 hours of players sending inputs each day. Enough to test with friends. The paid
Workers plan lifts both.

A Durable Object runs the Workers runtime, not Bun. The `.sim.ts` rule already keeps the rules free of
Bun, page and Three.js calls, so the same files run there. Step 4 of the build order proves it first.

Sources: [Vercel Hobby plan](https://vercel.com/docs/plans/hobby),
[Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines),
[Workers static assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Three.js

Three.js stays. It is code only, so agents can write and check all of it, and the game already has 13
shader files, instanced props and a mesher worker built on it. It is a drawing library and not an engine, so
the game supplies the rest. These parts are missing on `world/painted`:

| Missing | Why it matters | Found by |
|---|---|---|
| Shader warm-up with `renderer.compileAsync` before a region shows | The first sight of a new material stalls a frame on a weak GPU | No file calls it |
| Far versions of models | The low tier's budget is 150,000 triangles | No file uses `LOD` |
| `BatchedMesh` for static props of many kinds | One draw call for many kinds. The low tier's budget is 80 draw calls. | No file uses it. 10 files use `InstancedMesh`. |
| Meshopt-packed `.glb` files and KTX2 painted textures | Smaller downloads and less GPU memory on a 4 GB Chromebook. Pixel-art sprites stay PNG. | No file loads either |
| Cost by feature | `counters()` gives totals. An agent needs draw calls and triangles for each feature to know what to cut. | `renderer.info` is read in 4 files |

WebGPU waits. Three.js has a WebGPU renderer, but moving to it means rewriting the 13 `ShaderMaterial`
files and 7 `onBeforeCompile` patches, and nothing measured says the Chromebook needs it.
