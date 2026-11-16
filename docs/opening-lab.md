# The opening lab

Kausthubh, 2026-11-11, on the film in the planning site's Opening tab: "this is just a mockup, I need an
actual good opening for this, and I want to experiment". He asked for the opening made several ways, side by
side, so he can see them and pick: every frame drawn by code; Sol's pictures animated; the scene built in the
game with 3D rooms, the game's people, a camera, effects and sound; and a mix, animated for the legend and
the game engine for the rest.

The lab is one page, `demos/opening`, on the branch `lab/opening`. It plays the same cut with the same sound
and swaps how the picture is made. It is a test: nothing here is in the game, and the pick is his.

## The film

The cut is the one he approved up to the doorstep: eleven shots, about 68 seconds, Hobb says every line
(`demos/opening/film.ts`, from handbook chapter 29). Part 0 is the legend as the Order's wall painting, eight
shots. Part 1 is you: the painting turns out to be a wall in a dark room, then the night you were left on
the guild's step, then the same step sixteen years on and the title.

The lab changes how the film is made. It does not change the shots, the lines or their order.

## The cuts

| `?cut=` | The legend (shots 1 to 8) | You (shots 9 to 11) |
|---|---|---|
| `plates` | The mockup: one painted picture a shot under a slow camera | The same |
| `drawn` | Code paints every frame. No picture files. | The same |
| `cutout` | Painted pieces from Sol, moved and lit like a cut-out film | The same |
| `engine` | The painting is a real wall in a 3D room of the hall. The camera walks along it by candle light. | The room, the guild's street in the rain, the same street in the morning, with the game's people |
| `mix-drawn` | `drawn` | `engine` |
| `mix-cutout` | `cutout` | `engine` |

In the `engine` cut the legend is not acted out with armies and beasts in 3D. The film's idea is that the
legend is a painting in the hall you grew up in, so the camera stays on that wall and the reveal of the room
needs no cut. Kausthubh was told this reading before the build.

## How it is cut up

```
demos/opening/
  types.ts        the contract: Film, Shot, FilmRenderer, Soundtrack, StageSet
  film.ts         the cut as data, timed to the spoken lines
  cuts.ts         which way draws each part, and how a way is loaded
  main.ts         the page: loads a cut's ways, stacks and fades their canvases, words, title, transport
  art/plates/     the mockup's eleven pictures
  plates/         the mockup's way
  drawn/          code-drawn
  cutout/         painted layers, with its art in cutout/art
  engine/         in the game, with engine/sets and engine/sprites
  sound/          Hobb's voice, the score, the effects
```

The rules every way keeps (they are also in `types.ts`):

1. **A frame is a function of film time.** `draw(t)` carries nothing over from the frame before and never
   calls `Math.random()`. The scrub bar jumps anywhere, and `?t=12` gives the same picture every time.
2. **Lengths come from the film.** A shot grows to fit its spoken line, so a way reads `shot.at`, `shot.len`
   and `shot.beats` and writes every move as a share of the shot. A beat is a moment the picture and the
   sound both hit (the camera stops on the scraped place, each point of the Mark lights).
3. **A way draws no words.** The page sets Hobb's line and the title.
4. **A way draws on its own canvas.** The page stacks them and fades one way into the next over one second.
   Past its last shot a way keeps its last picture moving for that second.
5. **A mix matches at the seam.** A legend way gives a still of each panel (`panel(id)`), and the engine
   paints those on the hall's wall, so the wall in the dark room is the film the player just watched.
6. **Speed.** The engine way stays under the game's budget at high: 150 draw calls, 400,000 triangles
   (`stats()`). The lab does not ask for four graphics levels; that comes if he picks the engine.

The sound is one track for every cut: Hobb's voice in three takes (`?voice=a|b|c`) made ahead of time with
ElevenLabs, a score made by code, and recorded effects made by a tool from written prompts. It is scheduled
from film time, so it seeks.

## Who builds what

Each helper works in its own worktree on its own branch, cut from `lab/opening`, and writes only in its
folder. Nobody pushes. The coordinator merges into `lab/opening`.

