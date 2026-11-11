# Model request: anime toon cast (for Kausthubh to run)

Paste the prompt below into the modelling agent. Attach the files listed under "Attach".

## Attach

- `~/dev/sandbox/game-base/docs/style-lab/reference/genshin-fields.png`
- `~/dev/sandbox/game-base/docs/style-lab/reference/anime/` (Genshin, Honkai Star Rail, Wuthering Waves, Blue Protocol, Granblue Relink, Atelier Ryza, Ni no Kuni II)
- `~/dev/sandbox/game-look-test/design/img/3d/cast-dot/references/` (hero.png, tamsin.png, villager-a.png, leaftail.png, sprite-lineup.png): who each character is
- `~/dev/sandbox/game-look-test/design/img/3d/cast-dot/renders/lineup.png`: the chibi cast we have now, for clothes and colours
- `~/dev/sandbox/game-look-test/design/img/3d/cast-dot/scripts/` and `README.md`: the rig, clip names and export rules to match

## Prompt

Make four characters for a cozy anime open-world browser game, in the cel-shaded style of Genshin Impact and
Honkai Star Rail, scaled down for a web game. The attached sprites and the chibi lineup show who each one is
and what they wear; keep their clothes, colours and personality, but give them anime proportions.

Characters: the hero (a young adventurer, brown hair, cream shirt, satchel), Tamsin (an older woman, grey hair,
wide brimmed hat with a feather, long brown coat), villager-a (a woman in a headscarf and apron), and the
leaftail (a small green fox-like creature with a leaf tail).

Proportions: people 5.5 to 6 heads tall, large expressive anime eyes, simple nose and mouth, clean hair
clumps with clear silhouettes. Creature: round and cute, readable from above.

Build everything with a Blender 5.x Python script that rebuilds each model from scratch, like the attached
`cast-dot/scripts`. Keep the `.blend` sources and a `rebuild.sh`.

Rig and clips, to match our existing cast so the game code can swap them in:
- People share one skeleton with these 18 bone names and hierarchy: `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm.L/R`, `lower_arm.L/R`, `hand.L/R`, `hand.R.tool`, `upper_leg.L/R`, `lower_leg.L/R`, `foot.L/R`.
  Add `hair.*` and `cloth.*` bone chains for hair and coat tails that the game can move with springs.
- People clips, in place: `idle` 2.0 s, `walk` 1.0 s, `run` 0.7 s, `swing` 0.45 s, `talk` 2.0 s, `wave` 1.0 s.
  Loops start and end on the same pose. Make the walk and run read clearly from a camera 35 degrees above.
- Leaftail: its own small rig, clips `idle`, `walk`, `special` (tail wag and hop).

Look:
- Texture each model with a small hand-painted texture (512 px for people, 256 for the creature), flat anime
  colours with one soft shade band painted in, not photographic.
- Put the face (eyes, brows, mouth) on its own UV island with a separate 256 px texture, so the game can swap
  expressions. Give us 6 face textures per person: neutral, happy, sad, surprised, blink, talking.
- Also export a smooth-normals copy of the outer shell or vertex normals suited to an inverted-hull outline.

Budget: under 6,000 triangles a person, under 2,500 for the creature. Export GLB, Y up, facing +Z, feet on
y=0, one metre per unit, no Draco.

Deliver: the GLBs, textures, `.blend` sources, scripts, front/back/side/three-quarter renders on a plain
background, a lineup render at the same scale, a contact sheet of each clip, and a README with measured
triangles, bones and clips.

## Where it goes

Unzip into `~/dev/sandbox/game-look-test/design/img/3d/cast-anime/` and tell the anime style agent.
