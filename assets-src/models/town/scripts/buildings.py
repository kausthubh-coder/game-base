"""Original Hollowmere building meshes, in metres, front toward Blender -Y.

No texture images, imported geometry or per-building materials. All accents use
kit_common's two shared materials and vertex palette. Authored by composition:
small human-scale doors, slightly broad walls, generous eaves and clear trades.
"""
from kit_common import *
import math
import bpy
from mathutils import Matrix, Vector

SPECS = {
    'bakery': {'footprint': [10, 8], 'category': 'building', 'description': 'Cream-and-oak bakehouse with teal curved roof, rounded clay oven wing, wheat crest, bread sign and striped shop awning.', 'budget': 4000},
    'lodge': {'footprint': [12, 10], 'category': 'building', 'description': 'Proud two-storey riverside lodge with stepped golden gables, long welcoming porch and generous glowing windows.', 'budget': 4000},
    'workshop': {'footprint': [10, 8], 'category': 'building', 'description': 'Asymmetric makers workshop with tall teal cottage and genuinely open timber work bay, bench, anvil and stacked lumber.', 'budget': 4000},
    'kennel': {'footprint': [10, 8], 'category': 'building', 'description': 'Substantial keeper cottage with warm windows, lower thatched canine wing, dog-size arched entrances and paw sign.', 'budget': 4000},
    'ferry-house': {'footprint': [10, 10], 'category': 'building', 'description': 'River-teal ferry keeper house with flat plank dock, bollards, landing rails, crossed-oar sign and welcoming lanterns.', 'budget': 4000},
    'house-a': {'footprint': [7, 6], 'category': 'building', 'description': 'Small one-storey wheat-thatched cottage with broad curved eaves, one luminous gable eye and a flower-filled front window.', 'budget': 4000},
    'house-b': {'footprint': [9, 8], 'category': 'building', 'description': 'Medium L-plan teal-roof home with lower side gable, projecting window bay and a little roof dormer.', 'budget': 4000},
    'house-c': {'footprint': [10, 7], 'category': 'building', 'description': 'Broad medium farmhouse with warm golden thatch, projecting entry gable, exposed cross timber and colorful window boxes.', 'budget': 4000},
    'house-d': {'footprint': [8, 8], 'category': 'building', 'description': 'Two-storey jettied townhome with steep teal gable, oak balcony, prominent corner braces and flower boxes.', 'budget': 4000},
}


def _part(name, x, y, w, d, eave, ridge, color='teal', base=.22, light=False):
    """Grounded house volume; geometry is intentionally generous and squat."""
    box(name+'_stone_foot', (x, y, base*.5), (w+.12, d+.12, base), 'stone', bevel=0 if light else .05)
    box(name+'_plaster', (x, y, (eave+base)*.5), (w, d, eave-base), 'cream', bevel=0 if light else .065)
    gable_wall(name+'_gable', x, y, w, d, eave, ridge-.18, 'plaster')
    if light:
        for xx in (x-w*.5,x+w*.5):
            for yy in (y-d*.5,y+d*.5):
                beam(name+'_corner',(xx,yy,base),(xx,yy,eave),.20,'oak')
        for zz in (base+.20,eave-.12):
            for yy in (y-d*.5,y+d*.5):
                beam(name+'_belt',(x-w*.5,yy,zz),(x+w*.5,yy,zz),.17,'wood')
            for xx in (x-w*.5,x+w*.5):
                beam(name+'_side_belt',(xx,y-d*.5,zz),(xx,y+d*.5,zz),.17,'wood')
    else:
        timber_frame(name+'_oak', x, y, w, d, eave, base=base)
    roof(name+'_roof', x, y, w+.82, d+.85, eave, ridge, color)
    # The gable fan is broad enough to read in isometric views.
    yy=y-d*.5-.075
    beam(name+'_gable_king', (x, yy, eave), (x, yy, ridge-.18), .17, 'oak')
    for side in (() if light else (-1, 1)):
        beam(name+'_gable_fan', (x, yy, eave+.08), (x+side*w*.32, yy, eave+(ridge-eave)*.33), .14, 'wood_light')
    return y-d*.5-.09


def _braces(name, x, y, w, eave):
    for side in (-1, 1):
        xx=x+side*w*.5
        beam(name+'_knee', (xx, y, eave-.72), (xx-side*.68, y, eave-.12), .18, 'oak')


def _step(name, x, y, w=1.5, depth=.7, z=.16):
    box(name+'_step', (x, y, z*.5), (w, depth, z), 'stone_light', bevel=.06)


