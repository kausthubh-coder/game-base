"""Hollowmere original mesh vocabulary. Blender Z up, front -Y; glTF Y up,+Z."""
import bpy, math, random
from mathutils import Vector, Matrix
from math import sin,cos,pi,sqrt
PALETTE={
 'cream':'F3E5BC','plaster':'EBD5A2','wheat':'DDAF55','gold':'E8BD5E','teal':'387E7B','teal_light':'529B92','teal_dark':'2B5F62',
 'oak':'65422E','wood':'976341','wood_light':'BB8955','stone':'A69B86','stone_light':'C9BEA6','dark':'3B3936','leaf':'73935B',
 'flower':'E9B858','pink':'D98884','roof':'B96D51','terracotta':'BE7C55','water':'549C9B','bronze':'98845A','soil':'63513C'
}
def linear(c): return c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4
def rgba(c):
 if isinstance(c,str):
  h=PALETTE.get(c,c).lstrip('#'); return (*[linear(int(h[i:i+2],16)/255) for i in (0,2,4)],1)
 return (*c[:3],c[3] if len(c)>3 else 1)
def materials():
 body=bpy.data.materials.get('Body')
 if body is None:
  body=bpy.data.materials.new('Body');body.use_nodes=True
  p=body.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.9;p.inputs['Specular IOR Level'].default_value=.2
  a=body.node_tree.nodes.new('ShaderNodeVertexColor');a.layer_name='Color';body.node_tree.links.new(a.outputs['Color'],p.inputs['Base Color'])
 glow=bpy.data.materials.get('Glow')
 if glow is None:
  glow=bpy.data.materials.new('Glow');glow.use_nodes=True
  p=glow.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=rgba('gold');p.inputs['Emission Color'].default_value=rgba('FFD28A');p.inputs['Emission Strength'].default_value=2.8;p.inputs['Roughness'].default_value=1
 return body,glow
def mesh(name,verts,faces,color,glow=False):
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update()
 ob=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(ob)
 m.materials.append(materials()[1 if glow else 0]);col=m.color_attributes.new(name='Color',type='BYTE_COLOR',domain='CORNER')
 base=rgba(color)
 for poly in m.polygons:
  # restrained facet variation, no baked dynamic lighting or near-black tones
  f=1 if glow else (0.96+0.04*max(0,poly.normal.z))
  for k in poly.loop_indices: col.data[k].color=(*[base[i]*f for i in range(3)],base[3])
 return ob
