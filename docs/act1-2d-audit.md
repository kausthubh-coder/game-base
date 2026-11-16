# The 2D art of act 1, audited

2026-11-12, on `act1-asset-2d`. Every shipped sprite sheet, portrait, icon and interface piece, drawn the way a
player meets it, looked at, measured and graded. The grades live as data in `assets-src/art-ledger.json`; this
page says what they mean, what causes the faults and what to redraw first.

## How to see it yourself

```sh
bun tools/art/see.mjs                       # sprites, portraits, icons, kit: no browser, under a minute
bun tools/art/review.mjs <sheet> --quick    # one sheet beside the hero and its concept: a second
PORT=<the doctor's port> bun run dev &      # outside the queue, for the two below
bun tools/slot.mjs --look -- bun tools/art/see.mjs --only world --url http://localhost:$PORT
bun tools/slot.mjs --look -- bun tools/art/see.mjs --only talk --url http://localhost:$PORT
bun tools/art/check.mjs --list              # the redraw list, worst and most seen first
bun tools/art/check.mjs --poses             # the poses the act wants and no sheet has
```

`.artifacts/art/see/` then holds 34 pages of sprite cards (each sheet to scale beside the hero on day and night
ground, its concept sheet, every frame, each animation's frames laid over each other), an animated loop a
sheet, 3 pages of portraits beside their sprite and concept, the icons at 64 and 32 pixels on the dark well
and on parchment, the 48 interface pieces on dark and on parchment, 9 pages of every figure standing in the
world at the game's camera beside the hero, and every portrait in the real dialogue box. `bun tools/ui-shots.mjs`
draws the HUD, the bag and the panels with their icons and kit pieces in place.

## The top twenty

Ordered by how bad it is times how often a player sees it. Grades run 1 (wrong) to 5 (nothing to fix). "Seen"
runs 5 (always on screen) to 1 (not in act 1).

| # | Asset | Grade | Seen | What is wrong |
|---|---|---|---|---|
| 1 | `hero-staff` | 1.5 | 5 | Another costume: slate jacket, navy trousers, tan boots, blonder hair. Both eyes show; the idle hides one under the fringe. |
| 2 | The hero's portrait | 1 | 4 | The old hero: red-brown curls and an orange cloak. The sprite is strawberry blond in a navy jacket. |
| 3 | `hero-call` | 2 | 5 | Hair drab yellow-brown and flatter, the back of the head a different cut, both eyes show. |
| 4 | `hero-moves` | 2.5 | 5 | Stockier body, bigger head, yellower hair, both eyes with highlights. |
| 5 | `hero-swing` | 2.5 | 5 | The face is redrawn with two large eyes and a fuller fringe. The most used action in the game. |
| 6 | `tamsin` | 2 | 4 | Reads as a little girl in a big hat. Her sheet is a lean older warden a head taller. Speckled coat, light hair with no outline. |
| 7 | `hero-cut` | 3 | 5 | Close. Lighter hair, both eyes, a head a little larger. |
| 8 | `maren` | 2.5 | 4 | A child's proportions and a flower crown. Her sheet and her portrait have a nineteen-year-old in river teal with a pushed-back crown. A smudge on the face. |
| 9 | `custodian` | 3 | 4 | Was a third smaller than its sheet and than its own waking sheet (repaired today). Fur tan where the sheet is moss grey. |
| 10 | `hero-bow`, `hero-cut-back` | 3 | 4 | Close. Both eyes show; the back cut's hair is spikier and redder. |
| 11 | The bow and staff icons | 3 | 4 | Four thin pale bows that nearly vanish on the bag's parchment. Four staffs that differ by a few pixels of the head. |
| 12 | The Custodian's portrait | 3 | 4 | Brown fur. The sheet is moss grey with a cream muzzle. |
| 13 | `aldric` | 2.5 | 3 | The nose is a red streak across the face. |
| 14 | `boar-blighted`, `boar-fight` | 2.5 | 3 | Brown with glowing gold cracks. Every other Blighted creature is drained grey with ash, as the story asks. The fight sheet stands 13% smaller than the boar it becomes. |
| 15 | The keystone icons | 2.5 | 3 | Pump House, Lamp Gallery and Seed Vault are one tan shield at 32 pixels. |
| 16 | The fitting icons | 2.5 | 3 | Padded grip, spring hilt and honey binding are the same tan coil. Canvas and padded jacket are the same pale jacket. |
| 17 | Shed pelt, old brass, quill strip, lamp post icons | 2.5 | 3 | A tan lump, a bracket, a pale strip and a thin line. None is named without its label. |
| 18 | `calla` | 3 | 3 | The tallest woman of the cast stood shorter than the hero (repaired today). Her grey coat came out half brown. |
| 19 | `ilara` | 3 | 3 | The leaf-green tunic went brown. Teal on both hands; the Mark is on the left. |
| 20 | `custodian-wake` | 2.5 | 2 | Four single frames with nothing between them: no eye opening, no stretch. |

Next come Elowen's portrait (golden hair and an olive robe where the sprite and sheet are silver and white),
Gus (a cartoon moustache face where his sheet is a sun-worn farmer), Tansy (her honey-yellow apron went ochre),
the Stag (painted with no outline, pixels twice the hero's, half again taller than its sheet) and the lynx
(pixels twice the fox's beside it).

## What is good

The home cast (Hobb, Dax, Mina, Wren, Holt) and the farm creatures (fox, thistlehog, gearling, mossling,
burrower, frog, bee, lanternfly) are clean, hold one identity through every frame and match their sheets: grade
4. The eight townsfolk and two acolytes are 3.5 to 4. The first two icon sheets read at 32 pixels. The painted
interface kit is the best art in the game, 4.5, and one family. No sheet has a pale fringe except the old
`juniper`, every frame of every walking sheet stands on its anchor's row, and nothing uses a colour outside the palette.

## The causes

Each of these produced several of the faults above, and each has a rule or a tool against it now.

1. **Nothing compared an action sheet with its character.** The checks measured sizes, anchors and palette, and
   a sheet drawn as another kid passes all three. Eight hero action sheets drifted, each its own way. Now the
   check compares a sheet's front colours with its character's first sheet (`identity`, which catches
   `hero-staff`), and a new or changed sheet does not pass until its artist answers a rubric from one picture that
   puts it beside its reference. The eye over the fringe, the head 2 pixels wider: those stay with the rubric.
2. **Every person is fitted to 110 pixels, and height is a number someone typed.** The builders scale each
   figure to one height, so a tall person and a short one are the same drawing, and `worldHeight` decides the
   rest. Six of the world cast had it 9 to 16% under their sheet, so Calla, Ren and Ilara stood as children beside
   the hero. The check now holds each figure's height in heroes to its concept sheet's (`scale`), and
   `bun tools/art/repair.mjs <sheet> --height` sets it.
3. **One creature, several sizes.** A fight, Blighted or waking sheet was scaled on its own, so the figure grew
   or shrank when the game swapped sheets: the Custodian by 40%, the Blighted thistlehog and boar by 8%, the
   Stag's fight sheet by 10%. Rule `same-size`, same repair.
4. **Frames were centred by their bounding box.** A raised arm, a tool or a wing widens the box to one side,
   and centring the box then slides the body. The old check demanded it. It now allows 6 pixels, the art check
   holds the body's own column still in a loop (`steady`), and `repair.mjs --anchor` moves the frames.
5. **The palette is brown.** `assets-src/palette.json` has full ramps for skin, wood, leaves and stone and only
   scraps of yellow, crimson, teal cloth, violet and grey-blue. Snapping a whole sheet to it sends Tansy's honey
   apron to ochre, Auren's orange waistcoat to maroon, Maren's teal to leaf green, Ilara's green and Elowen's stole to brown, Calla's grey halfway to brown, the Custodian's
   moss to tan. The crowd in the market is maroon, cream and brown on every figure. The action sheets that
   snap to their character's own colours kept theirs. This one is not fixed: see the decisions below.
6. **Sources are resampled, not drawn on the grid.** A generated source has figures about 185 pixels tall made
   of blocks about 3 pixels wide. The builders scale that to 110 with nearest neighbour, so one source block
   becomes 1 or 2 pixels by turns and thin lines break. The cast still reads well at the game's size, where a
   person is about 75 pixels tall on a laptop screen; at 2x the unevenness shows. `fittedMode` in
   `tools/sprites/lib.mjs` scales by the commonest colour with the outline given priority and keeps lines closed
   (`.artifacts/art/probe/resample.png` shows Calla both ways). New builders use it. The shipped cast is not rebuilt
   with it: each rebuilt sheet changes every pixel and needs its own review.
7. **Three head sizes.** The hero is 2.6 heads tall, the world cast (Calla, Ren, Ilara) 2.4, the home cast and
   the townsfolk 2. In the world the hero is the least readable figure on screen and looks drawn for another
   game beside Dax. A decision, below.
8. **Pixels of very different sizes side by side.** A sprite's pixels a block run from 29 (the Stag) through 56
   (boar, lynx), 64 (the hero) and 113 (fox) to 175 (bee). The fox beside the lynx, or the hero beside the Stag,
   shows it. Rule `density` holds new sheets between half and twice the hero's.
9. **Portraits were made apart from their sprites.** The hero's is the old hero, Elowen's and the Custodian's
   took other colours, and the home cast faces the viewer while the world cast is drawn three-quarter and more
   painterly. Rule `portrait` compares a face's colours with every sprite's head and fails one that matches many
   others better than its own.
10. **Icons were judged on a dark background.** The act's six new sets are mostly tan and brown with a light
    edge. On the bag's parchment several fade, and within a set several share one silhouette. Rules
    `icon-outline` and `icon-twin`.
11. **Blight is drawn two ways.** Drained grey with ash on the fox, thistlehog and lynx; glowing gold cracks on
    the boar.
12. **People have two animations.** Every person has idle and walk and nothing else. The hero alone has a seat
    (`hero-camp`). `bun tools/art/check.mjs --poses` lists 23 poses the act's jobs, beds, dinner and gifts want;
    the contract now names what a pose may be called, so a scene can ask for one with a stand-in today.

Small creatures are also small on screen: at the default camera a frog or a bee is about 15 pixels, a fox 25.
Their sheets enlarge them on purpose and they are still hard to see on a farm.

## Repaired today, without drawing

Before and after of each are `.artifacts/art/review/<sheet>.png` (`bun tools/art/review.mjs <sheet> --before f22f144 --picture`; the repaired rows in the world, before and after, are `.artifacts/art/review/world-heights-before-after.png`).

| Sheet | Repair |
|---|---|
| `calla`, `ren`, `ilara`, `auren`, `elowen` | `worldHeight` set from the concept lineup's heights: Calla 1.95 to 2.33, Ren 1.8 to 2.1, Ilara 1.9 to 2.15, Auren 2.05 to 2.39, Elowen 1.7 to 1.86 |
| `custodian`, `custodian-wake` | 0.8 to 1.11 and 1.3 to 1.11, so both stand 0.45 heroes, as the sheet says |
| `thistlehog-blighted`, `boar-blighted` | Set to stand as tall as the well creature they turn into |
| `bee`, `rootsnare-calmed` | Three frames moved 2 or 3 pixels so the body keeps its column |
| `lynx-fight` | A stray pixel beside the side row cleared |

Tried and put back: the frog's hop (the repair slid a frame whose middle is meant to move) and `juniper`'s halo
(old cast, and the rim is not grey enough for the tool to tell from fur).

## The first redraws, through the new pipeline

Each by a Sol helper following the rewritten `make-sprite` skill, judged by the lead beside its sheet.

| Redraw | Branch | Attempts | Verdict | Picture |
|---|---|---|---|---|
| The hero's portrait: calm, glad, troubled | `act1-2d-hero-portrait` (383812b), merged | 1 | PASS. The wedge over his right eye, the navy jacket, cream collar and brass key in all three faces; the old cell is kept in place. | `.artifacts/art/review/portrait-hero-before-after.png` |
| `hero-staff` | `act1-2d-hero-actions` (ef837b0), merged | 1 | PASS with a defect. The costume, the hair colour and the hidden eye are the idle's. The hair is fuller: the head measures 55 pixels wide to the idle's 50, partly the staff beside it. | `.artifacts/art/review/hero-staff.png` |
| `hero-call` | the same | 2 | PASS with a defect. The same kid in every pose; the hair is spikier and 4 pixels wider from the front, and rounder and 5 narrower from the back. | `.artifacts/art/review/hero-call.png` |

| Twenty icons: bows, staffs, keystones, fittings, jackets, pelt, old brass, quill strip, lamp post | `act1-2d-icons` (0e437db), merged | 1 a set, 2 for equipment | ISSUES. Better: the keystones are a triangle, a hexagon and a disc; the grip, hilt and binding are three shapes; the pelt is grey and shaggy; every one holds its edge on parchment. Worse or not there: the bows and staffs are drawn upright and are slivers 12 to 14 pixels wide, the canvas jacket is a flat shirt 12 pixels high, old brass and the quill strip are still not named without a label. Ten are back in the ledger for a second pass. | `.artifacts/art/review/icons-before-after.png` |

The redraws taught the pipeline two things. The icons passed every rule while seven were slivers, so the check
has a new rule, `icon-thin` (the shorter side is 15 pixels or more), and the skill says a long thing lies on the
diagonal. And for the action sheets: the rubric asked the artist to read the head's width off
the picture, and both answers passed a head 4 to 5 pixels off. `review.mjs` now measures the head of the
reference and of the sheet and prints both above the rubric.

## Decisions that are Kausthubh's or the coordinator's

Each has a default the tools follow until someone says otherwise.

1. **Whose proportions?** The hero is 2.6 heads tall and slim; the cast is 2 heads tall and chunky, and reads
   better at the game's size. Either the hero's ten sheets are redrawn to the cast's build, or about 35 cast
   sheets to his. Default: a redo keeps its reference's build, a new person takes the home cast's, and the hero
   stays as approved. Since all eight hero action sheets are on the redraw list anyway, redrawing the hero's
   family in the cast's build is the cheaper way to one look.
2. **The boar's size.** His word was cart size, and in the world it looks right at 1.7 heroes tall. Its concept
   sheet says 1.6 blocks at the shoulder beside a 1.8-block hero. Default: keep the game's size; the `scale`
   fault stays in the ledger until the sheet's number is changed.
3. **More colours.** Adding ramps (honey yellow, crimson, river teal, leaf green, violet, slate) to the locked
   palette lets the cast keep the colours of its sheets. Old art is untouched by new colours. Default: not done;
   an action sheet snaps to its character's colours, a new character to the palette.
4. **The Stag.** At 384 pixels for 11 blocks its pixels are twice the hero's. Drawing it at 64 pixels a block
   needs a frame of about 720 pixels and three sheets past the 1 MB limit for a PNG. Default: left, known in the ledger.

## The redraw list

Worst first. Done for every item is the same check: `bun tools/art/check.mjs` passes the asset with its ledger
entry settled, and for a sheet `assets-src/art-reviews/<sheet>.md` ends `Verdict: PASS`. The second column
adds what the eye must find in the review picture.

| # | Redraw | Concept and reference | Done when, in the picture |
|---|---|---|---|
| 1 | `hero-staff`, `hero-call` (done; a second pass for the hair's width only) | `people-home/hero.webp`; `hero` | Every frame has the idle's navy jacket, brown trousers, dark boots, hair colour and one eye showing from the front |
| 2 | The hero's portrait, three faces (done) | `people-home/hero.webp`; `hero` | The strawberry-blond wedge over his right eye, the navy jacket and cream collar, in all three faces |
| 3 | `hero-moves`, `hero-swing` | the same | The idle's head size within 2 pixels, one eye showing, the idle's build |
| 4 | `hero-cut`, `hero-cut-back`, `hero-bow` | the same | The same, and the back cut's hair the idle's colour |
| 5 | `tamsin` (cast, for the coordinator) | `people-world/tamsin.webp` | A lean older warden 1.09 heroes tall, silver braid, a closed outline round the hair |
| 6 | `maren` (cast, for the coordinator) | `people-world/maren.webp`; her portrait | Nineteen, a pushed-back crown, river teal and a cream front panel, the bob of her portrait |
| 7 | `aldric` (cast, for the coordinator) | `people-world/aldric.webp` | A face with a nose and a mouth at 1x; the oversized coat swallowing his hands |
| 8 | Icons, second pass: two bows and four staffs on the diagonal, the canvas jacket, the lamp post, old brass, the quill strip (the keystones, fittings and pelt are done) | `gear/*.webp`, `goods/*.webp` | Each named without its label at 32 pixels on parchment; no `icon-twin` or `icon-outline` line |
| 9 | `boar-blighted`, `boar-fight` | `creatures/boar.webp` | Drained grey with ash and no glow; stands as tall as `boar` |
| 10 | `custodian`, `custodian-wake`, the Custodian's portrait | `people-old/custodian.webp` | Moss-grey fur and a cream muzzle on all three; a `wake` animation of six frames or more |
| 11 | Elowen's portrait | `people-world/elowen.webp`; `elowen` | Silver hair, white robe, green stole |
| 12 | `calla`, `ilara`, `auren`, `tansy`, `gus` (cast, for the coordinator; colours) | their sheets | Calla's coat grey with no brown, Ilara's tunic leaf green and one Marked hand, Auren's waistcoat burnt orange, Tansy's apron honey yellow, Gus sun-worn. Needs decision 3 first |
| 13 | Work, carry, kneel, give, sleep and seated poses | `bun tools/art/check.mjs --poses` | Each pose exists under its contract name and passes as its character |
| 14 | `lynx`, `lynx-fight` | `creatures/lynx.webp` | Pixels no more than twice the size of the fox's |
| 15 | The Stag's three sheets | `people-old/stag.webp` | Decision 4 first |

The story lead (`act1-lead-story`) has the vault keepers, the Blighted fox's reveal, the guildmaster, the
market's townsfolk and the dinner and blessing poses; those are marked `owner` in the ledger and left out here.

## What the check cannot see

It compares colours, sizes and positions. It cannot tell that a face shows an eye the idle hides, that a queen
reads as a child, that a nose is a streak, or that a coat is the wrong green when the wrong green is as common
in the sheet as the right one. Those are in the `eyes` field of the ledger for today's art and in the rubric for
tomorrow's.