def _arch(name, x, y, z, w, h, color, depth=.08):
    """Low-poly arched, extruded plaque/opening, lower edge at z."""
    spring=h-w*.5
    p=[(-w*.5,0), (w*.5,0), (w*.5,spring)]
    for i in range(1, 9):
        a=math.pi*i/8
        p.append((math.cos(a)*w*.5, spring+math.sin(a)*w*.5))
    n=len(p)
    verts=[(x+xx, y+yy, z+zz) for yy in (-depth*.5, depth*.5) for xx,zz in p]
    faces=[tuple(range(n-1, -1, -1)), tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name, verts, faces, color)


def _small_glass(name, x, y, z, w=.75, h=.7, arch=False):
    if arch:
        _arch(name+'_rim',x,y,z-h*.5,w+.17,h+.16,'oak',.12)
        # Front-facing glowing inset follows the arched frame.
        obj=_arch(name+'_glass',x,y-.075,z-h*.5+.08,w,h,'gold',.025)
        # Material assignment goes through the shared mesh helper.
        verts=[(x-w*.42,y-.10,z-h*.38),(x+w*.42,y-.10,z-h*.38),(x+w*.42,y-.10,z+h*.24),(x,y-.10,z+h*.47),(x-w*.42,y-.10,z+h*.24)]
        mesh(name+'_glow',verts,[(0,1,2,3,4)],'gold',glow=True)
    else:
        box(name+'_rim',(x,y,z),(w+.17,.13,h+.15),'oak',bevel=.025)
        mesh(name+'_glow',[(x-w*.5,y-.08,z-h*.5),(x+w*.5,y-.08,z-h*.5),(x+w*.5,y-.08,z+h*.5),(x-w*.5,y-.08,z+h*.5)],[(0,1,2,3)],'gold',glow=True)
    beam(name+'_vertical',(x,y-.13,z-h*.45),(x,y-.13,z+h*.40),.065,'wood_light')


def _hanging_sign(name,x,y,z,w=1.05,h=.68):
    beam(name+'_wallarm',(x,y+.53,z+.4),(x,y-.14,z+.4),.115,'oak')
    beam(name+'_brace',(x,y+.43,z+.11),(x,y-.1,z+.4),.08,'wood_light')
    beam(name+'_hanging_bar',(x-w*.36,y-.14,z+.4),(x+w*.36,y-.14,z+.4),.085,'oak')
    for dx in (-w*.3,w*.3):
        beam(name+'_hang',(x+dx,y-.14,z+.4),(x+dx,y-.14,z+h*.5),.045,'bronze')
    box(name+'_board',(x,y-.14,z),(w,.12,h),'oak',bevel=.09)
    box(name+'_inset',(x,y-.215,z),(w-.12,.045,h-.12),'wood_light',bevel=.05)
    return y-.25


def _bread_sign(name,x,y,z):
    yy=_hanging_sign(name,x,y,z,1.2,.78)
    sphere(name+'_loaf',(x,yy-.035,z),(.44,.075,.21),'wheat',segments=10,rings=4)
    for dx in (-.20,0,.20):
        beam(name+'_bread_cut',(x+dx-.035,yy-.115,z-.07),(x+dx+.035,yy-.115,z+.10),.035,'cream')


def _paw_sign(name,x,y,z):
    yy=_hanging_sign(name,x,y,z,.86,.76)
    sphere(name+'_pad',(x,yy-.04,z-.07),(.18,.035,.15),'wheat',segments=6,rings=3)
    for dx,dz in ((-.22,.11),(-.08,.23),(.08,.23),(.22,.11)):
        sphere(name+'_toe',(x+dx,yy-.04,z+dz),(.075,.04,.09),'wheat',segments=6,rings=3)


def _plain_window(name,x,y,z,w=.8,h=1.05,side=False):
    window(name,x,y,z,w=w,h=h,side=side,flowers=False)


def _gable_porchette(name,x,y,w,d,eave,ridge,color='teal'):
    # Roof over open space, without a closed triangular front wall.
    roof(name+'_hood',x,y,w,d,eave,ridge,color)
    for side in (-1,1):
        xx=x+side*(w*.5-.22)
        beam(name+'_post',(xx,y-d*.5+.16,.17),(xx,y-d*.5+.16,eave),.18,'oak')
        beam(name+'_brace',(xx,y-d*.5+.16,eave-.55),(xx-side*.44,y-d*.5+.16,eave-.08),.12,'wood_light')


def _roof_straps(name,x,y,w,d,eave,ridge,number=4):
    # Short rafters peeking from the eaves, not outlines over every roof tile.
    for i in range(number):
        yy=y-d*.5+(i+.5)*d/number
        for side in (-1,1):
            beam(name+'_rafter',(x+side*(w*.5-.32),yy,eave-.16),(x+side*(w*.5+.28),yy,eave-.03),.12,'oak')


