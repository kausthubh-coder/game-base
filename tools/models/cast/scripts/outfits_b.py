"""Distinct sprite-observed townfolk tailoring, authored in shared body coordinates."""
import math
from hero_refined import rings, tube


def _panel(b,label,outline,color,bone='chest',depth=.012):
    # A closed beveled plate: quiet broad planes, not stacked accessory spheres.
    n=len(outline);cx=sum(v[0] for v in outline)/n;cy=sum(v[1] for v in outline)/n;cz=sum(v[2] for v in outline)/n
    v=list(outline)+[(cx+(x-cx)*.84,y-depth,cz+(z-cz)*.90) for x,y,z in outline]
    f=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    f.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    b.mesh(label,v,f,color,bone)


def _coat(b,label,rows,color,bone='chest',gap=.30,n=12):
    # Open-front shell, including an inner surface and rolled-looking boundaries.
    v=[];f=[]
    for inner in [False,True]:
        for z,rx,ry in rows:
            if bone!='head':rx+=.014;ry+=.028
            for i in range(n+1):
                a=-math.pi/2+gap+(math.tau-2*gap)*i/n
                v.append(((rx-(.009 if inner else 0))*math.cos(a),.018+(ry-(.009 if inner else 0))*math.sin(a),z))
    step=n+1;layer=step*len(rows)
    for j in range(len(rows)-1):
        for i in range(n):
            a=j*step+i;f.extend([(a,a+1,a+step+1,a+step),(a+layer,a+layer+step,a+layer+step+1,a+layer+1)])
        for i in [0,n]:
            a=j*step+i;f.append((a,a+step,a+step+layer,a+layer))
    for j in [0,len(rows)-1]:
        for i in range(n):
            a=j*step+i;f.append((a,a+layer,a+layer+1,a+1))
    b.mesh(label,v,f,color,bone)


def _fringe(b,p,gray=False):
    col=p['hair'];light=p.get('hairLight',col)
    for i,(x,z,dx) in enumerate([(-.19,1.60,-.025),(-.09,1.67,-.035),(.035,1.69,-.045),(.16,1.65,.025)]):
        tube(b,'Broad groomed fringe '+str(i),[(x,-.15,z+.055),(x,-.236,z),(x+dx,-.249,z-.075)],[.065,.070,.008],light if i==1 else col,'head',6)


def _collar(b,color):
    for s in [-1,1]:
        _panel(b,'Folded collar',[(s*.025,-.137,1.16),(s*.15,-.108,1.12),(s*.19,-.145,1.035),(s*.09,-.174,1.075)],color)


def _pocket(b,x,z,color,bone='chest'):
    _panel(b,'Deep rounded patch pocket',[(x-.067,-.168,z+.064),(x+.067,-.168,z+.064),(x+.071,-.177,z-.035),(x+.045,-.184,z-.067),(x-.045,-.184,z-.067),(x-.071,-.177,z-.035)],color,bone,.025)
    _panel(b,'Pocket flap',[(x-.071,-.195,z+.067),(x+.071,-.195,z+.067),(x+.055,-.204,z+.026),(x,-.209,z+.015),(x-.055,-.204,z+.026)],'C29A60',bone,.009)


