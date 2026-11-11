"""Original Hollowmere civic landmarks. Z-up, principal frontage -Y.
All details are geometry; colors and the separate Glow material come from kit_common.
"""
from kit_common import *
from math import sin, cos, pi

SPECS = {
    'granary-hall': {'footprint': [14, 12], 'category': 'landmark', 'budget': 8000,
        'description': 'Proud grain-store civic hall with an open oak arcade, sweeping layered teal gables, wheat standards, and a lantern cupola.'},
    'rootworks-gate': {'footprint': [12, 8], 'category': 'landmark', 'budget': 8000,
        'description': 'Friendly ancient river-intake gateway, with a truly open stone arch, teal-roofed towers, bronze root pipes, water wheel, and pressure gauge.'},
    'town-well': {'footprint': [6, 6], 'category': 'landmark', 'budget': 8000,
        'description': 'Circular carved stone well, with an open water shaft, curved teal canopy, working spindle and hanging bucket, wheat finial, and paper lanterns.'},
}



def _window(name,x,y,z,w=.8,h=1.0,side=False,flowers=True,flip=False):
    """Budget-conscious windows: opaque solid frames, separate luminous pane, tiny blooms."""
    before=set(bpy.data.objects)
    box(name+'_surround',(x,y,z),(w+.18,.13,h+.18),'oak')
    mesh(name+'_Glow',[(x-w/2,y-.071,z-h/2),(x+w/2,y-.071,z-h/2),
                      (x+w/2,y-.071,z+h/2),(x-w/2,y-.071,z+h/2)],[(0,1,2,3)],'gold',glow=True)
    for xx in (x-w/2-.06,x+w/2+.06):
        box(name+'_shutter',(xx,y-.10,z),(.17,.07,h+.04),'teal')
    box(name+'_mullion',(x,y-.102,z),(.065,.045,h),'wood_light')
    box(name+'_crossbar',(x,y-.103,z+.06),(w,.045,.065),'wood_light')
    box(name+'_sill',(x,y-.14,z-h/2-.11),(w+.31,.30,.13),'stone_light')
    if flowers:
        zz=z-h/2-.30
        box(name+'_planter',(x,y-.23,zz),(w+.14,.31,.24),'wood')
        box(name+'_soil',(x,y-.23,zz+.12),(w,.24,.025),'dark')
        for sx in (-1,1):
            xx=x+sx*w*.25
            sphere(name+'_foliage',(xx,y-.23,zz+.25),(.20,.17,.17),'leaf',segments=4,rings=2)
            sphere(name+'_flower',(xx,y-.28,zz+.38),(.11,.10,.09),'pink' if sx<0 else 'flower',segments=4,rings=2)
    angle=(pi/2 if side else 0)+(pi if flip else 0)
    if angle:
        M=Matrix.Translation((x,y,0))@Matrix.Rotation(angle,4,'Z')@Matrix.Translation((-x,-y,0))
        for ob in set(bpy.data.objects)-before: ob.data.transform(M)

def _ring(name, x, y, z0, z1, outer, inner, color, n=16):
    """Open horizontal annular prism."""
    v = []
    for z, r in ((z0, outer), (z1, outer), (z0, inner), (z1, inner)):
        v += [(x+r*cos(2*pi*i/n), y+r*sin(2*pi*i/n), z) for i in range(n)]
    f=[]
    for i in range(n):
        j=(i+1)%n
        f += [(i,j,n+j,n+i), (2*n+j,2*n+i,3*n+i,3*n+j),
              (n+i,n+j,3*n+j,3*n+i), (j,i,2*n+i,2*n+j)]
    mesh(name,v,f,color)


def _arc(name,x,y,z,r,thick,depth,color,segments=12,start=0,end=pi):
    """An actual open extruded arch/ring in the XZ plane."""
    v=[]
    for yy in (y-depth/2,y+depth/2):
        for rr in (r,r+thick):
            v += [(x+rr*cos(start+(end-start)*i/segments),yy,z+rr*sin(start+(end-start)*i/segments)) for i in range(segments+1)]
    n=segments+1; f=[]
    for i in range(segments):
        j=i+1
        f += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),
              (i,2*n+i,2*n+j,j),(n+j,3*n+j,3*n+i,n+i)]
    f += [(0,n,3*n,2*n),(segments,2*n+segments,3*n+segments,n+segments)]
    mesh(name,v,[tuple(reversed(face)) for face in f],color)


