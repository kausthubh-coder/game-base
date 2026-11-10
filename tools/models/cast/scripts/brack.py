# One-character source-based rebuild. --regenerate replaces source edits.
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build import build_one
build_one('brack', renders=True, regenerate='--regenerate' in sys.argv)
