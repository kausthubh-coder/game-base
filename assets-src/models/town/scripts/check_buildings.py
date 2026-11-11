import sys,json,bpy
sys.path.insert(0,'/workspace/shared/hollowmere/scripts')
import kit_common as kc
import buildings
results=[]
for name,spec in buildings.SPECS.items():
    kc.reset_scene()
    try:
        buildings.build(name)
        tris=0;v=[]
        for ob in bpy.context.scene.objects:
            if ob.type!='MESH':continue
            ob.data.calc_loop_triangles();tris+=len(ob.data.loop_triangles)
            v.extend([ob.matrix_world @ vv.co for vv in ob.data.vertices])
        mn=[min(c[i] for c in v) for i in range(3)]
        mx=[max(c[i] for c in v) for i in range(3)]
        fp=spec['footprint']
        inside=all(mn[i]>=-fp[i]/2 and mx[i]<=fp[i]/2 for i in range(2))
        results.append(dict(name=name,tris=tris,objects=len(bpy.context.scene.objects),min=mn,max=mx,inside=inside))
        print('CHECK',json.dumps(results[-1]),flush=True)
    except Exception as e:
        import traceback;traceback.print_exc();raise
open('/workspace/shared/hollowmere/review/building_checks.json','w').write(json.dumps(results,indent=2))
