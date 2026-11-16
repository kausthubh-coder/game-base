# Scene 9 player test — ISSUES

Tested experiment commit `57cff589df688013359bdfaa556b7ba665a1f6b5`, served by the coordinator at `http://127.0.0.1:5410/experiment/`. Test branch: `cut/test`. The report commit is the tip of that branch. No game code changed.

## Findings, worst first

1. P1: portrait framing loses the hero and fox, including both subjects of shot 5. [Bug](2026-11-11-scene9-portrait.md). Three independent reproductions failed the projection check.
2. P2: foreground grass covers the fox's face during its entrance. [Bug](2026-11-11-scene9-fox-grass.md). Seen in continuous normal play, continuous reduced-motion play, and the held shot pass.
3. P2: reduced motion holds the camera but keeps the fox and ambient effects moving. [Bug](2026-11-11-scene9-reduced-motion.md). This conflicts with the written still-per-shot design; clarify that design if only a still lens was intended.

## Coverage

| Area | What was played and observed |
|---|---|
| 1. Full film | Started from the title's experiment button at 1280 by 720 with an active audio engine. Watched sampled continuous playback and reviewed the builder's six held shots. The fire, tent, listening turn, fox entrance, two-character shot, subtitle and return to play all appear. Visual detail below. |
| 2. Skip | Esc and real mouse clicks on Skip at 0.3, 3, 15 and 24 seconds. Control returned each time; hero position/facing and quest step matched the watched ending. The final independent skip pass also waited for the real fox to spawn and verified the hero, fox presence and door quest after all eight skips; raw state records the same fox landing position each time. Late Skip clicks used the current button coordinates because Playwright's stability wait follows the moving letterbox until it disappears. |
| 3. Natural entry | New game, skip the opening with Esc, use the permitted quest/time/place setup to reach night before dusk, then real keys. At the camp dusk starts the film. Inputs do not restart it. At the grant stone, outside the film's camp radius, dusk brings the fox and advances the quest without showing the film or teleporting the player to camp. The title button is also exercised separately. Did not build a roof from scratch or test the bed-trigger alternative. |
| 4. Night afterward | Walked with real held WASD keys from camp to the stone door. The fox follows. Enter advances the door scene; the door opens. Walked in, received the Mark and lights, turned the key with E, woke the Custodian, returned to the fox, calmed it with E, and watched it leave. Touched the Heartstone with E and advanced its lines. Waited in the running world until dawn: day 2, night.over true, and the tracker changed to Show Tamsin your hand. No film replay during this progression. |
| 5. Inputs | During the film pressed B, M, I, Q, E, Space, 1 and Tab, clicked the world, scrolled, and held W across the ending. No panel appeared, hero stayed at the landing position, and camera rotation/zoom did not change. Immediately afterward M opened the map, Esc closed it, B opened the bag, Esc closed it, and walking worked. Releasing the key held during the film left no stuck movement. |
| 6. Variants | Six held shots each at low graphics, 390 by 844, and reduced motion. A separate continuous reduced-motion run confirmed the lens stays still within each shot while actors keep animating. Low remains readable; portrait fails framing. Did not file the already-known low triangle budget problem. |
| 7. Reload | Reloaded during the film at 3 and 15 seconds and after the ending. The save resumes at the camp with the door quest, the fox, and working controls. The film does not restart. A mid-film reload preserves that saved hour rather than forcing the last shot's hour; no progression loss was found. |

## Six-shot visual judgment

1. **Dusk:** camp, tent and shut stone door read clearly at landscape size. The grey blue light suggests evening, but the surrounding meadow stays fairly bright. The camp's yellow pool makes its location clear. Portrait loses the fire and hero.
2. **The fire:** the seated hero reads and the flame fills the foreground. The pool is very bright yellow, especially at low graphics. This reads more like a large light on the ground than flickering firelight. No subjective approval is implied.
3. **Listening:** the turn away from the fire is legible, and the smaller flame communicates the fire sinking. Background Hall and tent remain visible.
4. **The trees:** the grey, small fox reads as frightened once clear of the grass. During the entrance its face is repeatedly crossed by foreground blades. The camera pushes and the fox walks; no whole-actor teleport was observed in the samples.
5. **Edge of light:** landscape frames hero left and fox right with the words below. The purple sky reads as dusk. The gap stays green and readable rather than black. The sentence fits landscape and wraps neatly in portrait, where the characters disappear off-screen.
6. **Back to play:** the lens returns to the overhead play view, the bars withdraw, the HUD returns and the real fox remains. The first walk and panels work. The narrow held frame clips the hero during this move.

