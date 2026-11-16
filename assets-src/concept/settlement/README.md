# Settlement concepts

Seven sheets for Kausthubh's approval, painted on 2026-11-12. These are references for Astra's later models. None is approved or installed in the game. The base is act 1 at `9161b86`.

## Shared construction direction

One block is one metre. The hero is two blocks tall. Doors have a one by two block clear opening. The game camera looks down 35 degrees. Models stand at ground level with their front toward +z. North is -z and east is +x.

Use honey timber, dark brown supports, cream plaster, straw thatch and honey limestone. Keep ordinary lamps amber and reserve luminous teal for ancient magic. Broad roof shapes, rounded box beams and swept roots should read from the game camera. Painted grain, flowers and cloth stitching describe materials rather than separate geometry. The later models must use the game's palette and meet its geometry budgets.

Hollowmere's house-a has a seven by six block footprint and house-b nine by eight. These rural cottages use simpler frames and thatch. The approved town screenshot supplies the warm lighting, stone paths, timber furniture and amber lantern language. The approved sacred vista supplies the hill, oak, ancient door and valley setting.

## Sheets

| Sheet | What to approve | Needs, wishes and work |
|---|---|---|
| [camp.webp](camp.webp) | A three by four tent, one by two bedroll, three by three fire court and ten by ten clearing. Frame, pegs and fabric separate into model pieces. | The first field gets water while the surrounding land remains tired. The fire and tent have a two-block clear separation in the plan. |
| [kitchen.webp](kitchen.webp) | A six by five kitchen, two by two oven and three by one preparation table. Outdoor oven and awning become an enclosed room. | Hobb sees the river from her counter. Smoke and the noon bell announce her work. Her kitchen supplies daily meals. Her alternative smokehouse is on the workrooms sheet. |
| [homes.webp](homes.webp) | A one by two bed, five by five cottage, seven by six map-room home, five by two porch and an added upper floor. | Every home needs a roof, bed, meals and lamp. Mina gets north light, a three by two map table and maps drying beneath the eaves. Her survey job uses the same table and field records. |
| [workrooms.webp](workrooms.webp) | Smokehouse, seed shed, waterside beast yard and gate watch. Work areas have separate footprints and join studies. | Hobb packs travel meals. Gus has seed bins, a hat on the fence and a resting row. Wren has water, a shelter and a way to the wood. Dax sees the road and gate, with his crate-lid gong and two marked carrying chests. |
| [dinner.webp](dinner.webp) | A six by two outdoor table made from three two by two modules, benches and lantern poles on a ten by seven green. | The table hosts two requests every third evening after a second resident arrives. Leave circulation space and access from the kitchen. The painting's people indicate use and scale, not approved character designs. |
| [heartstone.webp](heartstone.webp) | The court inside Ilara's Hall, its dais, stone, channels and successive light states. | The light represents the settlement's growth. It must not suggest that combat experience buys steps one through five. |
| [stages.webp](stages.webp) | One plot at camp, homestead, hamlet and freehold from the same camera. | The first shared roof holds three beds at homestead. Hamlet adds Gus's and Mina's homes for three households. Kitchen and workroom roofs do not count as households. Freehold expands the land after the Stag is freed. |

## Heartstone sequence

The source is `playthrough/farms.js`, including its warning that the numbers are proposals.

| Step | Requirement |
|---|---|
| 0 | Dormant. |
| 1 | Water in a field and a fire. |
| 2 | A kitchen, three beds and a living farm. |
| 3 | Three living farms and everyone's needs met. |
| 4 | A turning wheel and a terrace that out-yields a pumped field. |
| 5 | Three households, six living farms, goods moving by themselves and sixty hearts. |
| 6 | The Verdant Stag freed. |

A farm on Take does not count as living. The Order's root pump lowers the reading one step. Do not build a permanent extra light state for that penalty.

## Defaults and uncertainties

