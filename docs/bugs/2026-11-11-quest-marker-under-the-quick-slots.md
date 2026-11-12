# The quest marker slides under the quick slots

Found on 2026-11-11 by playing in human mode at 960x540, seed 7. Not fixed.

## What happened

Start a new game, skip the opening and hold W for a second and a half. Tamsin, who carries the quest's `!`,
passes below the bottom of the screen. Her marker keeps following her place on the screen, so it slides
down into the row of quick slots and sits half under slot 4.

Expected: a marker for someone off the screen stays clear of the interface: it stops at the edge of the
play area, or gives way to the gold arrow that already points to her from farther away.

The play tool says so by itself. `look` after the walk prints:

```
over "!" 428,469 26x26: covered by button.gb-slot "4"
```

The same marker also stays in the page under the pause menu and the Almanac. Under the Almanac it shows
faintly through the panel.

## The recording

```sh
bun tools/play.mjs replay docs/bugs/2026-11-11-quest-marker-under-the-quick-slots.json
```

It checks the screen is clean at the start, walks north with W, and checks again. Today the second check
fails. The fix moves the recording to `tools/play/scenarios/`.
