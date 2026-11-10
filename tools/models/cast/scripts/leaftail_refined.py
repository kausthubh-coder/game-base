"""Refined sprite-informed leafy fox. Deliberate sculpted silhouettes, one palette."""
import math
from shared import Builder, make_armature, create_action

GREEN='#82934B'; DARK='#596F3B'; LIGHT='#A7AF60'; CREAM='#F0D9A3'; PAW='#C7AA77'; INK='#443C2A'

def _rings(b,label,rings,color,bone,n=12):
    # z, center x/y, x/y radii. Closed, hand-shaped horizontal contours.
    v=[];f=[]
    for z,x,y,rx,ry in rings:
        for i in range(n):
            a=math.tau*i/n;v.append((x+rx*math.cos(a),y+ry*math.sin(a),z))
    for j in range(len(rings)-1):
        for i in range(n):
            k=j*n+i;h=j*n+(i+1)%n;f.append((k,h,h+n,k+n))
    f.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+i for i in range(n))])
    b.mesh(label,v,f,color,bone)

def _pad(b,label,outline,y,depth,color,bone,bulge=.006):
    # Rounded closed sculpt from a custom planar silhouette, not a button sphere.
    cx=sum(p[0] for p in outline)/len(outline);cz=sum(p[1] for p in outline)/len(outline)
    n=len(outline);v=[(x,y,z) for x,z in outline]+[(cx+(x-cx)*.68,y-bulge,cz+(z-cz)*.68) for x,z in outline]+[(cx,y-bulge*1.18,cz),(cx,y+depth,cz)]
    f=[]
    for i in range(n):
        j=(i+1)%n;f.extend([(i,j,n+j,n+i),(n+i,n+j,2*n),(j,i,2*n+1)])
    b.mesh(label,v,f,color,bone)

def _oval(cx,cz,rx,rz,n=8):
    return [(cx+rx*math.cos(math.tau*i/n),cz+rz*math.sin(math.tau*i/n)) for i in range(n)]

def _almond(cx,cz,rx,rz,s):
    return [(cx-rx,cz-.002*s),(cx-rx*.70,cz+rz*.69),(cx-rx*.1,cz+rz),(cx+rx*.64,cz+rz*.72),(cx+rx,cz+.002*s),(cx+rx*.64,cz-rz*.65),(cx,cz-rz*.88),(cx-rx*.68,cz-rz*.62)]

def _ear(b,s):
    # Outer silhouette has broad rounded roots, curved edges and a softened apex.
    outline=[(.048,.529),(.082,.592),(.153,.681),(.173,.695),(.189,.678),(.213,.596),(.198,.542),(.134,.522)]
    _pad(b,'sculpted pointed ear',[(s*x,z) for x,z in outline],-.213,.085,GREEN,'head',.018)
    inner=[(.077,.553),(.105,.596),(.163,.663),(.174,.670),(.192,.594),(.180,.558),(.131,.541)]
    _pad(b,'warm recessed ear',[(s*x,z) for x,z in inner],-.237,.008,'#D0AA72','head',.004)
    inner2=[(.096,.560),(.121,.598),(.167,.649),(.179,.598),(.169,.567),(.133,.553)]
    _pad(b,'cream ear center',[(s*x,z) for x,z in inner2],-.244,.003,CREAM,'head',.002)

def _tail(b):
    # Swept leaf with alternating softened shoulders. Thick cambered volume,
    # many curved contour levels rather than intersecting diamond sheets.
    levels=[(.22,.01,.155,.028,.035),(.29,.065,.204,.071,.047),(.36,.12,.255,.128,.058),(.415,.145,.282,.151,.058),(.445,.155,.297,.141,.056),(.49,.175,.31,.157,.050),(.532,.195,.319,.138,.045),(.557,.211,.324,.115,.039),(.59,.231,.326,.119,.034),(.625,.25,.329,.077,.027),(.66,.273,.332,.040,.018),(.688,.298,.335,.002,.002)]
    _rings(b,'single sculpted broad curved leaf tail',levels,'#788D44','tail',10)
    # Surface veins follow the front camber, widths taper toward the tip.
    for i in range(len(levels)-1):
        a=levels[i];c=levels[i+1]
        w=.006*(1-i/13)
        b.mesh('tail center vein',[(a[1]-w,a[2]-a[4]-.002,a[0]),(a[1]+w,a[2]-a[4]-.002,a[0]),(c[1]+w,c[2]-c[4]-.002,c[0]),(c[1]-w,c[2]-c[4]-.002,c[0])],[(0,1,2,3)],LIGHT,'tail')
    for j in [3,5,7]:
        z,x,y,rx,ry=levels[j];a=levels[j-1]
        for s in [-1,1]:
            b.mesh('branch leaf vein',[(a[1],a[2]-a[4]-.003,a[0]),(a[1]+.006*s,a[2]-a[4]-.003,a[0]-.008),(x+s*rx*.82,y-ry*.57-.004,z+.015)],[(0,1,2)],'#9CAA58','tail')