def _dormer_side(name,x,y,z,w=1.4,d=1.5):
    """Small true dormer oriented out of the +X roof slope."""
    before=set(bpy.data.objects)
    # Build at origin on a +Y-axis gable, then rotate the complete assembly.
    box(name+'_wall',(0,0,z+.31),(w,d,.7),'cream',bevel=.025)
    gable_wall(name+'_gable',0,0,w,d,z+.66,z+1.3,'cream')
    roof(name+'_roof',0,0,w+.3,d+.26,z+.66,z+1.34,'teal')
    _plain_window(name+'_window',0,-d*.5-.07,z+.36,w=.72,h=.63)
    for obj in set(bpy.data.objects)-before:
        obj.matrix_world=Matrix.Translation((x,y,0)) @ Matrix.Rotation(math.pi/2,4,'Z') @ obj.matrix_world


def bakery():
    f=_part('bakery_main',-.85,.45,5.8,4.75,3.35,5.8,'teal')
    door('bakery_door',-2.28,f,.22,w=1.1,h=2.2)
    _step('bakery_threshold',-2.28,f-.35,1.55,.67,.22)
    window('bakery_shop_window',-.15,f,1.72,w=1.65,h=1.28,flowers=False)
    awning('bakery_shop_awning',-.12,f-.03,2.65,2.67,1.23,'wheat')
    flowerbox('bakery_front_flowers',-.15,f-.21,.76,1.62)
    _plain_window('bakery_right_window',2.10,.65,1.9,w=.95,h=1.18,side=True)
    _small_glass('bakery_gable_eye',-.85,f-.015,4.18,.74,.78,True)
    crest('bakery_wheat_crest',-.85,f-.13,5.10,scale=.66)
    _bread_sign('bakery_bread_sign',-3.25,f-.35,2.58)
    lantern('bakery_lantern',-1.38,f-.19,2.53,scale=.75)
    chimney('bakery_main_chimney',-2.64,1.8,4.73,h=1.5)
    _braces('bakery_front',-.85,f-.01,5.75,3.35)
    # Attached circular oven wing: cylinder, broad low dome and a tall flue.
    ox,oy=3.02,.47
    cylinder('bakery_oven_stone',(ox,oy,.15),1.47,.3,'stone',vertices=12)
    cylinder('bakery_oven_cream',(ox,oy,1.46),1.38,2.52,'plaster',vertices=12)
    cylinder('bakery_oven_belt',(ox,oy,2.68),1.48,.20,'wood_light',vertices=12)
    sphere('bakery_clay_dome',(ox,oy,2.73),(1.5,1.5,1.05),'terracotta',segments=12,rings=6)
    chimney('bakery_oven_flue',ox+.14,oy+.28,3.39,h=1.38)
    of=oy-1.36
    _arch('bakery_oven_arch',ox,of-.07,.27,1.43,1.98,'stone_light',.20)
    _arch('bakery_oven_opening',ox,of-.20,.27,1.06,1.64,'dark',.06)
    # The oven fire is deliberately restrained, behind a charcoal grate.
    mesh('bakery_oven_embers',[(ox-.38,of-.24,.37),(ox+.38,of-.24,.37),(ox+.3,of-.24,.66),(ox-.3,of-.24,.66)],[(0,1,2,3)],'gold',glow=True)
    for dx in (-.28,0,.28):
        beam('bakery_oven_grate',(ox+dx,of-.28,.32),(ox+dx,of-.28,.94),.055,'dark')
    box('bakery_oven_shelf',(ox,of-.42,.25),(1.9,.88,.20),'stone_light',bevel=.04)
    # Bakery counter with two stylized loaves.
    box('bakery_counter',(.16,f-.48,.62),(1.52,.62,.12),'wood_light',bevel=.025)
    for dx in (-.44,.47):
        beam('bakery_counter_leg',(.16+dx,f-.47,.08),(.16+dx,f-.47,.58),.13,'oak')
    for dx in (-.34,.26):
        sphere('bakery_counter_loaf',(.16+dx,f-.5,.81),(.24,.15,.13),'wheat',segments=8,rings=4)
    _roof_straps('bakery',-.85,.45,5.8,4.75,3.35,5.8,3)


