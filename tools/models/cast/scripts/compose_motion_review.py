from pathlib import Path
import json,os
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];RAW=Path(os.environ.get('MOTION_REVIEW_TMP','/tmp/greenhollow-refined-motion'))
report=json.loads((ROOT/'qa/motion_review_samples.json').read_text())
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
humans=list(dict.fromkeys(x['model'] for x in report if x['clip']=='run'))
for label,names,clips in [('humanoid',humans,['idle','walk','run','swing','talk','wave']),('creature',['leaftail','mossling','lanternfly'],['idle','walk','special'])]:
 w,h=240,308;sheet=Image.new('RGB',(w*len(names),h*len(clips)),'#eeeadf');d=ImageDraw.Draw(sheet)
 for col,name in enumerate(names):
  for row,clip in enumerate(clips):
   im=Image.open(RAW/f'{name}-{clip}.png').convert('RGB');im=im.resize((240,288))
   sheet.paste(im,(col*w,row*h+20));d.text((col*w+9,row*h+3),name+' / '+clip,font=font,fill='#513d3c')
 sheet.save(ROOT/'qa'/f'{label}-motion-review.png',optimize=True)
print('Composed all-character motion contact sheets.')
