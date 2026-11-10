import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import *
r=start(29); m=Mesh(); m.cards(r,(0,0,.6),(.85,.7,.53),140); finish(m.object('soft bush'),'bush-29')