def lodge():
    f=_part('lodge_hall',0,.75,7.4,5.55,6.05,8.55,'wheat')
    # Lower gabled shoulders give the hall a purposeful stepped silhouette.
    for side in (-1,1):
        x=side*4.17
        sf=_part('lodge_shoulder',x,.94,2.20,4.0,3.15,4.5,'wheat',light=True)
        _small_glass('lodge_shoulder_window',x,sf,1.76,w=.86,h=1.10)
    box('lodge_floor_band',(0,f-.025,3.10),(7.5,.22,.24),'oak')
    door('lodge_double_entry',0,f,.24,w=1.58,h=2.2)
    for x in (-2.38,2.38):
        _plain_window('lodge_ground_window',x,f,1.72,w=1.05,h=1.26)
        window('lodge_upper_window',x,f,4.52,w=1.10,h=1.22,flowers=(x<0))
    _plain_window('lodge_upper_center',0,f,4.61,w=1.1,h=1.48)
    _small_glass('lodge_loft_light',0,f,6.87,.92,.96,True)
    crest('lodge_wheat_arms',0,f-.16,7.92,scale=.66)
    # Broad porch sits below the upper row, leaving every storey visible.
    box('lodge_porch_deck',(0,-3.22,.16),(7.25,2.21,.32),'wood')
    for j in range(6):
        box('lodge_porch_seam',(0,-4.12+j*.35,.327),(7.06,.023,.017),'oak')
    _step('lodge_front_step',0,-4.57,3.1,.64,.16)
    # Thin curved gable hood is deliberately lower than hall floor band.
    roof('lodge_porch_roof',0,-3.20,7.75,2.44,2.77,3.41,'teal')
    for x in (-3.34,-1.22,1.22,3.34):
        beam('lodge_porch_post',(x,-4.14,.32),(x,-4.14,2.80),.22,'oak')
        beam('lodge_porch_knee',(x,-4.14,2.17),(x+.38 if x<0 else x-.38,-4.14,2.72),.16,'wood_light')
    for side in (-1,1):
        for z in (.68,1.19):
            beam('lodge_porch_rail',(side*1.38,-4.14,z),(side*3.30,-4.14,z),.13,'wood_light')
        for i in range(3):
            x=side*(1.66+i*.66)
            beam('lodge_porch_spindle',(x,-4.14,.47),(x,-4.14,1.23),.075,'oak')
        lantern('lodge_porch_lamp',side*1.22,-4.31,2.12,scale=.78)
    chimney('lodge_left_chimney',-2.15,1.77,7.10,h=1.57)
    _braces('lodge_upper_braces',0,f-.05,7.3,6.0)


def workshop():
    f=_part('workshop_cottage',-2.54,.52,3.31,4.65,3.62,5.83,'teal')
    door('workshop_person_door',-2.50,f,.22,w=1.05,h=2.2)
    _small_glass('workshop_gable_light',-2.54,f,4.45,.74,.74,True)
    lantern('workshop_lamp',-3.47,f-.2,2.57,scale=.78)
    _plain_window('workshop_side_window',-.84,1.04,1.91,w=.82,h=1.09,side=True)
    chimney('workshop_flue',-3.1,1.65,4.63,h=1.7)
    # A fully open bay: no front box, just posts, back wall and roof.
    x,y,w,d=1.66,.34,4.54,4.85
    box('workshop_bay_plinth',(x,y,.105),(w+.12,d+.12,.21),'stone',bevel=.04)
    box('workshop_bay_backwall',(x,y+d*.5-.10,1.5),(w,.20,2.65),'plaster',bevel=.025)
    for xx in (x-w*.5+.12,x+w*.5-.12):
        for yy in (y-d*.5+.14,y+d*.5-.14):
            beam('workshop_bay_post',(xx,yy,.20),(xx,yy,3.31),.24,'oak')
            beam('workshop_bay_knee',(xx,yy,2.62),(xx+(.55 if xx<x else -.55),yy,3.25),.16,'wood_light')
    for yy in (y-d*.5+.14,y+d*.5-.14):
        beam('workshop_bay_header',(x-w*.5,yy,3.2),(x+w*.5,yy,3.2),.25,'oak')
    roof('workshop_bay_roof',x,y,w+.67,d+.67,3.28,4.75,'wheat')
    beam('workshop_bay_king',(x,y-d*.5-.16,3.25),(x,y-d*.5-.16,4.59),.17,'oak')
    for side in (-1,1):
        beam('workshop_gable_brace',(x,y-d*.5-.16,3.27),(x+side*1.29,y-d*.5-.16,3.94),.14,'wood_light')
    # Bench remains legible from street and overhead rather than buried inside.
    box('workshop_bench_top',(2.28,.65,1.12),(2.45,.86,.19),'wood_light',bevel=.04)
    for xx in (1.34,3.19):
        for yy in (.34,.96):
            beam('workshop_bench_leg',(xx,yy,.20),(xx,yy,1.07),.15,'oak')
    box('workshop_bench_shelf',(2.28,.66,.47),(2.20,.68,.10),'wood')
    box('workshop_tool_board',(2.08,2.55,1.89),(2.7,.13,1.14),'wood',bevel=.035)
    for i in range(4):
        xx=1.12+i*.57
        beam('workshop_hanging_handle',(xx,2.42,1.62),(xx,2.42,2.17),.075,'wood_light')
        box('workshop_hanging_tool',(xx,2.42,2.18),(.33,.10,.13),'stone')
    cylinder('workshop_anvil_stump',(.34,-.73,.55),.42,.70,'wood',vertices=8)
    box('workshop_anvil_foot',(.34,-.73,.97),(.70,.49,.15),'stone',bevel=.04)
    box('workshop_anvil_waist',(.34,-.73,1.16),(.34,.30,.27),'stone')
    box('workshop_anvil_face',(.34,-.73,1.34),(.80,.48,.15),'stone_light',bevel=.04)
    mesh('workshop_anvil_horn',[(.73,-.95,1.29),(.73,-.51,1.29),(1.10,-.73,1.32),(.73,-.91,1.44),(.73,-.55,1.44)],[(0,1,2),(0,2,3),(2,4,3),(1,4,2),(0,3,4,1)],'stone')
    for j in range(3):
        for i in range(2 if j==2 else 3):
            cylinder('workshop_stacked_log',(3.22+i*.27,-.65,.35+j*.24),.13,1.42,'wood_light' if i%2 else 'wood',vertices=6,rotation=(math.pi/2,0,0))
    # Joiner's hanging emblem: square plaque with mallet in relief.
    sy=_hanging_sign('workshop_trade_sign',-1.33,f-.33,2.78,.88,.72)
    beam('workshop_sign_handle',(-1.54,sy-.06,2.50),(-1.18,sy-.06,2.95),.07,'cream')
    beam('workshop_sign_mallet',(-1.38,sy-.06,3.04),(-1.02,sy-.06,2.77),.18,'wheat')
    _roof_straps('workshop',x,y,w,d,3.28,4.75,4)


