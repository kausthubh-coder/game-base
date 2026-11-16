# Arrival work had no field or camp actions

From the unedited earned landing, walk to the mossy pool and dig south with the spade. The tracker asks for a dry field, but the current terrain contains none near this pool. `field-red.log` records the failing terrain regression. `repro/survey.json` is a read-only terrain survey. The old ditch hook is present and works when water reaches tilled soil.

The first input attempt is `ditch-red/replay.json`. It digs three cells, then the pointer hits a tree instead of its final requested cell. This is a runner aiming failure, recorded separately from the missing field. The final connection runs east, clear of the trees and the later machine farms.

The bramble and camp content check also failed before the fix (`camp-red.log`). There were no bramble blocks at the field and no camp setup interaction. The existing camp was decorative; it supplied neither saved setup nor a sleeping place.

The fix adds a dry field east of the existing pool, beyond the later machine farms and three cuttable leaf blocks on its far edge. Ordinary block breaking clears the brambles. All three must be removed; world edits persist their removal. Camp setup consumes two gathered logs and one fiber to pitch the existing tent, then one log to light the existing fire. Setup flags persist and repeated use cannot spend those materials again. The pitched tent is a sleeping place within the usual bed reach. The Hall still guards sleep until the Heartstone has been seen.

Diagnostic rules tests use supplied tools and positions to isolate these actions. Those fixtures are separate from the earned browser replay, which imports only the historical landing save and earns all subsequent state.

Reproduce with `PLAY_PORT=5559 bun tools/play-firstnight.mjs --save .artifacts/grantday-framing-review/input/earned-landing.save.json --out .artifacts/first-night-input/review`.
