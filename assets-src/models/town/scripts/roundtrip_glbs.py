"""Blender runtime-import smoke test of every packed GLB. Run with blender -b --python."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
records=json.loads((ROOT/'manifest.json').read_text());results=[]
for r in records:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/(r['name']+'.glb')))
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];verts=[o.matrix_world@v.co for o in objs for v in o.data.vertices];tris=0
 for o in objs:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 lo=[min(v[i]for v in verts)for i in range(3)];hi=[max(v[i]for v in verts)for i in range(3)]
 dims=[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]]
 ok=tris==r['triangles'] and abs(lo[2])<.001 and all(abs(dims[i]-r['dimensions'][i])<.001 for i in range(3))
 results.append({'name':r['name'],'triangles':tris,'dimensions_gltf_m':dims,'ground_z_blender':lo[2],'passed':ok})
(ROOT/'reports'/'blender-roundtrip.json').write_text(json.dumps({'all_passed':all(r['passed']for r in results),'assets':results},indent=2));print('ROUNDTRIP',sum(r['passed']for r in results),'/',len(results));assert all(r['passed']for r in results)