def kennel():
    f=_part('kennel_keeper',-1.19,.49,5.35,4.64,3.42,5.68,'teal')
    door('kennel_keeper_door',-2.49,f,.22,w=1.08,h=2.2)
    _step('kennel_keeper_step',-2.49,f-.36,1.46,.70,.22)
    window('kennel_keeper_window',.25,f,1.76,w=1.22,h=1.21,flowers=True)
    _small_glass('kennel_keeper_loft',-1.2,f,4.23,.78,.75,True)
    _paw_sign('kennel_paw_sign',-3.37,f-.31,2.65)
    lantern('kennel_keeper_lamp',-1.59,f-.18,2.63,scale=.75)
    chimney('kennel_keeper_chimney',-2.63,1.75,4.64,h=1.43)
    _braces('kennel_front_brace',-1.19,f-.03,5.27,3.42)
    # A low companion wing attached to a full adult-scaled keeper home.
    dx,dy=2.95,.38
    df=_part('kennel_dog_wing',dx,dy,2.49,4.23,2.16,3.40,'wheat',base=.18)
    _arch('kennel_canine_arch',dx,df-.04,.18,1.34,1.70,'oak',.16)
    _arch('kennel_canine_opening',dx,df-.14,.18,1.02,1.46,'dark',.05)
    box('kennel_sleeping_straw',(dx,df-.25,.22),(.91,.48,.10),'wheat',bevel=.04)
    # Side sleeping entrance for another dog, facing +X.
    before=set(bpy.data.objects)
    _arch('kennel_side_arch',0,0,.18,1.16,1.45,'oak',.13)
    _arch('kennel_side_opening',0,-.09,.18,.90,1.22,'dark',.04)
    for obj in set(bpy.data.objects)-before:
        obj.matrix_world=Matrix.Translation((4.22,.81,0)) @ Matrix.Rotation(math.pi/2,4,'Z') @ obj.matrix_world
    box('kennel_nameplate',(dx,df-.22,1.96),(.88,.10,.24),'wood_light',bevel=.04)
    # A low picket rail suggests a tidy run without hiding the entry.
    for xx in (-3.65,-3.07,-2.49):
        beam('kennel_run_picket',(xx,-3.27,.02),(xx,-3.27,.88),.12,'wood_light')
        cone('kennel_picket_cap',(xx,-3.27,.95),.10,0,.17,'wood_light',vertices=4)
    for zz in (.30,.66):
        beam('kennel_run_rail',(-3.77,-3.27,zz),(-2.36,-3.27,zz),.11,'oak')
    # Feeding bowl and little brass bell belong to the keeper's porch.
    cone('kennel_water_bowl',(1.53,-2.69,.13),.26,.33,.20,'bronze',vertices=8)
    cylinder('kennel_bowl_water',(1.53,-2.69,.232),.25,.015,'water',vertices=8)
    _roof_straps('kennel_keeper',-1.19,.49,5.35,4.64,3.42,5.68,4)


