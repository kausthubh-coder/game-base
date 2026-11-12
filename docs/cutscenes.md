# Cutscenes

Kausthubh read the act 1 playthrough on 2026-11-11 and said some scenes need a cutscene, "like in scene 9",
and that he wants to see an experiment with cutscenes and animated scenes. This page is the design, the
first scene to build, and the order of work. The scenes and their lines are the handbook chapter
`~/dev/sandbox/game-look-test/design/22-scenes-and-script.md`.

## The experiment copy

| What | Where |
|---|---|
| Branch | `experiment`, cut from `playtest` (7ca6e8a). Helpers branch from it as `cut/<name>`. The coordinator merges. |
| Address | `/experiment/` of a built copy served from this Mac over Tailscale. It is not on the live site. |
| Save | `greenhollow.experiment.save`, so it never opens the playtest's or the game's save |
| Straight to a scene | `?scene=9` starts a new game at the camp at dusk and plays scene 9 |
| One moment, held | `?scene=9&cut-at=<seconds>` holds the scene at that time, for pictures and checks |

Nothing here goes to `main` or to `playtest` until Kausthubh has watched it and said yes.

## Three kinds of scene

A scene in the script is one of three kinds. The kind says who has the camera and who has the keys.

| Kind | Camera | Keys | The words | Use it when |
|---|---|---|---|---|
| Film | The scene's own shots, with bars top and bottom | Skip only | Under the picture, timed | Something happens that nobody says: a door moves, a road lights, a fox walks out of the dark |
| Staged | The game's camera, moved to frame the people | The player turns the lines | The dialogue box | People talk and also do something: hand over a glove, turn a key |
| Talk | The game's camera, as in play | The player turns the lines | The dialogue box | People only talk |

The coordinator's proposal for the 38 scenes. Kausthubh decides.

| Kind | Scenes |
|---|---|
| Film | 6 the quay, 7 ground nobody wanted, 9 something outside, 10 the door (its last beat), 11 the Mark, 13 the fox, 16 the blessing (her arrival), 23 the road is lit, 24 the first Echo, 26 the pails, 27 the pumps go quiet, 28 eight chairs, 29 the Stag's nose, 31 Bramble (after the fight), 32 three keystones, 33 the Stag (before and after), 34 green overnight, 35 the dream, 37 "She was kinder, before." |
| Staged | 1 Grant day, 2 the last lock, 4 the rack, 5 the grant, 8 the door by day, 12 "You're late.", 14 the Heartstone, 15 the morning after, 18 Hobb and Dax, 19 in the field at night, 20 the grey wood, 21 not yet, 25 Calla's seal, 30 a hamlet, 36 the second blessing, 38 leaving |
| Talk | 3 the map wall, 17 what the Custodian thinks, 22 the queen's count |

This experiment builds the film kind, with scene 9. Staged scenes come next and reuse the same director.

## How a film works

A film is data in `src/game/content/cutscenes.ts`. One director plays any of them. Adding scene 10 adds an
entry and changes no other code.

1. **The rules say when.** A film names the flag that starts it. Scene 9 starts when `night.fox` is first
   set in play. It never starts from a loaded save that already has the flag. The director sets the film's
   own flag (`cut.<id>`) as it starts, so a film plays once in a save.
2. **The rules stand still while it plays.** The director pauses the simulation, marks the player busy,
   takes every key and hides the HUD, as the opening does (`src/game/views/story-opening.view.ts`).
3. **Every frame comes from the film's time alone.** A pure function takes the film and a time in seconds
   and returns the whole frame: the lens, each actor's place, facing and animation, the fire's light, the
   black, the bars, the words, and the sounds that have started. It uses no three.js and no page, so
   `bun test` checks any moment and `?cut-at=` holds any moment.
4. **Actors in a film are puppets.** The director draws the hero, the fox and the fire from the frame. It
   does not step them through the rules. A puppet that is also an actor in the rules (the hero, the fox)
   is hidden in its rule-drawn form while the film plays.
5. **The end is the same watched or skipped.** A film names where everyone stands when play resumes
   (`land`). The director puts the player there under black at the start, so Esc at any moment leaves the
   same world. The last shot eases into the game's own camera, as the opening's last shot does.
