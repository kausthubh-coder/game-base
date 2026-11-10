"""Hand-designed mesh sections for the refined hero; compatible 18-bone skeleton."""
import math
from mathutils import Vector
from shared import Builder,make_armature
from humans import humanoid_bones,human_actions
P={'skin':'F1BF8D','shadow':'D79166','cream':'F5DFAD','cloth':'E9D1A2','cape':'BE8C4D','capeLight':'D7AB6E','capeEdge':'99693C','fur':'F6E3B6','hair':'6D3E2A','hairLight':'8D5233','dark':'3D2830','pants':'72503C','boot':'573B34','gold':'D6A344','iris':'BB7F37','white':'FFF2D3','rose':'D88E72'}

def rings(b,label,sections,color,bone,segments=12,weights=None):
    """Horizontal elliptical sections (x,y,z,rx,ry), with smooth profile."""
    vs=[];fs=[]
    for x,y,z,rx,ry in sections:
        for i in range(segments):
            t=i*math.tau/segments;vs.append((x+rx*math.cos(t),y+ry*math.sin(t),z))
    for j in range(len(sections)-1):
        for i in range(segments):
            a=j*segments+i;n=j*segments+(i+1)%segments;fs.append((a,n,n+segments,a+segments))
    fs.append(tuple(reversed(range(segments))));fs.append(tuple(range((len(sections)-1)*segments,len(sections)*segments)))
    first=len(b.verts);b.mesh(label,vs,fs,P.get(color,color),bone)
    if weights:
        for j,w in enumerate(weights):
            for i in range(segments):b.weights[first+j*segments+i]=w

def tube(b,label,points,radii,color,bone,segments=8,weights=None):
    vs=[];fs=[]
    for j,(p,r) in enumerate(zip(points,radii)):
        direction=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        q=Vector((0,0,1)).rotation_difference(direction.normalized())
        for i in range(segments):
            t=i*math.tau/segments;vs.append(tuple(Vector(p)+q@Vector((r*math.cos(t),r*math.sin(t),0))))
    for j in range(len(points)-1):
        for i in range(segments):
            a=j*segments+i;n=j*segments+(i+1)%segments;fs.append((a,n,n+segments,a+segments))
    fs.append(tuple(reversed(range(segments))));fs.append(tuple(range((len(points)-1)*segments,len(points)*segments)))
    start=len(b.verts);b.mesh(label,vs,fs,P.get(color,color),bone)
    if weights:
        for j,w in enumerate(weights):
            for i in range(segments):b.weights[start+j*segments+i]=w

def eye_disc(b,label,x,y,z,rx,rz,color,tilt=0,segments=14):
    v=[(x,y,z)]
    for i in range(segments):
        t=i*math.tau/segments;dx=rx*math.cos(t);dz=rz*math.sin(t);v.append((x+dx,y+.016*(dx/.058)**2,z+dz+tilt*dx))
    b.mesh(label,v,[(0,1+i,1+(i+1)%segments) for i in range(segments)],P[color],'head')

