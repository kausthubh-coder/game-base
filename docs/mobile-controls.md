# Touch controls

Phones and tablets show touch controls when the browser reports a coarse pointer or touch support. Mouse and keyboard remain available independently.

- Drag the left stick to walk relative to the camera. Jump holds the normal jump input.
- Tap the world to move the gold aim marker. Swipe the world to turn the camera without pointer lock. View changes camera mode; + and − change zoom.
- Hold Use to swing, dig or paint a build stroke. While holding Use, drag another finger over the world to aim the stroke. Release Use to finish; losing a finger cancels it.
- Place uses the held item with its secondary action. Talk interacts with nearby people and objects.
- Build toggles build mode, Undo takes back its last stroke, and Turn rotates the camera or the held build piece.
- Dodge, Skill and held Calm feed the fight's normal input path. Use attacks. Quick slots select the kit during a fight.
- Bag, Map and Pause open the existing menus. Dialogue keeps its tap-to-advance and choice buttons; the movement and action controls hide.

Opening a menu or dialogue cancels touch holds. Blur, hidden tabs, orientation changes, pointer cancellation and lost capture also cancel. A finger held across a menu must lift and press again. Buttons use the existing Gilded Hearth colors, with at least 44 CSS pixels per target and safe-area spacing.

Run focused checks with `bun test src/game/shell/keys.test.ts src/game/views/touch-controls.test.ts src/game/fightview/keys.test.ts`. After a coordinator grants a browser slot, serve a separately built source snapshot and run `bun tools/play-touch.mjs --url http://127.0.0.1:5800 --out .artifacts/mobile-controls/<run>`. The tool uses browser touch input and reads game state for assertions. It never writes gameplay state through the debug door.

The top row opens Bag, Map, Pause and Tools. Tools expands Build, Undo, Turn, View and zoom, temporarily hiding the combat buttons. Upright phones keep the action controls above the quick slots; landscape reserves space on both sides of the slots. Startup movement help uses the same touch-device decision as the controls.

The reviewed runtime is `dist-mobile-38c42107`, built from an archived source snapshot with linked dependencies and copied public assets. Its before and after source manifests match. `.artifacts/mobile-controls/proof-38c42107/` holds portrait and landscape screenshots, readable text rectangles, touch capture event records and the 44 passing browser assertions. The default check ran without `--input-only`; that flag is for diagnosing input against an older runtime whose layout is already known to fail. Fifteen focused tests and the scoped type check pass. The browser uses emulated touch on Chrome with Metal, so these checks establish behavior and layout rather than phone performance.

The arrival-banner CSS diagnostic is in `.artifacts/mobile-controls/arrival-2e1dc639/`. It stages the retained Gallery fixture and an arrival event solely to compare the prior container query with the fixed viewport query. The old query reproduces the visible HUD; the fixed query hides it without hit targets and restores it after the banner. This is presentation proof, not earned chapter progression.

The coordinator owns the combined verifier and independent camera checks. They were held during these browser runs. This slice does not claim a completed Act 1 replay or a physical-device performance test.
