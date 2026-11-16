---
name: make-sprite
description: Add or redo a generated sprite, action or pose sheet, creature, icon, portrait or block tile from its approved concept sheet, in the game's one pixel cast style, through the art check and a review picture its artist answers. Also the redraw list, and the repairs a tool does without redrawing.
---

# Make a sprite

A sheet is done when `bun tools/art/check.mjs` passes it with no ledger entry, its review is answered from the
picture, and you have said which frames you looked at. You look at the sheet beside the hero after every change
(section 5), not once at the end. Every earlier check passed on a hero drawn as another kid,
a custodian in two sizes and a portrait of someone else, so the picture and the rubric are the gate, and the
numbers come first only because they are cheap.

Use an image generation tool with the concept sheet and the reference sprite attached; without one, report
BLOCKED. Scripts cut, clean, scale, snap colours and place frames. Drawing or recolouring pixels in code or by hand
is outside this workflow.

## The data every tool reads

| File | Holds |
|---|---|
| `assets-src/art-style.json` | The style: frame and anchor by kind, pixels a block, outline, light, and every limit the check enforces |
| `assets-src/art-contract.json` | Each character: kind, concept sheet and crop, stated height, its action sheets (`sheets`), its recolours (`variants`), the pose names an animation may have |
| `assets-src/art-ledger.json` | What each shipped asset breaks today, its grade and what the eye saw. The redraw list: `bun tools/art/check.mjs --list` |
| `assets-src/palette.json` | The locked colours |

Read the style and the contract entry of your character before prompting. A value you need that is in neither:
ask the lead; do not invent it in a prompt.

## 1. Take the job from the sheet

1. Find the character in the contract. A new one gets an entry first: `kind`, `concept`, `crop` (x, y, width,
   height of the full figure on the concept sheet), `stated` (its height in metres or blocks and the hero's on that
   sheet). An action or pose sheet goes in its character's `sheets`; a recolour of the same body in `variants`.
   **No approved concept sheet, no new character**: stop and ask. A redo of a sheet that ships needs none: its
   reference is the character's first sheet.
2. Run `bun tools/art/review.mjs <character> --quick` and open the picture. This is your reference card: the figure at
   128 pixels a block beside the hero, its concept crop, every frame.
3. Write down, from the concept and the reference: the hair's shape and colour, how many eyes show from the front,
   the five or six big coloured shapes (headwear, top, bottom, footwear, one carried thing), and the height in
   heroes. These words go into the prompt and are what the rubric asks back.

The concept's README notes win over its painting. Ignore its lettering, parchment, soft light and its own pixel
studies.

## 2. One cast style

The shipped set is the style, whatever the concept's painting looks like.

- Light from the upper left. Outline dark and tinted (`outline.ramp` in the style), one or two pixels, closed all
  the way round, never black, never a pale rim.
- A person is drawn about 110 pixels tall in a 128 frame. A redo keeps its reference's head size to the pixel. A
  new person takes the home cast's build (Hobb, Dax, Mina: about 2 heads tall, a head near 55 pixels high); the
  hero alone is 2.6 heads tall, and whether the cast follows him or he follows them is Kausthubh's to pick
  (`docs/act1-2d-audit.md`). A taller or shorter person is drawn so, within 96 to 114 pixels, and `--height` sets
  the rest through `worldHeight`.
- A creature is drawn about 68 pixels tall in a 96 frame. Its pixels stay between half and twice the hero's
  (`limits.density`), so a tiny creature is drawn small in its frame, not shrunk by the game.
- Transparent background, hard alpha, no floor shadow. The side faces right, the back shows no face.
- Blight is drained grey with ash, never glowing cracks. Bright teal is lume: magic and old machines only.
- An icon fits inside 28 of its 32 pixels with a dark outline that holds on parchment, and a silhouette unlike
  every other icon of its set. A long thing (a staff, a bow, a post) lies on the diagonal so it fills the slot.
- A portrait is the sprite's person: same hair, skin, headwear and top colours. Three faces, `-calm`, `-glad`,
  `-troubled`; the bare name is calm.

## 3. Generate

1. Take the prompt of your kind from [prompts.md](prompts.md). Attach the reference card's sprite (or the
   character's own idle sheet for an action sheet) and the concept crop.
2. Name animations from the contract's `poses` list. A scene asks for `{ sprite, anim }` with a stand-in, so a
   pose sheet is `<character>-<set>` (as `hero-camp` holds `sit`, `look`, `rise`) and is picked up the day it merges.
3. Keep the source in `assets-src/` beside the set's other sources, with the prompt and every attempt in the
   set's prompts file. Three attempts at most; keep the best.

## 4. Build

Use the builder that owns the sheet (`git grep -n "<name>" -- tools/sprites`): `act1-hero.mjs` for a `hero-*`
sheet, `people-world.mjs`, `home.mjs`, `beasts-act1.mjs`, `critters.mjs`, `act1-icons.mjs`, or a new
`storySprites` entry in `story-config.mjs` built by `build-story.mjs`. A new builder is a last resort.