def head(b):
    # Pear-shaped jaw, broad cheeks, curved forehead. Deliberate facial planes.
    rings(b,'Sculpted chibi face',[(0,0,1.145,.075,.065),(0,-.012,1.20,.17,.15),(0,-.008,1.29,.24,.205),(0,.003,1.40,.283,.239),(0,.012,1.52,.285,.244),(0,.025,1.63,.24,.205),(0,.026,1.70,.15,.13),(0,.03,1.73,.03,.025)],'skin','head',segments=18)
    for s in [-1,1]:
        b.ellipsoid('Ear',(s*.281,.012,1.406),(.047,.034,.061),P['skin'],'head',8,5)
        b.ellipsoid('Ear inner',(s*.299,-.012,1.407),(.022,.012,.033),P['shadow'],'head',6,4)
        x=s*.100
        for label,y,rx,rz,col in [('Eye contour',-.234,.058,.074,'dark'),('Eye white',-.240,.050,.063,'white'),('Amber iris',-.247,.035,.055,'iris'),('Pupil',-.253,.023,.045,'dark')]:eye_disc(b,label,x,y,1.427,rx,rz,col,tilt=-s*.08)
        eye_disc(b,'Catchlight',x-.012,-.259,1.451,.010,.014,'white',segments=8)
        eye_disc(b,'Warm blush',s*.176,-.199,1.349,.033,.012,'rose',segments=10)
        tube(b,'Expressive brow',[(x-.045,-.206,1.523),(x,-.222,1.539),(x+.036,-.213,1.533)],[.008,.011,.006],'hair','head',segments=5)
    b.ellipsoid('Small warm nose',(0,-.239,1.358),(.024,.027,.025),P['skin'],'head',8,5)
    tube(b,'Gentle smile',[(-.028,-.214,1.303),(0,-.222,1.295),(.028,-.214,1.303)],[.005,.006,.005],'dark','head',segments=5)
    # Hair cap hugs the skull; the lower edge leaves the whole face visible.
    seg=16;v=[(0,.045,1.79)];f=[]
    for j in range(1,5):
        for i in range(seg):
            a=math.tau*i/seg;front=max(0,-math.sin(a));back=max(0,math.sin(a));bottom=1.37+.25*front-.1*back
            t=j/4;rr=math.sin(t*1.75)
            v.append((.302*rr*math.cos(a),.045+.254*rr*math.sin(a),1.79+(bottom-1.79)*t*t))
    for i in range(seg):f.append((0,1+i,1+(i+1)%seg))
    for j in range(3):
        for i in range(seg):a=1+j*seg+i;n=1+j*seg+(i+1)%seg;f.append((a,a+seg,n+seg,n))
    b.mesh('Layered hair cap',v,f,P['hair'],'head')
    # Soft six-sided tapered tufts, rather than cylinders or flat shards.
    locks=[((-.20,-.12,1.69),(-.20,-.205,1.58),(-.245,-.188,1.48),.072),
           ((-.13,-.12,1.72),(-.10,-.23,1.62),(-.13,-.247,1.49),.079),
           ((-.035,-.12,1.74),(.015,-.22,1.65),(-.005,-.255,1.55),.073),
           ((.085,-.10,1.73),(.15,-.205,1.64),(.145,-.245,1.53),.078),
           ((.19,-.04,1.68),(.25,-.13,1.56),(.24,-.17,1.43),.068),
           ((-.11,.045,1.70),(-.19,.045,1.78),(-.24,.05,1.76),.066),
           ((0,.05,1.73),(.055,.06,1.82),(.10,.05,1.84),.067),
           ((.17,.10,1.68),(.255,.10,1.74),(.29,.12,1.71),.062)]
    for i,(a,c,t,r) in enumerate(locks):tube(b,'Swept chunky lock '+str(i),[a,c,t],[r*.85,r,.006],'hairLight' if i in [1,5] else 'hair','head',segments=6)

def cape(b):
    n=15;v=[];f=[]
    for inside in [False,True]:
        for j,(rx,ry,z) in enumerate([(.133,.105,1.145),(.288,.172,1.09),(.345,.210,.99),(.365,.231,.84)]):
            for i in range(n+1):
                t=math.radians(-56+292*i/n);front=max(0,-math.sin(t));back=max(0,math.sin(t))
                zz=z+(.028*front-.09*back if j==3 else 0)
                v.append(((rx-(.009 if inside else 0))*math.cos(t),(ry-(.009 if inside else 0))*math.sin(t)+.026,zz))
    layer=4*(n+1)
    for j in range(3):
        for i in range(n):
            a=j*(n+1)+i;f.append((a,a+1,a+1+n+1,a+n+1));a+=layer;f.append((a,a+n+1,a+n+2,a+1))
    for j in range(3):
        for i in [0,n]:a=j*(n+1)+i;f.append((a,a+n+1,a+n+1+layer,a+layer))
    for i in range(n):a=3*(n+1)+i;f.append((a,a+layer,a+layer+1,a+1))
    b.mesh('Soft open travel mantle',v,f,P['cape'],'chest')
    # Dark hem is a narrow color band with a genuine silhouette edge.
    for s in [-1,1]:tube(b,'Cape seam',[(s*.075,-.064,1.145),(s*.161,-.117,1.09),(s*.193,-.148,.99),(s*.204,-.165,.864)],[.010]*4,'capeEdge','chest',segments=5)
    for i in range(8):
        a=math.tau*i/8;b.ellipsoid('Soft collar tuft',(math.cos(a)*.15,math.sin(a)*.11,1.137),(.074,.059,.053),P['fur'],'chest',8,4)
    b.ellipsoid('Mantle clasp',(0,-.128,1.107),(.032,.013,.029),P['gold'],'chest',8,4)

