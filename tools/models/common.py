"""Shared single-material mesh, leaf atlas, export and studio renders. Blender Z up exports Y up."""
import bpy, math, random, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = Path('/Users/dabot/dev/sandbox/game-look-test/design/img/options/models')

def start(seed):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    return random.Random(seed)

def material():
    # Left half is solid for bark/stone; right half is a spray of overlapping pointed leaves.
    image=bpy.data.images.new('leaf-atlas',width=128,height=64,alpha=True)
    pixels=[]
    leaves=[(.5,.5,.21,.47,0),(.26,.42,.16,.31,-.7),(.73,.47,.17,.33,.7),(.3,.73,.15,.24,-.7),(.72,.76,.14,.23,.7)]
    for y in range(64):
        for x in range(128):
            u=(x-64)/63; v=y/63; a=1 if x<64 else 0
            if x>=64:
                for cx,cy,rx,ry,angle in leaves:
                    dx=u-cx; dy=v-cy
                    xx=dx*math.cos(angle)-dy*math.sin(angle); yy=dx*math.sin(angle)+dy*math.cos(angle)
                    if abs(xx/rx)**1.25+abs(yy/ry)**1.25<1: a=1
            pixels.extend((1,1,1,a))
    image.pixels=pixels; image.pack()
    m=bpy.data.materials.new('painted palette and leaf cutout'); m.use_nodes=True; m.diffuse_color=(.3,.48,.13,1)
    n=m.node_tree.nodes; links=m.node_tree.links; p=n.get('Principled BSDF'); p.inputs['Roughness'].default_value=.92
    tex=n.new('ShaderNodeTexImage'); tex.image=image; tex.interpolation='Linear'
    col=n.new('ShaderNodeVertexColor'); col.layer_name='Color'
    links.new(col.outputs['Color'],p.inputs['Base Color']); links.new(tex.outputs['Alpha'],p.inputs['Alpha'])
    m.surface_render_method='DITHERED'; m.use_backface_culling=False
    return m

class Mesh:
    def __init__(self): self.v=[]; self.f=[]; self.colors=[]; self.uv=[]; self.norm=[]
    def face(self,points,color,leaf=False,normals=None):
        i=len(self.v); self.v.extend(points); self.f.append(tuple(range(i,i+len(points))))
        self.colors.extend([color]*len(points)); self.uv.extend([(0.51,0.01),(.99,.01),(.99,.99),(.51,.99)] if leaf else [(.2,.5)]*len(points))
        normal=(Vector(points[1])-Vector(points[0])).cross(Vector(points[2])-Vector(points[0])).normalized()
        self.norm.extend(normals or [tuple(normal)]*len(points))
    def tube(self,points,radii):
        rings=[]; normals=[]
        for j,point in enumerate(points):
            axis=(Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])).normalized()
            u=axis.cross(Vector((0,1,0))).normalized(); v=axis.cross(u)
            normals.append([u*math.cos(k*math.tau/8)+v*math.sin(k*math.tau/8) for k in range(8)])
            rings.append([Vector(point)+radii[j]*n for n in normals[-1]])
        for j in range(len(points)-1):
            for k in range(8):
                h=(k+1)%8
                self.face([rings[j][k],rings[j][h],rings[j+1][h],rings[j+1][k]],(.30,.175,.085,1),normals=[tuple(normals[j][k]),tuple(normals[j][h]),tuple(normals[j+1][h]),tuple(normals[j+1][k])])
    def cards(self,r,center,radius,count):
        c=Vector(center)
        for i in range(count):
            z=r.uniform(-1,1); t=i*2.39996323; n=Vector((math.sqrt(1-z*z)*math.cos(t),math.sqrt(1-z*z)*math.sin(t),z))
            p=c+Vector((n.x*radius[0],n.y*radius[1],n.z*radius[2]))*r.uniform(.65,1)
            axis=n.cross(Vector((0,0,1))).normalized(); up=n.cross(axis).normalized()
            size=r.uniform(.32,.52) if count>150 else r.uniform(.23,.36)
            points=[p+axis*x*size+up*y*size for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            light=max(0,min(1,(p.z-(center[2]-radius[2]))/(2*radius[2])))
            col=(.095+.16*light,.21+.22*light,.035+.065*light,1)
            normals=[tuple((Vector(q)-c+Vector((0,0,.5))).normalized()) for q in points]
            self.face(points,col,True,normals)
    def object(self,name):
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(self.v,[],self.f); mesh.update()
        obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
        attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER'); uv=mesh.uv_layers.new()
        for poly in mesh.polygons:
            poly.use_smooth=True
            for li in poly.loop_indices:
                vi=mesh.loops[li].vertex_index; attr.data[li].color=self.colors[vi]; uv.data[li].uv=self.uv[vi]
        mesh.normals_split_custom_set_from_vertices(self.norm)
        obj.data.materials.append(material()); return obj

def finish(obj,name):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    target=ROOT/'public/assets/models'/f'{name}.glb'; target.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_normals=True,export_yup=True)
    if '--renders' not in sys.argv: return
    OUT.mkdir(parents=True,exist_ok=True)
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=20
    scene.render.resolution_x=640; scene.render.resolution_y=640; scene.render.resolution_percentage=100
    scene.world.color=(.45,.45,.45); scene.view_settings.view_transform='Standard'
    height=max(v.co.z for v in obj.data.vertices); width=max(max(abs(v.co.x),abs(v.co.y)) for v in obj.data.vertices)
    bpy.ops.mesh.primitive_plane_add(size=200); ground=bpy.context.object
    mat=bpy.data.materials.new('warm studio'); mat.diffuse_color=(.67,.72,.58,1); ground.data.materials.append(mat); ground.location.z=-.025
    bpy.ops.object.light_add(type='AREA',location=(-4,-5,10)); bpy.context.object.data.energy=1600; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=7
    bpy.ops.object.camera_add(); camera=bpy.context.object; scene.camera=camera; camera.data.type='ORTHO'; camera.data.ortho_scale=max(height*1.25,width*2.7)
    for label,angle in [('front',0),('three-quarter',.75)]:
        camera.location=(math.sin(angle)*12,-math.cos(angle)*12,height*.5+5)
        camera.rotation_euler=(Vector((0,0,height*.48))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/f'{name}-{label}.png'); bpy.ops.render.render(write_still=True)
