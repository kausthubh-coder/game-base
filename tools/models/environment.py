"""Solid field plants. All surfaces have volume; no alpha cards or billboards."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
import json
GREEN=['516b3c','6c8043','8d9a4a']; STRAW=['b68a3f','d4aa58','eeca76']
def color(h):
    return tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,)
def sphere(m,c,scale,h,sides=6,rings=3):
    # Closed ellipsoid with tapered ends and soft normals.
    pts=[]
    for j in range(rings+1):
        a=math.pi*j/rings
        pts.append([Vector((c[0]+scale[0]*math.sin(a)*math.cos(k*math.tau/sides),c[1]+scale[1]*math.sin(a)*math.sin(k*math.tau/sides),c[2]+scale[2]*math.cos(a))) for k in range(sides)])
    for j in range(rings):
        for k in range(sides):
            q=(k+1)%sides
            v=[pts[j][k],pts[j+1][k],pts[j+1][q],pts[j][q]]
            if j==0:v=v[1:]
            elif j==rings-1:v=[v[0],v[1],v[3]]
            normals=[tuple(Vector(((p.x-c[0])/scale[0],(p.y-c[1])/scale[1],(p.z-c[2])/scale[2])).normalized()) for p in v]
            m.face(v,color(h),normals=normals)
def blade(m,x,y,h,w,a,tone):
    # Triangular cross section, three bent rings and a pointed tip.
    rings=[]
    for z,r,lean in [(0,w*.45,0),(h*.52,w,h*.12),(h,0,h*.42)]:
        rings.append([Vector((x+math.cos(a)*lean+math.cos(a+k*math.tau/3)*r,y+math.sin(a)*lean+math.sin(a+k*math.tau/3)*r,z)) for k in range(3)])
    for j in range(2):
        for k in range(3):
            q=(k+1)%3;v=[rings[j][k],rings[j][q],rings[j+1][q],rings[j+1][k]]
            if j==1:v=v[:3]
            m.face(v,color(tone))
    m.face(list(reversed(rings[0])),color(tone))
def flower(m,x,y,h,tone):
    blade(m,x,y,h,.014,0,GREEN[0])
    for k in range(5):
        a=k*math.tau/5
        sphere(m,(x+math.cos(a)*.065,y+math.sin(a)*.065,h),(.065,.065,.032),tone,5,2)
    sphere(m,(x,y,h+.025),(.04,.04,.03),'eeca76',5,2)
def build(kind,v):
    r=start(300+v);m=Mesh()
    if kind in ['grassTuft','tallGrass','reeds']:
        n= [5,7,9][v] if kind=='grassTuft' else 7
        H=([.32,.43,.55][v] if kind=='grassTuft' else 1.0 if kind=='tallGrass' else 1.5)
        for k in range(n):
            a=k*2.4;x=math.cos(a)*.16;y=math.sin(a)*.16;h=H*r.uniform(.65,1)
            blade(m,x,y,h,.035 if kind=='grassTuft' else .045,a,GREEN[k%3])
            if kind=='reeds' and v==1 and k%2==0:sphere(m,(x+h*.3*math.cos(a),y+h*.3*math.sin(a),h*.85),(.055,.055,.17),'815940',5,2)
    elif kind in ['flower','wildflowers']:
        tones=['fff0cf','eeca76','d67c59','e7bcb5','925d79','6d96b6']
        for k in range(2 if kind=='flower' else 3):flower(m,(k-.5)*.2,math.sin(k*2)*.12,.32+k*.09,tones[v] if kind=='flower' else tones[k])
    elif kind in ['bush','berryBush']:
        for k in range(5):
            a=k*2.4;rad=.25 if v!=1 else .4
            sphere(m,(math.cos(a)*rad,math.sin(a)*rad,.30+r.random()*.12),(.38,.34,.38),GREEN[k%3],7,3)
        if kind=='berryBush' or v==2:
            for k in range(6):
                a=k*2.4;sphere(m,(math.cos(a)*.4,math.sin(a)*.4,.5),(.065,.065,.065),'ab5e4e' if kind=='berryBush' else 'e7bcb5',4,2)
    elif kind in ['rock','mossStump']:
        sz=[.27,.55,1.1,.7][v] if kind=='rock' else .5
        if kind=='mossStump':
            bottom=[(sz*math.cos(k*math.tau/7),sz*math.sin(k*math.tau/7),0) for k in range(7)]
            top=[(sz*.8*math.cos(k*math.tau/7),sz*.8*math.sin(k*math.tau/7),.42) for k in range(7)]
            for k in range(7):
                q=(k+1)%7;m.face([bottom[k],bottom[q],top[q],top[k]],color('815940'))
            m.face(top,color('c48d64'));m.face(list(reversed(bottom)),color('65453a'))
        else: sphere(m,(0,0,sz*.42),(sz,sz*.8,sz*.44),'817f78',7,3)
        sphere(m,(-sz*.18,0,sz*.77),(sz*.73,sz*.6,sz*.12),'6c8043',7,2)
    elif kind=='lilyPad':
        sphere(m,(0,0,.035),(.4,.35,.035),'516b3c',8,2)
        if v:flower(m,0,0,.14,'e7bcb5')
    elif kind=='mushroom':
        sphere(m,(0,0,.14),(.06,.06,.14),'eae6cd',6,2);sphere(m,(0,0,.29),(.22,.2,.12),['ab5e4e','a27151','e7bcb5'][v],7,3)
    elif kind.startswith('crop'):
        crop=kind[4:];h=[.16,.36,.62,.88][v]
        for k in range(3):
            a=k*2.4;x=math.cos(a)*.16;y=math.sin(a)*.16
            blade(m,x,y,h,.025,a,STRAW[1] if v==3 and crop=='wheat' else GREEN[1])
            if crop=='wheat' and v>=2:
                for j in range(3):sphere(m,(x+h*.3*math.cos(a),y+h*.3*math.sin(a),h*.7+j*.065),(.055,.045,.07),STRAW[j] if v==3 else GREEN[j],4,2)
            elif crop!='wheat' and v>=2:sphere(m,(x,y,.1),(.11,.11,.1),'fff0cf' if crop=='turnip' else 'd67c59',6,2)
    obj=m.object(f'env-{kind}-{v}')
    obj.data.materials.clear();mat=bpy.data.materials.new('opaque painted palette');mat.use_nodes=True;p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.95;c=mat.node_tree.nodes.new('ShaderNodeVertexColor');c.layer_name='Color';mat.node_tree.links.new(c.outputs['Color'],p.inputs['Base Color']);obj.data.materials.append(mat)
    bottom=min(vertex.co.z for vertex in obj.data.vertices)
    for vertex in obj.data.vertices: vertex.co.z-=bottom
    finish(obj,f'env-{kind.lower()}-{v}')
for kind,n in {'grassTuft':3,'tallGrass':1,'flower':6,'wildflowers':1,'reeds':2,'bush':3,'berryBush':1,'rock':4,'mossStump':1,'lilyPad':2,'mushroom':3,'cropwheat':4,'cropturnip':4,'cropcarrot':4}.items():
    for v in range(n):build(kind,v)
