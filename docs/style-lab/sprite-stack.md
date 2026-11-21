# Sprite stacking experiment

Open `/?scene=sprite-meadow&look=sprite-stack` to start on the grant with the Leaftail and a spade. Walk with WASD, hold two directions to walk diagonally, and hold the left mouse button over nearby soil to dig. Open `/?scene=sprite-meadow` for the game's original sprites at the same saved position. The meadow keeps its own save.

To study individual poses, open `/experiments/sprite-stack/`. Choose an animation for Tamsin, the Leaftail, the Mossling or the player. Pause and use **Next frame** to inspect a footfall or tool strike.

## How the stack works

`bun tools/sprites/bake-stack.mjs` poses the cast rigs, samples each surface into horizontal pixel slices, then projects them into eight directions. The ten NPCs, the Leaftail, the Mossling and the Lanternfly take their colour from their models. The game draws each baked frame on one quad and selects the row using the actor's facing and the camera's yaw.

The player uses the painted hero and swing sheets at their original frame size and timing. Cardinal views copy the original cels. On diagonals, the bake fits the posed rig's depth to each painted scanline, then projects the colours into the turned frame. This keeps the fringe, jacket, bag and both foot contacts in the walk. The diagonal views are reconstructions from the existing art. Story and combat sheets outside the pack use their original artwork.

## Check a build

With the game served locally, run `bun tools/check-hero-rendered-frames.mjs --sprite-stack --url http://127.0.0.1:<port>/`. It compares the pixels the GPU draws with the requested heading and frame through two loop boundaries. Run the same command without `--sprite-stack` for the regular hero.
