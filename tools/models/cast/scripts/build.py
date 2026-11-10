"""Rebuild models and proof renders in Blender 4.3+. See rebuild.sh."""
import sys, json, math, argparse
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from shared import ROOT,FPS,export_model
from humans import build_human,SPECS
from refined_humans import build_refined_human
from hero_refined import build_refined_hero
NAMES=list(SPECS)+['leaftail','mossling','lanternfly']

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for a in list(bpy.data.actions):bpy.data.actions.remove(a)

def camera_scene(center=(0,0,.9),ortho=2.25,res=(480,560)):
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.render.resolution_x=res[0];scene.render.resolution_y=res[1];scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.render.fps=FPS
    shade=scene.display.shading;shade.light='STUDIO';shade.studio_light='paint.sl';shade.studiolight_rotate_z=.35
    shade.color_type='VERTEX';shade.background_type='WORLD';shade.show_shadows=True;shade.show_cavity=True
    shade.cavity_type='BOTH';shade.curvature_ridge_factor=.5;shade.curvature_valley_factor=.3;shade.cavity_ridge_factor=.45;shade.cavity_valley_factor=.25
    shade.show_specular_highlight=False;shade.show_object_outline=True;shade.object_outline_color=(.15,.11,.16)
    scene.world=bpy.data.worlds.new('Cream paper studio');scene.world.color=(.86,.83,.75)
    scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.name for i in scene.bl_rna.properties] else 'None'
    scene.view_settings.exposure=0;scene.view_settings.gamma=1
    data=bpy.data.cameras.new('Proof camera');cam=bpy.data.objects.new('Proof camera',data);scene.collection.objects.link(cam);scene.camera=cam
    data.type='ORTHO';data.ortho_scale=ortho;data.lens=50;data.clip_end=100
    return cam

def look(cam,pos,target):
    cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()

def render_views(name,obj,rig,actions):
    path=ROOT/'renders'/name;path.mkdir(exist_ok=True)
    bounds=[obj.matrix_world@v.co for v in obj.data.vertices];h=max(v.z for v in bounds);low=min(v.z for v in bounds)
    center=tuple((min(v[i] for v in bounds)+max(v[i] for v in bounds))/2 for i in range(3));extent=max(h-low,max(v.x for v in bounds)-min(v.x for v in bounds),max(v.y for v in bounds)-min(v.y for v in bounds))
    cam=camera_scene(center,max(.4,extent*1.25))
    positions={'front':(0,-6,center[2]),'back':(0,6,center[2]),'side':(6,0,center[2]),'three-quarter':(4,-6,center[2]+2.5)}
    for view,pos in positions.items():
        look(cam,pos,center)
        rot=cam.rotation_euler.to_quaternion();inv=rot.conjugated();local=[inv@(v-Vector(center)) for v in bounds]
        w=max(v.x for v in local)-min(v.x for v in local);hh=max(v.y for v in local)-min(v.y for v in local)
        offset=rot@Vector(((max(v.x for v in local)+min(v.x for v in local))/2,(max(v.y for v in local)+min(v.y for v in local))/2,0))
        cam.location+=offset;cam.data.ortho_scale=max(hh,w*560/480)*1.16
        bpy.context.scene.render.filepath=str(path/f'{view}.png');bpy.ops.render.render(write_still=True)
    if name=='hero':
        for clip in ['walk','swing']:
            action=next(a for a in actions if a.name==clip);rig.animation_data.action=action
            for i,t in enumerate([0,.25,.5,.75,1]):
                bpy.context.scene.frame_set(round(t*action['duration_seconds']*FPS));look(cam,(3,-6,center[2]+1.8),center)
                bpy.context.scene.render.filepath=str(ROOT/'renders'/f'hero-{clip}-{i+1}.png');bpy.ops.render.render(write_still=True)
        rig.animation_data.action=None

