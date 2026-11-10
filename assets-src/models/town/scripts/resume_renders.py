#!/usr/bin/env python3
"""Finish absent proof views without re-exporting or modifying source geometry.

Run: blender -b -t 4 --python-exit-code 1 --python scripts/resume_renders.py
Optional: -- --only ASSET --samples 16 --resolution 640
"""
import argparse
import json
import sys
import time
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import build_export

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only')
parser.add_argument('--samples', type=int, default=16)
parser.add_argument('--resolution', type=int, default=640)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

original_setup = build_export.setup_render
def efficient_setup(res=640, night=False):
    scene = original_setup(args.resolution, night)
    scene.cycles.samples = args.samples
    # This Blender CPU build has no denoising backend.
    scene.cycles.use_denoising = False
    return scene
build_export.setup_render = efficient_setup

original_render = bpy.ops.render.render
def skip_existing_render(*a, **kw):
    path = Path(bpy.context.scene.render.filepath)
    if path.exists() and path.stat().st_size > 1000:
        print('KEEP_RENDER', path, flush=True)
        return {'FINISHED'}
    return original_render(*a, **kw)
bpy.ops.render.render = skip_existing_render

names = [args.only] if args.only else [v['name'] for v in json.loads((ROOT / 'manifest.json').read_text())]
for name in names:
    paths = [ROOT / 'renders' / name / (mode + '.png') for mode in ['front', 'three-quarter', 'night']]
    if all(p.exists() and p.stat().st_size > 1000 for p in paths):
        continue
    start = time.time()
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'sources' / (name + '.blend')))
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith('PREVIEW_')]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    build_export.render_asset(name, bpy.context.object)
    print('RESUME_RENDER_DONE', name, round(time.time() - start, 1), flush=True)
print('ALL_MISSING_RENDERS_COMPLETE', flush=True)
