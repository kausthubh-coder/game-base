"""Sprite-observed clothing silhouettes for the mentor, royal, and village trades."""
import math
from hero_refined import rings,tube

def _dot(b,label,pos,size,c,bone='head',seg=8):
    b.ellipsoid(label,pos,size,c,bone,seg,4)

def _panel(b,label,rows,color,bone='chest',n=6):
    # Bowed fabric front, substantial rolled side walls instead of a floating plane.
    vs=[];fs=[]
    for back in (0,.012):
        for z,w,y in rows:
            for i in range(n+1):
                x=w*(2*i/n-1);vs.append((x,y+.035*(x/w)**2+back,z))
    sz=len(rows)*(n+1)
    for k in (0,sz):
        for j in range(len(rows)-1):
            for i in range(n):
                a=k+j*(n+1)+i;fs.append((a,a+1,a+n+2,a+n+1) if k==0 else (a,a+n+1,a+n+2,a+1))
    for j in range(len(rows)-1):
        for i in (0,n):a=j*(n+1)+i;fs.append((a,a+sz,a+n+1+sz,a+n+1))
    for j in (0,len(rows)-1):
        for i in range(n):a=j*(n+1)+i;fs.append((a,a+1,a+1+sz,a+sz))
    b.mesh(label,vs,fs,color,bone)

def _fringe(b,p,style='parted'):
    for s in (-1,1):
        tube(b,'Broad parted fringe',[(s*.025,-.12,1.73),(s*.135,-.225,1.65),(s*.21,-.219,1.51)],[.07,.075,.014],p['hairLight'] if s==-1 else p['hair'],'head',6)
        tube(b,'Soft temple lock',[(s*.22,-.045,1.64),(s*.278,-.09,1.49),(s*.265,-.06,1.34)],[.065,.06,.015],p['hair'],'head',6)

def _hat(b,p,straw=False):
    n=16;vs=[];fs=[]
    # Crown-connected brim with sloping, wavy outside and closed underside.
    for rx,ry,z in [(.22,.20,1.73),(.31,.26,1.715),(.43,.35,1.645),(.436,.356,1.621),(.30,.25,1.69),(.22,.20,1.708)]:
        for i in range(n):
            a=math.tau*i/n;wave=.018*math.cos(3*a)+.016*math.cos(a)
            vs.append((rx*math.cos(a),.028+ry*math.sin(a),z+wave*(rx/.436)**2))
    for j in range(5):
        for i in range(n):a=j*n+i;c=j*n+(i+1)%n;fs.append((a,c,c+n,a+n))
    b.mesh('Wavy thick straw brim' if straw else 'Soft weathered hat brim',vs,fs,p['cream'] if straw else p['cape'],'head')
    rings(b,'Rounded hat crown',[(0,.025,1.715,.265,.225),(-.012,.035,1.80,.248,.207),(-.035,.045,1.89,.19,.17),(-.04,.045,1.925,.085,.08)],p['cape'] if straw else p['secondary'],'head',12)
    rings(b,'Leather hat band',[(0,.026,1.738,.265,.227),(-.006,.032,1.784,.253,.215)],p['boot'],'head',12)

def _tamsin(b,p):
    _hat(b,p);_fringe(b,p)
    # Feather is a solid curved quill with a broad vane.
    tube(b,'Cream hat feather',[(.21,.03,1.79),(.31,.035,1.88),(.35,.04,2.00)],[.026,.043,.002],p['cream'],'head',6)
    tube(b,'Feather shaft',[(.20,.005,1.77),(.30,.012,1.89),(.35,.018,2.00)],[.005,.006,.002],p['gold'],'head',5)
    # Open coat arc omits the front, retaining the readable trouser gap.
    n=12;vs=[];fs=[]
    for z,rx,ry in [(1.09,.205,.143),(.91,.25,.177),(.66,.254,.18),(.32,.315,.213),(.30,.30,.205)]:
        for i in range(n+1):
            a=math.radians(-56+292*i/n);vs.append((rx*math.cos(a),.02+ry*math.sin(a),z))
    for j in range(4):
        for i in range(n):a=j*(n+1)+i;fs.append((a,a+1,a+n+2,a+n+1))
    b.mesh('Long open travelling coat',vs,fs,p['cape'],'hips')
    for s in (-1,1):
        tube(b,'Coat lapel piping',[(s*.10,-.11,1.07),(s*.14,-.145,.87),(s*.145,-.143,.65),(s*.177,-.159,.33)],[.017,.019,.015,.013],p['secondary'],'chest',5)
        _dot(b,'Coat welt pocket',(s*.225,-.105,.54),(.052,.014,.065),p['boot'],'hips')
    rings(b,'Wrapped tan scarf',[(0,0,1.09,.145,.116),(0,0,1.16,.157,.126),(0,0,1.19,.12,.103)],p['cream'],'chest',10)
    _panel(b,'Hanging scarf end',[(1.12,.042,-.15),(.88,.04,-.185)],p['cream'],n=2)
    # Thick alternating plaits down the back, faithful to side/back reference.
    for i in range(6):
        _dot(b,'Interwoven silver braid',((.023 if i%2 else -.023),.252,1.36-i*.079),(.065,.052,.066),p['hairLight'] if i%2 else p['hair'],'head',6)
    rings(b,'Braid tie',[(0,.252,.892,.046,.042),(0,.252,.928,.046,.042)],p['boot'],'head',6)
    return 'Floppy feathered hat, silver braid, scarf, shaped open long coat.'

