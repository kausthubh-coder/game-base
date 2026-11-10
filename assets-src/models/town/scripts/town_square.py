"""Dusk presentation scene. Stage landscape/cast are not part of exported kit budgets."""
import bpy,math,random,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from kit_common import *
from build_export import setup_render,camera_at,area_light,material_plain

def build_square(root):
 root=Path(root);reset_scene();rng=random.Random(17)
 library={}
 def place(name,x,y,rot=0,z=0):
  if name not in library:
   # Load editable source objects; preserve part groupings for square source.
   with bpy.data.libraries.load(str(root/'sources'/f'{name}.blend'),link=False) as (a,b):b.objects=[n for n in a.objects]
   library[name]=[o for o in b.objects if o is not None and o.type=='MESH']
  made=[];R=Matrix.Rotation(math.radians(rot),4,'Z')
  for src in library[name]:
   o=src.copy();o.data=src.data;bpy.context.collection.objects.link(o);o.matrix_world=Matrix.Translation((x,y,z))@R@src.matrix_world;o.name=name+' | '+src.name;made.append(o)
   for j,m in enumerate(o.data.materials):
    if m and m.name.startswith('Body'):o.data.materials[j]=materials()[0]
    elif m and m.name.startswith('Glow'):o.data.materials[j]=materials()[1]
  return made
 # softly beveled island landmass, river/quays, and a generous civic square
 box('STAGE river',(0,-2,-.6),(240,240,.9),'water',.2)
 box('STAGE capital island',(0,9,-.45),(57,47,.82),'leaf',.4)
 box('STAGE stone embankment',(0,-13.65,-.1),(57,1.3,1.1),'stone',.15)
 box('STAGE quay promenade',(0,-12.6,.06),(57,3.3,.16),'stone_light',.06)
 box('STAGE market square',(0,0,.035),(26,23,.07),'stone_light',.06)
 box('STAGE farmland bank',(39,10,-.33),(25,35,.65),'leaf',.2)
 box('STAGE far riverbank',(-25,-28,-.35),(8,15,.68),'leaf',.3)
 box('STAGE arrival path',(-25,-27,.014),(2.7,12,.035),'stone_light')
 # Broad clean paving design, not noisy high-frequency texture.
 for x in range(-12,14,2):
  for y in range(-10,12,2):
   if (x+y)%4==0:box('STAGE paving inset',(x,y,.078),(1.92,1.92,.018),'C1B89F')
 # civic focal axis and varied roof-line, not a row of identical blocks
 place('granary-hall',0,12)
 place('bakery',-13,4,-12)
 place('lodge',-16,-6,-35)
 place('workshop',14,5,12)
 place('house-d',11,15,-10)
 place('house-c',-12,18,6)
 place('house-b',-23,12,-25)
 place('house-a',-23,22,10)
 place('house-d',-8,27,0)
 place('house-c',5,27,0)
 place('house-b',20,23,5)
 place('kennel',23,11,10)
 place('ferry-house',17,-9,0)
 # Ancient machinery reads as a river threshold at the water edge.
 place('rootworks-gate',-27,-2,85)
 place('stone-bridge',-25,-17.6,90,-.03)
 place('dock-segment',17,-15,0,-.02)
 place('dock-segment',17,-18,0,-.02)
 place('town-well',-.5,.2)
 place('statue-gardener-warden',6,6,-15)
 place('market-stall-a',-7,-5,5)
 place('market-stall-b',6,-5,-8)
 place('cart',-8,0,-18)
 place('barrels-crates',-8.8,4,-20)
 place('barrels-crates',20,-7,30)
 place('bench',-5,-10,0);place('bench',5,-10,0)
 place('flower-planter',-2,-10,0);place('flower-planter',2,-10,0)
 place('signpost',10,-7,10)
 for x,y in [(-9,-9),(9,-9),(-10,0),(10,0),(-8,8),(8,8),(-20,-11),(23,-11)]:place('lamp-post',x,y)
 for x,y in [(-6,8),(6,8),(-11,-8),(11,-8)]:place('banner-pole',x,y)
 for x in [-6,0,6]:place('string-lights',x,-3,0,.08)
 for x in range(-22,26,4):
  if x not in [14,18]:place('fence-straight',x,-13.1)
 # Human-scale activity from the user's existing refined cast; these are stage only.
 castroot=root/'references'/'cast'
 cast=[('hero',-1,-6,0),('tamsin',-6,-3,-30),('maren',2,6,0),('odo',-8,-4,-90),('gus',9,1,-20),('mira',4,-2,25),('wren',-4,2,30),('brack',17,-13,0),('villager-a',5,-7,100),('villager-b',-4,-8,-20),('leaftail',-2,-6,-20),('juniper',2,-9,40)]
 for name,x,y,angle in cast:
  p=castroot/f'{name}.glb'
  if not p.exists():continue
  before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(p));new=set(bpy.data.objects)-before
  # Set the same ground alignment as actual glTF runtime placement.
  parents=[o for o in new if o.parent not in new]
  for o in parents:o.matrix_world=Matrix.Translation((x,y,.10))@Matrix.Rotation(math.radians(angle),4,'Z')@o.matrix_world
  for o in new:o.name='STAGE_CAST_'+name+'_'+o.name
 # low-detail grove and distant farm backdrop, all authored stage geometry
 for x,y,size in [(-27,17,1.5),(-21,5,1.6),(-21,-6,1.25),(25,2,1.5),(24,27,1.9),(-16,30,1.8),(15,30,1.8),(-4,32,1.6),(30,18,1.9)]:
  cylinder('STAGE orchard trunk',(x,y,1.1),.21,2.2,'wood',7)
  for dx,dy,dz,r in [(-.7,0,2.9,1.45),(.7,0,3.1,1.5),(0,.4,3.8,1.4)]:sphere('STAGE orchard crown',(x+dx*size,y+dy*size,dz*size*.85),(r*size,r*size*.8,r*size),'leaf',8,4)
 for i in range(6):
  box('STAGE harvest field',(35+i*1.8,10,-.02),(1.3,28,.12),'wheat')
 # floating paper-lamp festival on Mere, tiny warm diamonds and gold water strokes
 for i in range(28):
  x=rng.uniform(-18,25);y=rng.uniform(-27,-16)
  s=rng.uniform(.22,.37)
  box('STAGE floating lamp raft',(x,y,-.10),(s*1.4,s*1.4,.07),'wood')
  o=box('STAGE paper lamp',(x,y,s*.52-.04),(s,s,s),'gold',.035);o.data.materials.clear();o.data.materials.append(materials()[1])
  for k in range(2):box('STAGE reflected lamp',(x,y-.5-k*.22,-.138),(s*(1.1-k*.25),.055,.01),'gold')
 # Decorative water drift lines make river legible in an orthographic scene.
 for i in range(40):
  x=rng.uniform(-39,39);y=rng.uniform(-34,-16);box('STAGE water glint',(x,y,-.14),(rng.uniform(.3,1.8),.045,.015),'teal_light')
 s=setup_render(1800,True);s.render.resolution_x=2000;s.render.resolution_y=1500;s.cycles.samples=64;s.view_settings.exposure=.1
 area_light('PREVIEW setting sun',(-30,-25,36),(0,2,0),22000,(1,.71,.39),24)
 area_light('PREVIEW dusk sky',(20,10,44),(0,3,0),16000,(.43,.62,1),32)
 # Main plaza pools of light; lamps remain warm rather than blown-out cubes.
 for x,y,power in [(-9,-9,140),(9,-9,140),(-10,0,100),(10,0,100),(-8,8,140),(8,8,140),(0,8,240),(-13,1,160),(17,-12,100),(-1,0,100)]:
  d=bpy.data.lights.new('PREVIEW practical','POINT');d.energy=power;d.color=(1,.58,.23);d.shadow_soft_size=1.3;o=bpy.data.objects.new('PREVIEW practical',d);bpy.context.collection.objects.link(o);o.location=(x,y,2.8)
 camera_at('PREVIEW capital camera',(48,-66,47),(-1,4,2.0),69)
 # Remove unused linked source objects left unlinked. Their mesh data is shared with placed copies.
 bpy.ops.wm.save_as_mainfile(filepath=str(root/'sources'/'mock-town-square.blend'),compress=True)
 s.render.filepath=str(root/'renders'/'mock-town-square-dusk.png');bpy.ops.render.render(write_still=True)
 # Secondary human-scale crop gives square and cast legibility.
 camera_at('PREVIEW plaza camera',(23,-32,23),(-.5,3,2.8),39)
 s.render.resolution_x=1800;s.render.resolution_y=1350;s.cycles.samples=64
 s.render.filepath=str(root/'renders'/'town-square-close-dusk.png');bpy.ops.render.render(write_still=True)
 print('SQUARE_DONE',flush=True)
if __name__=='__main__':build_square(Path(__file__).resolve().parents[1])

def render_square_source(root):
 """Render the editable scene without rebuilding or replacing any placed geometry."""
 root=Path(root);bpy.ops.wm.open_mainfile(filepath=str(root/'sources'/'mock-town-square.blend'))
 s=bpy.context.scene;s.camera=bpy.data.objects.get('PREVIEW capital camera') or s.camera
 s.render.resolution_percentage=100;s.render.resolution_x=1800;s.render.resolution_y=1350;s.cycles.samples=64
 s.render.filepath=str(root/'renders'/'mock-town-square-dusk.png');bpy.ops.render.render(write_still=True)
 camera_at('PREVIEW plaza camera',(23,-32,23),(-.5,3,2.8),39)
 s.render.resolution_x=1400;s.render.resolution_y=1050;s.cycles.samples=64
 s.render.filepath=str(root/'renders'/'town-square-close-dusk.png');bpy.ops.render.render(write_still=True)
