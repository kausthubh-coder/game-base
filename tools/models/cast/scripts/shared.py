"""Shared geometry, color, skinning, animation, export and studio helpers.
Blender +Z is up and -Y is forward. glTF export maps these to +Y and +Z.
"""
from pathlib import Path
import math, json, os
import bpy
from mathutils import Vector
# CAST_ROOT is set by tools/models/cast/build.mjs: a folder holding `sources/`, where `models/` and `qa/` are written.
ROOT = Path(os.environ['CAST_ROOT']) if os.environ.get('CAST_ROOT') else Path(__file__).resolve().parents[1]
FPS = 60

def rgba(hex_color):
    h=hex_color.lstrip('#')
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in rgb)+(1,)

def material():
    m=bpy.data.materials.get('Cast • warm vertex palette')
    if m: return m
    m=bpy.data.materials.new('Cast • warm vertex palette');m.use_nodes=True
    nt=m.node_tree;nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial')
    bs=nt.nodes.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.92
    bs.inputs['Metallic'].default_value=0
    bs.inputs['Specular IOR Level'].default_value=.18
    vc=nt.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
    nt.links.new(vc.outputs['Color'],bs.inputs['Base Color']);nt.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
    return m

class Builder:
    def __init__(self,name,scale=(1,1,1)):
        self.name=name;self.scale=Vector(scale);self.verts=[];self.faces=[];self.colors=[];self.weights=[];self.parts=[]
    def mesh(self,label,verts,faces,color,bone):
        start=len(self.verts);self.verts.extend([tuple(Vector(v)*self.scale) for v in verts])
        c=rgba(color); self.faces.extend([tuple(start+i for i in f) for f in faces]);self.colors.extend([c]*len(faces))
        self.weights.extend([bone]*len(verts));self.parts.append(label)
    def ellipsoid(self,label,loc,scale,color,bone,segments=12,rings=6):
        v=[(loc[0],loc[1],loc[2]+scale[2])];f=[]
        for j in range(1,rings):
            a=math.pi*j/rings
            for i in range(segments):
                b=2*math.pi*i/segments;v.append((loc[0]+scale[0]*math.sin(a)*math.cos(b),loc[1]+scale[1]*math.sin(a)*math.sin(b),loc[2]+scale[2]*math.cos(a)))
        bottom=len(v);v.append((loc[0],loc[1],loc[2]-scale[2]))
        for i in range(segments):
            ni=(i+1)%segments;f.append((0,1+i,1+ni))
            for j in range(rings-2):
                a=1+j*segments+i;b=1+j*segments+ni;f.append((a,a+segments,b+segments,b))
            last=1+(rings-2)*segments;f.append((bottom,last+ni,last+i))
        self.mesh(label,v,f,color,bone)
    def capsule(self,label,a,b,radius,color,bone,radius2=None,segments=10):
        a=Vector(a);b=Vector(b);d=b-a;mid=(a+b)*.5
        if radius2 is None:radius2=radius
        q=Vector((0,0,1)).rotation_difference(d.normalized())
        v=[];f=[]
        # Round ends plus central tapered segment; no post-export modifiers.
        for z,r in [(-d.length/2-radius*.65,0),(-d.length/2,radius*.8),(-d.length/2+radius*.45,radius),(d.length/2-radius2*.45,radius2),(d.length/2,radius2*.8),(d.length/2+radius2*.65,0)]:
            for i in range(segments):
                t=2*math.pi*i/segments;v.append(tuple(mid+q@Vector((r*math.cos(t),r*math.sin(t),z))))
        # Ends use single tip vertices in faces; weld happens in finish.
        for j in range(5):
            for i in range(segments):
                a0=j*segments+i;a1=j*segments+(i+1)%segments;b0=a0+segments;b1=a1+segments
                if j==0:f.append((a0,b0,b1))
                elif j==4:f.append((a0,b0,a1))
                else:f.append((a0,b0,b1,a1))
        self.mesh(label,v,[tuple(reversed(face)) for face in f],color,bone)
    def leaf(self,label,base,tip,width,color,bone):
        a=Vector(base);b=Vector(tip);d=b-a
        side=d.cross(Vector((0,-1,0))).normalized()*width
        if side.length<.0001:side=Vector((width,0,0))
        mid=(a+b)*.5;ridge=mid+Vector((0,-width*.28,0))
        v=[a,mid+side,b,mid-side,ridge,mid+Vector((0,width*.18,0))]
        self.mesh(label,[tuple(x) for x in v],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],color,bone)
    def finish(self,rig):
        me=bpy.data.meshes.new(self.name+' • mesh');me.from_pydata(self.verts,[],self.faces);me.update()
        obj=bpy.data.objects.new(self.name,me);bpy.context.collection.objects.link(obj)
        mat=material()
        if self.name=='lanternfly':
            mat=mat.copy();mat.name='Lanternfly • warm emission'
            bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            bs.inputs['Emission Color'].default_value=rgba('FFD36C');bs.inputs['Emission Strength'].default_value=.14
        me.materials.append(mat);color=me.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
        for poly,c in zip(me.polygons,self.colors):
            poly.use_smooth=True
            for li in poly.loop_indices:color.data[li].color=c
        names=set()
        for w in self.weights:names.update(w if isinstance(w,dict) else [w])
        for name in sorted(names):
            group=obj.vertex_groups.new(name=name)
            for i,w in enumerate(self.weights):
                value=w.get(name,0) if isinstance(w,dict) else 1 if w==name else 0
                if value:group.add([i],value,'REPLACE')
        mod=obj.modifiers.new('Shared skin','ARMATURE');mod.object=rig
        obj.parent=rig
        obj['style']='Warm flat vertex palette; toon lighting supplied by game'
        # Triangulate explicitly for a stable published triangle count.
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        tr=obj.modifiers.new('Explicit triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tr.name);obj.select_set(False)
        return obj

def make_armature(name,bones):
    arm=bpy.data.armatures.new(name+' • skeleton');rig=bpy.data.objects.new(name+' • rig',arm);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for n,h,t,p in bones:
        eb=arm.edit_bones.new(n);eb.head=h;eb.tail=t
        if p:eb.parent=arm.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    rig.show_in_front=True
    return rig

def create_action(rig,name,duration,poses):
    """poses = {bone: {'rotation': {normalized_time: XYZ radians}, 'location': {...}}}."""
    rig.animation_data_create();a=bpy.data.actions.new(name);rig.animation_data.action=a
    for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
    for bone,channels in poses.items():
        pb=rig.pose.bones[bone]
        for kind,keys in channels.items():
            prop='rotation_euler' if kind=='rotation' else kind
            for t,val in sorted(keys.items()):
                setattr(pb,prop,val);pb.keyframe_insert(data_path=prop,frame=round(float(t)*duration*FPS,6),group=bone)
    for fc in a.fcurves:
        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
    a['duration_seconds']=duration
    a.use_fake_user=True
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,0,a);strip.action_frame_start=0;strip.action_frame_end=duration*FPS;track.mute=True
    rig.animation_data.action=None
    for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
    return a

def export_model(name,obj,rig,actions):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    rig.animation_data.action=None
    path=ROOT/'models'/f'{name}.glb'
    bpy.context.scene.render.fps=FPS;bpy.context.scene.frame_set(0)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
        export_materials='EXPORT',export_normals=True,export_texcoords=False,export_tangents=False,
        export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,
        export_force_sampling=False,export_optimize_animation_size=True,export_anim_single_armature=True,
        export_nla_strips_merged_animation_name='Animation',export_skins=True,export_all_influences=False,
        export_morph=False,export_lights=False,export_cameras=False,export_extras=True)
    verts=[obj.matrix_world@v.co for v in obj.data.vertices]
    return {'name':name,'triangles':len(obj.data.polygons),'bytes':path.stat().st_size,'bones':[b.name for b in rig.data.bones],
        'animations':{a.name:float(a['duration_seconds']) for a in actions},'blender_bounds':[[min(v[i] for v in verts) for i in range(3)],[max(v[i] for v in verts) for i in range(3)]]}
