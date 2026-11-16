# Act 1 interface concepts

These are approval paintings, not implemented screens. Nothing in the game or its shipped asset manifest changes.

## References

- `docs/act1.md`, Concepts, at base commit `9161b86`.
- `docs/ui-look.md` and `.agents/skills/make-ui/SKILL.md`.
- Existing desktop and phone UI sheets in the main checkout's `.artifacts/ui-merged/`. I opened both sheets, including the Almanac, Bag, Make, HUD and dialogue states.
- `docs/shots/approved/farm.png`, the real game view supplied to the image model for every first pass. The model repaints the supplied scene, so these are not pixel-identical screenshot composites.
- `game-look-test/playthrough/farms.js`, and handbook chapters 30, 23 and 22. The handbook is under `~/dev/sandbox/game-look-test/`.

## The screens

| Painting | What it shows | What it borrows from Gilded Hearth | Default where the plan leaves a choice |
|---|---|---|---|
| [fieldbook.webp](fieldbook.webp) | Mossling creature page, attraction, fears, yield, proved rule and best farm rate | Full-screen Almanac night stars, portrait list, gold halo, ruled facts, completion stamp and rails | Field book is an Almanac category, not a second leather book. The example rate assumes three mosslings. Category icons are placeholders. |
| [ratetag.webp](ratetag.webp) | Copper rate, the light symptom, Give or Take, and Inspect lamp one press away | Compact night-glass pills, gold action, highlighted world object, existing minimap and quick wells | Inspect selects the offending lamp. The player still changes the layout. It does not automatically solve the farm. The sample rate is illustrative. |
| [bench.webp](bench.webp) | Four steps, Copper-bound selected, recipe, two mutually exclusive fittings | Cream panel, painted corner frame, centred title, circular close, gold primary action and night item preview | Recipe quantities are deliberately unspecified. Choosing a fitting happens before Make. Later steps substitute their own pair from chapter 30. |
| [kit.webp](kit.webp) | Three equipped slots, six reserve tools, selected tool and use | Full-screen Bag frame, night wells, cream count tags, right detail column and prompt rail | Counts are sample inventory. Equip replaces the selected equipped slot. A thing is consumed when it works. |
| [ledger.webp](ledger.webp) | All four sections, granary deliveries, reward and overall completion | Full-screen night menu rail and cream detail panel, gold Deliver, ruled progress rows | Deliver contributes what is available; no extra acceptance screen is proposed. Section requirements are the handbook values. Pump wheat is excluded. |
| [dinner.webp](dinner.webp) | Gus and Hobb ask, player grants one, ten hearts | Existing small cream panel, corner ornament, portrait rows and rounded choice buttons | Choose commits the evening's one grant. Hobb is the highlighted example, not a recommended choice. Closing leaves the choice pending. The table's final setting is not designed here. |
| [heartstone.webp](heartstone.webp) | Discrete six-step gauge, current step 2 and the requirements for step 3 | Cream world text, gold diamonds, night gauge, small cream inspection panel | Keep gauge quiet until inspected. Requirements are checked individually, not an XP percentage. The pump penalty is disclosed in the inspection panel. |
| [people.webp](people.webp) | Hobb's door needs, wish, kitchen or smokehouse job | Glass door label, cream inspection panel, completion green, portrait and rounded choices | A missing lamp pauses work. This painting disables assignment too; whether players can preassign a paused job needs a decision before implementation. |
| [dialogue.webp](dialogue.webp) | Speaker portrait, name, one line and two action choices | Existing unboxed night shade, cream line, gold name, ring portrait and glass choice pills | The line comes from the current UI reference. Action choices are composition examples, not new canonical scene branches. The hero stays silent. |
| [dialogue-phone.webp](dialogue-phone.webp) | The same dialogue arranged for touch | Same shade and portrait, stacked rounded choices, no keyboard cue | Portrait composition represents a 390 by 844 phone. The delivered painting is 1600 wide to match this set. Evaluate target sizes after scaling to 390 logical pixels. |
| [fight.webp](fight.webp) | Empty segmented guard, the Mark's hold-to-calm prompt, Heartstone reach and three kit slots | Restrained night wells and pills, gold hairlines, cream world text | This is the guard-broken state. During the fight the gold segments drain. Hold duration and slot keys are provisional. No enemy health or death bar is proposed. |

## Approval limits

The paintings borrow the existing palette, rounded controls, diamonds, night menu treatment and corner ornament. Image generation approximates the two fonts and kit brushwork. Implementation must reuse the actual Fraunces and Nunito fonts and the existing kit PNGs and tokens, rather than tracing these pixels. The paintings do not authorize new UI tokens or replacement kit art.

People, creatures, equipment and scene props here are provisional inserts. Use their separately approved sheets when building. Tamsin uses the same portrait design on desktop and phone; approve the layout independently of her final portrait. The existing farm view is a shared context reference, not the final dinner room or combat arena.

The handbook describes Give and Take as choices with consequences. The rate tag keeps both visible and names the quiet period. Exact confirmation behaviour for Take remains open. The plan also calls the bench three steps in one summary but lists four in its table; this set follows the four-row table and `farms.js`.

## How these were made and checked

Built-in image generation produced each painting separately, using the current UI sheet as a style reference and the approved farm shot as the world reference. Review passes corrected floating full-screen menus, oversized fight widgets, the Hobb portrait and spoken dialogue answers. `prompts.json` records the shared brief, each first-pass screen brief and the review directions.

Only resizing and WebP compression use Sharp. Generated originals and rejected passes stay outside the committed set. Every final WebP was opened after conversion and compared with the current desktop and phone UI sheets and `docs/ui-look.md`. File checks decode every image, require width 1600, enforce less than 600,000 bytes per file and check the complete list of eleven images. These are concept-only files, so no game build or runtime behaviour changes require browser regression testing.

## Branch issue

The requested command failed because Git cannot have both a branch called `act1` and one called `act1/concept-interface`. I left the integration branch alone and used `act1-concept-interface`, fast-forwarded from the requested local `act1` at `9161b86`. Nothing was pushed or merged into `main` or `playtest`.
