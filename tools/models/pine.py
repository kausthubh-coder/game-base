import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
for seed in [17,41,83]:
    r=start(seed); m=Mesh()
    m.tube([(0,0,0),(0,0,3),(0,0,6.5)],[.24,.14,.01])
    for z,rad,n in [(2,1.9,180),(3,1.6,150),(4,1.2,120),(5,.85,100),(5.8,.45,70)]:
        m.cards(r,(0,0,z),(rad,rad,.65),n)
    finish(m.object('tiered pine'),f'pine-{seed}')
