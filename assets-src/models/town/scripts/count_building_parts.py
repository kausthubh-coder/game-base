import sys,bpy,collections
sys.path.insert(0,'/workspace/shared/hollowmere/scripts')
import kit_common as kc,buildings
for name in ['lodge','ferry-house']:
 kc.reset_scene();buildings.build(name)
 groups=collections.Counter()
 for ob in bpy.context.scene.objects:
  ob.data.calc_loop_triangles();groups['_'.join(ob.name.split('_')[:3])]+=len(ob.data.loop_triangles)
 print(name,sorted(groups.items(),key=lambda x:-x[1]))
