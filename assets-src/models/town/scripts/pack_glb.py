"""Loss-bounded GLB packing: byte vertex color, snorm8 normals. No Draco.
Keeps float32 metre positions, topology, names, origin and emissive materials.
Requires the standard KHR_mesh_quantization extension for compact normals.
"""
import json,struct,math
from pathlib import Path

def pack(path):
 path=Path(path);data=path.read_bytes();jlen,jtype=struct.unpack_from('<II',data,12);g=json.loads(data[20:20+jlen]);bpos=20+jlen;blen,btype=struct.unpack_from('<II',data,bpos);binary=data[bpos+8:bpos+8+blen]
 semantics={}
 for m in g['meshes']:
  for p in m['primitives']:
   for sem,idx in p['attributes'].items():semantics[idx]=sem
 out=bytearray();views=[]
 sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};arity={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
 for idx,a in enumerate(g['accessors']):
  old=g['bufferViews'][a['bufferView']];off=old.get('byteOffset',0)+a.get('byteOffset',0);n=arity[a['type']];stride=old.get('byteStride',n*sizes[a['componentType']]);sem=semantics.get(idx)
  while len(out)%4:out.append(0)
  start=len(out)
  if sem in ('COLOR_0','NORMAL') and a['componentType']==5126:
   for i in range(a['count']):
    vals=struct.unpack_from('<'+'f'*n,binary,off+i*stride)
    if sem=='COLOR_0':out.extend(bytes(round(max(0,min(1,x))*255) for x in vals))
    else:out.extend(struct.pack('<'+'b'*n,*[round(max(-1,min(1,x))*127) for x in vals]))
   a['componentType']=5121 if sem=='COLOR_0' else 5120;a['normalized']=True;a.pop('min',None);a.pop('max',None)
   # vertex attributes need 4-byte alignment per element
   element=n*sizes[a['componentType']];padstride=(element+3)//4*4
   if padstride!=element:
    raw=out[start:];del out[start:]
    for i in range(a['count']):out.extend(raw[i*element:(i+1)*element]);out.extend(bytes(padstride-element))
   v={'buffer':0,'byteOffset':start,'byteLength':len(out)-start,'target':34962,'byteStride':padstride}
  else:
   element=n*sizes[a['componentType']]
   for i in range(a['count']):out.extend(binary[off+i*stride:off+i*stride+element])
   v={'buffer':0,'byteOffset':start,'byteLength':len(out)-start}
   if 'target'in old:v['target']=old['target']
  a['bufferView']=len(views);a.pop('byteOffset',None);views.append(v)
 g['bufferViews']=views;g['buffers']=[{'byteLength':len(out)}]
 for key in ['extensionsUsed','extensionsRequired']:
  g.setdefault(key,[])
  if 'KHR_mesh_quantization' not in g[key]:g[key].append('KHR_mesh_quantization')
 # Two materials only, no incidental specular extension required at runtime.
 for m in g['materials']:
  if m.get('extensions',{}).get('KHR_materials_specular') is not None:
   m['extensions'].pop('KHR_materials_specular');
   if not m['extensions']:m.pop('extensions')
 if 'KHR_materials_specular' in g.get('extensionsUsed',[]):g['extensionsUsed'].remove('KHR_materials_specular')
 js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);out+=bytes((-len(out))%4)
 final=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out
 path.write_bytes(final);return len(final)
if __name__=='__main__':
 import sys
 for p in sys.argv[1:]:print(p,pack(p))