def _maren(b,p):
    rings(b,'Bell shaped green gown',[(0,0,.24,.302,.206),(0,0,.28,.319,.216),(0,0,.42,.29,.197),(0,0,.65,.229,.159),(0,0,.79,.223,.154)],p['cloth'],'hips',14)
    rings(b,'Gold dress hem',[(0,0,.24,.304,.209),(0,0,.265,.316,.214)],p['gold'],'hips',14)
    _panel(b,'Cream embroidered gown front',[(.29,.20,-.213),(.40,.195,-.207),(.67,.13,-.171),(.86,.116,-.168),(1.04,.125,-.15)],p['cream'],n=6)
    _fringe(b,p)
    # Long chestnut hair shell, broad sculpted silhouette behind shoulders.
    for s in (-1,1):
        tube(b,'Long wavy chestnut tress',[(s*.21,.07,1.62),(s*.29,.10,1.39),(s*.24,.12,1.16),(s*.275,.12,1.05)],[.078,.086,.074,.012],p['hair'],'head',7)
    rings(b,'Full rear hair curtain',[(0,.17,1.08,.18,.075),(0,.16,1.23,.25,.116),(0,.13,1.47,.25,.14),(0,.09,1.62,.20,.14)],p['hair'],'head',10)
    # Circlet follows forehead rather than being a crown floating above it.
    pts=[]
    for i in range(9):
        a=math.pi+math.pi*i/8;pts.append((.279*math.cos(a),.015+.254*math.sin(a),1.638+.025*abs(math.cos(a))))
    tube(b,'Golden royal circlet',pts,[.011]*9,p['gold'],'head',5)
    _dot(b,'Circlet central golden setting',(0,-.255,1.643),(.034,.014,.035),p['gold'])
    _dot(b,'Circlet green jewel',(0,-.270,1.644),(.017,.007,.021),p['accent'])
    _dot(b,'Neck brooch',(0,-.168,1.052),(.043,.013,.045),p['gold'],'chest')
    _dot(b,'Neck brooch jade',(0,-.181,1.052),(.029,.009,.030),p['accent'],'chest')
    # Rear cream sash bow, visibly distinct from hair.
    for s in (-1,1):_dot(b,'Cream sash bow',(s*.07,.182,.74),(.074,.022,.044),p['cream'],'hips')
    return 'Bell gown, cream front, gold hem, long chestnut hair and gem circlet.'

def _odo(b,p):
    for s in (-1,1):
        tube(b,'Brown baker suspender',[(s*.145,-.12,1.09),(s*.13,-.172,.91),(s*.14,-.18,.70)],[.024]*3,p['boot'],'chest',5)
    _panel(b,'Cream flour apron skirt',[(.39,.235,-.188),(.43,.253,-.19),(.70,.215,-.18)],p['cream'],'hips')
    _panel(b,'Apron bib',[(.69,.145,-.184),(.94,.13,-.182),(1.00,.11,-.165)],p['cream'])
    _panel(b,'Apron front pocket',[(.57,.091,-.211),(.69,.097,-.209)],p['fur'],'hips',4)
    for x,z,s in [(-.16,.48,.025),(.16,.53,.032),(.13,.43,.023),(-.13,.60,.02)]:
        _dot(b,'Soft flour dust patch',(x,-.202,z),(s,.006,s*.7),p['white'],'hips',6)
    for i in range(9):
        a=math.pi+math.pi*i/8;x=.265*math.cos(a);y=.045+.16*math.sin(a);z=1.65+.105*math.sin(i*math.pi/8)
        _dot(b,'Rounded baker curl',(x,y,z),(.072,.065,.069),p['hairLight'] if i%3==0 else p['hair'],'head',7)
    for s in (-1,1):_dot(b,'Apron back bow',(s*.065,.175,.72),(.07,.025,.041),p['cream'],'hips',6)
    return 'Curly hair, leather suspenders and tailored flour-dusted pocket apron.'

