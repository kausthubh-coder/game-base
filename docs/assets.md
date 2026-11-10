# The asset contract

`public/assets/manifest.json` is the only thing the game reads to find a sprite, a texture or an icon.
The sprite pipeline writes it. The game never guesses a file name.

```json
{
  "version": 1,
  "sprites": {
    "hero": {
      "sheet": "sprites/hero.png",
      "frame": [128, 128],
      "anchor": [64, 120],
      "worldHeight": 2.0,
      "animations": {
        "idle": { "frames": 4, "fps": 4, "rows": { "front": 0, "back": 1, "side": 2 } },
        "walk": { "frames": 6, "fps": 10, "rows": { "front": 3, "back": 4, "side": 5 } }
      }
    }
  },
  "blocks": {
    "tile": 32,
    "atlas": "blocks/atlas.png",
    "tiles": { "grass_top": [[0, 0], [1, 0], [2, 0]], "dirt": [[3, 0]] }
  },
  "icons": {
    "tile": 32,
    "sheet": "icons/icons.png",
    "names": { "wood": [0, 0], "stone": [1, 0] }
  }
}
```

- **Sprites.** One sheet per character. Each row is one animation seen from one direction, and each column is one frame. `rows` names the row for `front`, `back` and `side`. The side view faces right. An animation with one direction lists only `front`.
- **`anchor`** is the pixel in a frame where the feet touch the ground. **`worldHeight`** is how tall one frame is in blocks.
- **Blocks.** One atlas of square tiles. A tile name maps to a list of cells, `[column, row]`. More than one cell means variants, and the game picks one by position.
- **Icons.** One sheet of square tiles, each named.
- Paths are relative to `public/assets/`. Every image is a PNG with a transparent background where it needs one.