def ferry_house():
    f=_part('ferry_keeper',-.65,1.61,5.40,4.35,3.57,5.93,'teal')
    door('ferry_entry',-.66,f,.22,w=1.15,h=2.2)
    for x in (-2.34,1.03):
        window('ferry_front_window',x,f,1.76,w=.94,h=1.15,flowers=(x<0))
    _plain_window('ferry_right_window',2.10,1.79,1.9,w=1.03,h=1.15,side=True)
    _small_glass('ferry_loft',-.65,f,4.38,.86,.80,True)
    chimney('ferry_chimney',-2.12,2.69,4.70,h=1.52)
    _braces('ferry_gable',-.65,f-.02,5.32,3.57)
    # Flat attached dock: top surface at .24m, no piers below ground.
    for j in range(13):
        yy=-4.55+j*.292
        box('ferry_dock_plank',(0,yy,.14),(8.67,.274,.24),'wood_light' if j%3 else 'wood')
    for xx in (-3.97,3.97):
        box('ferry_dock_stringer',(xx,-2.79,.08),(.20,3.92,.16),'oak')
    box('ferry_entry_landing',(-.65,-.70,.14),(2.22,.94,.24),'wood_light')
    # A side return connects visibly along the keeper-house's east flank.
    for j in range(13):
        box('ferry_side_landing',(3.44,-.70+j*.294,.14),(2.0,.276,.24),'wood_light' if j%3 else 'wood')
    for xx in (-3.98,3.98):
        for yy in (-4.42,-1.13):
            cylinder('ferry_bollard',(xx,yy,.51),.15,.81,'oak',vertices=8)
            cylinder('ferry_bollard_cap',(xx,yy,.92),.20,.13,'wood_light',vertices=8)
    for yy in (-.51,1.10,2.72):
        beam('ferry_side_post',(4.22,yy,.24),(4.22,yy,1.20),.15,'oak')
    for z in (.62,1.12):
        beam('ferry_side_rail',(4.22,-.51,z),(4.22,2.72,z),.115,'wood_light')
    # Simple porch beams hold a small pitched cover above the main door.
    _gable_porchette('ferry_entry_porch',-.65,-1.05,2.06,1.34,2.67,3.27,'wheat')
    lantern('ferry_dock_lamp_left',-1.42,-1.65,2.08,scale=.80)
    lantern('ferry_dock_lamp_right',.12,-1.65,2.08,scale=.80)
    # Crossing oars read as ferry signage without text or a separate texture.
    sy=_hanging_sign('ferry_sign',1.57,f-.32,2.67,.99,.87)
    for s in (-1,1):
        beam('ferry_oar_shaft',(1.57-s*.28,sy-.07,2.40),(1.57+s*.21,sy-.07,2.90),.045,'cream')
        beam('ferry_oar_blade',(1.57+s*.21,sy-.07,2.90),(1.57+s*.33,sy-.07,3.02),.13,'wheat')
    # Lifering: eight original tangent blocks around a hollow center.
    for i in range(8):
        a=i*math.tau/8
        cx=2.08+math.cos(a)*.34
        cz=1.30+math.sin(a)*.34
        ob=box('ferry_life_ring',(cx,f-.16,cz),(.29,.11,.15),'cream' if i%2 else 'terracotta',bevel=.025)
        ob.data.transform(Matrix.Translation((cx,f-.16,cz)) @ Matrix.Rotation(-a-math.pi/2,4,'Y') @ Matrix.Translation((-cx,-f+.16,-cz)))
    _roof_straps('ferry',-.65,1.61,5.4,4.35,3.57,5.93,3)


def house_a():
    f=_part('house_a',0,.28,4.75,3.72,2.99,4.85,'wheat')
    door('house_a_door',-.99,f,.22,w=1.03,h=2.2)
    _step('house_a_step',-.99,f-.36,1.46,.68,.22)
    window('house_a_front_window',1.19,f,1.71,w=1.12,h=1.17,flowers=True)
    window('house_a_side_window',2.42,.36,1.75,w=.96,h=1.08,side=True,flowers=True)
    before=set(bpy.data.objects)
    _plain_window('house_a_rear_light',.63,2.18,1.76,w=.9,h=1.0)
    for obj in set(bpy.data.objects)-before:
        obj.data.transform(Matrix.Translation((.63,2.18,0)) @ Matrix.Rotation(math.pi,4,'Z') @ Matrix.Translation((-.63,-2.18,0)))
    _small_glass('house_a_gable_eye',0,f,3.72,.72,.67,True)
    lantern('house_a_lantern',-.12,f-.18,2.53,scale=.72)
    chimney('house_a_chimney',-1.54,1.01,3.65,h=1.43)
    _braces('house_a',0,f-.02,4.67,2.96)
    _roof_straps('house_a',0,.28,4.75,3.72,2.99,4.85,4)
    # Little supported door hood, offset from the main gable axis.
    awning('house_a_door_hood',-.99,f-.03,2.62,1.54,.68,'teal')
    # A small oak bench and planter emphasize the home scale.
    box('house_a_bench',(1.22,f-.53,.48),(1.34,.40,.12),'wood_light',bevel=.035)
    for dx in (-.47,.47):
        beam('house_a_bench_leg',(1.22+dx,f-.52,.02),(1.22+dx,f-.52,.46),.13,'oak')
    cone('house_a_pot',(-2.24,f-.36,.28),.24,.34,.50,'terracotta',vertices=8)
    sphere('house_a_pot_bush',(-2.24,f-.36,.65),(.37,.35,.40),'leaf',segments=8,rings=4)
    crest('house_a_wheat',0,f-.12,4.33,scale=.40)


