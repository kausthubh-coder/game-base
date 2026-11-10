"""The eleven human designs. One skeleton and one animation recipe for all."""
import math
from shared import Builder, make_armature, create_action
C={'skin':'F2C59B','skin2':'DEAE7D','skin3':'D69C70','cream':'F7E5BA','linen':'E9D7AD','tan':'BC8E55','brown':'79513D','hair':'654332','dark':'392E3C','rose':'D88D80','gold':'D1A34D','sage':'8B9B63','green':'536F54','blue':'4C617C','teal':'517C7A','plum':'795C79','red':'A95847','flour':'FFF2D5'}
SPECS={
'hero':dict(height=1.78,skin='skin',hair='hair',shirt='cream',pants='brown',shoes='brown',width=1,kind='hero'),
 'tamsin':dict(height=1.85,skin='skin2',hair='linen',shirt='brown',pants='brown',shoes='dark',width=.97,kind='tamsin'),
 'maren':dict(height=1.69,skin='skin',hair='brown',shirt='green',pants='cream',shoes='brown',width=.94,kind='maren'),
 'odo':dict(height=1.65,skin='skin',hair='brown',shirt='cream',pants='brown',shoes='dark',width=1.2,kind='odo'),
 'gus':dict(height=1.68,skin='skin2',hair='brown',shirt='tan',pants='blue',shoes='brown',width=1.15,kind='gus'),
 'mira':dict(height=1.72,skin='skin2',hair='hair',shirt='plum',pants='brown',shoes='brown',width=.98,kind='mira'),
 'wren':dict(height=1.66,skin='skin',hair='hair',shirt='green',pants='cream',shoes='brown',width=1,kind='wren'),
 'juniper':dict(height=1.20,skin='skin',hair='hair',shirt='tan',pants='brown',shoes='brown',width=1.04,kind='juniper'),
 'brack':dict(height=1.83,skin='skin2',hair='brown',shirt='blue',pants='dark',shoes='brown',width=.98,kind='brack'),
 'villager-a':dict(height=1.73,skin='skin',hair='brown',shirt='brown',pants='red',shoes='brown',width=1,kind='villager-a'),
 'villager-b':dict(height=1.63,skin='skin',hair='brown',shirt='cream',pants='red',shoes='brown',width=1.06,kind='villager-b')}

def humanoid_bones(scale):
    sx,sy,sz=scale
    def v(p):return(p[0]*sx,p[1]*sy,p[2]*sz)
    out=[]
    def add(n,h,t,p):out.append((n,v(h),v(t),p))
    add('hips',(0,0,.59),(0,0,.77),None);add('spine',(0,0,.77),(0,0,.95),'hips')
    add('chest',(0,0,.95),(0,0,1.10),'spine');add('neck',(0,0,1.10),(0,0,1.21),'chest');add('head',(0,0,1.21),(0,0,1.61),'neck')
    for side,s in [('L',1),('R',-1)]:
        add('upper_arm.'+side,(s*.235,0,1.07),(s*.335,0,.86),'chest')
        add('lower_arm.'+side,(s*.335,0,.86),(s*.39,-.015,.67),'upper_arm.'+side)
        add('hand.'+side,(s*.39,-.015,.67),(s*.40,-.035,.59),'lower_arm.'+side)
        if side=='R':add('hand.R.tool',(-.40,-.035,.63),(-.40,-.16,.63),'hand.R')
        add('upper_leg.'+side,(s*.13,0,.61),(s*.13,0,.34),'hips')
        add('lower_leg.'+side,(s*.13,0,.34),(s*.13,0,.105),'upper_leg.'+side)
        add('foot.'+side,(s*.13,0,.105),(s*.13,-.16,.065),'lower_leg.'+side)
    return out

def band(b,label,z,rx,ry,height,color,bone='hips',segments=12):
    # Four rings create a soft, closed belt/tunic hem with a beveled rim.
    v=[];f=[]
    for dz,k in [(-height/2,.95),(-height*.35,1),(height*.35,1),(height/2,.95)]:
        for i in range(segments):
            a=2*math.pi*i/segments;v.append((rx*k*math.cos(a),ry*k*math.sin(a),z+dz))
    f.append(tuple(reversed(range(segments))));f.append(tuple(range(3*segments,4*segments)))
    for j in range(3):
        for i in range(segments):f.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    b.mesh(label,v,f,C.get(color,color),bone)