def _wren(b,p):
    _coat(b,'Pet keeper olive work jacket',[(.58,.249,.166),(.72,.239,.172),(.99,.252,.177),(1.09,.205,.138)],p['cloth'],gap=.22)
    _collar(b,'C59A51')
    for s in [-1,1]:
        _pocket(b,s*.155,.696,'94703F')
    # The little perched companion is present in the sprite, a readable silhouette accent.
    b.ellipsoid('Shoulder chick body',(-.257,-.023,1.169),(.047,.052,.063),'E6C875','chest',8,4)
    b.ellipsoid('Shoulder chick head',(-.267,-.041,1.228),(.035,.035,.037),'F7DC8A','chest',8,4)
    b.ellipsoid('Chick eye',(-.283,-.071,1.233),(.006,.005,.008),p['dark'],'chest',6,3)
    for x in [-.272,-.247]:tube(b,'Chick feet',[(x,-.026,1.118),(x,-.026,1.078),(x,-.045,1.078)],[.004,.005,.004],'BD8640','chest',5)
    tube(b,'Chick beak',[(-.272,-.070,1.215),(-.274,-.103,1.212)],[.014,.001],'BD8640','chest',5)
    _panel(b,'Jacket center facing',[(-.025,-.163,1.05),(.025,-.163,1.05),(.025,-.171,.78),(-.025,-.171,.78)],'B28D57')
    for z in [.97,.87]:b.ellipsoid('Jacket brass fastening',(0,-.184,z),(.012,.009,.013),p['gold'],'chest',6,3)


def _juniper(b,p):
    _coat(b,'Round playful travel cloak',[(.57,.355,.234),(.73,.325,.213),(.99,.29,.185),(1.15,.128,.108)],'BC9653',gap=.40)
    # One curved broad hood resting behind the neck, plus distinctive red neckerchief.
    _coat(b,'Folded back hood',[(1.04,.18,.152),(1.14,.17,.144),(1.20,.12,.11)],'D0AD68',gap=.85,n=10)
    rings(b,'Red scarf collar',[(0,-.005,1.125,.125,.11),(0,-.005,1.18,.117,.10)],'A4513D','chest',10)
    _panel(b,'Red scarf pointed tail',[(.018,-.124,1.14),(.09,-.139,1.12),(.081,-.188,.99),(.04,-.192,.94),(.013,-.178,1.02)],'A4513D')
    _panel(b,'Green cloak patch',[(-.27,-.135,.79),(-.205,-.173,.78),(-.217,-.177,.69),(-.292,-.14,.70)],'7A8055')
    _panel(b,'Rust cloak patch',[(.24,-.164,.71),(.30,-.13,.70),(.31,-.13,.63),(.25,-.17,.64)],'A66A4B')


def _brack(b,p):
    _fringe(b,p)
    _coat(b,'Long navy traveling coat',[(.31,.26,.169),(.49,.263,.17),(.77,.238,.168),(1.075,.227,.154)],'41404B',gap=.30)
    _collar(b,'7F6440')
    rings(b,'Mustard woven neck wrap',[(0,0,1.105,.14,.117),(0,0,1.165,.125,.108)],'A88643','chest',10)
    _panel(b,'Long mustard scarf',[(.01,-.147,1.115),(.08,-.154,1.10),(.10,-.186,.76),(.04,-.188,.70),(.005,-.174,.78)],'9E7A3C')
    # A soft conical woven brim with doubled edge and a small crown button.
    rings(b,'Reed hat broad brim',[(0,.035,1.68,.445,.356),(0,.035,1.704,.457,.366),(0,.035,1.75,.386,.303),(0,.035,1.84,.225,.18),(0,.035,1.93,.075,.063),(0,.035,1.951,.053,.044)],'B68D4B','head',16)
    rings(b,'Reed hat bound rim',[(0,.035,1.675,.444,.356),(0,.035,1.699,.458,.368)],'79603F','head',16)
    rings(b,'Reed crown band',[(0,.035,1.903,.125,.101),(0,.035,1.923,.094,.077)],'D1AF68','head',12)
    for s in [-1,1]:tube(b,'Hat chin cord',[(s*.31,.005,1.69),(s*.267,-.088,1.36),(s*.13,-.12,1.17)],[.008,.008,.008],'B69A5E','head',5)
    tube(b,'Diagonal coat cord',[(.17,-.16,1.08),(-.16,-.187,.69)],[.013,.013],'A58146','chest',6)
    for z in [.96,.87,.78]:
        tube(b,'Braided coat frog',[(-.12,-.173,z),(-.035,-.191,z-.025),(.105,-.173,z+.005)],[.007,.009,.007],'B08D4B','chest',5)