def _radial(name,x,y,profile,color,n=8):
    """Solid faceted canopy or tower profile, with deliberately curved silhouette."""
    v=[]
    for z,r in profile:
        v += [(x+r*cos(2*pi*i/n+pi/8), y+r*sin(2*pi*i/n+pi/8), z) for i in range(n)]
    f=[tuple(reversed(range(n)))]
    for k in range(len(profile)-1):
        for i in range(n):
            j=(i+1)%n; f.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
    f.append(tuple((len(profile)-1)*n+i for i in range(n)))
    mesh(name,v,f,color)


def _wheat(name,x,y,z,s=1):
    """Readable wheat bas-relief: a central stem and fourteen raised kernels."""
    beam(name+'_stem',(x,y,z-.62*s),(x,y,z+.7*s),.045*s,'gold')
    for i in range(6):
        h=z+(-.38+i*.17)*s
        for side in (-1,1):
            xx=x+side*.10*s; dx=side*.18*s
            vv=[(xx,y-.035*s,h-.065*s),(xx+dx,y-.025*s,h+.045*s),
                (xx+dx*.72,y-.025*s,h+.17*s),(xx,y-.025*s,h+.06*s),
                (xx+dx*.48,y-.11*s,h+.06*s)]
            faces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)]
            if side<0: faces=[tuple(reversed(face)) for face in faces]
            mesh(name+f'_kernel_{i}_{side}',vv,faces,'wheat')
    cone(name+'_tip',(x,y,z+.77*s),.065*s,0,.25*s,'gold',vertices=6)


def _banner(name,x,y,z,w=.62,h=1.8,color='teal_dark'):
    # A folded, swallow-tail standard with gold border, not a painted texture.
    v=[(x-w/2,y,z),(x,y-.08,z),(x+w/2,y,z),
       (x-w/2,y,z-h),(x,y-.08,z-h+.22),(x+w/2,y,z-h)]
    mesh(name,v,[(3,4,1,0),(4,5,2,1)],color)
    beam(name+'_rod',(x-w*.68,y,z+.08),(x+w*.68,y,z+.08),.07,'gold')
    beam(name+'_edgeL',v[0],v[3],.028,'gold'); beam(name+'_edgeR',v[2],v[5],.028,'gold')
    _wheat(name+'_wheat',x,y-.10,z-h*.47,w*.7)


def _pipe(name,points,r=.15,color='bronze'):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        beam(name+f'_tube{i}',a,b,2*r,color,depth=2*r)
    for i,p in enumerate(points[1:-1]):
        sphere(name+f'_elbow{i}',p,(r*1.18,r*1.18,r*1.18),color,segments=8,rings=4)


def _gear(name,x,y,z,r=.95):
    _arc(name+'_rim',x,y,z,r*.70,r*.22,.18,'bronze',segments=24,start=0,end=2*pi)
    _arc(name+'_rimGold',x,y-.12,z,r*.76,r*.07,.05,'gold',segments=24,start=0,end=2*pi)
    for i in range(12):
        a=2*pi*i/12
        a0=a-.075; a1=a+.075
        vv=[]
        for yy in (y-.13,y+.13):
            for rr,aa in ((r*.88,a0),(r*1.10,a0),(r*1.10,a1),(r*.88,a1)):
                vv.append((x+rr*cos(aa),yy,z+rr*sin(aa)))
        mesh(name+f'_tooth{i}',vv,[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],'bronze')
    for i in range(6):
        a=i*pi/3
        beam(name+f'_spoke{i}',(x,y,z),(x+r*.76*cos(a),y,z+r*.76*sin(a)),.105,'bronze')
    cylinder(name+'_hub',(x,y-.04,z),r*.20,.32,'gold',vertices=12,rotation=(pi/2,0,0))
    cylinder(name+'_bolt',(x,y-.23,z),r*.085,.08,'teal_dark',vertices=6,rotation=(pi/2,0,0))


