# The asset contract

`public/assets/manifest.json` is the only thing the game reads to find a sprite, a texture or an icon.
The sprite pipeline writes it. The game never guesses a file name.

```json
{
  "version": 1,
  "sprites": {
    "hero": {
      "sheet": "sprites/hero.png",
      "frame": [
        128,
        128
      ],
      "anchor": [
        64,
        120
      ],
      "worldHeight": 2.0,
      "animations": {
        "idle": {
          "frames": 4,
          "fps": 4,
          "rows": {
            "front": 0,
            "back": 1,
            "side": 2
          }
        },
        "walk": {
          "frames": 6,
          "fps": 10,
          "rows": {
            "front": 3,
            "back": 4,
            "side": 5
          }
        }
      }
    }
  },
  "blocks": {
    "tile": 32,
    "atlas": "blocks/atlas.png",
    "tiles": {
      "grass_top": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          2,
          0
        ]
      ],
      "dirt": [
        [
          3,
          0
        ]
      ]
    }
  },
  "icons": {
    "tile": 32,
    "sheet": "icons/icons.png",
    "names": {
      "wood": [
        0,
        0
      ],
      "stone": [
        1,
        0
      ]
    },
    "sheets": {
      "story": {
        "tile": 32,
        "sheet": "icons/icons-2.png",
        "names": {
          "plank": [
            0,
            0
          ]
        }
      }
    }
  },
  "portraits": {
    "tile": 128,
    "sheet": "portraits/portraits.png",
    "names": {
      "tamsin": [
        0,
        0
      ]
    }
  },
  "crops": {
    "tile": 32,
    "sheet": "crops/crops.png",
    "names": {
      "wheat": [
        [
          0,
          0
        ],
        [
          1,
          0
        ],
        [
          2,
          0
        ],
        [
          3,
          0
        ]
      ]
    }
  },
  "ui": {
    "panel": "ui/panel.png",
    "button": "ui/button.png",
    "title": "ui/title.png"
  },
  "materials": {
    "tile": 32,
    "sheet": "blocks/oak-boards.png",
    "names": {
      "oak_boards": [
        0,
        0
      ]
    }
  }
}
```

- **Sprites.** A character's first sheet has its idle and walk. An action or pose sheet is `<character>-<set>`
  (`hero-swing`, `hero-camp`, `custodian-wake`), and a recolour of the same body is `<character>-<form>`
  (`fox-blighted`). Each row is one animation seen from one direction, and each column is one frame. `rows` names
  the row for `front`, `back` and `side`. The side view faces right. An animation with one direction lists only
  `front`.
- **`anchor`** is the pixel in a frame where the feet touch the ground. **`worldHeight`** is how tall one frame is
  in blocks, so a figure drawn `d` pixels tall in a frame `f` pixels high stands `d / f * worldHeight` blocks. Every
  sheet of one character stands the same height.
- **Blocks.** One atlas of square tiles. A tile name maps to a list of cells, `[column, row]`. More than one cell means variants, and the game picks one by position.
- **Icons.** One sheet of square tiles, each named.
- Paths are relative to `public/assets/`. Every image is a PNG with a transparent background where it needs one.
- The build (`tools/asset-build.mjs`) ships each PNG as a lossless WebP when that is smaller, with the same pixels, so the built manifest names `.webp` files. It also preloads, in the built page, every file the first frame waits for.

Additional manifest sections use the same PNG contract:

- `icons.sheets.<set>` has `tile`, `sheet`, and `names`, with one `[column,row]` per icon.
- `portraits` has `tile:128`, `sheet`, and `names`. Its atlas has three columns and may grow by whole rows. Act 1 names have `-calm`, `-glad`, and `-troubled` expression keys; the bare name selects calm. `bun tools/sprites/people-world.mjs` rebuilds the cast and these portraits from retained generated sources in `assets-src/people-world/`. The original nine portrait cells remain at their original coordinates.
- `crops` has `tile:32`, `sheet`, and `names`, with a list of cells per crop's stages.
- `ui` maps image names to PNG paths.
- `materials` has `tile:32`, `sheet`, and `names`. A material is drawn over a frozen tile of `blocks.atlas` when the game loads: `MATERIALS` in `src/game/shell/art.ts` maps the tile to the material (today `oak_plank` to `oak_boards`). The atlas file and its baseline stay as they were approved.