def build_refined_leaftail():
    b=Builder('leaftail')
    bones=[('root',(0,0,0),(0,0,.08),None),('body',(0,0,.13),(0,0,.34),'root'),('head',(0,-.13,.34),(0,-.13,.52),'body'),('tail',(0,.14,.23),(.10,.28,.38),'body')]
    _tail(b)
    _rings(b,'compact pear shaped fox torso',[(.105,0,.02,.073,.11),(.15,0,.025,.133,.16),(.245,0,.02,.154,.17),(.32,0,-.025,.128,.137),(.37,0,-.07,.077,.085)],GREEN,'body',12)
    _pad(b,'cream tapered chest bib',[(-.10,.325),(-.08,.346),(0,.35),(.08,.346),(.10,.325),(.077,.239),(.042,.188),(0,.173),(-.042,.188),(-.077,.239)],-.139,.06,CREAM,'body',.035)
    for side,x in [('L',.11),('R',-.11)]:
        for leg,y in [('front',-.105),('hind',.115)]:
            bone=leg+'.'+side;bones.append((bone,(x,y,.19),(x,y,.04),'body'))
            _rings(b,'tapered '+bone,[(.035,x,y-.01,.037,.042),(.085,x,y,.039,.043),(.145,x,y+.012,.046,.048),(.20,x,y+.013,.044,.052)],GREEN,bone,8)
            _rings(b,'soft grounded paw '+bone,[(0.0,x,y-.029,.035,.043),(.025,x,y-.033,.049,.064),(.052,x,y-.022,.046,.056),(.074,x,y-.005,.031,.035)],PAW,bone,8)
            # Restrained paired toe grooves on the front surface.
            for dx in [-.012,.012]:
                b.mesh('toe crease',[(x+dx-.0018,y-.09,.025),(x+dx+.0018,y-.09,.025),(x+dx+.0015,y-.075,.045),(x+dx-.0015,y-.075,.045)],[(0,1,2,3)],'#9B8056',bone)
    _rings(b,'sculpted oversized fox head',[(.325,0,-.194,.058,.069),(.35,0,-.202,.119,.102),(.402,0,-.202,.175,.128),(.465,0,-.199,.182,.136),(.52,0,-.185,.149,.122),(.558,0,-.17,.095,.08),(.571,0,-.165,.025,.024)],GREEN,'head',14)
    for s in [-1,1]:
        _ear(b,s)
        # Sweeping cheek fan with separate tips and a broad connecting root.
        outline=[(.105,.445),(.159,.457),(.204,.438),(.184,.418),(.216,.403),(.179,.386),(.188,.367),(.137,.372),(.093,.399)]
        _pad(b,'leafy swept cheek tufts',[(s*x,z) for x,z in outline],-.274,.085,GREEN,'head',.018)
        cx=s*.078;cz=.462
        _pad(b,'dark almond eye socket',_almond(cx,cz,.046,.050,s),-.323,.008,DARK,'head',.005)
        _pad(b,'cream eye rim',_almond(cx,cz,.040,.044,s),-.328,.003,CREAM,'head',.002)
        _pad(b,'warm amber almond iris',_almond(cx,cz,.029,.039,s),-.332,.002,'#B78B42','head',.001)
        _pad(b,'tall fox pupil',_oval(cx+s*.003,cz+.003,.014,.031),-.335,.001,INK,'head',.0005)
        _pad(b,'eye catchlight',_oval(cx-.007,cz+.019,.007,.009,6),-.338,.001,'#FFF9D8','head',.0003)
        _pad(b,'soft brow leaf',[(s*.042,.526),(s*.063,.54),(s*.094,.532),(s*.113,.516),(s*.085,.518)],-.291,.01,LIGHT,'head',.005)
    _pad(b,'continuous cream lower fox face',[(-.154,.397),(-.128,.417),(-.078,.421),(-.034,.409),(0,.404),(.034,.409),(.078,.421),(.128,.417),(.154,.397),(.137,.367),(.087,.346),(0,.337),(-.087,.346),(-.137,.367)],-.318,.035,CREAM,'head',.022)
    # Central muzzle blends across cream cheek lobes and ends in tiny fox nose.
    _pad(b,'muzzle bridge',[(-.042,.411),(0,.423),(.042,.411),(.045,.383),(0,.368),(-.045,.383)],-.347,.02,'#F4DEAD','head',.012)
    _pad(b,'little triangular fox nose',[(-.018,.409),(-.012,.416),(.012,.416),(.018,.409),(.008,.397),(0,.394),(-.008,.397)],-.366,.005,INK,'head',.004)
    for s in [-1,1]:
        b.mesh('gentle fox smile',[(0,-.367,.395),(s*.003,-.367,.382),(s*.021,-.36,.378),(s*.032,-.356,.385),(s*.021,-.361,.382),(s*.005,-.368,.385)],[(0,1,5),(1,2,4,5),(2,3,4)],'#806446','head')
    rig=make_armature('leaftail',bones)
    actions=[]
    for clip,duration in [('idle',2.),('walk',1.),('special',1.5)]:
        poses={}
        def setkey(bone,channel,t,value):poses.setdefault(bone,{}).setdefault(channel,{})[t]=value
        for i in range(9):
            t=i/8;wave=math.sin(math.tau*t);hop=(1-math.cos(math.tau*t))/2
            setkey('tail','rotation',t,(.035*wave,.10*wave,(.22 if clip!='special' else .48)*wave))
            setkey('head','rotation',t,(-.025*wave if clip!='special' else -.13*hop,0,.025*wave))
            setkey('body','location',t,(0,.006*hop if clip=='idle' else .010*hop,0))
            if clip=='walk':
                for bone,phase in [('front.L',1),('front.R',-1),('hind.L',-1),('hind.R',1)]:setkey(bone,'rotation',t,(.34*phase*wave,0,0))
            if clip=='special':
                setkey('root','location',t,(0,.085*hop,0))
                for bone in ['front.L','front.R']:setkey(bone,'rotation',t,(-.33*hop,0,0))
        actions.append(create_action(rig,clip,duration,poses))
    triangles=sum(len(f)-2 for f in b.faces)
    return b,rig,actions,{'kind':'creature','name':'leaftail','forward':'-Y','up':'Z','clips':['idle','walk','special'],'design':'Sculpted ring contours, cambered serrated leaf tail, almond amber eyes, shaped cheek fans, inset ears, tapered limbs and grounded paws.','source_triangles':triangles}