def build_one(name,renders=True,regenerate=False):
    source=ROOT/'sources'/f'{name}.blend';source.parent.mkdir(exist_ok=True)
    if source.exists() and not regenerate:
        bpy.ops.wm.open_mainfile(filepath=str(source))
        r=next(o for o in bpy.data.objects if o.type=='ARMATURE')
        obj=next(o for o in bpy.data.objects if o.type=='MESH' and o.parent==r)
        actions=list(bpy.data.actions)
        extra=json.loads(r.get('cast_metadata','{}'))
    else:
        clear()
        if name in SPECS:b,r,actions,extra=build_refined_human(name)
        elif name=='leaftail':
            from leaftail_refined import build_refined_leaftail
            b,r,actions,extra=build_refined_leaftail()
        else:
            from other_creatures_refined import build_other_creature
            b,r,actions,extra=build_other_creature(name)
        obj=b.finish(r)
        r['cast_metadata']=json.dumps(extra);r['units']='metres';r['forward']='Blender -Y; exported glTF +Z'
        bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
        bpy.context.scene.render.fps=FPS
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.region_3d.view_distance=3.1
                    area.spaces.active.region_3d.view_location=Vector((0,0,.8))
                    area.spaces.active.shading.color_type='VERTEX'
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
    report=export_model(name,obj,r,actions);report.update(extra)
    if renders:render_views(name,obj,r,actions)
    return report

def lineup():
    clear();placed=[];x=0
    for name in NAMES:
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'models'/f'{name}.glb'))
        objs=list(bpy.context.selected_objects)
        roots=[o for o in objs if o.parent is None]
        rigs=[o for o in objs if o.type=='ARMATURE']
        for rig in rigs:
            rig.animation_data_clear()
            for p in rig.pose.bones:p.rotation_quaternion=(1,0,0,0);p.rotation_euler=(0,0,0);p.location=(0,0,0)
        meshes=[o for o in objs if o.type=='MESH']
        bpy.context.view_layer.update()
        bounds=[o.matrix_world@Vector(corner) for o in meshes for corner in o.bound_box]
        width=max(v.x for v in bounds)-min(v.x for v in bounds)
        mid=(max(v.x for v in bounds)+min(v.x for v in bounds))/2
        for o in roots:o.location.x+=x+width/2-mid
        placed.append((name,x+width/2,width));x+=width+.20
        bpy.ops.object.select_all(action='DESELECT')
    center=(x/2-.1,0,.88)
    cam=camera_scene(center,2.5,(5600,1000))
    # Ortho scale refers to width for this landscape aspect ratio.
    cam.data.ortho_scale=max(x+.35,2.35*5.6)
    look(cam,(center[0],-10,1.7),(center[0],0,.88))
    bpy.context.scene.render.filepath=str(ROOT/'renders'/'lineup.png');bpy.ops.render.render(write_still=True)
    (ROOT/'qa'/'lineup_layout.json').write_text(json.dumps({'width_m':x,'ortho_width_m':cam.data.ortho_scale,'placements':placed},indent=2))

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    p=argparse.ArgumentParser();p.add_argument('--only',choices=NAMES);p.add_argument('--regenerate',action='store_true',help='Recreate editable sources from procedural definitions, replacing source edits');p.add_argument('--no-renders',action='store_true');p.add_argument('--lineup-only',action='store_true');p.add_argument('--output');opts=p.parse_args(args)
    for folder in ['models','renders','qa']:(ROOT/folder).mkdir(exist_ok=True)
    if opts.lineup_only:lineup();return
    report=[]
    for name in ([opts.only] if opts.only else NAMES):
        entry=build_one(name,not opts.no_renders,opts.regenerate);report.append(entry)
        (ROOT/'qa'/f'{name}.json').write_text(json.dumps(entry,indent=2))
    if not opts.only:
        (ROOT/'qa'/'build_report.json').write_text(json.dumps(report,indent=2))
        if not opts.no_renders:lineup()

if __name__=='__main__':main()