`sprites.hero-swing` is a separate action sheet. Its `tool` animation uses rows 0 front,
1 back and 2 right-facing side, three frames at 9 fps, frame 128-square, anchor `[64,120]`,
world height 2. `sprites.hero` remains approved and unchanged.

## One style, as data

Three files in `assets-src/` say how the 2D set is drawn and who is in it. The tools in `tools/art/` read them, and
no tool keeps a copy of a value from them.

| File | Holds | Changed by |
|---|---|---|
| `art-style.json` | Frame and anchor by kind (`person` 128 and `[64,120]`, `creature` 96 and `[48,88]`, `giant` 192 or 384), the hero's 64 pixels a block, the outline ramp, the light's side, the grounds the review pictures use, and `limits`: the most a sheet may be off each rule | The 2D lead, on purpose, with the reason in the commit |
| `art-contract.json` | `characters`: each one's `kind`, `concept` sheet and `crop`, `stated` height (its metres or blocks and the hero's on that sheet), its action `sheets` and recolour `variants`, and the flags `flies`, `mixed`, `glow`. `poses`: the names an animation may have. `wanted`: poses the act asks for and no sheet has | Whoever adds a character or a sheet |
| `art-ledger.json` | For each asset as audited: the rules it breaks (`known`), the hash it had (`sha`), a `grade`, how often it is `seen`, what the `eyes` saw | `bun tools/art/check.mjs --ledger` (the lead's audit) and `--settle <key>` (when a redraw passes) |

| Command | Does |
|---|---|
| `bun tools/art/check.mjs [names]` | Every sheet, portrait and icon against the style and the contract. A sheet whose file and manifest entry match its ledger entry may break the rules listed there; a new or changed one passes every rule and has an answered review. `--list` is the redraw list, `--poses` the wanted poses. Part of `bun tools/verify-assets.mjs` |
| `bun tools/art/review.mjs <sheet> --quick` | The look after every change: the sheet to scale beside the hero, its concept, every frame. No browser, a second |
| `bun tools/art/review.mjs <sheet> [--before <ref>]` | The review: the sheet before, its reference and the sheet now, with the rubric file `assets-src/art-reviews/<sheet>.md`. No browser. `--world --url <game>` in the look lane adds it standing in the game |
| `bun tools/art/see.mjs [--only ...]` | Contact sheets of everything, in `.artifacts/art/see/` |
| `bun tools/art/repair.mjs <sheet> --height / --anchor / --defringe` | What a tool can put right without drawing |

The rules and their fixes are in `.agents/skills/make-sprite/check-failures.md`; the audit that filled the ledger is
`docs/act1-2d-audit.md`.

Portrait colour ranking counts distinct characters from `art-contract.json`.
An action or variant contributes its character's closest competing head, but
does not add another competitor. The portrait's own similarity still uses its
base sprite. This prevents added action sheets from manufacturing new identity
failures. The rank and similarity limits remain in `art-style.json`; the contact
sheet and checker use the same calculation. A changed ranking is a diagnostic
correction, not proof that an existing portrait's visual defects were repaired.

A scene asks for a pose as `{ sprite, anim }` with a stand-in (`src/game/content/cutscenes.ts`), so a pose sheet
is drawn the day it merges and nothing breaks before. Its animation names come from `poses` in the contract.

## The interface kit

`uikit` lists the painted interface pieces in `public/assets/ui/kit/`: `images` maps a name to a PNG, and `tabs` is a
sheet of 96 px gold line icons. The loader parses it but never fetches it, so it costs the first frame nothing; the
page loads each file when CSS first draws it. `docs/ui-look.md` describes the kit, and the `make-ui` skill says how
to add a piece.

## Optional Blender models

The look test permits code-generated GLB files under `public/assets/models/`.
The optional `models` object maps a model name to `file` relative to assets,
`seed`, `triangles`, `budget` and `bytes`. For example,
`"tree-17": {"file":"models/tree-17.glb","seed":17,"triangles":1464,"budget":1500,"bytes":140560}`.
The build command writes actual counts. The verifier reads each GLB and checks
the declared counts, byte size, one triangle primitive and the 1500/300 caps.
They are loaded only by the optional `?models=1` look view.

The Hollowmere town kit is listed there too, as `town-<name>` with `file`
`models/town/<name>.glb`, `triangles`, `budget` and `bytes` and no seed. Each
has two primitives, its Body and its Glow, and the kit's own budget, at most
8000. Its GLBs are Draco-compressed and made by `bun tools/models/town.mjs`
from `assets-src/models/town/` (`--rebuild` re-exports the `.blend` sources
first). The town view fetches them only as the hero nears Hollowmere, so they
are not part of the first load.

The whole of `public/assets` must stay under 30 MB.

## The cast

The optional `cast` object lists the characters drawn when Characters is "3D models": one GLB each under
`public/assets/models/cast-<name>.glb`, exported from a hand-made Blender source in `assets-src/cast/sources/` by
`bun tools/models/cast/build.mjs` (also run by `tools/models/build.mjs`). Each entry has `file`, `source`, `triangles`,
`budget` (4000 for a person, 2000 for a creature) and `bytes`. For example,
`"hero": {"file":"models/cast-hero.glb","source":"assets-src/cast/sources/hero.blend","triangles":3400,"budget":4000,"bytes":149716}`.
The verifier reads each GLB and checks the counts, the byte size and that the source exists.

## The painted world's textures

The painted world (`src/features/painted`) draws its land, trees, rocks, grass tufts and clouds with twelve
paintings: a brush-mark texture, the meadow, bark, rock, two grass tufts and six clouds.

- **The files.** `public/assets/painted/<name>.webp`. `manifest.json` lists them as
  `"painted": { "textures": { "<name>": "painted/<name>.webp" } }`.
- **Where they come from.** Generated images, kept out of git in `assets-src/ghibli/raw`, with their prompts
  in `assets-src/ghibli/prompts.json`. `bun tools/ghibli-assets.mjs` cuts and scales them for the painted
  meadow test scene (`demos/ghibli/assets`) and copies these twelve into `public/assets/painted`.
- **When one is missing.** The feature draws a stand-in by code, so the world is always drawn. The leaf sprays
  and the flowers are always drawn by code and have no file.

## Recorded sounds

Ambience beds, footsteps, tool strikes, hand sounds and the town's spot sounds. `bun --env-file=.env.local
tools/sound.ts` makes them ahead of time with ElevenLabs' sound effects model (`eleven_text_to_sound_v3`).

- **The prompts.** `src/content/sound-samples.ts`, one entry a sound: its kind, prompt, length, takes and level.
  A `bed` is asked for as a loop. `steps` and `hits` are one take of many footfalls or strikes, which the tool
  cuts into slices. A `shot` is a whole one-shot, several takes. A `grain` is a rustle the engine plays short
  windows of.
- **The files.** `public/assets/sound/<id>.mp3`, 44.1 kHz: beds stereo at 96 kbit/s, the rest mono at 64.
  The tool takes the rumble out, levels each file (beds by LUFS, the rest by peak), folds each bed's end into
  its start, and lays slices end to end with 80 ms of silence around each.
- **The list.** `manifest.json` has `"sound": { "list": "sound/sound.json", "model": ... }`. `sound/sound.json`
  has `sounds`, keyed by id, each with `file`, `kind`, `seconds`, `channels`, `slices` ([start, length] in
  seconds), and the measured `lufs` and `peak`.
- **Kept out of the game.** `assets-src/sound/report.json` (each prompt, its hash and its measures). The raw takes
  go to `assets-src/raw/sound/`, which git ignores; `bun tools/sound.ts --process` cuts and levels again from them
  without asking ElevenLabs for anything. A prompt that changes is asked for again; nothing else is.
  A new worktree has no raw takes, and a run there would leave every sound without its takes out of the list:
  copy `assets-src/raw/sound/` from a checkout that has them first, then `--dry` must say only your new
  sounds are to be asked for. `--ids a,b` asks for those alone.
- **Cost.** About 11 credits a second of sound asked for, measured on the account's own counter on 2026-11-12
  (198 credits for an 18 second bed). The tool prices a run first and stops above 30,000 credits.

## Voiced lines

Spoken dialogue. `bun --env-file=.env.local tools/voice.ts` makes them ahead of time with
ElevenLabs. The game never calls ElevenLabs, and the key never leaves `.env.local`.

- **Who speaks.** `src/game/content/cast.ts` lists each voiced person's ElevenLabs voice and settings, the model
  (`eleven_v4_turbo`) and the format (mono mp3, 64 kbit/s). `DIRECTION` there gives a line audio tags such as
  `[sighs]`. A stage cue in the text, such as `(waking)`, is never spoken. Narration, the player's choices and
  anyone not in the cast are not voiced: their lines type and blip as before.
- **The files.** `public/assets/voice/<speaker>/<hash>.mp3`, one clip a line. The hash is of the words given to
  the voice, the voice, the model, the settings and the format, so the tool makes a clip again only when one of
  those changes, and deletes the clip of a line that is gone.
- **The list.** `manifest.json` has `"voice": { "lines": "voice/voice.json", "model": "eleven_v4_turbo" }`.
  `voice/voice.json` has `lines`, keyed by `<speaker>|<text as the box shows it>`, each with `file` (relative to
  `public/assets/`), `seconds` and `reveal`: for each character of the text, the millisecond of the clip it
  appears at (from ElevenLabs' character timings). `conversations` maps a conversation id to the keys it may
  play, so the game fetches them when the talk starts.
- **Kept out of the game.** `assets-src/voice/report.json` (what each clip was made from, its transcript by
  ElevenLabs Scribe and the share of its words heard) and `assets-src/voice/align/` (the raw character timings).
- **Auditions.** `tools/voice/audition.ts` has each candidate in `tools/voice/auditions.ts` say two of a person's
  own lines, made exactly as `tools/voice.ts` would make them, into `assets-src/voice/auditions/<speaker>/<candidate>/`
  with their measures in `auditions.json` (pitch, words a second, what Scribe heard). `tools/voice.ts` copies a take
  whose hash matches a line instead of buying it again, so swapping in another candidate costs only the person's
  other lines.
- **Cost.** The tool prices a run before it makes anything and stops above 40,000 credits. It prices at half a
  credit a character, the rate the API lists for v4 Turbo; the account's own counter charged about 0.2 a character
  on 2026-11-12, so the price is an upper bound.


## Offline ground contact

An asymmetric grounded sprite may declare `groundContact` in `story-config.mjs`.
It maps every used `row:column` to an inclusive `[left,top,right,bottom]`
rectangle. It is source/check data and is not shipped in the runtime manifest.
Both complete sprite commands use `validateSpriteGeometry` in
`tools/sprites/geometry.mjs`. Without metadata the original bounding-box centre
check runs unchanged. With metadata the checker measures the bounds of actual
opaque support pixels, with the same six-pixel horizontal tolerance. It still
checks the complete silhouette's baseline and padding. Palette, alpha, size,
animations, frozen hashes and art reviews retain their separate existing checks.

Regions include the complete lateral support at the sole band, with transparent
side columns, at least five rows through the actual baseline, and no omitted
used frame. A side column through an opaque sole fails. The top can cross a
lower leg. A walking region includes the raised foot and keeps the source sway;
it does not move each frame to follow whichever foot happens to be grounded.
The Braid tool band starts at row 116 because the side-strike axe connects to
the boot at rows 113–115 and separates at 116. Its ground pixels outside that
region do not define stance and still receive the full-frame clipping check.

A rectangle cannot identify a boot semantically. Review all overlays against
the actual pixels, including both feet, the raised foot, and any grounded
weapon. Do not generate regions anew to conceal a moved body. Braid's retained
regions are `assets-src/hero-braid/ground-contact.json`; they require the actual
pixel regressions in `bun test tools/sprites/geometry.test.mjs`. Inspect overlays
with `bun tools/sprites/contact-overlays.mjs <name> <output-folder>` after edits.
