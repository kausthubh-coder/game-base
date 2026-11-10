import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
for seed in [17,41,83]:
    r=start(seed); m=Mesh()
    m.tube([(0,0,0),(.05,0,2),(-.1,.05,4),(.05,0,5.5)],[.19,.15,.10,.02])
    m.colors=[(.72,.72,.60,1) for c in m.colors]
    for z in [.8,1.5,2.3,3.1,3.9]:
        m.face([(-.16,-.13,z),(.13,-.13,z+.04),(.12,-.13,z+.12),(-.12,-.13,z+.10)],(.18,.19,.15,1))
    m.cards(r,(0,0,4.7),(1.3,1.2,1.6),600)
    m.colors=[(c[0]*1.2,c[1]*1.12,c[2]*1.3,c[3]) if i>=len(m.colors)-2400 else c for i,c in enumerate(m.colors)]
    finish(m.object('pale birch'),f'birch-{seed}')
