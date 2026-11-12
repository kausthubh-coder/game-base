# Menus on a small screen

ISSUES. Played `e7844a8` on 2026-11-11, thorough player, human mode, 1366x768. Renderer was ANGLE Metal on Apple M4. No software renderer and no frame-rate claim. The journal spans midnight UTC; the local test date is November 11.

70 actions, 74 pictures opened and inspected, including 9 film sheets. Three sessions were used after two long text-click timeouts. The counts exclude replay verification. Raw journals remain locally in `.artifacts/play/journal/2026-11-11T23-56-29`, `2026-11-11T23-59-24`, and `2026-11-12T00-01-35`.

The checkout actually started at `03440d3`, so the requested fast-forward failed. Preserved that branch, created `t3/playtest-menus-small-screen-run` at the supplied `b14c865`, then fast-forwarded `t3/agent-playtest` to `e7844a8`. No main checkout or branch was changed.

## Findings, worst for a player first

1. **3D character selection fails, 2 of 2.** In title Settings and again in in-game Settings, selecting 3D models highlights it but requests a missing `cast-hero.glb`. The console explains the sprite fallback; the player sees no explanation. [Picture](img/2026-11-11-menus-small-screen/039-models-second-try.jpg). [Bug and failing recording](../bugs/2026-11-11-settings-3d-models-missing.md).
2. **Cold Settings opening briefly lacks its background, seen once.** The first opening drew controls on the title painting before the parchment arrived. That makes the page briefly hard to read. [First opening film](img/2026-11-11-menus-small-screen/002-title-settings.jpg), frames 5 and 6. Closing and reopening gave a normal parchment transition, so this is 1 of 2 openings and remains a polish observation, not a confirmed bug. [Second opening](img/2026-11-11-menus-small-screen/019-settings-second-opening.jpg).
3. **Dialogue gives little help for leaving it.** B, I, J, M and Escape all leave the conversation in place. Enter advances it and eventually restores menu access. The screen has a small triangle, but no key label explaining how to continue. This is a discoverability question, not a claim that dialogue must be cancellable. [Picture](img/2026-11-11-menus-small-screen/024-talk-escape.jpg).

## What worked

Title Settings scrolls through Picture, View, Sound, Interface and the key reference. Tested every quality choice, shadow choice, bloom/cloud/weather choice, reduce motion, all three graphics sliders, camera modes, mouse modes, quarter/smooth turning, character choices, four sound sliders and three interface sizes. Restored Normal, sprites, 2.5D, drag-to-turn, quarter turns, original sound levels and graphics presets. Large size moves the size controls below the visible area, but scrolling reaches them. [Bottom of Settings](img/2026-11-11-menus-small-screen/014-settings-bottom.jpg).

Bag opens by B and from Pause. Both tabs fit, both hand recipes select and explain missing materials, and disabled Make controls are clear. The axe moved between quick slots. Escape during a drag cancelled it and kept the bag open; a second Escape closed it. [Tab film](img/2026-11-11-menus-small-screen/003-tab-coordinate.jpg), [drag film](img/2026-11-11-menus-small-screen/029-bag-drag.jpg).

J replaces the bag with Quests, Escape returns to play, and Pause's Quests button opens the same panel. Its text and progress fit. [Quests picture](img/2026-11-11-menus-small-screen/036-actual-quests-button.jpg).

Map opens by M, Pause and the minimap. Zoom buttons, wheel, drag, recenter, pin-at-player, click waypoint, every icon, every color, sharing toggle, stop following and remove were exercised. Escape leaves the pin editor first, then the map. [Map drag film](img/2026-11-11-menus-small-screen/010-map-drag.jpg). A camera setting changes the world behind Settings. [Setting film](img/2026-11-11-menus-small-screen/038-free-camera-setting.jpg).

Pause Resume works. Account opens and Escape returns. Save and return to title enables Continue; Continue preserved the moved axe slot and quest progress in the same browser session.

## What slowed me down or was unclear in the skill and tool

- `screen` prints `[By hand]` like a button, but it is a tab. `click` with text searches only role=button. It timed out after 60000 ms; coordinates worked immediately. The screen should preserve the role or text-click should support tabs and radios. Settings' selectable choices are printed as plain text, so their clickable nature also has to come from the picture.
- A failed click inside `film` captured 3,573 frames and then occupied the daemon processing them. Look and stop appeared stuck while that work finished. There was no progress or pending-command status. A short input timeout, frame cap, and progress line would help. The first Skip timeout also became confusing because Escape had already begun skipping; waiting for `gone` before the next action avoided that.
- Film's `--fps` did not limit screencast capture to that rate. A short film captured about 60 frames per second despite the default of 10. The README should distinguish capture rate from sheet sampling.
- `wrong` includes scrolled-out Settings content and reports text over the opaque header even when the picture correctly clips it. It also reports a hidden quest marker over pause buttons. Some marker show-through is faintly visible in the translucent bag, but the pause warning was not visible. These lines need visibility/clipping filtering before they can be treated as defects.
- Long screen lists hide the lower controls after 24 lines. `look --json` exposes them, but costs another picture and returns a large coordinate object for every line. A compact full-text mode or page-by-page output would help.
- Replay keeps the active session's viewport; recordings do not include size. `replay all` failed the existing coordinate-based bag recording at 1366x768. A fresh default 960x540 session is needed for the existing suite. The new bug replay explicitly documents its required size.
- The skill does not explain how to note a past frame after moving on. `note` binds only the latest picture. The first model error note was pinned to a later Settings view; the second was pinned correctly. I copied additional already-inspected film sheets into the report folder manually.
- Coordinate sequences must stop for a new picture when size or menu composition changes. I missed controls after switching to Large and after unlocking the Almanac changed Pause's card widths. Those misses were tester input mistakes, not dead game buttons. Text-button clicks with explicit short timeouts and `see` helped recover.
- The charter asks for all controls within about 70 actions. Grouping known controls saves actions, but a group can return only the final state. This run proves the controls can be operated, not that every intermediate graphics combination was visually assessed.

## Verification and limits

Doctor passed all items, including the baseline game check. The new bug recording failed on the missing resource. `bun tools/play.mjs replay all` passed all three recordings in a fresh default 960x540 session. `PLAY_PORT=5805 bun run verify play` ended with `verify: 1 parts, nothing failed`, covering recordings, play-tool unit checks and fixtures, build-mode play and camera drag. The first verify attempt raced a still-closing session and failed its ownership lock; it passed after shutdown completed. All play sessions were stopped, and their daemon/server PIDs were gone. `git diff --check` and report-link checks passed. The full server, multiplayer, asset and screenshot suites were not run for this report-only change.

No game, tool or skill code changed. No push or deployment. The 3D-model result concerns this locally built copy, not a tested production deployment.

## What I did not reach

The action budget was spent. Did not test a successful craft, stack splitting with a stack larger than one, pin editing at the map edges or the 20-pin limit, the pin editor's Done button separately, a successful sign-in or online account pages, each Settings control a second time in-game, keyboard focus navigation, a browser reload followed by Continue, or long quest lists. Pause Close was not separately pressed; Escape and Resume were. The Almanac was unlocked but its pages were outside this charter. Audio sliders moved and returned to their values; audio output was not listened to. No second clean cold-cache opening was attempted for the brief parchment flash.
