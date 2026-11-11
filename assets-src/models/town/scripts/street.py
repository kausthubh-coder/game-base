"""Original Hollowmere street furniture. Z-up, fronts toward -Y, ground origins.
All silhouettes are hand-authored geometry, with no texture or stock mesh assets.
"""
from kit_common import *
import math

SPECS = {
 'market-stall-a': {'footprint':[3,3], 'category':'street','budget':800,'description':'Bread seller with scalloped teal-and-wheat canvas, timber trestles and scored loaves.'},
 'market-stall-b': {'footprint':[3,3], 'category':'street','budget':800,'description':'Harvest stall with teal-and-gold canvas, produce bins and hanging harvest crest.'},
 'cart': {'footprint':[3,4], 'category':'street','budget':800,'description':'Oak harvest handcart with open spoke wheels, long handles, crate and grain sack.'},
 'barrels-crates': {'footprint':[3,2], 'category':'street','budget':800,'description':'Coopered oak barrels with dark hoops and slatted harvest crates.'},
 'bench': {'footprint':[3,2], 'category':'street','budget':800,'description':'Welcoming curved oak bench with a teal back and sprouting harvest medallion.'},
 'signpost': {'footprint':[3,2], 'category':'street','budget':800,'description':'Carved river-town directional signpost, arrow boards and grain seal.'},
 'lamp-post': {'footprint':[3,2], 'category':'street','budget':800,'description':'Warm-brown cast lantern post with two glowing pointed lanterns and curved branches.'},
 'string-lights': {'footprint':[6,2], 'category':'street','budget':800,'description':'Sagging festival cable between timber poles with alternating teal and gold lanterns.'},
 'banner-pole': {'footprint':[2,2], 'category':'street','budget':800,'description':'Gold-tipped oak standard with sculpted teal swallowtail and raised wheat-sheaf emblem.'},
 'flower-planter': {'footprint':[3,2], 'category':'street','budget':800,'description':'Chamfered cream planter full of fluffy pink-and-gold garden blossoms.'},
 'fence-straight': {'footprint':[3,1], 'category':'street','budget':800,'description':'Stout oak field fence with shaped caps, two rails and crossed timber braces.'},
 'fence-corner': {'footprint':[3,3], 'category':'street','budget':800,'description':'Matching right-angle oak field fence with capped posts and diagonal braces.'},
 'stone-bridge': {'footprint':[6,3], 'category':'street','budget':800,'description':'Exactly six-metre flat-deck crossing with warm voussoir arches below and low stone parapets.'},
 'dock-segment': {'footprint':[3,3], 'category':'street','budget':800,'description':'Three-metre square flat timber river dock with pegged planks, fenders and mooring bollards.'},
 'statue-gardener-warden': {'footprint':[3,3], 'category':'street','budget':800,'description':'Friendly carved gardener guardian in a broad straw hat, holding a spade and young sprout.'},
}


def _lathe(name,x,y,rings,color,n=8,caps=True):
    vs=[(x+r*math.cos(2*math.pi*i/n),y+r*math.sin(2*math.pi*i/n),z) for z,r in rings for i in range(n)]
    fs=[]
    for j in range(len(rings)-1):
        for i in range(n):
            k=j*n+i; nxt=j*n+(i+1)%n
            fs.append((k,nxt,nxt+n,k+n))
    if caps:
        fs.extend([tuple(reversed(range(n))), tuple(range((len(rings)-1)*n,len(rings)*n))])
    return mesh(name,vs,fs,color)