def _villager_a(b,p):
    _fringe(b,p)
    rings(b,'Soft full russet skirt',[(0,.014,.31,.29,.183),(0,.012,.35,.303,.195),(0,.01,.55,.255,.169),(0,.005,.73,.205,.147)],'70463E','hips',14)
    # Apron follows skirt profile, with a broad curved bottom rather than a flat rectangle.
    _panel(b,'Cream linen apron',[(-.135,-.151,.78),(.135,-.151,.78),(.17,-.182,.56),(.207,-.177,.39),(.13,-.206,.365),(-.13,-.206,.365),(-.207,-.177,.39),(-.17,-.182,.56)],'E9CBA0','hips',.013)
    _panel(b,'Apron bib',[(-.09,-.16,1.025),(.09,-.16,1.025),(.114,-.175,.79),(-.114,-.175,.79)],'F2D8B0')
    for s in [-1,1]:tube(b,'Apron shoulder strap',[(s*.09,-.175,.89),(s*.105,-.149,1.095),(s*.11,.10,1.09)],[.019,.019,.019],'E6C69D','chest',5)
    # Headkerchief shell has a face opening and drops down the back.
    _coat(b,'Rust headkerchief',[(1.30,.285,.246),(1.55,.325,.278),(1.77,.258,.232),(1.845,.045,.042)],'A86850','head',gap=.72,n=12)
    for s in [-1,1]:
        tube(b,'Kerchief face binding',[(s*.105,-.166,1.79),(s*.25,-.202,1.66),(s*.269,-.151,1.38)],[.015,.019,.018],'BC8060','head',6)
        tube(b,'Soft side braid',[(s*.256,.005,1.34),(s*.257,-.01,1.19),(s*.225,-.055,1.08)],[.052,.058,.025],p['hair'],'head',7)
    _panel(b,'Kerchief rear bow',[(-.17,.279,1.31),(0,.31,1.25),(.17,.279,1.31),(.12,.29,1.16),(0,.31,1.23),(-.12,.29,1.16)],'995540','head',-.015)


def _villager_b(b,p):
    _fringe(b,p)
    _coat(b,'Brown wool waistcoat',[(.70,.237,.165),(.87,.247,.17),(1.065,.221,.151)],'776044',gap=.26,n=10)
    _collar(b,'E9CCA0')
    for s in [-1,1]:_pocket(b,s*.15,.785,'665039')
    # Small projecting bill and generous rounded flat-cap crown.
    rings(b,'Soft taupe flat cap',[(0,.025,1.647,.29,.244),(0,.025,1.688,.323,.271),(0,.045,1.785,.295,.247),(0,.055,1.851,.20,.174),(0,.06,1.88,.04,.035)],'8F744B','head',14)
    rings(b,'Cap lower binding',[(0,.022,1.637,.294,.246),(0,.022,1.679,.307,.257)],'67553D','head',14)
    _panel(b,'Curved cap bill',[(-.27,-.125,1.67),(-.18,-.29,1.65),(0,-.326,1.637),(.18,-.29,1.65),(.27,-.125,1.67),(.12,-.172,1.69),(-.12,-.172,1.69)],'6F593E','head',.014)
    # Quiet gray stubble shapes follow jaw and leave the smile clearly readable.
    for s in [-1,1]:
        tube(b,'Gray jaw stubble',[(s*.215,-.137,1.345),(s*.166,-.177,1.25),(s*.072,-.171,1.205)],[.024,.035,.023],'9B9382','head',6)
    tube(b,'Gray chin stubble',[(-.067,-.17,1.205),(0,-.183,1.19),(.067,-.17,1.205)],[.023,.028,.023],'AAA08A','head',6)


def add_outfit(b,name,palette):
    fn={'wren':_wren,'juniper':_juniper,'brack':_brack,'villager-a':_villager_a,'villager-b':_villager_b}.get(name.lower())
    if fn:fn(b,palette)