def _gus(b,p):
    _hat(b,p,True)
    _panel(b,'Blue overall bib',[(.70,.183,-.176),(.94,.16,-.175),(1.015,.14,-.15)],p['pants'])
    for s in (-1,1):
        tube(b,'Overall shoulder strap',[(s*.15,.115,1.05),(s*.17,.015,1.11),(s*.153,-.129,1.055),(s*.14,-.177,.94)],[.024]*4,p['pants'],'chest',5)
        _dot(b,'Brass overall button',(s*.14,-.194,.951),(.019,.008,.019),p['gold'],'chest',6)
        tube(b,'Thick friendly moustache',[(s*.008,-.262,1.327),(s*.055,-.275,1.314),(s*.094,-.239,1.323)],[.02,.032,.008],p['hair'],'head',6)
        tube(b,'Short hat fringe',[(s*.12,-.18,1.68),(s*.20,-.213,1.60),(s*.25,-.16,1.48)],[.055,.05,.01],p['hair'],'head',6)
    _panel(b,'Raised overall pocket',[(.78,.075,-.203),(.89,.08,-.202)],p['secondary'],n=4)
    tube(b,'Pocket upper stitching',[(-.076,-.213,.887),(0,-.214,.885),(.076,-.213,.887)],[.004]*3,p['cream'],'chest',5)
    return 'Wavy straw hat, workwear bib and straps, pocket and expressive moustache.'

def _mira(b,p):
    _fringe(b,p)
    rings(b,'Sculpted high coiled bun',[(0,.10,1.72,.11,.09),(0,.105,1.80,.14,.118),(-.01,.11,1.89,.12,.098),(-.025,.105,1.93,.057,.053)],p['hair'],'head',10)
    tube(b,'Bun curved highlight',[(-.09,.01,1.82),(-.06,-.005,1.88),(.015,-.002,1.90),(.073,.016,1.86)],[.011]*4,p['hairLight'],'head',5)
    tube(b,'Hair pencil',[(.20,-.02,1.48),(.34,-.02,1.63),(.39,-.02,1.685)],[.014,.014,.003],p['gold'],'head',6)
    for s in (-1,1):
        tube(b,'Folded blouse collar',[(s*.08,-.102,1.12),(s*.125,-.153,1.057),(s*.045,-.172,1.003)],[.025,.035,.012],p['secondary'],'chest',6)
    rings(b,'Leather tool pouch',[(-.255,-.055,.46,.057,.041),(-.255,-.055,.49,.078,.061),(-.255,-.055,.67,.075,.057)],p['boot'],'hips',8)
    tube(b,'Hammer wooden handle',[(.253,-.09,.46),(.253,-.09,.71)],[.017,.017],p['cape'],'hips',6)
    rings(b,'Hammer steel head',[(.253,-.09,.685,.061,.033),(.253,-.09,.74,.061,.033)],'9CA3A0','hips',8)
    tube(b,'Tool leather loop',[(.23,-.13,.65),(.28,-.13,.65)],[.018,.018],p['boot'],'hips',6)
    _dot(b,'Tape measure brass casing',(-.17,-.174,.705),(.050,.023,.045),p['gold'],'hips',8)
    _dot(b,'Tape measure center',(-.17,-.198,.705),(.027,.006,.025),p['boot'],'hips',7)
    b.mesh('Short measuring tape',[(-.186,-.198,.686),(-.160,-.198,.686),(-.148,-.199,.574),(-.174,-.199,.574)],[(0,1,2,3)],p['cream'],'hips')
    for i in range(4):
        z=.597+i*.022;b.mesh('Tape graduation',[(-.172,-.200,z),(-.159,-.200,z),(-.159,-.200,z+.003),(-.172,-.200,z+.003)],[(0,1,2,3)],p['boot'],'hips')
    return 'High coiled dark bun with pencil, plum collar, tool pouch, hammer and measuring tape.'

def add_outfit(b,name,palette):
    return {'outfit_notes':{'tamsin':_tamsin,'maren':_maren,'odo':_odo,'gus':_gus,'mira':_mira}[name](b,palette)}
