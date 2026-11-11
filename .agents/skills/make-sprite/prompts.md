# Prompt patterns

The exact prompts behind every sheet in the game are in `assets-src/prompts.json` (the first five
characters, the first atlas, the first icons), `assets-src/block-prompts-2.json` (one prompt for each
tile) and `assets-src/prompts-3.json` (the townspeople, portraits, crops, icons, interface art). Copy the
pattern for your kind, fill the slots in `<angle brackets>` and change nothing else. Each clause is there
because of a failure it prevents.

## A person or a creature, from the front, the back and the side

Run three made nine characters with this text (eight people and the leaftail). All nine kept their
identity across the three views, and eight needed one attempt. It is `spriteBase` in `prompts-3.json`,
followed by one subject line. Run one's five characters used an earlier wording of the same clauses
(`prompts.json`). If your tool takes a reference image, attach `.artifacts/sprites/side-by-side-3.png`
and keep the last sentence. If it does not, drop that sentence and `matching the reference villager`.

```
Use case: stylized-concept. Production sprite sheet for cozy anime pixel RPG, warm top-left light,
dark brown tinted outlines, chunky pixel clusters, large head and small feet, matching the reference villager.
Transparent background, NO text, NO grids, NO cast shadows, no ground.
STRICT rectangular uniform grid FOUR columns SIX rows, 24 equal cells. Every cell contains exactly one
whole character with ample transparent padding.
Rows 1-3 idle: front, back (no face), right profile; all four columns repeat idle variations.
Rows 4-6 walk: front, back, right profile, four distinct step phases feet apart / passing / opposite apart / passing.
Same character, clothes, accessories and proportions throughout. Feet baseline equal in each cell.
Full body visible including head and shoes, nothing crosses cell boundaries.
Reference shows existing approved style only; generate a NEW character.
<NAME, who they are, then five or six big colored shapes. What they must not have.>
```

A subject line that worked: `MAREN, young adult woman queen age 19, thin gold circlet, chestnut
shoulder-length hair, muted forest green dress and cream work apron, tired eyes. No crown towers,
ordinary worker shoes.`

| Clause | What it prevents |
|---|---|
| One image holds all six rows | A second image is a second character. Never generate the back or the side on its own. |
| `Same character, clothes, accessories and proportions throughout` and the subject line | Drift between rows. The subject line is what the generator repeats. |
| Five or six big colored shapes: hair, headwear, top, bottom, shoes, one carried thing | Big shapes survive all three views (a red headscarf, a straw hat, a navy coat). Fine detail drifts or vanishes at 128 pixels: cloak folds, hair highlights, a pencil behind an ear. |
| `STRICT ... FOUR columns SIX rows`, rows named in order | The build cuts equal cells in this order. Two sheets (Gus, Wren) came back with the directions in columns, and Gus with uneven rows. Each needed a special case in `build-story.mjs`. Generate again before you write a third. |
| `back (no face)`, `right profile` | A back view with a face, and profiles facing left. The game mirrors the side view for left. |
| `Feet baseline equal`, `Same ... proportions` | Heads that change size between rows. The build uses one scale for the whole sheet. |
| `NO cast shadows, no ground`, `Transparent background` | The game draws the shadow. A painted one moves the feet off the anchor. |
| `ample transparent padding`, `nothing crosses cell boundaries` | A hat or a rod cut by the cell edge, and scraps of a neighbor inside a frame. |
| `dark brown tinted outlines` | Pure black outlines, which no sprite in the set has. |

Say `No teal` in the subject line unless the thing is magic. Lume teal is for magic and old machines only.

**A white background instead of a transparent one.** It leaves a pale fringe on the outline after the
build. Wren's first attempt had it. Ask the tool to edit that same image, with the retry prompt from
`prompts-3.json`: `Remove all white background and grid lines, preserve character, genuine transparent background.`
If the sheet is already built, `bun tools/sprites/defringe.mjs <sheet>` peels the rim off and sets each frame back on
its anchor. `bun tools/sprite-fringe.mjs` measures it, and the sprite check fails a sheet that has one.

**A creature seen from one side** (the lanternfly): `FOUR columns ONE row, four equal square cells`, one
pose per cell, `Identical body size and center in each frame`, and `no glow haze outside silhouette` for
anything that glows. The full text is `lanternfly` in `prompts-3.json`.

## A block tile

One image for each tile. The first run asked for the whole atlas in one image: the tiles did not repeat
cleanly on their own, and the clay cell came back as roof tiles.

```
Use case: stylized-concept. Asset: one full-bleed square seamless block-face texture for a cozy painted
pixel-art RPG. <Material: its color, its grain, and what it must not show>.
Orthographic flat material surface only, no object perspective. Target 32x32 game pixels,
fine 1-2 pixel clusters, extremely low contrast. Uniform average brightness across the entire tile,
no directional lighting, gradient, edge shadow, vignette, broad bands or large motif.
Quiet repetition in both axes. No text.
```

- Name the wrong reading in the material line: `NOT roof tiles`, `no purple`, `NO top fringe`, `no dark canopy gaps`. Each of those was a real first result.
- `Uniform average brightness ... no directional lighting, gradient` keeps a tile under the banding rule. A lit tile repeats as stripes.
- For a material with drawn structure, ask for the structure by name: `small staggered stone bricks, subtle quiet joints`. Its contrast comes back in `compose-blocks.mjs`, so the prompt can stay quiet.

## Icons

```
Use case: stylized-concept. Cozy anime RPG inventory PIXEL ART ICON SHEET. Four columns FOUR rows,
16 equal square cells, transparent background, one small icon centered per cell, clear dark tinted brown
outline and warm top-left light, chunky readable pixel clusters with earth tones.
NO lettering, NO grid, NO shadow, no repeated items.
Row1 left to right: <four objects>. Row2: <four objects>. Row3: <four objects>. Row4: <four objects>.
Equal margins, each fits cleanly in own cell, same cozy ochre green rust brass palette as farming game.
Designed to reduce to 32x32 pixels each.
```

Name each object in capitals with one or two words of material or color: `wooden PLANK`, `metal WATERING CAN`,
`closed wooden CHEST with brass latch`. The order you list them in is the order of the cells. Draw each
object as one connected piece, because the build keeps only the largest piece in a cell. For fewer than
16, shrink the grid (`TWO columns TWO rows`) and keep the cells square.

## Portraits

```
Use case: stylized-concept. Cozy anime RPG PIXEL ART PORTRAIT atlas, 3 columns by 3 rows, nine equal square cells.
Genuine transparent background, no words, no grid lines, no shadows.
Each tile one head-and-shoulders bust facing slightly LEFT, with dark tinted brown outline, warm top-left light,
chunky pixels and clear expression. Match the identities in reference overview, not full bodies.
Row1 left to right: <person>; <person>; <person>. Row2: ... Row3: ...
Keep all faces in left three-quarter orientation. Each bust fits fully in tile with transparent margin.
```

For each person, reuse the words of that person's sprite subject line. The portrait and the sprite must
be the same person, and the shared words are what tie them. A portrait holds more detail than a 128 pixel
sprite, so age and expression belong here: `show wrinkles and sixty-year-old face`.