A new builder scales with `fittedMode` from `tools/sprites/lib.mjs`, which keeps a thin outline closed where
nearest-neighbour scaling breaks it. A builder that already ships keeps `fitted`, so rerunning it changes nothing.

An action sheet is snapped to its character's own colours, as `act1-hero.mjs` does. The whole palette's nearest
shade sits several steps off and turns teal to olive and orange to maroon.

Then let the tools put right what needs no artist:

```sh
bun tools/art/repair.mjs <sheet> --height     # stands as tall as its concept sheet says, or as its character's first sheet
bun tools/art/repair.mjs <sheet> --anchor     # feet on the anchor's row; in a loop the body keeps one column
bun tools/art/repair.mjs <sheet> --defringe   # specks, soft pixels and a pale rim
```

`--anchor` is for bodies that stay whole. Leave it off a frame that leaps or stretches (a frog's hop): it would
slide the frame to hold a middle that is meant to move.

## 5. Look after every change

```sh
bun tools/art/review.mjs <sheet> --quick
```

It writes `.artifacts/art/review/<sheet>-quick.png` in about a second, with no browser and no slot: the figure
to scale beside the hero on day and night ground, its concept sheet, every frame, each animation's frames laid
over each other. Open it after every build and every repair, before the next change, and compare the first front
frame with the hero beside it and with the concept. A fault seen now costs one build; the same fault found at the
review costs the sheet. A portrait: `bun tools/art/see.mjs --only portraits --names <who>`. An icon:
`bun tools/art/see.mjs --only icons`. Both draw without a browser in under a minute.

## 6. Check

```sh
bun tools/art/check.mjs <sheet>
```

Every `FAIL` line names a rule; [check-failures.md](check-failures.md) has each rule's meaning and fix. Fix the
art or the build and run again until the only line left is `review`. A fault is never added to the ledger to
pass: the ledger is the lead's audit. With a sheet's name the check skips portraits and icons; run it with no
name for those.

## 7. Review

```sh
bun tools/art/review.mjs <sheet> --before HEAD
```

It writes `.artifacts/art/review/<sheet>.png`: the sheet before, the reference, the sheet now; `<sheet>.webp`
plays the animations; and `assets-src/art-reviews/<sheet>.md` holds the measured heads and the rubric. No
browser: a sprite sheet is judged from these cards.

Open the picture and the animation. Answer every question in the rubric from what you see, naming frames. The
sheet fails when any frame shows another head (hair outline, fringe, an eye that was hidden, a head over 2 pixels
wider or taller), another body, another costume or colour, another view (a side facing left, a face on the back),
a jump between frames, or another style (soft shading, a pale or black outline). When unsure, it fails: write
`Verdict: FAIL` with the frames, and generate again with the reference attached. Three failed attempts: stop and
report the best with its defects.

`bun tools/art/check.mjs <sheet>` passes once the rubric is answered for this exact file and ends
`Verdict: PASS`. Changing the sheet afterwards voids the review.

**In the game.** For a new character, a creature whose size changed, or a giant, add the world rows, which show
the game's light and camera on it:

```sh
PORT=<the doctor's port> bun run dev &          # outside the queue; note the pid, stop it by that pid when done
bun tools/slot.mjs --look -- bun tools/art/review.mjs <sheet> --world --url http://localhost:$PORT
```

One page load and one shot, about 15 seconds; `--night` adds the night. The look lane (`--look`) is for this:
a short job that makes a picture, two at once, stopped after 5 minutes. Checks (`bun tools/verify-assets.mjs`,
`bun run check`) go in the heavy lane, once a slice, never in one command with a picture. A portrait in the real
dialogue box: `bun tools/slot.mjs --look -- bun tools/art/see.mjs --only talk --names <who> --url ...`.

Icons and portraits have no rubric file. Judge them by section 2 in the pictures of section 5: an icon named
without its label at 32 pixels on parchment, a portrait that is its sprite.

## 8. Done and the report

Done: `bun tools/art/check.mjs` and `bun tools/verify-assets.mjs` pass, the review ends `Verdict: PASS`, and the
sheet's ledger entry is gone (`bun tools/art/check.mjs --settle <sheet>`, which refuses while a rule still fails).

Report PASS only then. Give the manifest names a caller can wire, the review picture's path, every defect you
left and the attempts you kept.

## Frozen files

`assets-src/block-baseline-2.json` and `story-baseline-3.json` pin the hero, the two villagers, the pet, the
critter, the first icon sheet and the block atlas by hash. Leave them unless your brief names the file; then
replace that one hash and say which and why in the commit. A new block tile is published through
`build-valley-tile.mjs` and `manifest.materials`, which `MATERIALS` in `src/game/shell/art.ts` draws over a
frozen tile.