def house_b():
    f=_part('house_b_tall',-1.04,.60,4.78,5.06,3.65,6.02,'teal')
    sf=_part('house_b_wing',2.35,-.26,2.32,3.55,2.83,4.18,'teal_light')
    door('house_b_door',2.34,sf,.22,w=1.02,h=2.2)
    _step('house_b_entry',2.34,sf-.36,1.44,.70,.22)
    lantern('house_b_lamp',1.50,sf-.20,2.53,scale=.74)
    # Shallow projecting front bay, with an angled cheek on each side.
    bayy=f-.31
    box('house_b_bay_plaster',(-1.10,bayy,1.39),(2.04,.71,2.20),'plaster',bevel=.07)
    box('house_b_bay_foot',(-1.10,bayy,.26),(2.17,.81,.27),'stone_light',bevel=.045)
    window('house_b_bay_window',-1.1,bayy-.39,1.62,w=1.45,h=1.31,flowers=True)
    roof('house_b_bay_hood',-1.10,bayy,2.45,1.10,2.52,3.16,'teal')
    _small_glass('house_b_loft',-1.04,f,4.47,.90,.90,True)
    _plain_window('house_b_wing_side',3.56,-.21,1.65,w=.90,h=1.03,side=True)
    _plain_window('house_b_right_back',1.40,1.76,1.9,w=.86,h=1.15,side=True)
    chimney('house_b_chimney',-2.49,1.71,4.81,h=1.60)
    _dormer_side('house_b_dormer',.86,1.16,4.25,w=1.28,d=1.19)
    _braces('house_b_front',-1.04,f-.02,4.70,3.62)
    _roof_straps('house_b',-1.04,.60,4.78,5.06,3.65,6.02,4)
    # Open entry veranda joins the two volumes rather than a separate box.
    beam('house_b_veranda_post',(3.25,-2.73,.18),(3.25,-2.73,2.62),.16,'oak')
    beam('house_b_veranda_knee',(3.25,-2.73,2.05),(2.76,-2.73,2.55),.13,'wood_light')
    awning('house_b_veranda',2.32,sf-.02,2.64,2.16,.83,'wheat')
    cone('house_b_pot',(-2.61,-2.46,.28),.23,.33,.49,'terracotta',vertices=8)
    sphere('house_b_shrub',(-2.61,-2.46,.69),(.39,.36,.44),'leaf',segments=8,rings=4)


def house_c():
    f=_part('house_c_long',0,.32,7.55,4.18,3.18,5.02,'wheat')
    # Strong diagonal framing either side of the separate entrance gable.
    for s in (-1,1):
        beam('house_c_lower_cross',(s*1.54,f-.02,.44),(s*3.46,f-.02,2.96),.145,'wood_light')
        window('house_c_front_window',s*2.52,f-.07,1.78,w=1.20,h=1.17,flowers=True)
    # Projecting front entry breaks up a broad, low farmhouse silhouette.
    ef=_part('house_c_entry',-.02,-1.97,2.30,1.21,2.68,3.96,'teal')
    door('house_c_front_door',-.02,ef,.22,w=1.08,h=2.2)
    _step('house_c_step',-.02,ef-.32,1.49,.59,.22)
    lantern('house_c_entry_lamp',.84,ef-.19,2.47,scale=.67)
    _small_glass('house_c_entry_eye',-.02,ef,3.30,.52,.46,True)
    _plain_window('house_c_right_side',3.82,.61,1.84,w=.95,h=1.10,side=True)
    _small_glass('house_c_main_loft',0,f,4.11,.90,.65,True)
    chimney('house_c_chimney',-2.28,1.15,4.03,h=1.56)
    _roof_straps('house_c',0,.32,7.55,4.18,3.18,5.02,5)
    # Long, warm ridge saddles evoke bundled wheat rather than a tile grid.
    for j in range(5):
        cylinder('house_c_ridge_bundle',(0,-1.50+j*.88,5.02),.17,.80,'gold',vertices=8,rotation=(math.pi/2,0,0))
    # Under-eave corbels keep the large roof visually supported.
    for xx in (-3.69,-1.51,1.51,3.69):
        beam('house_c_eave_bracket',(xx,f+.17,2.64),(xx,f-.32,3.09),.16,'oak')
    crest('house_c_crest',-.02,ef-.12,3.73,scale=.34)
    box('house_c_small_bench',(-3.08,f-.66,.48),(1.18,.42,.13),'wood_light',bevel=.035)
    for xx in (-3.47,-2.69):
        beam('house_c_bench_leg',(xx,f-.66,.01),(xx,f-.66,.43),.13,'oak')