Some held shot-5 captures showed a horizontal missing-land strip with town geometry behind it. It did not appear in continuous normal or continuous reduced-motion playback. This was left as an unconfirmed capture/loading observation, not filed as a normal-play bug.

## Sound, shot by shot

This is an audit of the actual page's running Web Audio engine and captured mix, not a claim of human headphone listening. The test logs bus levels, ambience inputs, node starts and page state while the button-started film runs. The audio context was running; master and Effects were enabled. Live mix: [watch-audio.webm](/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/watch-audio.webm). Raw records: [watch.json](/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/watch.json).

| Shot | Page/engine evidence and storyboard comparison |
|---|---|
| 1 | Wind/night ambience and the camp's looping filtered-noise fire run. Music fades down to zero during the opening part. The ambience receives the dusk hour and wind. The low film-note oscillators already exist silently. No spoken line is requested. |
| 2 | Fire sound rises close. Ambience stays at its normal level before the silence cue, then reaches zero before shot 3. This cuts wind along with the crickets, matching the next shot's fire-only intent. |
| 3 | A short cluster of noise bursts starts at the listening cut, matching the dry twig cue. Music and ambience are both zero; fire continues. The cue is procedural rather than a recorded twig file. |
| 4 | The held tone uses sine oscillators at 55 and about 82.41 Hz, plus a quiet triangle at about 110.6 Hz and slow filter modulation. Its gain swells while ambience/music remain muted. Fire stays underneath. |
| 5 | The held note continues; the fire-pop cue is scheduled at 20.7 seconds as a crack plus a low thump. The subtitle has no voice. The mix recording preserves the cue for listening review. |
| 6 | The note fades; ambience returns below its full level, then the normal ambience and music levels return after the film. Page logs confirm zero music during the body of the scene and restoration afterward. |

I did not assess perceived loudness, speaker balance, clipping by ear, or whether the synthetic twig convincingly sounds like wood. The captured audio and exact engine log make that remaining review concrete.

## Evidence paths

All pictures listed here were opened, including every six-shot high/low/narrow/reduced set and every continuous normal/reduced sample.

- Portrait: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/portrait-repro-1.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/portrait-repro-2.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/portrait-repro-3.png`.
- Grass: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/live-15.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/high/shot-4.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reduced-live-15.png`.
- Reduced motion: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reduced-live-13.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reduced-live-15.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reduced-live-16.5.png`.
- Night progression: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/inside-after-talk.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/hall-next.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/custodian-after.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/fox-hand-after.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/heart-finished.png`.
- Dawn: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/morning.png`. Raw page state: `.artifacts/cut-test/morning.json`.
- Inputs: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/inputs-during.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/inputs-after.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/bag-after.png`.
- Reload: `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reload-3.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reload-15.png`, `/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/reload-25.5.png`.

## Checks and limits

- Doctor: all setup items healthy; assigned port 5781; check finished with 912 passing tests. Used the coordinator's 5410 server; never stopped it.
- `bun tools/film-check.mjs --url http://127.0.0.1:5410/experiment --skips 0.3,3,15,24`: passed watched ending, follow, reload and all four skips.
- `bun tools/film-shots.mjs --url http://127.0.0.1:5410/experiment --out .artifacts/cut-test/high`: six pictures, no console errors. Renderer: ANGLE Metal on Apple M4. No frame rate claims.
- `bun run verify`: check, lint, tools, bots, assets, build, server, together, shots and play passed. Live failed because the configured Convex deployment does not expose `worlds:create`. No backend changes were attempted. Exact backend error: `Could not find public function for worlds:create`. See [verify log](/Users/dabot/.t3/worktrees/game-base/t3-78e426ec-ada3564fdcf57f7a/.artifacts/cut-test/verify.log).
- `bun run verify tools`: passed after the test harness changes.
- New test harness: `tools/cut-player-test.mjs`. Modes record real inputs and the resulting state. Only `portrait-check` is an automatic failing regression check; grass and reduced-motion art judgments require picture review.
- No full roof-building playthrough, bed-trigger test, physical mobile touch test, other hardware, online cutscene test, or human headphone listening. The slow full-suite act-1 run was not rerun; the targeted night path was played instead. This is a report with open findings, not a claim that the build is ready to ship.
