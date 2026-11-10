"""Generate the measured asset manifest, README, and labeled proof sheets."""
import json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rows=json.loads((ROOT/'qa'/'build_report.json').read_text())
by={x['name']:x for x in rows}
intro='''# Greenhollow • complete refined character cast

The refined treatment has been applied to all fourteen characters: eleven people and three creatures. This is a new complete package; both earlier packages are unchanged. It retains the approved refined hero and Leaftail, with bespoke refined clothes, hair, faces and creature silhouettes for the remaining twelve.
Built and checked with Blender 4.3.2. All geometry is original, based on the supplied sprite sheets. This is a low-poly 3D interpretation rather than an exact pixel-to-volume reconstruction.

## Quick start

Install Blender 4.3+ and Python 3.10+. From the extracted package root, run:

```sh
./scripts/rebuild.sh
```

Set `BLENDER=/path/to/blender` when Blender is not on PATH. `BLENDER_THREADS=4` is the default. For example on macOS:

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender ./scripts/rebuild.sh
```

The default rebuild opens all fourteen editable `sources/*.blend`, preserves source geometry and animation edits, exports models, produces proof renders and the lineup, then independently checks the GLBs and updates this measured README. Source files already contain the shared rig, skin weights, named actions, and a vertex-color material; no external assets or add-ons are required. Rendering uses Blender Workbench and a bundled studio light; it needs a working OpenGL/EGL software or hardware context. Model-only export works without rendering: `blender -b --python scripts/build.py -- --no-renders`.

To regenerate the entire cast from its procedural definitions instead of the edited sources:

```sh
REGENERATE=1 ./scripts/rebuild.sh
```

**Regeneration replaces source edits.** Keep a copy of any manually edited sources before using it. To rebuild only one character, e.g. hero: `blender -b --python scripts/hero.py`. Each character has its own entry script. Shared implementation lives in `shared.py`, `humans.py`, and `refined_humans.py`; custom human shapes are in `hero_refined.py`, `outfits_a.py`, and `outfits_b.py`; creature shapes are in `leaftail_refined.py` and `other_creatures_refined.py`.

## Package

- `models/`: fourteen self-contained GLB files, one mesh and one material each.
- `sources/`: fourteen editable, compressed Blender files with mesh, rig, weights, vertex colors, and actions. In Edit Mode, hover over a disconnected clothing/hair part and press L to select it.
- `scripts/`: per-character commands, shared builders, source rebuild/export, render setup, manifest generation, independent GLB checker.
- `renders/<name>/`: front, back, side, three-quarter PNGs.
- `renders/lineup.png`: all fourteen characters side by side at identical world scale.
- `renders/hero-walk-*.png` and `hero-swing-*.png`: five frames per clip; contact sheets collect them.
- `references/`: supplied sprite sheets, source lineup, and landscape mood reference.
- `qa/`: measured reports, source rebuild test, visual review notes.

## Coordinates, geometry and materials

- One Blender unit is one metre; object scale is applied in generated geometry.
- Blender source uses Z up and faces -Y. GLB export converts to **Y up, facing +Z**. The rest-pose feet touch y=0 in glTF, with horizontal center at the origin.
- Exported triangle counts below are measured, not estimates. All humans are below 4,000 triangles and all creatures below 2,000.
- No Draco or meshopt compression, no external buffers, no texture maps. Each model uses `COLOR_0` vertex colors with one shared-style rough material. Files need no decompressor.
- Keep `vertexColors: true` when replacing materials with your game's toon shader. The model does not bake outlines or the stepped-light ramp. The preview uses a soft Workbench outline and cavity lighting, not your runtime shader.
- Lanternfly has a modest warm emission factor on its single material. Bloom and localized light spill belong to your game renderer; no lights or extra glow meshes are exported.
- Clothing, hair, face details and accessories are joined into one skinned mesh. Sleeves and trousers are continuous shaped sections with blended elbow/knee weights. Dress/apron panels also blend torso and hip weights where needed. Rigid hair/accessory sections keep the silhouettes compact and readable. This favors stylized game animation over realistic cloth simulation.

## Animation and integration

All eleven humans use the same 18 bone names, parent hierarchy, local rest orientations, and clip recipe. Skeleton dimensions scale per character. Clips contain in-place motion; move the character in game code for locomotion. `idle`, `walk`, `run`, and `talk` have matching first/last poses; `swing` and `wave` are one-shot gestures returning to rest. On Three.js, use LoopRepeat for loops and LoopOnce with clampWhenFinished for one-shots. No inverse-kinematics constraints or Blender-only modifiers need to run in the browser.

Human clips: `idle` 2.00 s, `walk` 1.00 s, `run` 0.70 s, `swing` 0.45 s, `talk` 2.00 s, `wave` 1.00 s.
Creature clips: `idle` 2.00 s, `walk` 1.00 s, `special` 1.50 s. Leaftail special is tail wag + hop; mossling special is wobble; lanternfly special is hover + wing flap. Lanternfly's walk is a low hovering locomotion cycle, not biped walking.

`hand.R.tool` is a real child bone of `hand.R` in every human GLB. Parent tools to this bone; source local +Y runs along the attachment bone, and the grip origin is at the hand. Adjust your tool mesh's own local grip rotation/offset. Some Three.js GLTFLoader versions sanitize periods to underscores, so check `hand_R_tool` as well as `hand.R.tool` (or the original node name in userData). No axe/hoe geometry is bundled.

Animation tracks target the same named human bones, so they can be bound to another human with matching names. For differently sized bodies, choose the character's own bundled clips to preserve its nominal proportions. Use SkeletonUtils.clone for independent skinned instances. The assets have been round-tripped through Blender and checked as glTF, but have not been play-tested in your actual Three.js game or with your final toon shader.

## Measured assets

Bytes are actual GLB file bytes, decimal KB is bytes/1000. Height is the rest-pose visual bound including hats, hair and ears.

| Model | Triangles | Bytes | KB | Height (m) | Bones |
|:--|--:|--:|--:|--:|--:|
'''
text=intro
for x in rows:
 h=x['blender_bounds'][1][2]-x['blender_bounds'][0][2]
 text+=f"| {x['name']} | {x['triangles']:,} | {x['bytes']:,} | {x['bytes']/1000:.1f} | {h:.3f} | {len(x['bones'])} |\n"