6. **Places, not coordinates.** Every point in a film is blocks east, up and south of a named place of the
   region, as in `src/game/content/opening.ts`.
7. **Speed.** The film allocates nothing per frame, stays inside the draw budgets of `AGENTS.md` rule 6
   at every graphics level, and reads any quality value from `src/content/quality.ts`. With reduced
   motion on, each shot holds one still.

The opening scene keeps its own player for now. Moving it onto the director is a later, separate change.

## Scene 9, "Something outside"

The script: *Dusk. Your fire is lit and your tent is up. The fox walks out of the trees. The fire is low.
Something is standing at the edge of the light.*

What it has to do: the last calm minute before the story starts. The player is alone for the first time in
their life, it is getting dark, and the thing that walks out of the trees is thin and shaking, not a
monster. Nobody speaks. About 25 seconds.

| # | Shot | Seconds | The picture | Sound |
|---|---|---|---|---|
| 1 | Dusk | 5 | High and wide from the south-east. The plot, small. One fire, one tent, the hill and the stone door dark behind them. The lens pushes in slowly. Fades up from black. | Crickets, the fire, a little wind |
| 2 | The fire | 4.5 | Low and close. Flames in front, the hero sitting beyond them, lit warm, sparks going up. The hero prods the fire. | The fire close. At 3.4 s the crickets stop. |
| 3 | Listening | 3 | Closer on the hero. A twig snaps. The head comes up and turns away from the fire. The fire sinks: its light drops by a third. | Twig snap on the cut. Then only the fire. |
| 4 | The trees | 5.5 | Over the hero's shoulder, toward the black tree line. Slow push. A grey shape comes out between two trunks, head low, and stops where the firelight ends. It shakes. | A low held note swells from nothing |
| 5 | The edge of the light | 4.5 | Low, from the side. The hero stands up on the left by the fire, the fox on the right at the edge of the light, dark between them. The words come up. | The note holds. The fire pops once. |
| 6 | Back to play | 2 | The lens eases to the game's own camera over the hero. The bars leave. | The night comes back, quieter than before |

The words, once, under shot 5: "The fire is low. Something is standing at the edge of the light."

After it: the hero stands by the fire facing the fox, the fox stands at the edge of the light, and the
night goes on as it does on `playtest` (the step `door` of the quest `night`): the fox follows, slower than
the player, to the stone door.

### The camp

The camp is new. It is in the south half of the plot, so the stone door is behind the player when they
back away from the fox, and the fox comes from the south or the west, out of trees.

| Region place | What |
|---|---|
| `camp` | The fire. Every offset in scene 9 starts here. |
| `camp.seat` | Where the hero sits, and stands when play resumes |
| `camp.edge` | Where the fox stops: the edge of the firelight, 6 to 7 blocks from the fire |
| `camp.trees` | Where the fox comes out, 12 to 16 blocks from the fire |

When the place `camp` exists and the fox comes, the hall's rules stand the fox at `camp.edge`, so the film
and the rules agree. Without the place they do what they do today.

## Names the helpers share

Three helpers build at once and meet only through these names. The builder writes the film against them and
falls back when one is missing, so the film runs before the art lands.

| Kind | Name | What | Made by | Fallback until it lands |
|---|---|---|---|---|
| Prop | `campfire`, variants `lit`, `low`, `cold` | A ring of stones, crossed logs, a flame. `lit` gives light 12, `low` 8, `cold` 0. | Fable | The `brazier` |
| Prop | `tent`, variant `canvas` | A ward's small A-frame tent, open at one end, a bedroll inside | Fable | The `bed` |
| Effect | `ember` | Sparks that rise from the fire and go out | Fable | `firefly` |
| Effect | `campsmoke` | Thin smoke above the flame | Fable | None |
| Sprite | `hero-camp`, animations `sit`, `look`, `rise` | The hero sitting by a fire (2 frames), sitting with the head up and turned (2), standing up (4, ending in the `idle` stance). Rows `front`, `back`, `side`. Frame 128 by 128, anchor 64, 120, the same kid as `hero`. | Sol | `hero` `idle` |
| Sprite | `fox-blighted`, new animations `stalk`, `shake` | The grey fox walking slow with its head low (4 frames), and standing, trembling (2). Rows `front`, `back`, `side`. The frame, anchor and height it has today. | Sol | `walk`, `idle` |

