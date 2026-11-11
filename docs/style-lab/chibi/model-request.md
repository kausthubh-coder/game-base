# Model request: chibi cast, painted (for Kausthubh to run)

Paste the prompt below into the modelling agent, with the files under "Attach". It upgrades the cast we
already have rather than starting again.

## Attach

- The whole package `~/dev/sandbox/game-look-test/design/img/3d/cast-dot/` (sources, scripts, models,
  renders, README)
- `~/dev/sandbox/game-base/docs/style-lab/reference/genshin-fields.png`
- `~/dev/sandbox/game-base/docs/style-lab/reference/chibi/` (A Short Hike, Dragon Quest Builders 2, Animal
  Crossing, Lil Gator Game, Fae Farm, Ooblets, Tunic)

## Prompt

The attached package is our 14-character cast for a cozy browser game. Upgrade it into a polished chibi
style like Dragon Quest Builders 2 and Animal Crossing, with the light of Genshin Impact. Keep every
character's identity, clothes and colours, the 18-bone rig, the bone names, the clip names and the export
rules in the README. Work by editing the Blender scripts so `rebuild.sh` still rebuilds everything.

1. Proportions: about 3 heads tall. A bigger head, shorter legs, slightly larger hands and feet. Rescale the
   clips so the walk still plants its feet.
2. Faces as textures: replace the modelled eyes and mouth with a face UV island and a 256 px face texture.
   Make 6 faces per person: neutral, happy, sad, surprised, blink, talking (mouth open). Name them
   `<name>-face-<mood>.png`. The game swaps them, so the faces are what carries emotion.
3. Painted look: UV-unwrap each model and bake a 512 px hand-painted texture from the current vertex colours,
   with soft painted folds, a little warm light from the top left and no photographic detail. Keep vertex
   colours too, as a fallback.
4. Villagers: make villager-a and villager-b each take 4 colour variants through a small palette texture
   swap, so a crowd does not look cloned.
5. Clips: keep `idle`, `walk`, `run`, `swing`, `talk`, `wave`, and add `sit`, `carry` (holding a crate in
   both arms), `fish` (cast and hold) and `cheer`. Loops start and end on the same pose.

Budget: under 4,000 triangles a person, under 2,000 a creature. GLB, Y up, facing +Z, feet on y=0, no Draco.

Deliver: the updated package with the same layout, new renders, a lineup, clip contact sheets and the README
updated with measured triangles and the face texture list.

## Where it goes

Unzip into `~/dev/sandbox/game-look-test/design/img/3d/cast-chibi/` and tell the chibi style agent.
