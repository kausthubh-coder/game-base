# Style sheet

Every asset reads this file. It is the reason a new asset fits the old ones.

| Rule | Value |
|---|---|
| Mood | Cozy anime RPG. Warm light, friendly shapes, clear silhouettes. |
| Light | From the top left. Warm by day, blue at night. |
| Block textures | 32 by 32 pixels for one block face. Painted, soft edges, low contrast inside a tile so tiles do not shout. They must tile with themselves. |
| Characters | Pixel art with a dark tinted outline, never pure black. Big heads, small feet. About 2 blocks tall. |
| Frames | 128 by 128 for people. 96 by 96 for pets and small creatures. Feet stand on the anchor point. |
| Directions | Front, back and side. The side view faces right, and the game mirrors it for left. |
| Colors | One locked palette, `assets-src/palette.png`, about 48 colors. A script snaps every image to it. |
| Background | Fully transparent. No ground shadow in the sprite, because the game draws it. |
| Lume | A teal that always glows. Keep that teal for magic and old machines only. |
| 3D props | Built in code from simple shapes. Chunky, slightly rounded, readable from above at a 35 degree camera. Budget: 300 triangles for a small prop, 1,500 for a tree, 6,000 for a building. |

Reference images, for mood and palette only:

- `~/dev/sandbox/game-look-test/mockups/B1-side-25d-village.jpg` and `C1-fixed-3d-village.jpg`
- `~/dev/sandbox/game-25d-test/assets/hero.png`, `pet.png`, `npc.png`, `creature.png`, `icons.png`
- `~/dev/sandbox/game-25d-test/shots/day.png` and `house.png`
