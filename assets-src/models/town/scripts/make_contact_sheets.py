#!/usr/bin/env python3
"""Compose labeled review sheets from the actual Blender renders, not concept art."""
from pathlib import Path
import sys,json,math
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def font(n):
 try:return ImageFont.truetype(fontpath,n)
 except:return ImageFont.load_default()
def fit(im,size):
 im=im.convert('RGB');im.thumbnail(size,Image.Resampling.LANCZOS);return im
records=json.loads((ROOT/'manifest.json').read_text())
def sheet(names,filename,title,view='three-quarter',cols=4):
 cw,ch=400,438;head=90;rows=math.ceil(len(names)/cols)
 out=Image.new('RGB',(cols*cw,head+rows*ch),(241,237,223));dr=ImageDraw.Draw(out);dr.text((26,22),title,font=font(30),fill=(62,70,61))
 dr.text((26,59),'HOLLOWMERE  /  Original game geometry  /  metres',font=font(16),fill=(103,110,95))
 for i,name in enumerate(names):
  x=(i%cols)*cw;y=head+(i//cols)*ch;p=ROOT/'renders'/name/(view+'.png')
  if not p.exists():continue
  im=fit(Image.open(p),(cw-12,ch-48));out.paste(im,(x+(cw-im.width)//2,y))
  dr.text((x+15,y+ch-40),name,font=font(20),fill=(62,70,61))
  rec=next(r for r in records if r['name']==name);dr.text((x+15,y+ch-17),f"{rec['triangles']:,} tris  |  {rec['footprint'][0]} × {rec['footprint'][1]} m",font=font(13),fill=(103,110,95))
 out.save(ROOT/'renders'/filename)
sheet([r['name']for r in records if r['category']!='street'],'architecture-contact-sheet.png','CIVIC LANDMARKS & HOMES')
sheet([r['name']for r in records if r['category']=='street'],'street-contact-sheet.png','THE LIFE BETWEEN BUILDINGS',cols=5)
sheet([r['name']for r in records],'night-contact-sheet.png','WINDOWS, PAPER LAMPS & DUSK','night',5)
# Explicit final visual comparison against the user's supplied reference.
a=ROOT/'renders'/'mock-town-square-dusk.png';b=ROOT/'references'/'reference-genshin-fields.png'
if a.exists() and b.exists():
 out=Image.new('RGB',(2200,1000),(241,237,223));dr=ImageDraw.Draw(out);dr.text((35,28),'Hollowmere / final dusk square',font=font(29),fill=(62,70,61));dr.text((1130,28),'Supplied Genshin / mood reference',font=font(29),fill=(62,70,61))
 for p,x in [(a,20),(b,1120)]:
  im=fit(Image.open(p),(1060,850));out.paste(im,(x+(1060-im.width)//2,100+(850-im.height)//2))
 dr.text((35,961),'Review focus: civic skyline, warm habitation, river setting and clear distant silhouettes. Original geometry, not a reconstruction.',font=font(18),fill=(103,110,95));out.save(ROOT/'renders'/'reference-comparison.png')
print('Review sheets created.')