- The handbook does not specify construction dimensions. The dimensions above are proposed module sizes for approval, not changes to the game rules or collision grid.
- I placed the river east, the road south and Ilara's hill northwest. The stages use a proposed thirty-two by twenty-four block study area. These are relationships for the concept, not surveyed live-world coordinates.
- Hobb's kitchen window faces east toward the river. Use the corrected north-up plan for placement, with a southern entrance and western serving door toward the dinner green. The main cutaway rotates the room to show its contents.
- The base home is five by five. The porch adds two blocks of depth, producing five by seven. Keep the porch open beneath the added floor.
- The camp sheet's small settlement-context cottage says four by three. That is a scale comparison sketch only. Use the five by five home module on the homes sheet.
- The single-person cottage is a module, not a claim that three beds fit with its illustrated furniture. At homestead, adapt the shared sleeping room before adding the separate households. The precise three-bed room arrangement needs Astra's fit check.
- The stages sheet simplifies small parts. Its shelter says three by three, and its small porch join says three by two. Use the detailed workrooms sheet's three by two shelter and the homes sheet's five by two porch when building. The overview's little building stamps describe occupied areas, not dimensioned production plans.
- Mina's home has a taller roof in the overview than in her detailed cutaway. Treat that as optional loft space within the seven by six module. Its map room, north light and sleeping nook remain on the ground floor.
- Hobb's and Dax's two jobs are alternatives. Building both workplaces does not assign both jobs. Likewise Wren can work the beast yard or walk the wood, and Mina can map ruins or survey farms.
- Gus's own field keeps one row in four resting and has no harvester arm. The seed shed serves areas machines cannot reach. Machinery elsewhere may run independently.
- Bramble's strip capacity and clearance need a model-scale check against the approved boar. Keep a two-block gate and leave a route past the sleeping beast. No pen is a slaughterhouse.
- The six leaf channels are a proposed visual language for the Heartstone, not established Hall lore. Step six opens the Hall's next level, without adding a new household or turning the freehold into a city.
- Tansy's flowers and bee boxes and Holt's path lamps belong in the growing settlement. They do not imply additional mandatory households beyond the three shown. Final placement must respect the farms' light and creature-attraction rules.

## Sources and generation

Read `docs/act1.md`, `docs/painted-world.md`, `docs/style-sheet.md`, the make-3d-asset skill and `src/content/town-kit.ts`. Viewed the approved town picture, sacred vista and Hall-door sheet, plus the handbook's camp, kitchen, hamlet and dinner pictures. Checked jobs, needs, wishes, dinner and Heartstone requirements against `playthrough/farms.js` and handbook chapters 27 and 30.

The built-in image generation tool painted one image per requested sheet. Targeted edits corrected the kitchen compass, home dimension and workroom job captions. `prompts.json` records the full prompts. WebP conversion uses the installed `cwebp` tool at quality 82. Source PNGs remain in the tool's generated-image storage; no duplicate drafts are kept here.

Git cannot have both a local branch named `act1` and a branch named `act1/concept-settlement`. This work uses `act1-concept-settlement`, following the other concept branches, and leaves the integration branch intact.

Verification is limited to these source concepts. They are not shipped assets, so no game build, runtime placement or model checks apply. The final report records visual inspection and the file-size and changed-path checks. The proposed dimensions and overview simplifications above remain matters for approval and production drafting.

## Inspection result

PASS for the requested concept-delivery checks. Opened all seven final WebPs after compression and checked them against the resident requirements and Hollowmere references. All contain a painted three-quarter study, block footprints, scale references, materials and joins. The stages preserve the hill door, oak, river and road across the four views, with three domestic households at hamlet and freehold. The dinner painting favours the social scene; its plan and exploded table provide the construction reference.

All seven files decode through `webpinfo`. Exact sizes are camp 241094, kitchen 245822, homes 222484, workrooms 271624, dinner 278480, heartstone 226978 and stages 460100 bytes. Every deliverable, including this README and the prompt record, is below 600000 bytes. The changed-path check against `9161b86` contains only `assets-src/concept/settlement/`. No dependency, model, runtime or shipped asset changed.