def granary_hall():
    # Broad, stepped silhouette, shallow wings, deep front arcade, and central lantern.
    box('hall_foundation',(0,.3,.23),(12.25,7.8,.46),'stone')
    box('hall_main_plinth',(0,.25,.54),(7.8,6.85,.36),'stone_light')
    box('hall_main_plaster',(0,.25,3.33),(7.4,6.4,5.6),'cream')
    timber_frame('hall_main',0,.25,7.4,6.4,6.13,base=.52)
    # Stone corners and substantial grain-store belt courses.
    for x in (-3.7,3.7):
        for y in (-2.95,3.45):
            for k in range(4):
                box('hall_quoin',(x,y,.95+k*.45),(.30,.30,.32),'stone_light')
    box('hall_middle_belt',(0,.25,3.22),(7.65,6.65,.20),'oak')
    gable_wall('hall_main_gables',0,.25,7.4,6.4,6.13,8.75,'plaster')
    roof('hall_sweeping_roof',0,.25,8.3,7.2,6.15,8.8,'teal')
    for sx in (-1,1):
        x=sx*4.96
        box('hall_wing_plinth',(x,.75,.48),(3.45,5.8,.34),'stone_light')
        box('hall_wing_body',(x,.75,2.15),(3.12,5.5,3.2),'plaster')
        timber_frame('hall_wing',x,.75,3.12,5.5,3.75,base=.55)
        gable_wall('hall_wing_gable',x,.75,3.12,5.5,3.75,5.45,'cream')
        roof('hall_wing_roof',x,.75,3.85,6.1,3.75,5.47,'teal_light')
        # Tall shuttered wing windows, and generous flower ledges.
        for y in (-.7,1.4,2.65):
            _window('hall_wing_side',x+sx*1.575,y,2.2,w=.76,h=1.15,side=True,flowers=True,flip=sx<0)
        _window('hall_wing_front',x,-2.04,2.15,w=1.1,h=1.30,flowers=True)
        crest('hall_wing_rosette',x,-2.08,4.2,scale=.48)
        for y in (-1.35,1.15,2.65):
            beam('hall_wing_bracket',(x+sx*1.59,y,3.52),(x+sx*1.87,y,3.78),.12,'oak')
    # Back facade is as resolved as the front, useful for a freely orbiting town camera.
    for x in (-2.45,0,2.45):
        _window('hall_upper_back',x,3.50,4.70,w=1.05,h=1.36,flowers=False,flip=True)
        _window('hall_lower_back',x,3.50,1.83,w=.94,h=1.24,flowers=False,flip=True)
    for x in (-2.4,0,2.4):
        _window('hall_upper_front',x,-3.00,4.76,w=1.02,h=1.45,flowers=True)
    door('hall_front_double_door',0,-3.05,z=.46,w=1.65,h=2.35)
    for x in (-2.35,2.35):
        _window('hall_arcade_wall_window',x,-3.02,1.8,w=1.0,h=1.30,flowers=False)
    # Real open arcade: separate columns, structural arches, empty walking bays.
    box('hall_arcade_deck',(0,-4.03,.34),(8.0,2.2,.34),'stone_light')
    for i in range(3):
        box('hall_front_stair',(0,-5.08-.25*i,.24-.07*i),(3.7+.25*i,.58,.14),'stone')
    for x in (-3.55,-1.18,1.18,3.55):
        box('hall_arcade_pedestal',(x,-4.85,.67),(.48,.48,.46),'stone')
        box('hall_arcade_column',(x,-4.85,1.92),(.24,.24,2.45),'oak')
        box('hall_arcade_capital',(x,-4.85,3.13),(.48,.48,.18),'wood_light')
        beam('hall_arcade_left_brace',(x,-4.85,2.54),(x-.43,-4.85,3.21),.12,'oak')
        beam('hall_arcade_right_brace',(x,-4.85,2.54),(x+.43,-4.85,3.21),.12,'oak')
    for x in (-2.365,0,2.365):
        _arc('hall_arcade_arch',x,-4.85,2.38,1.07,.14,.22,'oak',segments=8)
    box('hall_arcade_lintel',(0,-4.85,3.42),(8.1,.28,.22),'oak')
    roof('hall_arcade_roof',0,-3.97,8.55,2.7,3.48,4.42,'teal_dark')
    # Proud wheat seal mounted in the big cream front gable.
    cylinder('hall_gable_seal',(0,-3.04,7.2),.68,.12,'teal_dark',vertices=16,rotation=(pi/2,0,0))
    _arc('hall_gable_seal_rim',0,-3.14,7.2,.65,.065,.07,'gold',segments=20,start=0,end=2*pi)
    _wheat('hall_golden_wheat',0,-3.21,7.2,.86)
    for sx in (-1,1):
        _banner('hall_civic_standard',sx*3.0,-3.13,5.90,w=.62,h=1.67)
    # Cupola: fully modelled eight-sided drum and little open belfry.
    _radial('hall_cupola_base',0,.65,[(7.65,1.12),(8.55,1.12),(8.67,1.32),(8.84,1.32)],'oak')
    _radial('hall_cupola_drum',0,.65,[(8.80,1.08),(10.20,1.08)],'cream')
    for i in range(8):
        a=2*pi*i/8+pi/8
        xx=1.02*cos(a); yy=.65+1.02*sin(a)
        beam('hall_cupola_upright',(xx,yy,8.80),(xx,yy,10.35),.13,'oak')
    # Four lit openings use the common dedicated Glow material.
    _window('hall_cupola_front',0,-.38,9.48,w=.73,h=.90,flowers=False)
    _window('hall_cupola_back',0,1.68,9.48,w=.73,h=.90,flowers=False,flip=True)
    _window('hall_cupola_east',1.03,.65,9.48,w=.73,h=.90,side=True,flowers=False)
    _window('hall_cupola_west',-1.03,.65,9.48,w=.73,h=.90,side=True,flowers=False,flip=True)
    _radial('hall_cupola_lower_cap',0,.65,[(10.14,1.20),(10.27,1.55),(10.55,1.23),(11.15,.64),(11.37,.50)],'teal')
    _radial('hall_cupola_gilt_band',0,.65,[(11.32,.52),(11.46,.52)],'gold')
    _radial('hall_cupola_crown',0,.65,[(11.45,.67),(11.66,.50),(12.10,.10)],'teal_dark')
    sphere('hall_cupola_finial',(0,.65,12.13),(.17,.17,.22),'gold')
    beam('hall_weather_vane_mast',(0,.65,12.15),(0,.65,12.88),.055,'gold')
    _wheat('hall_weather_vane',0,.65,12.78,.38)
    # Cargo-ready granary details at either porch flank.
    for sx in (-1,1):
        for i in range(2):
            cylinder('hall_grain_cask',(sx*(4.36+i*.60),-2.70,.65),.30,.72,'wood',vertices=10)
            _ring('hall_cask_hoop',sx*(4.36+i*.60),-2.70,.46,.51,.31,.28,'bronze',n=10)
            _ring('hall_cask_hoop',sx*(4.36+i*.60),-2.70,.82,.87,.31,.28,'bronze',n=10)
        lantern('hall_porch_lantern',sx*2.3,-4.87,2.75,scale=.72)
    for y in (-1.6,1.9):
        chimney('hall_wing_chimney',5.25,y,4.55,h=1.25)


