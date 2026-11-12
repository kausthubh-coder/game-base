# New player, first quest

ISSUES. I completed "A plot of your own" from New game and reached the next tracker, "A roof before dark". No quest blocker. The main player friction was reading the Almanac at the default size.

## Charter and conditions

Played the title, the opening, Tamsin's first conversation, the Almanac, observation near the mossy rocks, and the return conversation. Human mode, blind, seed 7, default 960x540. Renderer was ANGLE on Apple M4 with Metal. No performance claim.

The supplied checkout was on `t3/playtest-first-quest` at `03440d3`, rather than the stated base. The requested fast-forward failed. I created `t3/playtest-first-quest-cold` at the exact requested tool commit, `e7844a8`, in my own checkout. I did not alter the original branch or main.

I read only setup instructions and the playtool instructions before playing. Game dialogue and existing bug reports were read only after finishing the quest, to prepare the reproduction and avoid duplicates.

The cold session contains 36 actions and 38 journal pictures, including five film sheets. I opened all 38 pictures and 14 full-size frames marked as jumps or flickers. Films covered New game, the opening camera, starting dialogue, opening the Almanac, and walking toward the rocks. The opening fade, dialogue portrait loading and panel opening account for most automatic motion flags; I did not treat those flags alone as bugs. The report retains 14 pictures. Counts exclude subsequent automated reproduction runs.

## Findings, worst for the player first

### 1. The Almanac hides its useful answers below the footer

Opening Tab after Tamsin shows a large portrait and name. The two column headings sit behind the footer, and the answer starts at y536 in a 540-pixel viewport. Opening the completed Mossling page repeats the problem. "Complete" is visible, but what the creature needs and gives is not.

A mouse-wheel scroll reveals both columns. I found no visible scrollbar or scroll instruction. This is a layout and discoverability polish finding, not a quest blocker. Repeated on both initial pages, and again on two subsequent Mossling opens. The raw notes called it a bug before I discovered the scroll workaround.

Pictures: [Tamsin before scrolling](img/2026-11-11-new-player-first-quest/019-almanac-cut.jpg), [Tamsin after scrolling](img/2026-11-11-new-player-first-quest/020-scroll-page.jpg), [completed Mossling](img/2026-11-11-new-player-first-quest/024-creature-entry.jpg), [repeat open](img/2026-11-11-new-player-first-quest/038-offscreen-see-again.jpg).

The current input format cannot assert that these answers fit within the readable panel area. The tool bug below explains why a plain `see` is insufficient. I have not invented a passing visual check for this finding.

### 2. The hero vanishes under the tree on the first walk

I followed the yellow distance arrow with D. The camera followed, but the leaves covered the hero completely before I reached the pond. Observation completed during that walk. I could read the finished page, but I did not deliberately identify and watch a creature to earn it. Seen once; I did not repeat the full walk. No claim that the observation rule itself is broken.

[Walk film sheet](img/2026-11-11-new-player-first-quest/023-walk-east.jpg). The hero is clear again on the [return toward Tamsin](img/2026-11-11-new-player-first-quest/026-return-tamsin.jpg).

### 3. The first dialogue makes me guess the advance key

E started Tamsin's dialogue. Once the sentence finished there was a small downward triangle, but no written key or button label. I guessed Enter, which worked. The return conversation used the same presentation. This did not stop progress, but a new player has to infer the control.

[Finished first sentence](img/2026-11-11-new-player-first-quest/006-read-tamsin.jpg).

### 4. Dark dashed lines cross the opening meadow

Thin dark lines crossed the ground and grant stone in multiple conversation pictures, with different positions between them. They look like rendering seams. Seen repeatedly in the first session, not independently reproduced in a fresh session. This remains visual polish with an unproven cause.

[Conversation with seam across the meadow](img/2026-11-11-new-player-first-quest/015-finish-talk.jpg).

### 5. The map's destination name overlaps its distance