def body(b):
    rings(b,'Cream tunic',[(0,0,.63,.18,.12),(0,0,.69,.217,.145),(0,.005,.82,.22,.15),(0,.005,.96,.24,.156),(0,.005,1.065,.219,.13),(0,0,1.105,.13,.105)],'cream','chest',12)
    rings(b,'Trouser seat',[(0,0,.55,.183,.125),(0,0,.62,.23,.145),(0,0,.70,.207,.143)],'pants','hips',12)
    b.capsule('Neck',(0,0,1.06),(0,0,1.205),.075,P['skin'],'neck',segments=8)
    for side,s in [('L',1),('R',-1)]:
        upper='upper_leg.'+side;lower='lower_leg.'+side
        rings(b,'Flowing trousers '+side,[(s*.13,0,.125,.071,.070),(s*.13,0,.22,.078,.083),(s*.13,0,.34,.086,.088),(s*.13,0,.43,.09,.092),(s*.13,0,.645,.093,.099)],'pants',upper,10,[lower,lower,{upper:.5,lower:.5},upper,upper])
        # Shaped boots taper at the ankle and widen gently over the toe.
        rings(b,'Soft boot '+side,[(s*.13,-.063,.015,.086,.132),(s*.13,-.066,.045,.097,.145),(s*.13,-.055,.085,.096,.138),(s*.13,-.012,.135,.079,.082),(s*.13,0,.19,.078,.077)],'boot','foot.'+side,10)
        rings(b,'Boot sole '+side,[(s*.13,-.065,0,.087,.13),(s*.13,-.065,.021,.093,.139)],'dark','foot.'+side,10)
        a='upper_arm.'+side;l='lower_arm.'+side
        pts=[(s*.23,0,1.07),(s*.267,0,1.015),(s*.305,0,.935),(s*.335,0,.86),(s*.36,-.009,.775),(s*.385,-.014,.69)]
        tube(b,'Continuous sleeve '+side,pts,[.066,.086,.078,.066,.061,.055],'cloth',a,8,[a,a,a,{a:.5,l:.5},l,l])
        tube(b,'Rolled cuff '+side,[(s*.38,-.014,.716),(s*.39,-.018,.68)],[.061,.060],'cream',l,8)
        b.ellipsoid('Mitten hand '+side,(s*.397,-.022,.633),(.061,.054,.075),P['skin'],'hand.'+side,8,5)
        b.ellipsoid('Thumb '+side,(s*.362,-.055,.638),(.026,.028,.041),P['skin'],'hand.'+side,6,4)
    rings(b,'Leather belt',[(0,0,.674,.222,.150),(0,0,.725,.224,.151)],'boot','hips',14)
    # Raised gold buckle with dark inset rather than a floating button.
    b.ellipsoid('Buckle frame',(0,-.157,.702),(.045,.014,.034),P['gold'],'hips',8,4)
    b.ellipsoid('Buckle inset',(0,-.17,.702),(.024,.006,.018),P['boot'],'hips',8,4)
    tube(b,'Diagonal leather strap',[(.14,-.15,1.08),(.062,-.163,.96),(-.06,-.169,.83),(-.19,-.15,.70)],[.018]*4,'boot','chest',6)
    # Satchel pocket with a separate flap and clasp, sitting at the left hip.
    rings(b,'Shaped satchel',[(-.245,-.04,.49,.07,.05),(-.245,-.04,.52,.10,.075),(-.245,-.04,.65,.104,.077),(-.245,-.04,.70,.087,.065)],'capeEdge','hips',10)
    b.ellipsoid('Satchel flap',(-.245,-.106,.664),(.096,.019,.047),P['cape'],'hips',10,4)
    b.ellipsoid('Satchel stud',(-.245,-.127,.649),(.015,.008,.016),P['gold'],'hips',6,4)

def build_refined_hero():
    scale=(.97,.97,.97)
    b=Builder('hero',scale);body(b);cape(b);head(b)
    rig=make_armature('hero',humanoid_bones(scale));actions=human_actions(rig)
    return b,rig,actions,{'kind':'human','revision':'refined','reference_status':'Refined against supplied hero sprite: sculpted face, expressive eyes, swept hair, continuous sleeves/trousers, open mantle and satchel.'}