def haircap(b,color,variant):
    seg=14;v=[(0,.025,1.76)];f=[]
    for ring in range(1,5):
        for i in range(seg):
            a=2*math.pi*i/seg
            # Front hairline is high; back and temples wrap around the head.
            front=max(0,-math.sin(a));back=max(0,math.sin(a));bottom=1.40+.17*front-.12*back
            theta=(math.pi/2+.30)*ring/4
            x=.302*math.sin(theta)*math.cos(a);y=.025+.255*math.sin(theta)*math.sin(a)
            z=1.76+(bottom-1.76)*(1-math.cos(theta))/(1-math.cos(math.pi/2+.30))
            v.append((x,y,z))
    for i in range(seg):f.append((0,1+i,1+(i+1)%seg))
    for j in range(3):
        for i in range(seg):a=1+j*seg+i;n=1+j*seg+(i+1)%seg;f.append((a,a+seg,n+seg,n))
    f.append(tuple(reversed(range(1+3*seg,1+4*seg))))
    b.mesh('Sculpted hair cap',v,f,C[color],'head')
    # Broad graphic locks rather than strands.
    for i,(x,z) in enumerate([(-.18,1.56),(-.075,1.52),(.045,1.57),(.16,1.54)]):
        b.capsule('Chunky fringe '+str(i),(x-.035,-.180,1.67),(x+.025,-.224,z),.060,C[color],'head',radius2=.030,segments=8)
    if variant in ['hero','juniper','wren']:
        for i,x in enumerate([-.17,0,.15]):b.capsule('Messy crown '+str(i),(x,.02,1.70),(x+.06,-.015,1.78-abs(x)*.2),.054,C[color],'head',radius2=.019,segments=7)

def face(b,spec):
    skin=C[spec['skin']];b.ellipsoid('Head',(0,0,1.43),(.283,.247,.293),skin,'head',16,10)
    for side,x in [('L',.282),('R',-.282)]:b.ellipsoid('Ear '+side,(x,.005,1.405),(.048,.041,.066),skin,'head',8,5)
    sleepy=spec['kind']=='maren';older=spec['kind'] in ['tamsin','brack']
    for x in [-.103,.103]:
        if spec['kind']=='odo':
            b.capsule('Smiling eye',(x-.031,-.238,1.441),(x,-.246,1.456),.011,C['dark'],'head',segments=6)
            b.capsule('Smiling eye',(x,-.246,1.456),(x+.031,-.238,1.441),.011,C['dark'],'head',segments=6)
        else:b.ellipsoid('Eye',(x,-.235,1.441),(.034,.013,.033 if sleepy else .049),C['dark'],'head',10,6)
        if spec['kind']!='odo':b.ellipsoid('Eye glint',(x-.009,-.247,1.459),(.010,.005,.012),C['flour'],'head',8,4)
        b.capsule('Brow',(x-.031,-.229,1.509),(x+.026,-.231,1.514 if sleepy else 1.521),.009,C[spec['hair']],'head',segments=6)
        b.ellipsoid('Warm cheek',(x*1.56,-.205,1.359),(.040,.008,.017),C['rose'],'head',8,4)
        if older:b.capsule('Smile crease',(x*1.52,-.204,1.402),(x*1.72,-.190,1.389),.005,C['tan'],'head',segments=5)
    b.ellipsoid('Button nose',(0,-.247,1.374),(.028,.027,.025),skin,'head',8,5)
    if spec['kind']=='odo':
        b.capsule('Happy smile L',(-.05,-.232,1.338),(0,-.249,1.316),.009,C['brown'],'head',segments=6)
        b.capsule('Happy smile R',(0,-.249,1.316),(.05,-.232,1.338),.009,C['brown'],'head',segments=6)
    else:b.capsule('Small mouth',(-.025,-.231,1.322),(.025,-.231,1.322),.008,C['brown'],'head',segments=6)
    haircap(b,spec['hair'],spec['kind'])

