"""Sprite-informed sculpted moss creature and soft-winged lantern insect."""
import math
from shared import Builder,make_armature,create_action
from leaftail_refined import _rings,_pad,_oval

def line(b,label,a,c,w,col,bone):
    # Small closed tapered stems, antennae and legs, economical six-sided section.
    from mathutils import Vector
    a=Vector(a);c=Vector(c);d=(c-a).normalized();u=d.cross(Vector((0,1,0)))
    if u.length<.001:u=d.cross(Vector((1,0,0)))
    u.normalize();v=d.cross(u);vs=[]
    for p,r in [(a,w),(c,w*.8)]:
        for j in range(6):vs.append(tuple(p+r*(math.cos(j*math.tau/6)*u+math.sin(j*math.tau/6)*v)))
    b.mesh(label,vs,[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]+[tuple(reversed(range(6))),tuple(range(6,12))],col,bone)

def eye(b,x,y,z,rx,rz,bone):
    for label,s,col,yy in [('soft socket',1.23,'#465039',y),('warm eye rim',1.,'#C2A66C',y-.002),('dark gentle pupil',.68,'#332B25',y-.004)]:
        _pad(b,label,_oval(x,z,rx*s,rz*s,8),yy,.002,col,bone,.001)
    _pad(b,'cream catchlight',_oval(x-rx*.20,z+rz*.30,rx*.24,rz*.25,6),y-.007,.001,'#FFF1BC',bone,.0005)

def mossling():
    b=Builder('mossling');bones=[('root',(0,0,0),(0,0,.05),None),('body',(0,0,.09),(0,0,.29),'root'),('crown',(0,0,.41),(0,0,.51),'body')]
    # Puffy radial contours sculpt one continuous, gently lobed moss body.
    vs=[];fs=[];n=24
    levels=[(.055,.07,.065),(.09,.15,.11),(.15,.202,.15),(.23,.214,.17),(.31,.193,.155),(.375,.15,.12),(.418,.075,.065),(.426,.01,.01)]
    for j,(z,rx,ry) in enumerate(levels):
        for i in range(n):
            a=math.tau*i/n;lob=1+.045*math.cos(a*8+j*.6)
            vs.append((rx*math.cos(a)*lob,ry*math.sin(a)*lob,z+.006*math.cos(a*8+j*.6)))
    for j in range(len(levels)-1):
        for i in range(n):
            k=j*n+i;h=j*n+(i+1)%n;fs.append((k,h,h+n,k+n))
    fs.extend([tuple(reversed(range(n))),tuple((len(levels)-1)*n+i for i in range(n))]);b.mesh('continuous soft scalloped moss silhouette',vs,fs,'#718749','body')
    for s,side in [(1,'L'),(-1,'R')]:
        x=s*.091;bones.append(('foot.'+side,(x,0,.1),(x,-.02,.025),'root'))
        _rings(b,'rounded dark teddy foot',[(0,x,-.024,.039,.047),(.022,x,-.032,.051,.064),(.047,x,-.022,.045,.052),(.066,x,-.01,.028,.035)],'#514237','foot.'+side,8)
        _pad(b,'rounded brown teddy ear',_oval(s*.145,.396,.052,.059,10),-.015,.05,'#806846','body',.016)
        _pad(b,'warm inner ear',_oval(s*.145,.399,.032,.039,8),-.036,.012,'#BA9464','body',.006)
        _pad(b,'moss ear inset',_oval(s*.145,.395,.019,.026,8),-.045,.002,'#87914D','body',.003)
        eye(b,s*.058,-.165,.278,.019,.025,'body')
        _pad(b,'soft cheek dimple',_oval(s*.093,.244,.016,.008,6),-.160,.003,'#899752','body',.001)
    _pad(b,'little warm smile',[(-.017,.239),(-.008,.232),(0,.230),(.008,.232),(.017,.239),(.009,.235),(0,.234),(-.009,.235)],-.176,.002,'#45402D','body',.001)
    # Broad leaf scallops give layered foliage rather than loose spikes.
    for x,z,w,y,col in [(-.13,.315,.045,-.117,'#85994F'),(-.06,.378,.044,-.092,'#97A258'),(.025,.382,.045,-.10,'#85974C'),(.12,.34,.047,-.106,'#7D914A'),(-.16,.208,.04,-.104,'#617D43'),(.16,.215,.04,-.105,'#617D43'),(-.09,.13,.048,-.12,'#5B7740'),(0,.112,.042,-.12,'#657E42'),(.09,.13,.048,-.12,'#5B7740')]:
        _pad(b,'rounded layered moss tuft',[(x-w,z+.018),(x-w*.5,z+.032),(x+w*.5,z+.028),(x+w,z+.01),(x+w*.65,z-.018),(x+w*.25,z-.013),(x,z-.031),(x-w*.25,z-.013),(x-w*.65,z-.02)],y,.025,col,'body',.007)
    line(b,'two leaf sprout stem',(0,0,.416),(0,0,.49),.006,'#695C3E','crown')
    for s,col in [(-1,'#9AA757'),(1,'#84984B')]:
        pts=[(0,.482),(s*.026,.514),(s*.075,.541),(s*.111,.541),(s*.098,.516),(s*.064,.491),(s*.026,.483)]
        _pad(b,'soft sprout leaf',pts,-.004,.012,col,'crown',.008)
        line(b,'sprout midrib',(s*.012,-.015,.488),(s*.087,-.015,.529),.002,'#BBC275','crown')
    return b,make_armature('mossling',bones)

