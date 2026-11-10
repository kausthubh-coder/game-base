# KayKit stand-ins for the 3D cast

`cast.glb` holds the people the game draws when Settings > View > Characters is "3D models": three bodies on one shared rig, and five clips.

- **Source:** KayKit Character Pack: Adventurers 1.0, by Kay Lousberg (www.kaylousberg.com), from https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (folder `addons/kaykit_character_pack_adventures/Characters/gltf`).
- **License:** CC0 1.0. The pack's own license is `LICENSE.txt` beside this file.
- **Rebuilt by:** `bun tools/models/cast/stand-ins.mjs`. It downloads the pack's `Rogue`, `Mage`, `Barbarian` and `Knight` files once into `tools/models/cast/.cache/` and writes `cast.glb`.

What the script changes:

| Body | Made from | Optional parts |
|---|---|---|
| `slim` | the rogue's body, arms and legs, the knight's head | `cape` (the rogue's) |
| `dress` | the mage's body, arms and legs, the rogue's head | none |
| `stout` | the barbarian's body, arms, legs and head | `beard` |

- Weapons, shields, hats and helmets are left out. Hats, aprons and the rest are built by code in `src/features/toon/accessories.ts`.
- The pack's texture is dropped. Each vertex keeps the colour slot of the swatch it sampled (skin, hair, eyes, top, bottom, accent, leather, metal) and how light it was, in the `_TONE` attribute, so the game recolours every person. Their colours are in `src/game/content/cast.ts`.
- Bones nothing is skinned to (the pack's IK helpers) are dropped: 23 of 41 are kept.
- Of the pack's 76 clips, four are kept and renamed: `Idle`, `Walk` (Walking_A), `Run` (Running_A), `Tool` (1H_Melee_Attack_Chop). `Talk` is made from `Idle` by the script: the right arm lifts and turns over, the head nods.

These are stand-ins until our own cast is built by Blender scripts (`docs/cast-plan.md`).
