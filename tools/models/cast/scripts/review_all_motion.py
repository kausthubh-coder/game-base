"""One representative pose of every exported clip, on every source character."""
import sys,os,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
from build import ROOT,NAMES,SPECS,camera_scene,look
OUT=Path(os.environ.get('MOTION_REVIEW_TMP','/tmp/greenhollow-refined-motion'))
OUT.mkdir(parents=True,exist_ok=True);only=os.environ.get('MOTION_REVIEW_ONLY');report=json.loads((ROOT/'qa'/'motion_review_samples.json').read_text()) if only else [];report=[r for r in report if r['model']!=only] if only else report
for name in NAMES:
 if only and name!=only:continue
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'sources'/f'{name}.blend'))
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');obj=next(o for o in bpy.data.objects if o.type=='MESH')
 points=[obj.matrix_world@v.co for v in obj.data.vertices];height=max(v.z for v in points)-min(v.z for v in points)
 center=(0,0,height*.50);cam=camera_scene(center,height*1.40,(300,360))
 look(cam,(3,-6,center[2]+1),center)
 clips=['idle','walk','run','swing','talk','wave'] if name in SPECS else ['idle','walk','special']
 for clip in clips:
  for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
  rig.animation_data.action=bpy.data.actions[clip];duration=float(rig.animation_data.action['duration_seconds'])
  fraction=.125 if name=='lanternfly' else .35 if clip=='swing' else .5 if clip in ['talk','wave'] else .25
  bpy.context.scene.frame_set(round(duration*60*fraction))
  bpy.context.scene.render.filepath=str(OUT/f'{name}-{clip}.png');bpy.ops.render.render(write_still=True)
  report.append({'model':name,'clip':clip,'fraction':fraction,'render':f'{name}-{clip}.png'})
(ROOT/'qa'/'motion_review_samples.json').write_text(json.dumps(report,indent=2))