def garments(b,s):
    k=s['kind'];skin=C[s['skin']];shirt=C[s['shirt']];pants=C[s['pants']]
    b.ellipsoid('Body',(0,0,.89),(.235,.157,.265),shirt,'chest',12,7)
    b.ellipsoid('Hips',(0,0,.625),(.211,.135,.125),pants,'hips',12,6)
    b.capsule('Neck',(0,0,1.07),(0,0,1.21),.082,skin,'neck',segments=8)
    for side,sgn in [('L',1),('R',-1)]:
        b.capsule('Trouser thigh '+side,(sgn*.13,0,.59),(sgn*.13,0,.36),.092,pants,'upper_leg.'+side,segments=10)
        b.capsule('Trouser shin '+side,(sgn*.13,0,.345),(sgn*.13,0,.12),.078,C['cream'] if k=='juniper' else pants,'lower_leg.'+side,segments=10)
        b.ellipsoid('Boot '+side,(sgn*.13,-.055,.065),(.098,.145,.065),C[s['shoes']],'foot.'+side,10,5)
        b.capsule('Upper sleeve '+side,(sgn*.235,0,1.04),(sgn*.324,0,.875),.086,shirt,'upper_arm.'+side,segments=8)
        b.capsule('Forearm '+side,(sgn*.334,0,.866),(sgn*.385,-.014,.688),.060,skin if k in ['mira','odo','juniper','gus'] else shirt,'lower_arm.'+side,segments=8)
        b.ellipsoid('Hand '+side,(sgn*.395,-.020,.647),(.062,.055,.076),skin,'hand.'+side,8,5)
    band(b,'Waist seam',.70,.217,.15,.052,'brown')
    # Readable shirt bib/collar and two oversized buttons.
    b.leaf('Left collar',(-.115,-.117,1.11),(-.03,-.171,1.015),.055,C['cream'],'chest')
    b.leaf('Right collar',(.115,-.117,1.11),(.03,-.171,1.015),.055,C['cream'],'chest')
    for z in [.94,.85]:b.ellipsoid('Button',(0,-.16,z),(.014,.010,.014),C['gold'],'chest',6,4)
    if k=='hero':
        # Open cape: clear arms and visible cream shirt front.
        b.mesh('Tan travelling cape',[(-.25,.06,1.10),(.25,.06,1.10),(-.30,.16,.70),(.30,.16,.70),(0,.25,.69),(0,.20,1.12)],[(0,1,5),(0,5,2),(5,4,2),(5,1,3),(5,3,4),(2,4,3),(0,2,3,1)],C['tan'],'chest')
        for side in [-1,1]:
            b.capsule('Front cloak fold',(side*.14,-.105,1.09),(side*.25,-.095,.95),.070,C['tan'],'chest',radius2=.055,segments=8)
        b.ellipsoid('Belt buckle',(0,-.162,.70),(.043,.014,.034),C['gold'],'hips',8,4)
        for i in range(7):
            a=math.pi*i/6;b.ellipsoid('Fur collar',(math.cos(a)*.175,-math.sin(a)*.115,1.115),(.075,.058,.060),C['cream'],'chest',8,4)
        b.capsule('Satchel strap',(.14,-.13,1.07),(-.23,-.13,.69),.020,C['brown'],'chest',segments=6)
        b.ellipsoid('Leather satchel',(-.242,-.038,.62),(.116,.082,.12),C['tan'],'hips',10,5)
        b.ellipsoid('Satchel clasp',(-.25,-.119,.65),(.025,.009,.023),C['gold'],'hips',6,4)
    elif k=='tamsin':
        band(b,'Long coat skirt',.63,.265,.17,.43,'brown')
        for x in [-.155,.155]:b.capsule('Coat lapel',(x,-.125,1.06),(x*.65,-.16,.77),.045,C['brown'],'chest',segments=6)
        b.ellipsoid('Wide hat brim',(0,.015,1.725),(.43,.34,.035),C['brown'],'head',16,4)
        b.ellipsoid('Hat crown',(0,.04,1.79),(.245,.21,.11),C['tan'],'head',12,6)
        b.leaf('Hat feather',(.22,.01,1.77),(.34,.015,1.93),.038,C['cream'],'head')
        b.capsule('Mentor scarf',(-.15,-.11,1.10),(.15,-.11,1.10),.043,C['tan'],'chest',segments=8)
        for i in range(5):b.ellipsoid('Long braid '+str(i),(.20,.205,1.35-i*.09),(.061,.054,.067),C['linen'],'chest' if i>2 else 'head',8,4)
        b.ellipsoid('Braid tie',(.2,.205,.92),(.05,.05,.026),C['red'],'chest',8,4)
    elif k=='maren':
        band(b,'Simple royal skirt',.59,.26,.17,.38,'green')
        b.ellipsoid('Cream gown front',(0,-.152,.78),(.168,.036,.30),C['cream'],'chest',12,6)
        band(b,'Gold dress hem',.405,.259,.17,.025,'gold')
        b.ellipsoid('Royal clasp',(0,-.169,1.025),(.036,.014,.042),C['gold'],'chest',8,4)
        b.ellipsoid('Royal stone',(0,-.184,1.03),(.017,.006,.023),C['teal'],'chest',8,4)
        b.capsule('Simple circlet',(-.23,-.15,1.65),(.23,-.15,1.65),.018,C['gold'],'head',segments=6)
        b.leaf('Circlet center',(0,-.178,1.64),(0,-.18,1.72),.03,C['gold'],'head')
        for x in [-.245,.245]:b.capsule('Long bob',(x,.035,1.45),(x,.045,1.16),.07,C['brown'],'head',segments=8)
    elif k=='odo':
        b.ellipsoid('Apron bib',(0,-.15,.865),(.149,.025,.21),C['cream'],'chest',10,6)
        b.ellipsoid('Apron skirt',(0,-.145,.61),(.195,.027,.145),C['cream'],'hips',10,6)
        for x,z,r in [(-.07,.88,.025),(.06,.77,.02),(.08,.62,.033)]:b.ellipsoid('Flour dust',(x,-.18,z),(r,.006,r*.65),C['flour'],'chest' if z>.7 else 'hips',6,4)
        for i in range(6):
            a=math.pi*i/5;b.ellipsoid('Soft baker curls',(.25*math.cos(a),-.11,1.58+.16*math.sin(a)),(.08,.07,.08),C['brown'],'head',8,4)
        for x in [-.13,.13]:b.capsule('Brown suspenders',(x,-.12,1.08),(x,-.17,.90),.025,C['brown'],'chest',segments=6)
        band(b,'Apron tie',.70,.225,.16,.022,'cream')
    elif k=='gus':
        b.ellipsoid('Straw hat brim',(0,.015,1.715),(.40,.32,.033),C['tan'],'head',16,4)
        b.ellipsoid('Straw hat crown',(0,.02,1.78),(.245,.22,.115),C['linen'],'head',12,6)
        b.capsule('Farmer moustache',(-.065,-.246,1.35),(.065,-.246,1.35),.027,C['brown'],'head',segments=8)
        b.ellipsoid('Overall bib',(0,-.15,.86),(.135,.022,.135),C['blue'],'chest',10,5)
        for x in [-.12,.12]:b.capsule('Overall strap',(x,-.118,1.08),(x,-.163,.90),.022,C['blue'],'chest',segments=6)
    elif k=='mira':
        band(b,'Tool belt',.70,.239,.17,.09,'tan')
        b.ellipsoid('Tape measure',(.19,-.13,.67),(.056,.038,.052),C['gold'],'hips',8,5)
        b.ellipsoid('Tape hub',(.192,-.166,.67),(.025,.008,.025),C['dark'],'hips',8,4)
        b.capsule('Hammer handle',(-.235,-.025,.58),(-.235,-.025,.76),.018,C['brown'],'hips',segments=6)
        b.capsule('Hammer head',(-.29,-.025,.77),(-.18,-.025,.77),.03,C['blue'],'hips',segments=6)
        b.ellipsoid('High carpenter bun',(0,.09,1.80),(.113,.105,.115),C['hair'],'head',10,6)
        b.capsule('Pencil in bun',(.12,.045,1.73),(.26,.045,1.81),.013,C['gold'],'head',segments=6)
    elif k=='wren':
        b.ellipsoid('Practical vest',(0,.035,.89),(.242,.155,.225),C['green'],'chest',12,6)
        for x in [-.16,.16]:b.ellipsoid('Pocket',(x,-.125,.80),(.06,.026,.065),C['tan'],'chest',8,4)
        b.capsule('Soft scarf',(-.14,-.105,1.105),(.14,-.105,1.105),.04,C['gold'],'chest',segments=8)
        b.leaf('Scarf tail',(.10,-.14,1.08),(.15,-.16,.92),.045,C['gold'],'chest')
        for x in [-.23,.23]:b.ellipsoid('Round side hair',(x,.06,1.40),(.10,.11,.16),C['brown'],'head',8,5)
    elif k=='juniper':
        b.mesh('Short travelling cloak',[(-.25,.07,1.10),(.25,.07,1.10),(-.30,.16,.61),(.30,.16,.61),(0,.24,.62),(0,.20,1.12)],[(0,1,5),(0,5,2),(5,4,2),(5,1,3),(5,3,4),(2,4,3),(0,2,3,1)],C['tan'],'chest')
        for side in [-1,1]:b.capsule('Cape front',(side*.13,-.105,1.06),(side*.24,-.08,.78),.068,C['tan'],'chest',segments=8)
        b.capsule('Red play scarf',(-.14,-.11,1.105),(.14,-.11,1.105),.036,C['red'],'chest',segments=8)
        b.ellipsoid('Cloak clasp',(0,-.16,1.055),(.024,.012,.026),C['gold'],'chest',8,4)
    elif k=='brack':
        band(b,'Long river coat',.60,.26,.17,.38,'blue')
        b.capsule('Rope belt',(-.20,-.11,.71),(.20,-.11,.71),.025,C['tan'],'hips',segments=8)
        b.leaf('Reed scarf',(-.12,-.12,1.10),(.13,-.185,.93),.073,C['gold'],'chest')
        b.ellipsoid('Stubble',(0,-.165,1.285),(.11,.077,.055),C['tan'],'head',10,5)
        b.ellipsoid('Reed hat brim',(0,.015,1.71),(.43,.34,.025),C['tan'],'head',16,4)
        b.ellipsoid('Reed hat crown',(0,.03,1.75),(.29,.25,.13),C['tan'],'head',12,6)
        b.capsule('Chin cord L',(-.28,-.03,1.68),(-.15,-.12,1.18),.008,C['linen'],'head',segments=5)
        b.capsule('Chin cord R',(.28,-.03,1.68),(.15,-.12,1.18),.008,C['linen'],'head',segments=5)
    elif k=='villager-a':
        band(b,'Rust skirt',.59,.26,.17,.35,'red')
        b.ellipsoid('Apron skirt',(0,-.15,.65),(.19,.03,.18),C['cream'],'hips',10,6)
        b.ellipsoid('Apron bodice',(0,-.15,.91),(.11,.027,.11),C['cream'],'chest',10,5)
        b.ellipsoid('Soft rust bonnet',(0,.06,1.63),(.324,.255,.19),C['red'],'head',12,7)
        # Frame the face while preserving a clear forehead opening.
        for x in [-.245,.245]:b.capsule('Loose hair lock',(x,.035,1.48),(x,-.005,1.19),.066,C['brown'],'head',segments=8)
        b.capsule('Bonnet ribbon',(-.08,-.12,1.16),(.08,-.12,1.16),.022,C['cream'],'neck',segments=6)
    elif k=='villager-b':
        b.ellipsoid('Brown waistcoat',(0,-.013,.87),(.241,.16,.22),C['tan'],'chest',12,6)
        b.ellipsoid('Flat cap',(0,.02,1.73),(.30,.25,.09),C['brown'],'head',12,6)
        b.ellipsoid('Cap visor',(0,-.216,1.68),(.235,.115,.025),C['tan'],'head',12,4)
        b.ellipsoid('Gray beard',(0,-.177,1.28),(.114,.078,.057),C['linen'],'head',10,5)
        b.ellipsoid('Belt buckle',(0,-.165,.70),(.036,.012,.031),C['gold'],'hips',8,4)

