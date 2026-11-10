# Our own cast, built by Blender scripts

> **Done (2026-11-10).** Kausthubh's own cast arrived from his Blender bot and replaced the CC0 stand-ins: sources in `assets-src/cast/`, exported by `bun tools/models/cast/build.mjs`, wired in `src/game/content/cast-models.ts`. The plan below is kept for its notes.

Today the 3D cast is CC0 stand-ins from KayKit's Adventurers pack, recoloured per person (`public/assets/stand-ins/kaykit`, rebuilt by `tools/models/cast/stand-ins.mjs`). They read well, but they are generic adventurers with stern faces, and every person shares one of three bodies. This plan replaces them with our own people: chibi, about 2 blocks tall, rigged and animated by script, so the rule "no model a script does not rebuild" holds with no exception.

## Dropping a new cast in

Kausthubh's own bot is building the real cast in Blender: 14 models on one shared rig, with idle, walk, run, swing, talk and wave clips. It needs no code change. In `src/game/content/cast-models.ts`:

1. Add the file to `CAST_MODELS`, with its clip names for the game's animations (`tool: 'swing'`), and the bone names if hats, aprons or the cheap shadow shape should work on it.
2. Point each character at the file and the mesh, or meshes, that are theirs. Drop `colours` to show the file's own materials, or keep some to override a material by its name.

A file without the stand-ins' `_TONE` attribute paints with its materials, its texture and its vertex colours, each material a slot named after it. This was checked by pointing the hero at KayKit's untouched `Rogue.glb`.

## What stays as it is

The game side needs no change. The toon feature (`src/features/toon/`) takes any skinned GLB on one rig, and works best with one laid out the way the stand-in script writes it:

- One rig, shared by every body. Bones named as KayKit names them (`hips`, `spine`, `chest`, `head`, `upperarm.l` and so on), so `src/game/shell/art.ts` and the accessories find them.
- Bodies as skinned meshes with four bones per vertex and a `_TONE` attribute: colour slot, shade, part, glow. The mesh's `extras.parts` names the parts.
- Clips named `Idle`, `Walk`, `Run`, `Tool`, `Talk`.
- The colours stay in `src/game/content/cast-models.ts`, and the code-built hats, aprons and the rest keep working, because they are placed from the head's box and the bones.

So a Blender-built `cast.glb` drops in where the KayKit one is, and the sprites-or-models switch, the instancing and the budget work the same.

## The pipeline

Blender 5.3 runs headless at `/Applications/Blender.app/Contents/MacOS/Blender`. `t3/blender-model-look-test` has the pattern for trees and rocks: `tools/models/common.py` holds the shared helpers, one Python file per model, `tools/models/build.mjs` runs Blender for each and writes the manifest. The cast follows it:

| File | What it does |
|---|---|
| `tools/models/cast/rig.py` | Makes the armature: 23 bones at chibi proportions, KayKit's names. |
| `tools/models/cast/body.py` | Builds one body from parameters: head size, torso width, leg length, belly, a skirt or trousers. Shapes are subdivided primitives joined and remeshed, then weighted to the rig with automatic weights and cleaned by rule (the head 100% to `head`, the hands to the wrists). |
| `tools/models/cast/heads.py` | Hair shapes as separate parts: short, long, bun, curls, bald, beard. Each is a mesh weighted to `head`. |
| `tools/models/cast/clips.py` | Keys the five clips by script: a walk and a run from a stride table (foot plant, passing pose, lift), idle breathing, a two-beat tool swing, a talk gesture. |
| `tools/models/cast/export.py` | Writes vertex colour slots into `_TONE`, the parts into `extras`, exports one GLB. |
| `tools/models/cast/build.mjs` | Runs the four in order, checks triangles and bones, lists the file in the manifest. |

## Proportions

Chibi, as in the reference and the sprites: the head about a third of the height. For a 2-block person: head 0.66, torso 0.6, legs 0.62, feet 0.1. Arms reach the hips. Eyes are large, flat, dark ovals with one light dot, set low on the face, as the sprites draw them. No nose, or a small bump; a small mouth. Soft and round everywhere: no hard edges in the silhouette, so the toon ramp and the outline give the shape.

## Budget

| Item | Target |
|---|---|
| A body with its head and hair | 1,800 triangles (the stand-ins are 4,100) |
| The shadow shape | the capsules `art.ts` builds now, about 500 |
| The file, three bodies, eight hair parts, five clips | under 300 KB |

At 1,800 triangles the whole cast in one view costs about 60,000 triangles, against 178,000 with the stand-ins (measured by `tools/chars-lineup.mjs`, everyone in a row).

## Steps

1. The rig and one body, the hero, with idle and walk. Swap it in for the slim body and compare at the six places of `tools/view-shots.mjs`.
2. The run, the tool swing and the talk.
3. The other two bodies and the hair parts. Move each person in `cast.ts` to them.
4. The creatures. They are code-built today (`src/features/toon/creatures.ts`) and cheap, so they move last, if at all.
5. Portraits: render each person's head from the GLB in Blender with a flat toon look, so the dialogue box matches the model.

## Risks

- Automatic weights on chibi shapes fold at the shoulders. The script fixes the weights of the shoulder ring by rule, and a test bakes the walk and checks no vertex moves further than its bone's reach.
- Clips keyed by script look stiff. Give each curve an ease, and offset the arms a few frames behind the legs. If they still look stiff, keep the KayKit clips: they are CC0 and fit the same rig names, so our own bodies can play them.
- Blender's glTF exporter changes between versions. Pin 5.3, and have `build.mjs` check the exported bone order and the attribute names.