def lanternfly():
    b=Builder('lanternfly');bones=[('root',(0,0,0),(0,0,.03),None),('body',(0,0,.04),(0,0,.13),'root'),('glow',(0,.04,.09),(0,.1,.09),'body')]
    _rings(b,'warm sculpted amber lantern',[(.014,0,.024,.018,.021),(.025,0,.024,.045,.035),(.055,0,.024,.056,.044),(.086,0,.022,.05,.038),(.107,0,.018,.029,.026)],'#D7A447','glow',12)
    _pad(b,'soft golden lantern face',[(-.035,.036),(-.039,.061),(-.025,.08),(0,.085),(.025,.08),(.039,.061),(.035,.036),(0,.023)],-.018,.012,'#F1C76C','glow',.007)
    _rings(b,'dark thorax',[(.075,0,-.004,.022,.022),(.105,0,-.005,.041,.031),(.129,0,-.012,.031,.028)],'#7A5D36','body',10)
    _rings(b,'shaped broad chestnut head',[(.102,0,-.028,.018,.019),(.112,0,-.035,.041,.033),(.135,0,-.035,.053,.039),(.155,0,-.029,.047,.035),(.172,0,-.022,.024,.023)],'#665035','body',12)
    for s in [-1,1]:
        eye(b,s*.023,-.071,.140,.011,.013,'body')
        # Curved stems with club ends, clearly distinct from the wings.
        line(b,'lower antenna',(s*.022,-.023,.166),(s*.030,-.022,.192),.0032,'#60472E','body')
        line(b,'upper curved antenna',(s*.030,-.022,.192),(s*.049,-.018,.207),.0027,'#60472E','body')
        _pad(b,'warm antenna club',_oval(s*.050,.209,.007,.008,8),-.024,.011,'#D8AE5E','body',.002)
        for j,y in enumerate([-.013,.018,.045]):
            x=s*(.046 if j==0 else .052)
            line(b,'insect upper leg',(s*.028,y,.081-j*.013),(x,y-.004,.044-j*.006),.0032,'#6B5130','body')
            line(b,'insect foot',(x,y-.004,.044-j*.006),(x+s*.007,y-.014,.0025),.0025,'#6B5130','body')
        for label,y,scale,col in [('back',.043,.79,'#D3B374'),('front',.010,1.,'#F2DDA6')]:
            bn='wing.'+label+('.L' if s==1 else '.R');base=(s*.025,y,.109);bones.append((bn,base,(s*.10,y,.109),'body'))
            outline=[(.026,.112),(.035,.151),(.056,.198),(.083,.233),(.113,.25),(.135,.246),(.139,.228),(.129,.197),(.112,.163),(.086,.135),(.055,.115)]
            outline=[(s*(.025+(x-.025)*scale),.109+(z-.109)*scale) for x,z in outline]
            _pad(b,'rounded gold wing border',outline,y,.008,'#B79356',bn,.003)
            cx=sum(x for x,z in outline)/len(outline);cz=sum(z for x,z in outline)/len(outline)
            inside=[(cx+(x-cx)*.90,cz+(z-cz)*.93) for x,z in outline]
            _pad(b,'broad cream wing membrane',inside,y-.005,.002,col,bn,.002)
            def pt(x,z):return(s*(.025+(x-.025)*scale),y-.009,.109+(z-.109)*scale)
            line(b,'wing main vein',pt(.035,.124),pt(.125,.235),.0011,'#D2B77D',bn)
            for a,c in [((.064,.16),(.061,.197)),((.085,.186),(.117,.192))]:line(b,'delicate branching vein',pt(*a),pt(*c),.0008,'#D2B77D',bn)
    _pad(b,'friendly tiny insect smile',[(-.012,.119),(0,.115),(.012,.119),(.007,.115),(0,.113),(-.007,.115)],-.072,.001,'#B6955C','body',.0005)
    return b,make_armature('lanternfly',bones)

def build_other_creature(name):
    b,rig={'mossling':mossling,'lanternfly':lanternfly}[name]();actions=[]
    floor=min(v[2] for v in b.verts)
    b.verts=[(x,y,z-floor) for x,y,z in b.verts]
    for clip,duration in [('idle',2.),('walk',1.),('special',1.5)]:
        poses={}
        def key(bone,ch,t,val):poses.setdefault(bone,{}).setdefault(ch,{})[t]=val
        for i in range(17):
            t=i/16;wave=math.sin(math.tau*t);hop=(1-math.cos(math.tau*t))/2
            key('root','location',t,(0,(.025 if clip=='special' else .007)*hop if name=='lanternfly' else 0,0))
            if name=='mossling':
                key('crown','rotation',t,(.06*wave,0,(.25 if clip=='special' else .08)*wave))
                key('body','rotation',t,((.13 if clip=='special' else .025)*wave,0,(.23 if clip=='special' else .07 if clip=='walk' else .015)*wave))
                key('body','location',t,(0,(.014 if clip!='idle' else .004)*hop,0))
                for side,s in [('L',1),('R',-1)]:key('foot.'+side,'rotation',t,((.32 if clip=='walk' else 0)*wave*s,0,0))
            else:
                key('body','rotation',t,(.035*wave,0,.03*wave))
                for label in ['front','back']:
                    for side,s in [('L',1),('R',-1)]:key('wing.'+label+'.'+side,'rotation',t,((.32 if clip=='idle' else .55 if clip=='walk' else .8)*math.sin(math.tau*t*2),0,0))
        actions.append(create_action(rig,clip,duration,poses))
    return b,rig,actions,{'kind':'creature','name':name,'forward':'-Y','up':'Z','clips':['idle','walk','special'],'design':'Sculpted sprite silhouettes, warm layered eyes, restrained broad foliage or rounded veined wings.','source_triangles':sum(len(f)-2 for f in b.faces)}