def house_d():
    x,y=0,.49
    # The visibly jettied upper floor makes a different, taller composition.
    box('house_d_foundation',(x,y,.13),(5.55,4.87,.26),'stone',bevel=.05)
    box('house_d_lower_plaster',(x,y,1.61),(5.34,4.65,2.77),'plaster',bevel=.06)
    timber_frame('house_d_lower_oak',x,y,5.34,4.65,3.0,base=.26)
    box('house_d_jetty_band',(x,y,3.03),(5.95,5.20,.31),'oak',bevel=.04)
    box('house_d_upper_plaster',(x,y,4.57),(5.83,5.12,2.84),'cream',bevel=.065)
    timber_frame('house_d_upper_oak',x,y,5.83,5.12,6.02,base=3.17)
    gable_wall('house_d_gable',x,y,5.83,5.12,6.02,8.13,'plaster')
    roof('house_d_roof',x,y,6.74,6.04,6.02,8.31,'teal')
    lf=y-4.65*.5-.09
    uf=y-5.12*.5-.09
    door('house_d_ground_entry',.96,lf,.26,w=1.1,h=2.2)
    _step('house_d_step',.96,lf-.39,1.54,.77,.26)
    window('house_d_ground_window',-1.45,lf,1.78,w=1.17,h=1.20,flowers=True)
    _plain_window('house_d_side_ground',2.72,1.02,1.8,w=1.04,h=1.13,side=True)
    # Balcony door and side window are scaled for an adult, not dollhouse doors.
    door('house_d_balcony_door',-.83,uf,3.17,w=.98,h=2.2)
    window('house_d_upper_window',1.64,uf,4.52,w=1.00,h=1.24,flowers=True)
    _plain_window('house_d_upper_side',2.97,.89,4.56,w=1.00,h=1.25,side=True)
    box('house_d_balcony_deck',(-.86,uf-.53,3.19),(3.45,1.11,.20),'wood_light',bevel=.03)
    for xx in (-2.45,.72):
        beam('house_d_balcony_post',(xx,uf-.99,3.26),(xx,uf-.99,4.23),.14,'oak')
        beam('house_d_balcony_brace',(xx,uf+.06,2.25),(xx,uf-.90,3.09),.19,'oak')
    for zz in (3.49,4.18):
        beam('house_d_front_rail',(-2.45,uf-.99,zz),(.72,uf-.99,zz),.12,'wood_light')
    for i in range(7):
        xx=-2.24+i*.46
        beam('house_d_baluster',(xx,uf-.99,3.43),(xx,uf-.99,4.18),.07,'oak')
    for side in (-1,1):
        xx=-2.45 if side<0 else .72
        beam('house_d_balcony_side',(xx,uf-.98,4.18),(xx,uf+.03,4.18),.12,'wood_light')
    # Jetty corbels and gable fan are chunky, readable structural ornaments.
    for xx in (-2.55,-1.60,.15,1.46,2.55):
        beam('house_d_jetty_bracket',(xx,lf+.02,2.46),(xx,uf-.01,3.02),.18,'oak')
    beam('house_d_gable_king',(0,uf,6.05),(0,uf,8.08),.18,'oak')
    for s in (-1,1):
        beam('house_d_gable_fan',(0,uf,6.08),(s*1.75,uf,6.75),.15,'wood_light')
    _small_glass('house_d_attic_light',0,uf-.03,6.83,.91,.83,True)
    crest('house_d_wheat_crest',0,uf-.16,7.76,scale=.47)
    lantern('house_d_front_lantern',1.80,lf-.18,2.56,scale=.72)
    chimney('house_d_chimney',-1.85,1.74,7.13,h=1.47)
    _braces('house_d_upper',0,uf-.01,5.75,6.0)
    _roof_straps('house_d',0,.49,5.83,5.12,6.02,8.31,4)


BUILDERS = {
    'bakery': bakery, 'lodge': lodge, 'workshop': workshop,
    'kennel': kennel, 'ferry-house': ferry_house,
    'house-a': house_a, 'house-b': house_b, 'house-c': house_c,
    'house-d': house_d,
}

def build(name):
    """Construct one grounded, centered building; kit pipeline handles export."""
    if name not in BUILDERS:
        raise KeyError('Unknown Hollowmere building: '+str(name))
    BUILDERS[name]()