The map labels the target "Mossy rocks", but "12 blocks" crosses the label. I initially misread the map, then corrected my raw note after looking more closely. It has neither the unknown question marks nor the missing label claimed in that discarded note. The world arrow was enough to continue. Seen once.

[Map with overlapping target labels](img/2026-11-11-new-player-first-quest/021-find-pond.jpg).

## Tool bug

`see` succeeded twice for "Shade and mossy stone" while that answer was hidden below the Almanac footer. Both pictures were inspected. This can make a browser recording claim a player can read something they cannot.

[First false success](img/2026-11-11-new-player-first-quest/037-offscreen-see.jpg), [second false success](img/2026-11-11-new-player-first-quest/038-offscreen-see-again.jpg). Filed separately with a failing recording in [the bug report](../bugs/2026-11-11-play-see-reads-clipped-almanac.md).

## What worked and what I did not reach

The [title](img/2026-11-11-new-player-first-quest/001-title.jpg) was legible. The opening named Tamsin and the grant stone. The [first screen](img/2026-11-11-new-player-first-quest/004-first-steps.jpg) gave movement and talk instructions. Tab opened the book, the distance arrow led toward the observation area, both columns filled, and returning to Tamsin advanced the tracker to [A roof before dark](img/2026-11-11-new-player-first-quest/035-after-lodge.jpg).

I did not test title settings, camera turning, gathering, shelter, sleep, saving and Continue, touch, other sizes, sound quality, multiplayer or later quests. The coverage index dates mean these opening rows were sampled; their settings and camera subparts remain untested.

## What slowed me down or was unclear in the skill and the tool

- `see` means inclusion in the screen list, rather than readable pixels. Clipped text at the very bottom passes. This needs fixing before it can verify the Almanac layout.
- There is no supported assertion for `wrong: none`, an element fitting inside its scroll area, or a hidden hero. Turning a visual finding into the required failing recording needs more than the documented inputs.
- A film's named PNG is a contact sheet, not the final full-size picture. I used `look` for a readable still of the Almanac. It would help to print a final-frame path alongside the sheet.
- Film output gives flagged frame numbers and times but does not give their exact filenames. I listed the frame directory to open them. Printing those paths would save a step.
- Automatic flicker detection flagged the intentional opening fade and a portrait arriving during dialogue. The pictures were necessary to interpret them.
- The game keeps running while I inspect images and write notes. Hours of the game day passed during two conversations. A cold new-player run therefore includes tool reading time, which changes the available day.
- `record` saves inputs but omits time spent reading between commands. My live conversation presses are not a reliable standalone replay. I prepared the bug recording with full-sentence `see` waits instead.
- A generic replay did not guarantee which Almanac category opened, because creature knowledge could arrive while waiting. I made the reproduction explicitly select People and Tamsin. The screen list names the People control, but a click by that name timed out; a coordinate click worked.
- The setup's stated base did not match the checkout. I chose a new branch at the requested commit rather than change the test version.
- `journal --to` copied only noted pictures. I separately copied the title, first steps, map and walk sheet needed to explain coverage and findings.

The raw [notes](img/2026-11-11-new-player-first-quest/notes.md) retain the immediate impressions and their correction. The findings above supersede the initial map mistake and the initial interpretation that the Almanac could not be read at all.

## Verification and cleanup

The retained tool-bug recording failed at its intended final `gone` assertion in 2 of 2 full replays. The initial cold session reproduced false `see` success in 2 of 2 attempts. Earlier reproduction drafts had a wrong selected category and a name-based click timeout; those are excluded from the final reproduction count.

`bun tools/play.mjs replay all` passed all three existing recordings and ended with `replay all: every recording passed`. `bun run verify check lint tools` ended with `verify: 3 parts, nothing failed`. Setup also passed the game check before play. I did not run the full server, multiplayer, asset or screenshot suites for this report-only change.

Both sessions were stopped with `bun tools/play.mjs stop`. No game, tool, skill or existing scenario file changed.
