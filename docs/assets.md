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