def human_actions(rig):
    out=[]
    ts=[i/8 for i in range(9)]
    def curve(fn):return {t:fn(t) for t in ts}
    def r(fn):return {'rotation':curve(fn)}
    idle={'chest':r(lambda t:(.018*math.sin(t*math.tau),0,0)),'head':r(lambda t:(0,.012*math.sin(t*math.tau),.012*math.sin(t*math.tau))),
          'hips':{'location':curve(lambda t:(0,.006*(1-math.cos(t*math.tau)),0))}}
    out.append(create_action(rig,'idle',2,idle))
    for name,duration,amp in [('walk',1,.47),('run',.7,.78)]:
        p={'hips':{'location':curve(lambda t:(0,.018*(1-math.cos(t*math.tau*2)),0))},'chest':r(lambda t:(.08 if name=='run' else .015,0,.045*math.sin(t*math.tau)))}
        for side,phase in [('L',0),('R',math.pi)]:
            p['upper_leg.'+side]=r(lambda t,ph=phase:(amp*math.sin(t*math.tau+ph),0,0))
            p['lower_leg.'+side]=r(lambda t,ph=phase:(-.68*max(0,math.sin(t*math.tau+ph)),0,0))
            p['foot.'+side]=r(lambda t,ph=phase:(.12*math.sin(t*math.tau+ph),0,0))
            p['upper_arm.'+side]=r(lambda t,ph=phase:(-amp*.7*math.sin(t*math.tau+ph),0,0))
            p['lower_arm.'+side]=r(lambda t,ph=phase:(-.12-(.48 if name=='run' else .12)*max(0,-math.sin(t*math.tau+ph)),0,0))
        out.append(create_action(rig,name,duration,p))
    out.append(create_action(rig,'swing',.45,{
        'chest':{'rotation':{0:(0,0,0),.35:(-.13,0,-.16),.65:(.17,0,.16),1:(0,0,0)}},
        'upper_arm.R':{'rotation':{0:(0,0,0),.35:(-2.0,0,-.18),.65:(.45,0,-.08),1:(0,0,0)}},
        'lower_arm.R':{'rotation':{0:(0,0,0),.35:(-.55,0,0),.65:(-.10,0,0),1:(0,0,0)}},
        'upper_arm.L':{'rotation':{0:(0,0,0),.35:(-.25,0,.20),.65:(.18,0,.12),1:(0,0,0)}}}))
    out.append(create_action(rig,'talk',2,{'head':r(lambda t:(.04*math.sin(t*math.tau),0,0)),
        'upper_arm.R':r(lambda t:(-.22*(1-math.cos(t*math.tau)),0,-.10*(1-math.cos(t*math.tau)))),
        'lower_arm.R':r(lambda t:(-.18*(1-math.cos(t*math.tau)),0,0)),
        'upper_arm.L':r(lambda t:(-.10*(1-math.cos(t*math.tau)),0,.07*(1-math.cos(t*math.tau))))}))
    out.append(create_action(rig,'wave',1,{
        'upper_arm.R':{'rotation':{0:(0,0,0),.2:(-.20,0,2.0),.8:(-.20,0,2.0),1:(0,0,0)}},
        'lower_arm.R':{'rotation':{0:(0,0,0),.2:(-.2,0,-.2),.35:(-.2,0,.40),.5:(-.2,0,-.2),.65:(-.2,0,.4),.8:(-.2,0,-.2),1:(0,0,0)}}}))
    return out

def build_human(name):
    s=SPECS[name]; nominal=1.93 if name=='tamsin' else 1.7924 if name=='juniper' else 1.82 if name=='hero' else 1.895 if name=='gus' else 1.88 if name=='brack' else 1.915 if name=='mira' else 1.82
    k=s['height']/nominal;scale=(k*s['width'],k,k)
    b=Builder(name,scale);garments(b,s);face(b,s)
    rig=make_armature(name,humanoid_bones(scale));actions=human_actions(rig)
    return b,rig,actions,{'kind':'human','design_height_m':s['height'],'reference_status':'Compared with supplied sprite sheet and sprite-lineup.png; stylized low-poly 3D interpretation.'}