text+='''
### Per-model skeleton and clips

'''
for x in rows:
 text+='#### '+x['name']+'\n\n'
 text+='Bones: '+', '.join('`'+n+'`' for n in x['bones'])+'.\n\n'
 text+='Animations: '+', '.join('`'+k+'` '+f'{v:.2f} s' for k,v in x['animations'].items())+'.\n\n'
text+='''## Visual review and interpretation

The refined same-scale lineup and individual views were compared with the supplied reference lineup. Every character now uses the refined visual family: shaped face contours, expressive layered eyes, broad hair forms and continuous limbs. Each costume is bespoke to its sprite. Tamsin has the long coat and feathered hat; Maren has a green/cream gown and tired eyes; Odo has smiling eyes, curls and flour apron; Gus has the straw hat and overalls; Mira has a bun/pencil, tool belt, hammer and measuring tape; Wren has a practical jacket and perched chick; Juniper has the cloak/scarf; Brack has the reed hat/navy coat; both villagers retain their distinct outfits. Mossling and Lanternfly were rebuilt with shaped silhouettes, faces and leaf/wing details.

Visual QA corrected hair intersecting hats, jacket/waistcoat layering, apron hardware, and Maren's gown panel clipping in run/idle poses. The gown/apron panel fix uses skin weights, not a preview-only adjustment. Representative poses were rendered for every clip of every character: 66 human poses and nine creature poses. Contact sheets are in `qa/humanoid-motion-review.png` and `qa/creature-motion-review.png`; the sample list is `qa/motion_review_samples.json`.
Deliberate interpretations and remaining caveats:

- Sprite-back details and hidden surfaces are simplified three-dimensional continuations. The shared chibi body, face construction, and broad hair chunks unify the cast rather than exactly reproduce every painted pixel.
- Hats and costume details take priority from the supplied sprites where the original prose differs (e.g. Gus's straw hat and Juniper's uncovered hair).
- Leaftail is approximately 0.8 m nose-to-tail in the rest pose. Mossling is approximately 0.5 m high. Lanternfly is approximately 0.3 m across the full wing/antenna silhouette; its body is smaller.
- Long coats and skirts use the hips/chest skeleton rather than cloth simulation; extreme custom poses may need garment-weight editing. The supplied gestures are deliberately modest.
- There are no facial blend shapes or lip-sync, LODs, physics colliders, or game engine integration scripts. Runtime toon shading, bloom, shadow settings, and outline width should be tuned in your actual scene.

## Validation

Two separate Python GLB readers inspect the exported binary rather than trusting source counts. Checks cover actual triangle/index counts, material count, embedded buffers, file size, skin weights/joints, animation names and lengths, humanoid hierarchy agreement and tool attachment, and rest bounds. The primary checker also compares loop endpoints and root motion. `qa/validation.json` and `qa/independent_validation.json` contain measured results. Structural checks do not substitute for gameplay motion review.

The full one-command source rebuild was exercised with models/ and renders/ absent at the start. All fourteen resulting GLBs were compared with the prior procedural exports. The default source rebuild was exercised after source creation. See `qa/source_rebuild.json`. Files use no network downloads during rebuild. The optional labeled contact-sheet step needs Pillow; if Pillow is absent, the required raw Blender renders still exist and the README is generated.
'''
(ROOT/'README.md').write_text(text)
manifest={str(p.relative_to(ROOT)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((ROOT/'models').glob('*.glb'))}
(ROOT/'qa'/'model_manifest.json').write_text(json.dumps(manifest,indent=2))
# Optional presentation-only labeling; raw model renders remain untouched.
try:
 from PIL import Image,ImageDraw,ImageFont
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 def font(n):
  try:return ImageFont.truetype(fontpath,n)
  except OSError:return ImageFont.load_default()
 for clip in ['walk','swing']:
  ims=[Image.open(ROOT/'renders'/f'hero-{clip}-{i+1}.png').convert('RGB') for i in range(5)]
  sheet=Image.new('RGB',(5*480,630),'#eeeadd');d=ImageDraw.Draw(sheet)
  for i,im in enumerate(ims):
   sheet.paste(im,(i*480,40));d.text((i*480+25,603),f'{clip} / {int(i*25)}%',font=font(18),fill='#513d3c')
  d.text((24,9),'GREENHOLLOW / '+clip.upper()+' MOTION STUDY',font=font(22),fill='#513d3c')
  sheet.save(ROOT/'renders'/f'hero-{clip}-contact-sheet.png',optimize=True)
 lineup=Image.open(ROOT/'renders'/'lineup.png').convert('RGB');d=ImageDraw.Draw(lineup);layout=json.loads((ROOT/'qa'/'lineup_layout.json').read_text())
 span=layout.get('ortho_width_m',layout['width_m']+.35);center=layout['width_m']/2-.1
 for name,pos,w in layout['placements']:
  xp=(pos-center)/span*lineup.width+lineup.width/2
  box=d.textbbox((0,0),name,font=font(27));d.text((xp-(box[2]-box[0])/2,lineup.height-57),name,font=font(27),fill='#513d3c')
 d.text((40,24),'GREENHOLLOW  /  SAME-SCALE CHARACTER LINEUP',font=font(35),fill='#513d3c')
 lineup.save(ROOT/'renders'/'lineup.png',optimize=True)
except (ImportError,FileNotFoundError) as exc:
 print('Optional proof-sheet labeling skipped:',exc)
print('Wrote README.md and qa/model_manifest.json')