def rootworks_gate():
    # Walkway is flush with ground and the central passage is genuinely empty.
    box('gate_passage_paving',(0,0,.055),(4.0,5.4,.11),'stone_light')
    for sx in (-1,1):
        x=sx*3.55
        _radial('gate_pier_foot',x,0,[(0,1.90),(.23,1.90),(.42,1.68)],'stone')
        _radial('gate_pier',x,0,[(.35,1.60),(3.45,1.48)],'stone_light')
        _radial('gate_pier_belt',x,0,[(3.20,1.58),(3.48,1.58)],'oak')
        _radial('gate_watch_room',x,0,[(3.45,1.46),(5.34,1.46)],'cream')
        _radial('gate_upper_belt',x,0,[(5.21,1.55),(5.41,1.55)],'oak')
        # Curved pagoda-like roof profile keeps the waterworks friendly and light.
        _radial('gate_flared_teal_cap',x,0,[(5.34,1.71),(5.45,2.08),(5.64,1.74),(6.10,1.22),(6.55,.60),(6.72,.44)],'teal')
        _radial('gate_golden_roof_band',x,0,[(5.39,2.08),(5.47,2.08)],'gold')
        _radial('gate_small_top_cap',x,0,[(6.65,.66),(6.82,.49),(7.30,.08)],'teal_dark')
        sphere('gate_finial',(x,0,7.29),(.14,.14,.20),'gold')
        for yy in (-.8,.8):
            box('gate_room_corner',(x+sx*1.23,yy,4.40),(.13,.13,1.82),'oak')
        _window('gate_tower_window',x,-1.40,4.37,w=.90,h=1.10,flowers=True)
        _window('gate_tower_side_window',x+sx*1.40,0,4.37,w=.86,h=1.10,side=True,flowers=False,flip=sx<0)
        _window('gate_tower_rear_window',x,1.40,4.37,w=.90,h=1.10,flowers=False,flip=True)
        # Masonry offsets and carved stone inset tablets.
        for j in range(4):
            for dx in (-.62,.62):
                box('gate_masonry_face',(x+dx+(.16 if j%2 else -.16),-1.49,.73+j*.59),(.57,.045,.36),'stone')
        box('gate_pier_tablet',(x,-1.53,3.00),(.83,.08,.24),'teal_dark')
        _banner('gate_water_standard',x+sx*.82,-1.43,5.12,w=.43,h=1.35,color='teal')
    # Thick exposed voussoirs and completely open inner arch, 3.5m wide, 4.45m tall.
    _arc('gate_arch_stone',0,0,2.62,1.78,.48,2.15,'stone_light',segments=16)
    _arc('gate_arch_front_trim',0,-1.15,2.62,1.82,.12,.16,'gold',segments=16)
    _arc('gate_arch_rear_trim',0,1.15,2.62,1.82,.12,.16,'stone',segments=16)
    for i in range(13):
        a=pi*(i+.5)/13
        p=(2.00*cos(a),-1.10,2.62+2.00*sin(a))
        q=(2.22*cos(a),-1.10,2.62+2.22*sin(a))
        beam('gate_arch_joint',p,q,.035,'stone')
    box('gate_bridge_lintel',(0,0,5.03),(4.65,2.25,.34),'oak')
    roof('gate_bridge_roof',0,0,5.10,3.08,5.20,6.10,'teal_light')
    crest('gate_center_crest',0,-1.58,5.62,scale=.58)
    for sx in (-1,1):
        lantern('gate_passage_lantern',sx*1.80,-1.38,2.68,scale=.70)
    # Low water channels outside the gateway: never block the traversal route.
    for sx in (-1,1):
        x=sx*4.70
        box('gate_outflow_trough',(x,-1.83,.14),(1.25,2.65,.26),'stone')
        box('gate_outflow_water',(x,-1.85,.285),(.80,2.48,.025),'water')
        for dx in (-.51,.51):
            box('gate_trough_rim',(x+dx,-1.85,.36),(.18,2.7,.35),'stone_light')
    # Bronze radial intake wheel and rootlike branching plumbing.
    _gear('gate_intake_wheel',-3.52,-1.80,1.93,1.04)
    _pipe('gate_left_root',[(-3.52,-1.56,1.93),(-4.45,-1.63,2.60),(-4.85,-1.82,2.42),(-4.85,-1.82,.65)],.15)
    _pipe('gate_right_main',[(3.10,-1.65,3.35),(3.10,-1.74,2.70),(4.03,-1.74,2.12),(4.74,-1.80,1.80),(4.74,-1.80,.55)],.18)
    _pipe('gate_right_branch',[(4.03,-1.74,2.12),(3.53,-1.79,1.34),(3.53,-1.79,.50)],.12)
    _pipe('gate_right_outer_root',[(4.03,-1.74,2.12),(4.86,-.80,2.30),(5.05,-.3,1.12),(5.05,.3,.32)],.12)
    for x,z in ((3.10,3.03),(4.74,.9),(3.53,.75),(-4.85,.94)):
        cylinder('gate_pipe_collar',(x,-1.76,z),.22,.13,'gold',vertices=10)
    # Ivory gauge face, bronze rim, tick geometry and unmistakable red indicator.
    cylinder('gate_pressure_gauge',(3.10,-1.81,3.14),.43,.16,'bronze',vertices=16,rotation=(pi/2,0,0))
    cylinder('gate_gauge_ivory',(3.10,-1.91,3.14),.34,.025,'cream',vertices=16,rotation=(pi/2,0,0))
    for i in range(7):
        a=pi*.15+i*pi*.70/6
        beam('gate_gauge_tick',(3.10+.26*cos(a),-1.94,3.14+.26*sin(a)),(3.10+.31*cos(a),-1.94,3.14+.31*sin(a)),.023,'oak')
    beam('gate_gauge_needle',(3.10,-1.95,3.14),(3.27,-1.95,3.35),.035,'terracotta')
    sphere('gate_gauge_pin',(3.10,-1.97,3.14),(.07,.025,.07),'gold',segments=8,rings=4)
    # Golden shutoff handwheel on a separate branch.
    _gear('gate_valve_handwheel',4.05,-1.95,2.13,.38)