| Slice | Folder it owns | Who | Branch | Needs |
|---|---|---|---|---|
| The contract, the cut, the first page | `types.ts`, `film.ts`, `cuts.ts`, `placeholder.ts`, `art/` | Coordinator | `lab/opening` | |
| The lab page and the mockup's way | `main.ts`, `index.html`, `page/`, `plates/` | Opus | `lab/opening-page` | |
| The sound | `sound/` | Opus | `lab/opening-sound` | |
| Drawn by code | `drawn/` | Opus | `lab/opening-drawn` | |
| Layers: war, king, friends, roads | `cutout/art/<shot>/` for those four | Sol | `lab/opening-art-a` | |
| Layers: sickness, night, gods, mark | `cutout/art/<shot>/` for those four | Sol | `lab/opening-art-b` | |
| Layers: wall, doorstep, morning | `cutout/art/<shot>/` for those three | Sol | `lab/opening-art-you` | |
| The cut-out film | `cutout/` but not `cutout/art` | Opus | `lab/opening-cutout` | all the layers |
| The 3D sets | `engine/sets/`, `sets.html` | Fable 5.2 | `lab/opening-sets` | |
| The people | `engine/sprites/` | Sol | `lab/opening-sprites` | |
| The film in the game | `engine/` but not `sets` or `sprites` | Opus | `lab/opening-engine` | the sets, the people |
| Testing every cut | `docs/bugs/`, `tools/opening-check.mjs` | Sol | `lab/opening-test` | everything merged |

## How a helper works here

1. Your checkout starts on `main`. Run `git switch -c <your branch> lab/opening`, then `bun tools/doctor.mjs --quick`,
   and use the port it prints. Read this file and `demos/opening/types.ts` before anything else.
2. The page: `bun tools/demo.mjs dev opening <port>` (it prints its pid; stop it by that pid when you are done).
   `http://127.0.0.1:<port>/?cut=drawn&shot=friends&p=0.8&panel=0` holds one moment of one cut. `main.ts` lists
   the rest of the address. `bun tools/shot.mjs <url> <out.png> --w 1920 --h 1080` takes the picture and exits 1
   on a console error.
3. Write only in the folder the table gives you. If the contract lacks something, add what you need inside
   your folder and say so in your report. Other helpers are changing the other folders at the same time.
4. Commit on your branch as you go, one commit a slice that works. Never push, never merge, never touch
   `main`: a push to `main` goes live.
5. Look at your own pictures. Put them in `.artifacts/opening/<slice>/` and open them. A picture you have not
   looked at is not checked. Nobody here can hear: check sound by measuring it and by transcribing speech back.
6. Check motion by filming it, the way the `playtest-game` skill says (Kausthubh asked for this). The play
   tool opens a file, so point it at your dev server through one:
   `printf '<script>location.replace("http://127.0.0.1:<port>/?cut=drawn&shot=friends&p=0")</script>' > .artifacts/opening/open.html`,
   then `bun tools/play.mjs start --page .artifacts/opening/open.html --size 1280x720`, then
   `bun tools/play.mjs film '[{"type":"press","key":" "},{"type":"wait","ms":6000}]' friends --fps 6` and
   `bun tools/play.mjs stop`. It records every frame Chrome draws, writes a sheet, and lists flickers and
   jumps. Open the sheet and the frames it marks. Look for what the skill's "Does it move right?" row names:
   a flicker, a slide with no walk, a snap of the camera, a stutter, a pop. A jump at a cut is expected;
   a jump inside a shot is a bug.
7. Before you report: `bun tools/typecheck.mjs opening` and `bunx biome lint demos/opening` pass.
8. Report PASS, ISSUES or BLOCKED; your branch and its last commit; the commands you ran and what they
   printed; the paths of your pictures; what you did not check. A question you cannot settle: pick a default,
   say so, keep going. Kausthubh's taste calls wait for him and are listed at the end of this file.

Never report a frame rate from this Mac (AGENTS.md rule 7). Report draw calls, triangles and the
milliseconds one `draw()` takes.

## Done

- Every cut plays start to end with no console error: `bun tools/shot.mjs` at five times a cut exits 0.
- `bun tools/typecheck.mjs opening` and `bun run lint` pass. `bun run check` still passes.
- Two shots of the same `?t=` are the same picture.
- The picture's beats land with the sound's: the Mark's six lights, the stop on the scraped place, the title.
- The engine's `stats()` is under 150 draw calls and 400,000 triangles in every shot.
- Kausthubh can open each cut from a link and switch between them on the page.

## What is his to decide

- Which way the game's opening is made, or which mix.
- Hobb's voice, from the three takes.
- Whether the engine's legend should be acted out in 3D after all.
