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

- **Sprites.** One sheet per character. Each row is one animation seen from one direction, and each column is one frame. `rows` names the row for `front`, `back` and `side`. The side view faces right. An animation with one direction lists only `front`.
- **`anchor`** is the pixel in a frame where the feet touch the ground. **`worldHeight`** is how tall one frame is in blocks.
- **Blocks.** One atlas of square tiles. A tile name maps to a list of cells, `[column, row]`. More than one cell means variants, and the game picks one by position.
- **Icons.** One sheet of square tiles, each named.
- Paths are relative to `public/assets/`. Every image is a PNG with a transparent background where it needs one.

Additional manifest sections use the same PNG contract:

- `icons.sheets.<set>` has `tile`, `sheet`, and `names`, with one `[column,row]` per icon.
- `portraits` has `tile:128`, `sheet`, and `names`.
- `crops` has `tile:32`, `sheet`, and `names`, with a list of cells per crop's stages.
- `ui` maps image names to PNG paths.
- `materials` has `tile:32`, `sheet`, and `names`. A material is drawn over a frozen tile of `blocks.atlas` when the game loads: `MATERIALS` in `src/game/shell/art.ts` maps the tile to the material (today `oak_plank` to `oak_boards`). The atlas file and its baseline stay as they were approved.

`sprites.hero-swing` is a separate action sheet. Its `tool` animation uses rows 0 front,
1 back and 2 right-facing side, three frames at 9 fps, frame 128-square, anchor `[64,120]`,
world height 2. `sprites.hero` remains approved and unchanged.

## Optional Blender models

The look test permits code-generated GLB files under `public/assets/models/`.
The optional `models` object maps a model name to `file` relative to assets,
`seed`, `triangles`, `budget` and `bytes`. For example,
`"tree-17": {"file":"models/tree-17.glb","seed":17,"triangles":1464,"budget":1500,"bytes":140560}`.
The build command writes actual counts. The verifier reads each GLB and checks
the declared counts, byte size, one triangle primitive and the 1500/300 caps.
They are loaded only by the optional `?models=1` look view.

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
- **Cost.** 40 credits a second of sound asked for. The tool prices a run first and stops above 30,000 credits.
  The whole set is about 16,000.

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
- **Cost.** The tool prices a run before it makes anything and stops above 40,000 credits. v4 Turbo bills half a
  credit a character.

