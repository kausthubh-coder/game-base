# Style lab

Kausthubh is choosing the art style for the game. Five agents each build one style into the same game, on its
own branch, behind `?style=<name>`. He judges them side by side; agents build and measure, they do not pick.

The question the lab answers: **which style can an AI pipeline make well, at the size of a whole game?** Image
generation is strong at still pictures. AI 3D is fair at things that do not move. Animation is where AI is
weakest. So every style is judged on two things at once: how it looks next to the reference, and what it costs
to add one more character, one more action and one more prop.

## The target look

Read these before you start:

- `reference/genshin-fields.png` is the judge for the world: big sky and clouds, far haze, rolling ground,
  round trees, clean bright colour, simple grass. His words: "It doesn't have good grass, it just has grass,
  which is better."
- `reference/<your style>/` holds screenshots of games in your style. Take their rendering ideas, not their
  content.
- His direction after playing: cozy, Genshin-like, warm light, depth, shadows. **Less Minecraft**: block
  faces and block-by-block looks felt wrong. One coherent look, never separate pieces in separate styles.
- The core game: you build systems and farms and grow a kingdom of NPCs, with a story that follows what you
  built. So the style must hold many people, many props and many machines.

## The five styles

| `?style=` | Style | Games | Characters are | Who animates |
|---|---|---|---|---|
| `hd2d` | HD-2D | Octopath Traveler II, DQ III HD-2D, Triangle Strategy | Pixel sprites in a lit 3D world | Image gen draws every frame |
| `puppet` | Paper puppet | Paper Mario, Cult of the Lamb, Don't Starve | Flat painted parts on 2D bones | Code moves the parts |
| `chibi` | Chibi toon 3D | A Short Hike, DQ Builders 2, Animal Crossing | Short round 3D models on one shared rig | One clip library plus code |
| `anime` | Anime toon 3D | Genshin, Honkai Star Rail, Wuthering Waves | Taller cel-shaded 3D models | Keyframed clips |
| `voxel` | Voxel | Cube World, Hytale, Trove | Blocky 3D figures | Code swings the blocky limbs |

Each style covers the whole picture, not only characters: ground, grass, trees, rocks, water, sky, light,
the town's buildings, the hero, Tamsin, the villagers and the leaftail.

## What already exists on this branch

- 2D pixel sheets for the hero, 8 townspeople, the leaftail and creatures: `public/assets/sprites`, listed in
  `public/assets/manifest.json`. `.agents/skills/make-sprite` is how they were made.
- 3D models of the same 14 characters on one shared rig, toon-shaded: `?chars=models`. Their Blender package
  is `~/dev/sandbox/game-look-test/design/img/3d/cast-dot/` (sources, scripts, renders).
- Tree, rock and bush models from Blender scripts in `tools/models/`; code-built props in
  `src/features/props/builders`. `.agents/skills/make-3d-asset` covers both.
- Soft shadows, bloom, haze, colour grade and water from the merged look work.
- Camera modes: `?camera=tilt` (default 2.5D), `free`, `first`; `?cam=` profiles.

Reuse what fits your style. Replace what does not.

## Tools the agents share

- **Image generation: Codex.** Start a Codex child with `delegate_task` (`target.providerInstanceId: "codex"`,
  `isolation: "shared"` so it writes into your checkout). Give it the reference image paths, the palette,
  the exact size and the output path. Keep every prompt and every raw output in
  `assets-src/styles/<style>/` with a `prompts.json`, including the failures.
- **Blender 5.3**, headless: `/Applications/Blender.app/Contents/MacOS/Blender -b --python <script>`. Every
  model has a script that rebuilds it (AGENTS.md rule 4).
- **Better 3D models from Kausthubh.** He can run a stronger modelling agent. If your style needs a model
  you cannot make well, write the request into `docs/style-lab/<style>/model-request.md`: what to make,
  the references to attach, the rig, the clips, the triangle budget, the export format. Keep building with
  your own first pass; his model replaces it later.

## The check

`.agents/skills/verify-style-lab` is the loop: build, serve, run `tools/style-lab.mjs`, read the card and
the motion strips against the reference, fix the biggest gap, repeat.

## What a style delivers

Done means all of these pass:

1. `bun tools/style-lab.mjs --style <style>` exits 0 and writes `card.png`, every place and every clip.
2. Every place stays under 150 draw calls and 400,000 triangles at quality high, and the style runs at
   `low`, `medium` and `high`.
3. `bun run check` passes, and the game without `?style=` looks exactly as before.
4. `docs/style-lab/<style>/STYLE.md`, the look bible, has:
   - the rules: palette, light, shading, outlines, proportions, texture size, what goes on a surface;
   - **the pipeline**: what image gen made, what Blender or code made, every prompt, how many tries each asset
     took and how many failed, and why;
   - **the cost to grow**: the steps, tries and hours to add one new villager, one new action for every
     character (say, fishing), and one new prop. Measure it by actually adding one new action;
   - what looks wrong still, in plain words.
5. The card, the places and the motion GIFs are copied to
   `~/dev/sandbox/game-look-test/design/img/style-lab/<style>/`, where the comparison board reads them.
