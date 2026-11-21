# Sprite stacking experiment

Run `bun run dev`. Open `/experiments/sprite-stack/` on that server to turn Tamsin, the Leaftail, the Mossling and the player together. Each has its own animation selector. Pause and use **Next frame** to inspect a footfall or tool strike. Open `/?look=sprite-stack` to play with the same sprites in the world.

The pack covers ten NPCs, the Leaftail, the Mossling, the Lanternfly and the player. They use the colours and poses of the existing cast models. The player has a diagonal walk and spade swing. The Mossling settles and the Lanternfly flutters. Story and combat sheets outside the pack use their original artwork.

## How the stack works

`bun tools/sprites/bake-stack.mjs` poses each rig from its animation clip, samples the painted surface into horizontal pixel slices, then draws that stack from eight headings. The feet keep the same anchor across headings and frames. The game draws each baked frame on a single quad and selects the row using the actor's facing and the camera's yaw.

The flat coat and simpler faces are visible at close range. The most readable changes on a diagonal are Tamsin's hat brim, the Leaftail's raised tail and the player's spade passing the shoulder. An earlier trial inferred depth from the painted front and side views. The tail and tool streaked across the diagonal frame, so the playable pack uses rigged poses for depth.

## Check a build

With the game served locally, run `bun tools/check-hero-rendered-frames.mjs --sprite-stack --url http://127.0.0.1:<port>/`. It compares the pixels the GPU draws with the requested heading and frame through two loop boundaries. Run the same command without `--sprite-stack` for the regular hero.
