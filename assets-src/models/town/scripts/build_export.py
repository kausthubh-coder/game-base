#!/usr/bin/env python3
"""One entry point: preserve/edit .blend sources, export GLBs, render proofs, check results.
blender -b -t 4 --python scripts/build_export.py -- [--regenerate] [--only NAME] [--no-renders] [--square]
First build generates missing sources. --regenerate explicitly replaces source geometry.
"""
import bpy,sys,os,math,json,argparse,subprocess,time
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from kit_common import *

def registry():
 import landmarks,buildings,street
 specs={};builders={}
 for mod in [landmarks,buildings,street]:
  for n,s in mod.SPECS.items():specs[n]=s;builders[n]=mod.build
 return specs,builders

def asset_bounds(objects):
 vs=[o.matrix_world@v.co for o in objects if o.type=='MESH' for v in o.data.vertices]
 return [min(v[i] for v in vs) for i in range(3)],[max(v[i] for v in vs) for i in range(3)]
def recenter(objects):
 lo,hi=asset_bounds(objects);offset=Vector((-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]))
 for o in objects:o.location+=offset
 return list(offset)
def clean_materials(objects):
 # collapse any duplicate imported material names onto canonical runtime materials
 for o in objects:
  if o.type!='MESH':continue
  for i,m in enumerate(o.data.materials):
   if m and m.name.startswith('Body'):o.data.materials[i]=materials()[0]
   elif m and m.name.startswith('Glow'):o.data.materials[i]=materials()[1]

def create_source(name,spec,builder):
 reset_scene();builder(name);objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 # Recentering includes every decorative overhang, ensuring consistent placement.
 offset=recenter(objects);clean_materials(objects)
 for o in objects:
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
  o['part']=o.name
 scene=bpy.context.scene;scene['asset_name']=name;scene['footprint_m']=spec['footprint'];scene['source_axes']='Z up; front -Y; GLB export Y up, front +Z';scene['units']='metres';scene['auto_center_offset']=offset
 # Human-editable architecture parts remain separate in source; export merges a copy.
 for area in bpy.context.screen.areas if bpy.context.screen else []:
  if area.type=='VIEW_3D':area.spaces.active.shading.type='MATERIAL'
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'sources'/f'{name}.blend'),compress=True)
 return objects

