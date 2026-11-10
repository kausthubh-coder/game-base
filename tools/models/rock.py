import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
for seed in [11,37]:
    r=start(seed)
    bpy.ops.mesh.primitive_cube_add(size=2,location=(0,0,0)); obj=bpy.context.object
    obj.scale=(1,.75,.65); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('soft weathered edges','BEVEL'); bevel.width=.38; bevel.segments=3
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=bevel.name)
    for v in obj.data.vertices: v.co*=r.uniform(.94,1.06)
    low=min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices: v.co.z-=low
    m=Mesh()
    for p in obj.data.polygons:
        pts=[obj.data.vertices[i].co.copy() for i in p.vertices]; top=sum(v.z for v in pts)/len(pts)/1.3
        m.face(pts,(.26+.18*top,.29+.17*top,.26+.16*top,1))
    bpy.data.objects.remove(obj,do_unlink=True)
    finish(m.object('weathered rock'),f'rock-{seed}')