def town_well():
    cylinder('well_circular_paving',(0,0,.085),1.87,.17,'stone',vertices=20)
    cylinder('well_low_step',(0,0,.19),1.52,.15,'stone_light',vertices=16)
    # Individual staggered stone wedges; the shaft is genuinely hollow.
    for row in range(3):
        n=12; aoff=(row%2)*pi/n
        for i in range(n):
            a0=2*pi*i/n+aoff+.012; a1=2*pi*(i+1)/n+aoff-.012
            vv=[]
            for z in (.27+row*.26,.51+row*.26):
                for rr,aa in ((.82,a0),(1.25,a0),(1.25,a1),(.82,a1)):
                    vv.append((rr*cos(aa),rr*sin(aa),z))
            mesh('well_carved_stone',vv,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'stone_light' if (row+i)%3 else 'stone')
    _ring('well_rounded_coping',0,0,1.02,1.20,1.33,.78,'cream',n=16)
    _ring('well_inner_shadow',0,0,.26,.99,.825,.79,'dark',n=16)
    cylinder('well_recessed_water',(0,0,.38),.79,.035,'water',vertices=16)
    # Uprights flank the water shaft. Corner braces give the canopy crafted heft.
    for sx in (-1,1):
        x=sx*1.47
        box('well_post_foot',(x,0,.41),(.44,.52,.45),'stone')
        box('well_carved_post',(x,0,1.91),(.23,.28,2.78),'oak')
        for z in (.70,2.80):
            box('well_post_collar',(x,0,z),(.33,.37,.13),'gold')
        for sy in (-1,1):
            beam('well_canopy_brace',(x,0,2.62),(x,sy*.77,3.14),.14,'oak')
        beam('well_center_brace',(x,0,2.69),(x-sx*.48,0,3.23),.13,'wood_light')
    box('well_crossbeam',(0,0,3.18),(3.35,.28,.23),'oak')
    for y in (-.96,.96):
        box('well_canopy_front_beam',(0,y,3.20),(3.50,.15,.20),'oak')
        beam('well_gable_rafter',(-1.62,y,3.04),(0,y,3.97),.13,'wood_light')
        beam('well_gable_rafter',(0,y,3.97),(1.62,y,3.04),.13,'wood_light')
    roof('well_swept_canopy',0,0,3.85,2.60,3.27,4.27,'teal')
    # Decorative carved drops at the roof ends.
    for x in (-1.60,1.60):
        for y in (-1.10,1.10):
            sphere('well_roof_carved_drop',(x,y,3.18),(.10,.10,.20),'gold',segments=8,rings=4)
    cylinder('well_axle',(0,0,2.26),.13,3.25,'wood',vertices=12,rotation=(0,pi/2,0))
    cylinder('well_rope_spool',(0,0,2.26),.21,.56,'wood_light',vertices=12,rotation=(0,pi/2,0))
    for xx in (-.31,.31):
        cylinder('well_spool_end',(xx,0,2.26),.26,.07,'oak',vertices=12,rotation=(0,pi/2,0))
    for xx in (-.20,-.10,0,.10,.20):
        # Fine wrapped rope bands around the winding spindle.
        cylinder('well_spool_rope',(xx,0,2.26),.218,.045,'wheat',vertices=12,rotation=(0,pi/2,0))
    beam('well_crank_arm',(1.72,0,2.26),(1.72,0,1.86),.09,'bronze')
    cylinder('well_crank_handle',(1.89,0,1.86),.095,.37,'oak',vertices=8,rotation=(0,pi/2,0))
    beam('well_bucket_rope',(0,-.04,2.20),(0,-.04,1.50),.037,'wheat')
    # The hanging bucket has an open top, bands and a curved handle.
    _ring('well_bucket_open',0,-.04,1.25,1.58,.25,.20,'wood',n=10)
    cylinder('well_bucket_bottom',(0,-.04,1.27),.245,.06,'wood',vertices=10)
    _ring('well_bucket_band_bottom',0,-.04,1.28,1.33,.262,.24,'bronze',n=10)
    _ring('well_bucket_band_top',0,-.04,1.52,1.58,.262,.24,'bronze',n=10)
    _arc('well_bucket_handle',0,-.04,1.57,.21,.035,.035,'bronze',segments=8)
    for sx in (-1,1):
        lantern('well_paper_lamp',sx*1.20,-.95,2.72,scale=.64)
    # Crest and wheat-spike finial: shared civic visual language, not copied architecture.
    crest('well_gable_crest',0,-1.34,3.67,scale=.32)
    beam('well_finial_mast',(0,0,4.25),(0,0,4.72),.055,'gold')
    _wheat('well_wheat_finial',0,0,4.78,.38)
    for x in (-1.75,1.75):
        box('well_stone_seat',(x,.70,.47),(.50,.88,.19),'stone_light')
        box('well_stone_seat_leg',(x,.70,.30),(.28,.58,.34),'stone')


def build(name):
    {'granary-hall': granary_hall, 'rootworks-gate': rootworks_gate, 'town-well': town_well}[name]()