def box(name,loc,size,color,bevel=0.0):
 x,y,z=loc;a,b,c=[v/2 for v in size]
 verts=[(x+i*a,y+j*b,z+k*c) for i,j,k in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
 o=mesh(name,verts,[tuple(reversed(f)) for f in [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]],color)
 if bevel>0:
  # one-segment chamfer: soft lowpoly edges, not subdivided rounded cubes
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  mod=o.modifiers.new('Soft carved edges','BEVEL');mod.width=min(bevel,min(size)*.24);mod.segments=1;mod.affect='EDGES'
  bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
  for d in o.data.color_attributes['Color'].data:d.color=rgba(color)
 return o
def beam(name,a,b,width,color,depth=None):
 a,b=Vector(a),Vector(b);direction=b-a;d=direction.length
 o=box(name,(0,0,0),(width,depth or width,d),color)
 q=Vector((0,0,1)).rotation_difference(direction.normalized());mat=q.to_matrix().to_4x4();mat.translation=(a+b)/2
 o.data.transform(mat);return o
def cylinder(name,loc,radius,depth,color,vertices=8,rotation=None):return cone(name,loc,radius,radius,depth,color,vertices,rotation)
def cone(name,loc,r1,r2,depth,color,vertices=8,rotation=None):
 verts=[(r*cos(2*pi*i/vertices),r*sin(2*pi*i/vertices),z) for z,r in [(-depth/2,r1),(depth/2,r2)] for i in range(vertices)]
 faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]+[(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
 o=mesh(name,verts,faces,color)
 if rotation:
  from mathutils import Euler
  o.data.transform(Euler(rotation).to_matrix().to_4x4())
 o.data.transform(Matrix.Translation(loc));return o
def sphere(name,loc,scale,color,segments=8,rings=4):
 verts=[(0,0,-1)];
 for j in range(1,rings):
  p=-pi/2+pi*j/rings
  for i in range(segments):verts.append((cos(p)*cos(2*pi*i/segments),cos(p)*sin(2*pi*i/segments),sin(p)))
 verts.append((0,0,1));faces=[]
 for i in range(segments):faces.append((0,1+(i+1)%segments,1+i))
 for j in range(rings-2):
  for i in range(segments):
   a=1+j*segments+i;b=1+j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 t=len(verts)-1
 for i in range(segments):faces.append((t,t-segments+i,t-segments+(i+1)%segments))
 verts=[tuple(loc[k]+v[k]*scale[k] for k in range(3)) for v in verts]
 return mesh(name,verts,faces,color)
def roof(name,cx,cy,width,depth,eave_z,ridge_z,color='teal'):
 # Concave, softly kicked eave silhouette. Ridge is along Y.
 profile=[(-width/2,eave_z),(-width*.38,eave_z+.16),(-width*.16,ridge_z-.43),(0,ridge_z),(width*.16,ridge_z-.43),(width*.38,eave_z+.16),(width/2,eave_z)]
 verts=[(cx+x,cy+y,z) for y in [-depth/2,depth/2] for x,z in profile]
 faces=[(i,i+1,i+8,i+7) for i in range(6)]
 o=mesh(name+'_curved_roof',verts,faces,color)
 # modeled thick eave/rake trim; clean solid silhouette from every side
 for j,y in enumerate([-depth/2,depth/2]):
  for i in range(6):beam(name+'_rake', (cx+profile[i][0],cy+y,profile[i][1]),(cx+profile[i+1][0],cy+y,profile[i+1][1]),.17,'wood_light' if color=='wheat' else 'teal_dark')
 for x,z in [profile[0],profile[-1]]:beam(name+'_eave',(cx+x,cy-depth/2,z),(cx+x,cy+depth/2,z),.18,'wood_light' if color=='wheat' else 'teal_dark')
 # broad courses make tiled/thatch treatment readable without a texture set
 for side in [-1,1]:
  for frac in [.3,.62]:
   x=side*width*.5*frac
   pts=profile[3:]
   xx=abs(x)
   z=next(za+(zb-za)*(xx-xa)/(xb-xa) for (xa,za),(xb,zb) in zip(pts,pts[1:]) if xa<=xx<=xb)
   beam(name+'_roof_course',(cx+x,cy-depth/2+.08,z+.035),(cx+x,cy+depth/2-.08,z+.035),.045,'gold' if color=='wheat' else 'teal_light')
 beam(name+'_chunky_ridge',(cx,cy-depth/2-.05,ridge_z+.04),(cx,cy+depth/2+.05,ridge_z+.04),.24,'wood_light' if color=='wheat' else 'teal_light')
 return o
def gable_wall(name,cx,cy,width,depth,eave_z,ridge_z,color='cream'):
 profile=[(-width/2,eave_z),(-width*.38,eave_z+.10),(-width*.16,ridge_z-.50),(0,ridge_z-.10),(width*.16,ridge_z-.50),(width*.38,eave_z+.10),(width/2,eave_z)]
 v=[(cx+x,cy+y,z) for y in [-depth/2,depth/2] for x,z in profile]
 faces=[tuple(range(6,-1,-1)),tuple(range(7,14))]+[(i,(i+1)%7,(i+1)%7+7,i+7) for i in range(7)]
 return mesh(name,v,faces,color)
def flowerbox(name,x,y,z,w=1):
 box(name+'_planter',(x,y,z),(w,.34,.25),'wood',.035)
 box(name+'_soil',(x,y,z+.12),(w*.88,.26,.04),'soil')
 for i in range(3):
  xx=x+(i-1)*w*.3
  sphere(name+'_leaves',(xx,y,z+.25),(.18,.18,.18),'leaf',6,3)
  sphere(name+'_bloom',(xx,y-.04,z+.39),(.095,.09,.085),'pink' if i%2 else 'flower',6,3)
def window(name,x,y,z,w=.8,h=1.0,side=False,flowers=True):
 old=set(bpy.data.objects)
 box(name+'_surround',(x,y,z),(w+.19,.12,h+.18),'oak',.03)
 # shared emissive panes, no textures
 ob=box(name+'_Glow',(x,y-.071,z),(w,.025,h),'gold');ob.data.materials.clear();ob.data.materials.append(materials()[1])
 for xx in [x-w/2-.04,x+w/2+.04]:box(name+'_shutter',(xx,y-.11,z),(.18,.07,h+.06),'teal')
 box(name+'_mullion',(x,y-.10,z),(.065,.045,h),'wood_light');box(name+'_crossbar',(x,y-.10,z-.03),(w,.045,.065),'wood_light')
 box(name+'_sill',(x,y-.14,z-h/2-.09),(w+.30,.30,.12),'stone_light',.025)
 if flowers:flowerbox(name,x,y-.22,z-h/2-.28,w+.14)
 if side:
  M=Matrix.Translation((x,y,0))@Matrix.Rotation(pi/2,4,'Z')@Matrix.Translation((-x,-y,0))
  for o in set(bpy.data.objects)-old:o.data.transform(M)
 return list(set(bpy.data.objects)-old)
def door(name,x,y,z=0,w=1.1,h=2.2):
 box(name+'_frame',(x,y,z+h/2),(w+.27,.17,h+.15),'oak',.06)
 box(name+'_flat_door',(x,y-.10,z+h/2),(w,.06,h),'wood',.045)
 for i in range(4):box(name+'_plank',(x-w*.375+i*w*.25,y-.139,z+h/2),(.014,.012,h-.09),'wood_light')
 box(name+'_lintel',(x,y-.13,z+h+.02),(w+.36,.23,.18),'wood_light',.035)
 sphere(name+'_knob',(x+w*.30,y-.19,z+h*.48),(.055,.045,.055),'gold',6,3)
def lantern(name,x,y,z,scale=1):
 s=scale
 beam(name+'_bracket',(x,y+.10,z+.46*s),(x,y-.24*s,z+.46*s),.065*s,'oak')
 beam(name+'_chain',(x,y-.24*s,z+.46*s),(x,y-.24*s,z+.24*s),.035*s,'bronze')
 cone(name+'_cap',(x,y-.24*s,z+.22*s),.22*s,.11*s,.14*s,'teal_dark',6)
 o=cylinder(name+'_Glow',(x,y-.24*s,z),.14*s,.32*s,'gold',6);o.data.materials.clear();o.data.materials.append(materials()[1])
 cylinder(name+'_foot',(x,y-.24*s,z-.19*s),.17*s,.08*s,'bronze',6)
 for xx in [-1,1]:beam(name+'_cage',(x+xx*.135*s,y-.24*s,z-.17*s),(x+xx*.135*s,y-.24*s,z+.17*s),.025*s,'bronze')
def crest(name,x,y,z,scale=1):
 s=scale
 # relief wheat sheaf: three stems and fat alternating grain lozenges
 for i in [-1,0,1]:
  beam(name+'_stalk',(x,y,z-.34*s),(x+i*.17*s,y,z+.31*s),.035*s,'gold')
  for j in range(2):
   xx=x+i*.12*s;zz=z+.1*s+j*.14*s
   mesh(name+'_grain',[(xx-.10*s,y-.02,zz),(xx,y-.03,zz+.11*s),(xx+.1*s,y-.02,zz),(xx,y-.025,zz-.09*s)],[(0,1,2,3)],'wheat')
 box(name+'_binding',(x,y-.025,z-.12*s),(.26*s,.025,.065*s),'cream')
def timber_frame(name,cx,cy,w,d,eave_z,base=.25):
 for x in [cx-w/2,cx+w/2]:
  for y in [cy-d/2,cy+d/2]:box(name+'_corner',(x,y,(base+eave_z)/2),(.20,.20,eave_z-base),'oak',.025)
 for z in [base+.2,eave_z-.12]:
  for y in [cy-d/2,cy+d/2]:box(name+'_belt',(cx,y,z),(w+.14,.16,.17),'wood')
  for x in [cx-w/2,cx+w/2]:box(name+'_belt_side',(x,cy,z),(.16,d+.14,.17),'wood')
def awning(name,x,y,z,w,d,color='teal'):
 for i in range(6):
  x0=x-w/2+w*i/6;x1=x0+w/6
  mesh(name+'_stripe',[(x0,y,z),(x1,y,z),(x1,y-d*.45,z-.10),(x0,y-d*.45,z-.10),(x0,y-d,z-.42),(x1,y-d,z-.42),(x1,y-d,z-.62),(x0,y-d,z-.62)],[(0,1,2,3),(3,2,5,4),(4,5,6,7)],'cream' if i%2 else color)
 for xx in [x-w*.47,x+w*.47]:beam(name+'_strut',(xx,y,z-.65),(xx,y-d,z-.43),.06,'oak')
def chimney(name,x,y,z,h=1):
 box(name+'_stack',(x,y,z+h/2),(.51,.58,h),'stone_light',.05)
 box(name+'_cap',(x,y,z+h),(.69,.73,.16),'stone',.04)
 for zz in [z+h*.3,z+h*.65]:box(name+'_course',(x,y-.301,zz),(.49,.025,.045),'stone')
 box(name+'_soot',(x,y,z+h+.089),(.38,.42,.015),'dark')
def reset_scene():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.meshes):
  if not m.users:bpy.data.meshes.remove(m)
 bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
