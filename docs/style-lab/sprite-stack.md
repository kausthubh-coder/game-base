# Eight-direction character sprites

Open `/?scene=sprite-meadow` to start on the grant with the Leaftail and a spade. Walk with WASD, hold two directions to walk diagonally, and hold the left mouse button over nearby soil to dig. Open `/?scene=sprite-meadow&look=painted` for the game's original sprites at the same saved position. The meadow keeps its own save.

To study individual poses, open `/experiments/sprite-stack/`. Choose an animation for Tamsin, the Leaftail, the Mossling or the player. Pause and use **Next frame** to inspect a footfall or tool strike.

## How the stack works

The game uses eight-direction sprites for directional movement and action poses in the world and in fights. One-view story poses keep their authored framing. The player and townspeople retain their own painted poses and timing. The Leaftail, Mossling and Lanternfly use their rigged stack animations.

`bun tools/sprites/bake-stack.mjs` rebuilds the pack. A posed rig supplies depth where available. For sheets without a rig, the painted side view supplies the depth of each horizontal slice. The bake projects that depth into the diagonal views. Characters with symmetric turns share their right-facing rows with the mirrored left views.

## Check a build

With the game served locally, run `bun tools/check-hero-rendered-frames.mjs --sprite-stack --url http://127.0.0.1:<port>/`. It compares the pixels the GPU draws with the requested heading and frame through two loop boundaries. Run the same command without `--sprite-stack` for the regular hero.