def export(name,spec):
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith('PREVIEW_')]
 clean_materials(objects);lo,hi=asset_bounds(objects)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=name
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 ob['asset']=name;ob['footprint_m']=spec['footprint'];ob['front_axis']='+Z';ob['up_axis']='+Y'
 # Flat doors/thresholds, no colliders baked in. Joining reduces overhead/draw calls.
 bpy.ops.export_scene.gltf(filepath=str(ROOT/'models'/f'{name}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=False,export_normals=True,export_tangents=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False,export_extras=True,export_draco_mesh_compression_enable=False)
 from pack_glb import pack
 pack(ROOT/'models'/f'{name}.glb')
 ob.data.calc_loop_triangles();tri=len(ob.data.loop_triangles)
 return {'name':name,**spec,'triangles':tri,'bytes':(ROOT/'models'/f'{name}.glb').stat().st_size,'dimensions':[round(hi[0]-lo[0],4),round(hi[2]-lo[2],4),round(hi[1]-lo[1],4)],'blender_bounds':[lo,hi],'materials':sorted({m.name for m in ob.data.materials if m})},ob

def material_plain(name,col,rough=1):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba(col);p.inputs['Roughness'].default_value=rough;return m

def camera_at(name,loc,target,ortho):
 d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=ortho;bpy.context.scene.camera=o;return o

def area_light(name,loc,target,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def setup_render(res=640,night=False):
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=False;s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2;s.cycles.transmission_bounces=0;s.render.resolution_x=res;s.render.resolution_y=res;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.film_transparent=False
 s.view_settings.view_transform='AgX';s.view_settings.look='AgX - Medium High Contrast';s.view_settings.exposure=.2 if night else .1
 w=bpy.data.worlds.new('PREVIEW_World');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.09,.15,.25,1) if night else (.7,.78,.82,1);w.node_tree.nodes['Background'].inputs[1].default_value=.2 if night else .55;s.world=w
 s.use_nodes=True;nt=s.node_tree;nt.nodes.clear();rl=nt.nodes.new('CompositorNodeRLayers');gl=nt.nodes.new('CompositorNodeGlare');gl.glare_type='FOG_GLOW';gl.quality='HIGH';gl.threshold=1.2;gl.size=7;out=nt.nodes.new('CompositorNodeComposite');nt.links.new(rl.outputs['Image'],gl.inputs['Image']);nt.links.new(gl.outputs['Image'],out.inputs['Image'])
 return s

def render_asset(name,ob):
 folder=ROOT/'renders'/name;folder.mkdir(parents=True,exist_ok=True)
 lo,hi=asset_bounds([ob]);w,d,h=hi[0]-lo[0],hi[1]-lo[1],hi[2];extent=max(w,d,h)
 for mode in ['front','three-quarter','night']:
  night=mode=='night';s=setup_render(640,night);before=set(bpy.data.objects)
  # neutral presentation ground, excluded from every GLB
  ground=box('PREVIEW_ground',(0,0,-.08),(200,200,.14),'stone');ground.data.materials.clear();ground.data.materials.append(material_plain('PREVIEW_ground_mat','334852' if night else 'D9DDCB'))
  target=(0,0,h*.47)
  if mode=='front':loc=(0,-extent*2.4,h*.47+extent*.12);ortho=max(w*1.18,h*1.22)
  else:loc=(extent*1.7,-extent*2.3,h*.45+extent*1.40);ortho=max(w*.92+d*.68,h*.9)*1.22
  camera_at('PREVIEW_camera',loc,target,ortho)
  if night:
   area_light('PREVIEW_moon',(-extent*.7,-extent,extent*2),target,extent*extent*24,(.46,.65,1),extent*1.2)
   area_light('PREVIEW_warm_fill',(extent,-extent*.6,extent*.8),target,extent*extent*10,(1,.68,.35),extent*.7)
   # Preview-only practical light, emission itself remains one exported Glow material.
   for idx,p in enumerate(ob.data.polygons):
    if ob.data.materials[p.material_index].name=='Glow' and p.normal.y<-.7:
     if idx%4:continue
     c=p.center;ld=bpy.data.lights.new('PREVIEW_practical','POINT');ld.energy=20;ld.color=(1,.56,.22);ld.shadow_soft_size=.65;oo=bpy.data.objects.new('PREVIEW_practical',ld);bpy.context.collection.objects.link(oo);oo.location=c+Vector((0,-.3,0))
  else:
   area_light('PREVIEW_key',(-extent,-extent*1.3,extent*2),target,extent*extent*90,(1,.87,.66),extent)
   area_light('PREVIEW_fill',(extent,extent*.4,extent*1.3),target,extent*extent*40,(.68,.84,1),extent*1.5)
  s.render.filepath=str(folder/f'{mode}.png');bpy.ops.render.render(write_still=True)
  for oo in set(bpy.data.objects)-before:bpy.data.objects.remove(oo,do_unlink=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('--regenerate',action='store_true');p.add_argument('--only');p.add_argument('--no-renders',action='store_true');p.add_argument('--square',action='store_true');p.add_argument('--no-check',action='store_true');p.add_argument('--no-square',action='store_true');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 for d in ['sources','models','renders','reports']:(ROOT/d).mkdir(exist_ok=True)
 specs,builders=registry();manifest_path=ROOT/'manifest.json';records={}
 if manifest_path.exists():records={v['name']:v for v in json.loads(manifest_path.read_text())}
 names=[args.only] if args.only else list(specs)
 for name in names:
  t=time.time();source=ROOT/'sources'/f'{name}.blend'
  if args.regenerate or not source.exists():create_source(name,specs[name],builders[name])
  else:bpy.ops.wm.open_mainfile(filepath=str(source))
  record,ob=export(name,specs[name]);records[name]=record
  manifest_path.write_text(json.dumps(list(records.values()),indent=2))
  if not args.no_renders:render_asset(name,ob)
  print('ASSET_DONE',name,record['triangles'],record['bytes'],round(time.time()-t,1),flush=True)
 if args.square or (not args.no_renders and not args.only and not args.no_square):
  import town_square
  if (ROOT/'sources'/'mock-town-square.blend').exists() and not args.regenerate:town_square.render_square_source(ROOT)
  else:town_square.build_square(ROOT)
 if not args.no_check:
  import check_glbs
  check_glbs.main_cli([str(ROOT)]+(['--skip-renders'] if args.no_renders else [])) if hasattr(check_glbs,'main_cli') else subprocess.run(['python3',str(ROOT/'scripts'/'check_glbs.py'),str(ROOT)]+(['--skip-renders'] if args.no_renders else []),check=True)
 if not args.no_renders and not args.only:
  subprocess.run(['python3',str(ROOT/'scripts'/'make_contact_sheets.py'),str(ROOT)],check=True)
 if (ROOT/'scripts'/'write_readme.py').exists():
  subprocess.run(['python3',str(ROOT/'scripts'/'write_readme.py'),str(ROOT)],check=True)
if __name__=='__main__':main()
