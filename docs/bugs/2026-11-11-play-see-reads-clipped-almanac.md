# The play tool treated clipped Almanac answers as readable

**Fixed on 2026-11-12, in the branch that found it.** `see` now counts a piece only when at least 60% of
its box shows inside its scrolling and clipping ancestors and nothing sits on top of it. `look` flags a
piece that is mostly hidden as `cut`, and counts the pieces scrolled out of sight. `bun
tools/play/check-eyes.mjs` keeps it fixed, on a page with one line past the edge of a scrolling box, one
scrolled away and one under a footer. The recording that came with this file relied on the false `see` to
wait, so it could not be kept as written; it became the recording of the game's own bug,
`2026-11-11-almanac-answers-below-the-fold.json`. What follows is the report as filed.

Found while playing the first quest cold at `e7844a8`, 960x540, human blind mode, seed 7. No existing report covered this.

## What happened

After learning the Mossling's facts, open Tab without scrolling. The page shows its portrait, name and Complete stamp. The answer "Shade and mossy stone" has a reported box at x354 y536, 178x23. It is hidden below the scroll area's readable region and the fixed footer.

`act '{"type":"see","text":"Shade and mossy stone","timeout":1000}'` succeeds anyway. Close and reopen the panel and repeat: it succeeds again. Reproduced 2 of 2 live attempts with both pictures inspected.

Expected: `see` succeeds only when the matching text is actually visible within its ancestor clipping areas and the viewport. `gone` succeeds while that text is hidden. The `screen` list may retain diagnostic boxes for clipped text, but those boxes must not count as readable text for these waits.

Pictures: [first false success](../playtests/img/2026-11-11-new-player-first-quest/037-offscreen-see.jpg), [repeat](../playtests/img/2026-11-11-new-player-first-quest/038-offscreen-see-again.jpg). The accompanying [playtest](../playtests/2026-11-11-new-player-first-quest.md) describes the player impact of the layout.

## Failing recording

The sibling JSON uses the first conversation to unlock Tamsin's page, so it does not depend on creature movement. It waits for complete sentences, opens the Almanac, selects People and Tamsin, then asserts that the advice hidden below the footer is `gone`. It should pass while the answer is clipped. Today the final assertion fails because the screen list still contains it.

```sh
export PLAY_PORT=5714
bun tools/play.mjs start --mode human --blind
bun tools/play.mjs replay docs/bugs/2026-11-11-play-see-reads-clipped-almanac.json
bun tools/play.mjs stop
```

Use default 960x540. Do not scroll. A larger viewport can make the advice visible and would invalidate this expectation. The recording reproduces the tool's clipping mistake, not a requirement that the game hide the advice. If the game layout is fixed first, move this assertion to a tool fixture with equivalent clipping.

The final recording failed at this intended assertion in 2 of 2 complete replays:

```text
Error: "The Almanac, an axe and dry advice" was still on the screen after 1000 ms
```

An earlier draft passed because it did not select the intended page. Another draft timed out clicking People by its reported screen name. Neither draft is counted as a reproduction of this assertion. The retained version selects that category at a coordinate shared by its one-category and two-category layouts.

## Cause checked after play

`textShown` in `tools/play/inputs.mjs` tests whether any `window.__playScreen().items` text includes the requested string. In `tools/play/screen.mjs`, `readScreen` includes an element when its rectangle intersects the viewport. It does not intersect that rectangle with ancestor overflow regions, and non-pressable text does not get an occlusion check. The answer's rectangle intersects the bottom four pixels of the viewport while its text is hidden.

The same false visibility lets the unscrolled page pass a `see` for the answers that a new player cannot read. No game, tool or skill code was changed.
