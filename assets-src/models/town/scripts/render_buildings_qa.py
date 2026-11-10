import sys,os,bpy,math
from mathutils import Vector
sys.path.insert(0,'/workspace/shared/hollowmere/scripts')
import kit_common as kc,buildings
out='/workspace/shared/hollowmere/review/building_qa';os.makedirs(out,exist_ok=True)
for name in buildings.SPECS:
 kc.reset_scene();buildings.build(name)
 scene=bpy.context.scene
 obs=[o for o in scene.objects if o.type=='MESH'];v=[o.matrix_world @ vv.co for o in obs for vv in o.data.vertices]
 zmax=max(a.z for a in v)
 center=Vector((0,0,zmax*.36))
 bpy.ops.object.camera_add(location=center+Vector((12,-19,13)))
 camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=max(buildings.SPECS[name]['footprint'][0]*1.19,zmax*1.48);scene.camera=camera
 for loc,power,size in [((-8,-12,17),1800,9),((8,-3,11),1100,8),((0,9,13),1500,7)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,2))-l.location).to_track_quat('-Z','Y').to_euler()
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.83,.87,.91,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.8
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));plane=bpy.context.object
 mat=bpy.data.materials.get('QAground') or bpy.data.materials.new('QAground');mat.diffuse_color=(.66,.68,.61,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.66,.68,.61,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.95;plane.data.materials.append(mat)
 scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
 scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items] else 'None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
 scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(out,name+'.png');scene.render.film_transparent=False
 bpy.ops.render.render(write_still=True)
 print('RENDERED',name,flush=True)
