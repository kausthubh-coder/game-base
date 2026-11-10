# Compresses the town kit's GLBs with Draco for the game: reads each delivered GLB in assets-src/models/town/models/,
# and writes it again to public/assets/models/town/ with the same Body and Glow materials, vertex colours and
# normals, its geometry Draco-compressed. Run by tools/models/town.mjs; Blender carries the Draco encoder.
#   Blender --background --factory-startup --python tools/models/town_draco.py
import bpy, pathlib, sys

root = pathlib.Path(__file__).resolve().parents[2]
src = root / 'assets-src/models/town/models'
out = root / 'public/assets/models/town'
out.mkdir(parents=True, exist_ok=True)
for glb in sorted(src.glob('*.glb')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.ops.object.select_all(action='SELECT')
    options = dict(filepath=str(out / glb.name), export_format='GLB', use_selection=True, export_yup=True,
                   export_apply=True, export_texcoords=False, export_normals=True, export_tangents=False,
                   export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False,
                   export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                   export_draco_position_quantization=14, export_draco_normal_quantization=10,
                   export_draco_color_quantization=10)
    try:
        bpy.ops.export_scene.gltf(**options, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**options)
    print('draco', glb.name, (out / glb.name).stat().st_size, 'bytes from', glb.stat().st_size)