Sound is made by code (rule 4 of `AGENTS.md`). This Mac has no ElevenLabs key, so the film uses the sound
engine and the recorded beds the game already ships: the crickets, the fire, the twig, the held note.

## Order of work

| Step | Who | Branch | Done when |
|---|---|---|---|
| 1. The director, scene 9's film, the camp's places, the experiment copy's entry | Opus | `cut/director` | `bun run check` and `bun run lint` pass, a test checks moments of scene 9 from the pure function, a test plays the night from the film's end, and pictures of each shot are in `.artifacts/cutscene/` |
| 1. Campfire, tent, embers, smoke | Fable | `cut/camp-props` | `bun test src/features/props` passes, the budgets hold, pictures from four sides |
| 1. Hero by the fire, the fox's two new animations | Sol | `cut/camp-sprites` | `bun tools/verify-assets.mjs` passes and a contact sheet shows the same kid |
| 2. Merge the three, swap the fallbacks for the art | Coordinator | `experiment` | `bun run verify` passes |
| 3. Play it like a person: watch, skip, hold moments, low graphics, a narrow window, the night after it | Sol | `cut/test` | Bugs are in `docs/bugs/`, with a picture each |
| 4. Fix, build, serve at `/experiment/` | Coordinator | `experiment` | Kausthubh has the link |

## Decisions for Kausthubh

- Which scenes are films. The table above is a proposal.
- Whether a film may be skipped on the first watch. The experiment allows it.
- Whether the words of a film are read aloud. Nobody speaks in scene 9.

## What is built

On `cut/director`. The art helpers' props and effects are not merged yet, so the brazier, the bed and
fireflies stand in for them; their names are looked for when the game runs.

| Part | File |
|---|---|
| The film format and scene 9 | `src/game/content/cutscenes.ts` |
| The frame as a pure function, its clock and skip, the rule for when a film starts | `src/game/uiview/cutscene.ts`, tested in `cutscene.test.ts` |
| The director | `src/game/views/story-cutscene.view.ts` |
| The camp: fire, tent, firelight on the ground, sparks, smoke, the fire's sound | `src/game/views/world-camp.view.ts`, `src/game/worldview/camp.ts` |
| The film's sound, made by code | `src/game/uiview/film-sound.ts` |
| The experiment badge and its button | `src/game/views/ui-experiment.view.ts`, `src/game/uiview/cutscene-stage.ts` |
| The experiment save, `greenhollow.experiment.save` | `src/game/shell/save.ts` |
| The camp's places, and the fox standing at `camp.edge` | `src/game/content/region.ts`, `src/game/hall/index.sim.ts` |
| Six pictures, one a shot, with their draw costs | `bun tools/film-shots.mjs` (`--quality low` for low) |
| Watch, walk, reload, and Esc at 3 s and 15 s, in Chrome with real keys | `bun tools/film-check.mjs` |

Choices made while building it, for Kausthubh to overrule:

- **The hour.** The film runs from 0.782 to 0.798, just as the sun goes (0.785 in the sky's table). At the
  first plan's 0.752 the land was still lit gold and the fire did not show.
- **Shot 4 is the hero's eye line**, from just behind and over their head with a long lens that follows the
  fox in, not over the shoulder. Over the shoulder, the pixel-art head filled a third of the frame and the
  fox was a speck in the grass.
- **`camp.edge` moved a block**, to 5 west and 4 south of the fire (still 6.4 blocks from it), so the fox
  stops clear of a tall tuft of the painted grass.
- **Each drawing of a puppet comes from the film's time** too: a walk from the ground covered, the rest
  from the seconds since its pose began. A held moment always shows the same drawing.
- **The badge's button** sets up the first night at the camp and lets the rules start the film, the same
  way play does. In a game where the fox has already come it plays the film as it stands; the rules carry
  on from where they were.
- **The film takes the quest's beam of light and the Almanac's card off the screen** while it plays.