def _panel(name,poly,y,depth,color):
    # Polygon in XZ, extruded along Y. All polygons supplied counter-clockwise.
    n=len(poly); vs=[(x,y+dy,z) for dy in (-depth/2,depth/2) for x,z in poly]
    fs=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    fs += [(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return mesh(name,vs,fs,color)


def _leaf(name,a,b,width,color='leaf'):
    ax,ay,az=a; bx,by,bz=b
    mx,my,mz=((ax+bx)/2,(ay+by)/2,(az+bz)/2)
    # Faceted diamond with a prominent central ridge.
    vs=[a,(mx-width,my,mz),(mx,my-.055,mz+.035),(mx+width,my,mz),b,(mx,my+.04,mz-.02)]
    fs=[(0,1,2),(0,2,3),(1,4,2),(2,4,3),(0,5,1),(0,3,5),(1,5,4),(3,4,5)]
    mesh(name,vs,fs,color)


def _puff(name,x,y,z,r,color,n=6):
    # Two broad staggered rings and true poles: fluffy 20/24-triangle blossoms.
    vs=[(x,y,z-r*.75)]
    for h,rr,phase in [(-.28,.88,0),(.30,.93,0)]:
        vs += [(x+r*rr*math.cos(2*math.pi*i/n+phase),y+r*rr*math.sin(2*math.pi*i/n+phase),z+r*h) for i in range(n)]
    vs += [(x,y,z+r*.82)]
    fs=[]
    for i in range(n):
        j=(i+1)%n
        fs += [(0,1+j,1+i),(1+i,1+j,1+n+j,1+n+i),(2*n+1,1+n+i,1+n+j)]
    mesh(name,vs,fs,color)


def _sprout(name,x,y,z,s=1,color='gold'):
    beam(name+' stem',(x,y,z),(x,y,z+.38*s),.055*s,color)
    _leaf(name+' left',(x,y,z+.15*s),(x-.30*s,y,z+.45*s),.13*s,color)
    _leaf(name+' right',(x,y,z+.24*s),(x+.31*s,y,z+.54*s),.13*s,color)


def _seal(name,x,y,z,r=.25):
    # Solid octagonal coin with an inset face on the visible side.
    cylinder(name+' rim',(x,y,z),r,.06,'gold',vertices=8,rotation=(math.pi/2,0,0))
    cylinder(name+' inset',(x,y-.037,z),r*.79,.025,'teal',vertices=8,rotation=(math.pi/2,0,0))
    _sprout(name+' sprout',x,y-.064,z-r*.55,r*1.8,'wheat')


def _post(name,x,y,h,color='oak',width=.17):
    box(name+' foot',(x,y,.12),(width*1.55,width*1.55,.24),'stone')
    box(name+' shaft',(x,y,(h+.17)/2),(width,width,h-.17),color)
    cone(name+' carved cap',(x,y,h+.05),width*.94,0,.18,'wood_light',vertices=4)


def _canvas(name,w=2.65,d=1.95,top=2.40,second=False):
    # Continuous bowed six-stripe canopy: hand-cut lower valances retain a scalloped silhouette.
    n=6; start=-w/2
    for i in range(n):
        xl=start+w*i/n; xr=start+w*(i+1)/n
        col=('teal' if i%2==0 else ('gold' if second else 'wheat'))
        ys=[-.99,-.62,.12,.83]
        zs=[top-.30,top-.13,top+.08,top-.02]
        vs=[(x,y,z) for x in (xl,xr) for y,z in zip(ys,zs)]
        mesh(name+' stripe %d'%i,vs,[(0,4,5,1),(1,5,6,2),(2,6,7,3)],col)
        # A six-sided scallop is visible, thick enough for silhouettes and both sides.
        _panel(name+' scallop %d'%i,[(xl,top-.30),(xl+.07,top-.46),(xr-.07,top-.46),(xr,top-.30)],-.99,.045,col)
    beam(name+' front pole',(-w/2,-.99,top-.30),(w/2,-.99,top-.30),.075,'wood')
    beam(name+' rear pole',(-w/2,.83,top-.02),(w/2,.83,top-.02),.075,'wood')


def _market(second=False):
    for x in (-1.17,1.17):
        for y,h in ((-.80,2.20),(.68,2.45)):
            box('tapered market post',(x,y,h/2),(.12,.12,h),'oak')
        beam('awning side bow',(x,-.84,2.16),(x,.12,2.48),.065,'wood_light')
    _canvas('striped harvest canopy',second=second)
    box('counter top',(0,-.38,1.00),(2.45,.84,.13),'wood_light')
    for i in range(6):
        x=-1.01+i*.405
        # Faceted toe boards read as a shaped, closed trestle front.
        _panel('counter front plank %d'%i,[(x-.19,.26),(x+.19,.26),(x+.19,.93),(x-.19,.93)],-.81,.075,'teal' if second else 'oak')
    beam('counter bottom rail',(-1.22,-.84,.30),(1.22,-.84,.30),.10,'wood')
    for x in (-1.03,1.03):
        beam('trestle foot',(x,-.90,.08),(x,.28,.08),.12,'wood')
        beam('trestle upright',(x,-.38,.10),(x,-.38,.92),.12,'wood')
    if second:
        for j in range(3):
            x=-.78+j*.78
            box('produce bin base',(x,-.36,1.105),(.70,.62,.08),'oak')
            box('produce bin front',(x,-.67,1.18),(.72,.055,.20),'wood_light')
            for i in range(3):
                px=x-.20+(i%2)*.36; py=-.42+(i//2)*.26
                _puff('ripe produce',px,py,1.25,.14,'terracotta' if j==0 else ('wheat' if j==1 else 'leaf'),5)
        _seal('harvest sellers seal',.0,-.87,.61,.22)
    else:
        for j in range(3):
            x=-.78+j*.78
            box('bread tray',(x,-.34,1.105),(.69,.64,.07),'wood')
            for k in range(2):
                xx=x-.17+k*.34
                # Octagonal long loaves lie along Y, with visible short scoring bars.
                ob=_lathe('golden loaf',xx,-.35,[(1.13,.07),(1.22,.15),(1.31,.12)],'wheat',6)
                for v in ob.data.vertices: v.co.y=-.35+(v.co.y+.35)*1.65
                for q in range(2):
                    yy=-.42+q*.13
                    mesh('bread scored crust',[(xx-.08,yy,1.325),(xx+.055,yy+.03,1.325),(xx+.055,yy+.055,1.325),(xx-.08,yy+.025,1.325)],[(0,1,2,3)],'cream')
        _seal('bakers sprout seal',0,-.87,.60,.22)


def _wheel(name,x,y,z,r=.49):
    n=10; vs=[]
    for yy,rr in [(y-.075,r),(y-.075,r*.73),(y+.075,r),(y+.075,r*.73)]:
        vs += [(x+rr*math.cos(2*math.pi*i/n),yy,z+rr*math.sin(2*math.pi*i/n)) for i in range(n)]
    fs=[]
    for i in range(n):
        j=(i+1)%n
        fs += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)]
    mesh(name+' iron tyre',vs,fs,'dark')
    for ang in (0,math.pi/2):
        dx=math.cos(ang)*r*.78; dz=math.sin(ang)*r*.78
        beam(name+' oak spokes',(x-dx,y,z-dz),(x+dx,y,z+dz),.10,'wood_light')
    cylinder(name+' hub',(x,y,z),.115,.24,'oak',vertices=6,rotation=(math.pi/2,0,0))


def _cart():
    # Length runs down Y; the handles project toward the viewer.
    for x in (-.91,.91):
        # Wheels rotate about X, implemented by swapping the local wheel coordinates.
        before=set(__import__('bpy').data.objects)
        _wheel('cart wheel',0,x,.53,.52)
        for ob in set(__import__('bpy').data.objects)-before:
            for v in ob.data.vertices:
                v.co.x,v.co.y=v.co.y,-v.co.x
    beam('cart axle',(-1.10,.05,.53),(1.10,.05,.53),.13,'dark')
    for x in (-.52,.52):
        beam('long handcart shafts',(x,-1.82,.80),(x,.99,.63),.10,'oak')
        box('handle grip',(x,-1.73,.80),(.14,.30,.14),'dark')
    for i in range(5):
        box('wagon floor plank',(-.56+i*.28,.16,.71),(.265,1.65,.105),'wood_light')
    for x in (-.72,.72):
        for z in (.88,1.10,1.32): box('open wagon side',(x,.16,z),(.10,1.75,.17),'oak')
        for y in (-.67,.99): box('wagon corner stake',(x,y,1.05),(.12,.12,.84),'wood')
    for y in (-.68,1.0):
        for z in (.9,1.14): box('end slat',(0,y,z),(1.45,.09,.17),'wood_light')
    # A tied faceted grain sack and two oversized harvest fruits.
    _lathe('grain sack',-.25,.30,[(.77,.23),(1.00,.32),(1.40,.28),(1.51,.10),(1.60,.13)],'cream',6)
    cylinder('sack cord',(-.25,.30,1.52),.11,.055,'gold',vertices=6)
    for y in (-.15,.38): _puff('harvest squash',.36,y,1.01,.23,'terracotta',6)


def _barrel(name,x,y,h=.94,r=.34):
    n=10; rings=[(.0,r*.84),(.10*h,r),(.50*h,r*1.12),(.90*h,r),(h,r*.84)]
    vs=[(x+rr*math.cos(2*math.pi*i/n),y+rr*math.sin(2*math.pi*i/n),z) for z,rr in rings for i in range(n)]
    for i in range(n):
        j=(i+1)%n
        mesh(name+' stave %02d'%i,vs,[(k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i) for k in range(4)],'oak' if i%2 else 'wood_light')
    cylinder(name+' lid',(x,y,h-.025),r*.83,.05,'wood',vertices=10)
    for z,rr in ((.17*h,r*1.05),(.79*h,r*1.065)):
        _lathe(name+' iron band',x,y,[(z-.045,rr),(z+.045,rr)],'dark',10,caps=False)
    beam(name+' lid brace',(x-r*.65,y,h+.008),(x+r*.65,y,h+.008),.065,'wood_light')


def _crate(name,x,y,z,s=.70):
    box(name+' core',(x,y,z+s/2),(s*.96,s*.96,s*.92),'oak')
    for dz in (.1,.5,.9):
        box(name+' front slat',(x,y-s*.5,z+s*dz),(s+.03,.055,s*.22),'wood_light')
        box(name+' right slat',(x+s*.5,y,z+s*dz),(.055,s+.03,s*.22),'wood_light')
    beam(name+' front diagonal',(x-s*.43,y-s*.54,z+.05),(x+s*.43,y-s*.54,z+s-.05),.07,'wood')
    beam(name+' top brace',(x-s*.42,y-s*.42,z+s*.98),(x+s*.42,y+s*.42,z+s*.98),.08,'wood')


def _barrels():
    _barrel('large coopered barrel',-.79,.20,1.08,.40)
    _barrel('small coopered barrel',-.11,-.43,.79,.29)
    _crate('bottom produce crate',.70,.18,0,.75)
    _crate('upper produce crate',.70,.18,.75,.62)


def _bench():
    for x in (-.98,.98):
        for y in (-.34,.32):
            _lathe('turned bench leg',x,y,[(.04,.13),(.16,.10),(.46,.075),(.55,.12)],'wood',6)
        # Shaped solid end runners and arm supports.
        _panel('scroll bench end',[(x-.16,.42),(x+.16,.42),(x+.12,.75),(x+.04,.83),(x-.10,.79)],-.26,.14,'oak')
        beam('bench rear upright',(x,.34,.42),(x,.47,1.30),.11,'wood')
        beam('bench armrest',(x,-.43,.80),(x,.40,.88),.12,'wood_light')
    for j in range(4): box('rounded seat slat',(0,-.31+j*.20,.56),(2.34,.18,.10),'wood_light')
    # Arched back panel, visually split by contrasting narrow battens.
    _panel('arched teal bench back',[(-1.13,.81),(1.13,.81),(1.13,1.10),(.89,1.22),(.0,1.32),(-.89,1.22),(-1.13,1.10)],.40,.095,'teal')
    beam('bench back lower edge',(-1.13,.337,.83),(1.13,.337,.83),.065,'gold')
    for x in (-.78,-.39,.39,.78):
        beam('back board seam',(x,.34,.86),(x,.34,1.20),.035,'teal_dark')
    _seal('bench carved sprout',0,.31,1.07,.19)
    for x in (-1.04,1.04):
        cylinder('armrest round finial',(x,-.41,.82),.105,.15,'gold',vertices=6,rotation=(math.pi/2,0,0))


def _signpost():
    _lathe('carved sign footing',0,0,[(0,.37),(.10,.38),(.22,.27),(.33,.20)],'stone',8)
    _lathe('oak sign shaft',0,0,[(.25,.12),(2.25,.10),(2.42,.16),(2.57,.01)],'oak',8)
    # Two visibly different arrow-shaped boards; front faces toward -Y.
    _panel('upper arrow',[(-1.10,1.79),(.78,1.79),(1.24,1.99),(.78,2.19),(-1.10,2.19),(-.97,1.99)],-.16,.14,'teal')
    _panel('lower arrow',[(-1.21,1.39),(-.81,1.18),(.95,1.18),(.83,1.39),(.95,1.60),(-.81,1.60)],-.15,.14,'wood_light')
    for x in (-.59,-.10,.39):
        _leaf('route engraving',(x,-.242,1.90),(x+.14,-.242,2.08),.055,'wheat')
    for x in (-.45,.0,.45):
        beam('river route mark',(x,-.24,1.31),(x+.20,-.24,1.47),.045,'teal')
    _seal('signpost grain seal',0,-.27,.85,.24)
    for x,y,r in [(-.35,.17,.14),(.34,.10,.12),(-.10,-.32,.13)]:
        _lathe('footing river cobble',x,y,[(0,r*.8),(.08,r),(.19,r*.3)],'stone_light',6)


def _lantern_small(name,x,y,z,s=1,col='teal'):
    _lathe(name+' pointed roof',x,y,[(z+.13*s,.19*s),(z+.20*s,.23*s),(z+.39*s,.035*s)],col,6)
    # A solid luminous heart is framed by four chunky dark warm-brown mullions.
    _lathe(name+' warm heart',x,y,[(z-.19*s,.12*s),(z+.12*s,.15*s)],'wheat',6)
    # mark only the pane mesh emissive without introducing another body material
    # custom mesh emission is passed via the shared helper
    vv=[(x-.10*s,y-.115*s,z-.12*s),(x+.10*s,y-.115*s,z-.12*s),(x+.12*s,y-.14*s,z+.09*s),(x-.12*s,y-.14*s,z+.09*s)]
    mesh(name+' glowing pane',vv,[(0,1,2,3)],'wheat',glow=True)
    for dx,dy in ((-.105,-.09),(.105,-.09),(-.105,.09),(.105,.09)):
        beam(name+' upright',(x+dx*s,y+dy*s,z-.21*s),(x+dx*1.35*s,y+dy*1.35*s,z+.13*s),.035*s,'dark')
    _lathe(name+' flared foot',x,y,[(z-.27*s,.06*s),(z-.22*s,.16*s),(z-.16*s,.14*s)],'dark',6)
    cylinder(name+' top button',(x,y,z+.40*s),.055*s,.08*s,'gold',vertices=6)


def _lamp():
    _lathe('cast brown base',0,0,[(0,.28),(.09,.30),(.19,.21),(.36,.17),(.48,.10)],'dark',8)
    cylinder('slender lamp shaft',(0,0,1.52),.075,2.2,'dark',vertices=8)
    _lathe('lamp collar',0,0,[(2.45,.11),(2.53,.17),(2.63,.10),(2.78,.025)],'gold',8)
    for side in (-1,1):
        pts=[(0,0,2.34),(.23*side,0,2.59),(.55*side,0,2.73),(.88*side,0,2.64),(.99*side,0,2.45)]
        for a,b in zip(pts,pts[1:]): beam('curved cast lantern arm',a,b,.065,'dark')
        _lantern_small('hanging lantern',side*.99,0,2.08,.88,'teal')
    _seal('lamp harvest seal',0,-.095,1.84,.16)


def _stringlights():
    for x in (-2.76,2.76):
        _post('festival pole',x,0,2.95,'oak',.14)
        cylinder('pole gold band',(x,0,2.68),.103,.10,'gold',vertices=6)
    pts=[]
    for i in range(9):
        x=-2.76+i*5.52/8; z=2.77-.64*(1-(x/2.76)**2)
        pts.append((x,0,z))
    for a,b in zip(pts,pts[1:]): beam('sagging festival cable',a,b,.027,'dark')
    for i in range(1,8):
        x,y,z=pts[i]
        beam('lantern drop',(x,y,z),(x,y,z-.11),.024,'dark')
        # Lanterns are faceted paper gourds, with a crisp colored roof and glowing body.
        _lathe('festival paper lantern',x,0,[(z-.48,.055),(z-.40,.14),(z-.21,.14),(z-.14,.055)],'wheat',6)
        cone('colored lantern cap',(x,0,z-.145),.16,.04,.10,'teal' if i%2 else 'gold',vertices=6)
        mesh('luminous lantern panel',[(x-.06,-.123,z-.395),(x+.06,-.123,z-.395),(x+.06,-.123,z-.205),(x-.06,-.123,z-.205)],[(0,1,2,3)],'wheat',glow=True)


def _banner():
    _lathe('standard stone footing',-.48,0,[(0,.31),(.12,.34),(.29,.22),(.35,.17)],'stone',8)
    cylinder('oak standard',(-.48,0,1.66),.065,2.70,'oak',vertices=8)
    cone('gold spear finial',(-.48,0,3.11),.14,0,.33,'gold',vertices=6)
    beam('banner crossbar',(-.68,0,2.80),(.83,0,2.80),.09,'wood')
    for x in (-.67,.83): _puff('crossbar gold end',x,0,2.80,.07,'gold',5)
    # Slightly sculpted waves, with an actual notched swallowtail, not a flat rectangular flag.
    vs=[(-.36,-.015,2.71),(.16,-.085,2.71),(.71,.015,2.71),(-.36,-.04,1.10),(.16,-.11,1.35),(.71,-.005,1.10)]
    mesh('swallowtail teal cloth',vs,[(0,3,4,1),(1,4,5,2)],'teal')
    for x in (-.36,.71): beam('banner woven gold hem',(x,-.055,1.14),(x,-.055,2.70),.033,'gold')
    # Wheat sheaf: three stems and nine plump grain diamonds with no text dependency.
    for k in (-1,0,1):
        bx=.16+k*.22; zt=2.36-abs(k)*.08
        beam('wheat stem',(.16,-.14,1.53),(bx,-.14,zt),.026,'wheat')
        for q in range(3):
            z=1.93+q*.16-abs(k)*.05
            _leaf('wheat grain',(bx,-.15,z-.06),(bx+(-.10 if q%2 else .10),-.15,z+.13),.067,'gold')
    box('sheaf tie',(.16,-.17,1.70),(.24,.035,.07),'cream')
    _lathe('footing collar',-.48,0,[(.35,.11),(.41,.13),(.48,.09)],'gold',8)


def _planter():
    _panel('chamfered stone planter',[(-1.16,.20),(-.99,.05),(.99,.05),(1.16,.20),(1.22,.67),(-1.22,.67)],0,1.02,'cream')
    box('rich garden soil',(0,0,.66),(2.25,.86,.055),'dark')
    for y in (-.51,.51): box('golden planter rim',(0,y,.70),(2.52,.12,.15),'wheat')
    for x in (-1.20,1.20): box('planter side rim',(x,0,.70),(.12,1.02,.15),'wheat')
    for x in (-.92,.92): box('planter foot',(x,0,.09),(.28,.90,.18),'stone')
    for i in range(7):
        x=-.91+i*.30; y=(-.16 if i%2 else .17); z=1.02+(i%3)*.12
        beam('flower stalk',(x,y,.69),(x,y,z),.037,'leaf')
        _leaf('broad planter leaf',(x,y,.75),(x+(.18 if i%2 else -.18),y,.96),.13,'leaf')
        _puff('fluffy garden blossom',x,y,z,.18,'pink' if i%3 else 'gold',5)
        _puff('flower center',x,y-.135,z+.025,.065,'wheat',5)
        if i in (1,3,5):
            for side in (-1,1):
                _puff('flower soft petal lobe',x+side*.12,y+.015,z-.025,.105,'pink' if i%3 else 'gold',5)
    _seal('planter town seal',0,-.548,.39,.17)


def _fence_part(a,b,name):
    ax,ay=a; bx,by=b
    for z in (.45,.94): beam(name+' rail',(ax,ay,z),(bx,by,z),.14,'wood_light',depth=.17)
    beam(name+' rising brace',(ax,ay,.40),(bx,by,.99),.09,'oak')
    beam(name+' falling brace',(ax,ay,.99),(bx,by,.40),.09,'oak')
    # Raised square pegs, one on each visible face at the rail joints.
    for x,y in (a,b):
        for z in (.45,.94):
            box(name+' peg',(x,y-.104,z),(.07,.04,.07),'gold')


def _fence(corner=False):
    if corner:
        pts=[(-1.30,-1.30),(-1.30,1.30),(1.30,1.30)]
    else: pts=[(-1.30,0),(1.30,0)]
    for x,y in pts:
        _post('fence pillar',x,y,1.18,'oak',.20)
        box('fence cap collar',(x,y,1.15),(.27,.27,.10),'wood_light')
    for i in range(len(pts)-1): _fence_part(pts[i],pts[i+1],'fence section')
    if not corner:
        for x in (-.55,.55):
            _panel('pointed fence picket',[(x-.08,.24),(x+.08,.24),(x+.08,1.05),(x,1.18),(x-.08,1.05)],0,.13,'oak')
        _seal('fence harvest seal',0,-.12,.74,.18)


def _bridge():
    # Exact six-metre span, flat deck at Z=.64; faceted arch exists only below the flat floor.
    box('flat bridge slab',(0,0,.53),(6.0,2.94,.22),'stone_light')
    for i in range(12):
        x=-2.75+i*.50
        mesh('walkway joint',[(x-.009,-1.25,.646),(x+.009,-1.25,.646),(x+.009,1.25,.646),(x-.009,1.25,.646)],[(0,1,2,3)],'stone')
    # Polygonal arch ring between upper horizontal deck and lower faceted arch.
    # Stone piers sit on z=0 while the wide central opening remains visibly recessed.
    # Arch apex stays beneath the horizontal underside of the deck.
    profile=[(-3,0),(-2.26,0),(-1.78,.19),(-1.10,.33),(0,.39),(1.10,.33),(1.78,.19),(2.26,0),(3,0),(3,.44),(-3,.44)]
    for y in (-1.32,1.32):
        _panel('faceted arch spandrel',profile,y,.27,'stone')
        # Voussoirs are proud on the outside, articulated around the low subdeck arch.
        for i in range(4):
            x=-1.8+i*1.2; z=.10+.28*(1-(x/2.1)**2)
            box('arch keystone', (x,y+(-.15 if y<0 else .15),z+.055),(.19,.035,.17),'cream')
        # Low segmented parapets do not interrupt the flat walking surface.
        for i in range(6):
            x=-2.50+i
            _panel('parapet stone',[(x-.48,.65),(x+.48,.65),(x+.48,1.00),(x+.35,1.06),(x-.35,1.06),(x-.48,1.00)],y,.20,'stone_light')
            box('parapet cap',(x,y,1.08),(.97,.29,.10),'cream')
    for x in (-2.80,2.80):
        for y in (-1.32,1.32):
            box('bridge end pier',(x,y,.61),(.30,.28,1.22),'stone')
            cone('bridge finial',(x,y,1.30),.17,.12,.16,'wheat',vertices=4)


def _dock():
    # Full footprint 3 x 3 m. A single flat walkable top is formed by adjacent boards.
    for i in range(10):
        x=-1.35+i*.30
        box('dock deck board %02d'%i,(x,0,.41),(.286,3.0,.17),'wood_light' if i%3 else 'oak')
        for y in (-1.19,1.19):
            cylinder('deck timber peg',(x,y,.501),.026,.012,'dark',vertices=4)
    for x in (-1.22,1.22):
        box('dock underside bearer',(x,0,.26),(.19,3.0,.17),'wood')
    for x in (-1.20,1.20):
        for y in (-1.19,1.19):
            _lathe('pier piling',x,y,[(0,.13),(.50,.14),(.74,.12)],'oak',6)
            cylinder('pile cap',(x,y,.77),.17,.10,'wood_light',vertices=6)
            _lathe('pile rope collar',x,y,[(.59,.16),(.66,.16)],'wheat',6,caps=False)
    for x in (-.93,.93):
        box('mooring bollard foot',(x,-1.18,.56),(.23,.23,.12),'dark')
        cylinder('mooring bollard',(x,-1.18,.70),.065,.25,'dark',vertices=6)
        beam('bollard horns',(x-.15,-1.18,.79),(x+.15,-1.18,.79),.08,'dark')


def _statue():
    # Friendly stylized proportions echo the reference character lineup, carved as one palette family.
    _lathe('octagonal plinth',0,0,[(0,.82),(.14,.86),(.28,.73),(.46,.70)],'stone',8)
    _lathe('plinth top bevel',0,0,[(.46,.72),(.55,.66)],'stone_light',8)
    for x in (-.19,.19):
        beam('guardian trouser leg',(x,0,.61),(x,0,1.03),.22,'stone_light',depth=.24)
        box('carved round boot',(x,-.085,.63),(.27,.42,.17),'stone')
    _lathe('guardian apron coat',0,0,[(.92,.37),(1.18,.32),(1.52,.37),(1.63,.24)],'cream',8)
    _panel('carved apron bib',[(-.23,1.10),(.23,1.10),(.20,1.48),(-.20,1.48)],-.33,.045,'stone_light')
    box('apron pocket',(0,-.367,1.23),(.25,.04,.16),'stone')
    cylinder('guardian neck',(0,0,1.65),.12,.18,'stone_light',vertices=6)
    _lathe('friendly sculpted face',0,-.02,[(1.65,.14),(1.73,.24),(1.98,.29),(2.17,.24),(2.21,.12)],'cream',8)
    # Broad brim and low crown are unmistakably a gardener's straw hat.
    _lathe('broad straw hat brim',0,0,[(2.16,.50),(2.21,.53),(2.25,.42)],'wheat',10)
    _lathe('straw hat crown',0,0,[(2.23,.29),(2.43,.24),(2.48,.16)],'wheat',8)
    _lathe('hat carved band',0,0,[(2.25,.298),(2.31,.283)],'gold',8,caps=False)
    # Softly upturned eyes and a smile are geometric incisions, not a printed texture.
    for x in (-.102,.102):
        _panel('kind carved eye',[(x-.043,1.947),(x+.043,1.947),(x+.029,1.971),(x-.029,1.971)],-.295,.018,'stone')
        beam('friendly eyebrow',(x-.048,-.288,2.017),(x+.042,-.288,2.029),.023,'stone')
    _puff('guardian button nose',0,-.296,1.90,.064,'stone_light',5)
    mesh('guardian gentle smile',[(-.073,-.276,1.825),(0,-.287,1.800),(.073,-.276,1.825),(.052,-.279,1.806),(0,-.29,1.785),(-.052,-.279,1.806)],[(0,1,4,5),(1,2,3,4)],'stone')
    # The left elbow bends toward a newly growing sprout; right arm grasps a spade.
    for side in (-1,1):
        shoulder=(side*.28,0,1.51); elbow=(side*.47,-.01,1.28); hand=(side*.51,-.22,1.38)
        beam('guardian upper sleeve',shoulder,elbow,.20,'cream')
        beam('guardian forearm',elbow,hand,.15,'stone_light')
        _puff('carved mitten',*hand,.105,'cream',5)
    # Spade rests on the plinth, its shaft ending beneath a split grip.
    beam('garden spade shaft',(.61,-.25,.83),(.61,-.25,1.88),.055,'gold')
    _panel('spade blade',[(.44,.81),(.47,.63),(.61,.55),(.75,.63),(.78,.81)],-.25,.075,'bronze')
    for x in (.52,.70): beam('spade grip side',(x,-.25,1.81),(x,-.25,1.99),.045,'gold')
    beam('spade grip top',(.52,-.25,1.99),(.70,-.25,1.99),.045,'gold')
    _sprout('guardian young sprout',-.53,-.24,1.41,.66,'teal')
    _seal('plinth harvest emblem',0,-.72,.28,.17)


_BUILDERS={
 'market-stall-a':lambda:_market(False), 'market-stall-b':lambda:_market(True),
 'cart':_cart, 'barrels-crates':_barrels, 'bench':_bench, 'signpost':_signpost,
 'lamp-post':_lamp, 'string-lights':_stringlights, 'banner-pole':_banner,
 'flower-planter':_planter, 'fence-straight':lambda:_fence(False),
 'fence-corner':lambda:_fence(True), 'stone-bridge':_bridge,
 'dock-segment':_dock, 'statue-gardener-warden':_statue,
}

def build(name):
    if name not in _BUILDERS: raise ValueError('Unknown Hollowmere street prop: '+name)
    import bpy
    from mathutils import Vector
    before=set(bpy.data.objects)
    _BUILDERS[name]()
    objects=[o for o in set(bpy.data.objects)-before if o.type=='MESH']
    vs=[v.co for o in objects for v in o.data.vertices]
    lo=[min(v[i] for v in vs) for i in range(3)]
    hi=[max(v[i] for v in vs) for i in range(3)]
    shift=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]))
    for ob in objects:
        for v in ob.data.vertices: v.co-=shift
        ob.data.update()

