import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
for seed in [17,41,83]:
    r=start(seed); m=Mesh(); lean=r.uniform(-.3,.3)
    m.tube([(0,0,0),(.12,0,1.4),(lean,.05,2.8),(.1,0,4.6)],[.32,.25,.18,.035])
    for t in [0,2.1,4.2]:
        m.tube([(lean,0,2.5),(math.cos(t)*.7,math.sin(t)*.7,3.5),(math.cos(t)*1.3,math.sin(t)*1.3,4.2)],[.15,.09,.015])
    # Overlapping ellipsoidal card clusters, never sphere meshes.
    for c,rad,n in [((0,0,4.9),(1.65,1.55,1.35),270),((-1.1,.15,4.3),(1.15,1.25,1.1),150),((1,.4,4.5),(1.3,1.2,1.15),150),((.1,-1,4.45),(1.1,1.05,1),90)]:
        m.cards(r,(c[0]+r.uniform(-.15,.15),c[1],c[2]),rad,n)
    finish(m.object('round leafy tree'),f'tree-{seed}')
