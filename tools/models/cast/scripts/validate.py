#!/usr/bin/env python3
"""Independent stdlib GLB audit. Usage: validate.py [asset-dir] --out report.json.

Counts exported primitives rather than trusting generator metadata. glTF uses
Y-up by definition; this cannot establish semantic facing direction or visual
quality, which require render inspection. No exporter modules are imported.
"""
import argparse
import json
import math
import struct
from pathlib import Path

HUMAN_CLIPS = {'idle': 2.0, 'walk': 1.0, 'run': .7, 'swing': .45, 'talk': 2.0, 'wave': 1.0}
HUMAN_JOINTS = {'hips','spine','chest','neck','head','upper_arm.L','lower_arm.L','hand.L','upper_arm.R','lower_arm.R','hand.R','hand.R.tool','upper_leg.L','lower_leg.L','foot.L','upper_leg.R','lower_leg.R','foot.R'}
COMPONENTS = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT2': 4, 'MAT3': 9, 'MAT4': 16}
IDENTITY = [1.,0,0,0, 0,1.,0,0, 0,0,1.,0, 0,0,0,1.]

def mul(a, b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]

def point(m, p):
    return [sum(m[c*4+r]*p[c] for c in range(3))+m[12+r] for r in range(3)]

def matrix(n):
    if 'matrix' in n:
        return n['matrix']
    x,y,z,w = n.get('rotation', [0,0,0,1])
    sx,sy,sz = n.get('scale', [1,1,1])
    t = n.get('translation', [0,0,0])
    return [(1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,
            (2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,
            (2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,*t,1]

class GLB:
    def __init__(self, path):
        data = path.read_bytes()
        if len(data) < 12:
            raise ValueError('Truncated GLB header')
        magic, version, size = struct.unpack_from('<4sII', data)
        if magic != b'glTF' or version != 2 or size != len(data):
            raise ValueError('Invalid GLB header/version/declared length')
        self.doc = None
        self.bin = b''
        off = 12
        chunks = []
        while off < size:
            count, typ = struct.unpack_from('<II', data, off)
            off += 8
            if count % 4 or off+count > size:
                raise ValueError('Invalid chunk alignment or length')
            chunk = data[off:off+count]
            chunks.append(typ)
            if typ == 0x4e4f534a:
                self.doc = json.loads(chunk)
            elif typ == 0x004e4942:
                self.bin = chunk
            off += count
        if not chunks or chunks[0] != 0x4e4f534a or chunks.count(0x4e4f534a) != 1 or chunks.count(0x004e4942) > 1:
            raise ValueError('Invalid GLB chunk order/count')
        self.cache = {}

    def accessor(self, idx):
        if idx in self.cache:
            return self.cache[idx]
        d = self.doc
        a = d['accessors'][idx]
        if 'sparse' in a:
            raise ValueError('Sparse accessor unsupported by this audit')
        fmt, size = COMPONENTS[a['componentType']]
        width = WIDTH[a['type']]
        if 'bufferView' not in a:
            out = [[0]*width for _ in range(a['count'])]
        else:
            v = d['bufferViews'][a['bufferView']]
            if v.get('buffer', 0) != 0:
                raise ValueError('Accessor references non-GLB buffer')
            local = a.get('byteOffset', 0)
            stride = v.get('byteStride', size*width)
            if stride < size*width or local+(max(a['count']-1,0))*stride+(size*width if a['count'] else 0) > v['byteLength']:
                raise ValueError('Accessor exceeds bufferView or invalid stride')
            start = v.get('byteOffset', 0)+local
            out = [list(struct.unpack_from('<'+fmt*width, self.bin, start+i*stride)) for i in range(a['count'])]
            if a.get('normalized'):
                divisor = {5120:127,5121:255,5122:32767,5123:65535}.get(a['componentType'])
                if divisor is None:
                    raise ValueError('Invalid normalized accessor component type')
                out = [[max(-1,x/divisor) for x in row] for row in out]
        if not all(math.isfinite(x) for row in out for x in row):
            raise ValueError('Non-finite accessor values')
        self.cache[idx] = out
        return out

def audit(path, triangle_limit=None, byte_limit=None, kind='auto', expected=None):
    report = {'file':path.name,'bytes':path.stat().st_size,'errors':[],'warnings':[]}
    err, warn = report['errors'].append, report['warnings'].append
    try:
        g = GLB(path)
        d = g.doc
        nodes = d.get('nodes', [])
        if d.get('asset',{}).get('version') != '2.0': err('asset.version is not 2.0')
        if len(d.get('buffers',[])) != 1: err('Expected exactly one embedded GLB buffer')
        for b in d.get('buffers',[]):
            if 'uri' in b: err('Buffer has external or data URI')
            if b['byteLength'] > len(g.bin): err('Buffer exceeds BIN chunk')
        for im in d.get('images',[]):
            if 'uri' in im: err('Image has external or data URI')
        for i in range(len(d.get('accessors',[]))): g.accessor(i)
        for v in d.get('bufferViews',[]):
            if v.get('byteOffset',0)+v['byteLength'] > len(g.bin): err('bufferView exceeds BIN chunk')
        parents = {}
        for i,n in enumerate(nodes):
            for j in n.get('children',[]):
                if not 0 <= j < len(nodes): err('Node child out of range'); continue
                if j in parents: err('Node has multiple parents')
                parents[j] = i
        worlds = {}
        def world(i, seen=None):
            if i in worlds: return worlds[i]
            seen = set() if seen is None else seen
            if i in seen: raise ValueError('Node hierarchy cycle')
            seen.add(i)
            worlds[i] = mul(world(parents[i], seen),matrix(nodes[i])) if i in parents else matrix(nodes[i])
            return worlds[i]
        for i in range(len(nodes)): world(i)
        triangles = vertices = 0
        for m in d.get('meshes',[]):
            mats = set()
            for p in m.get('primitives',[]):
                mats.add(p.get('material'))
                if 'material' not in p or not 0 <= p['material'] < len(d.get('materials',[])): err('Missing/invalid primitive material')
                pos = g.accessor(p['attributes']['POSITION'])
                vertices += len(pos)
                indices = [v[0] for v in g.accessor(p['indices'])] if 'indices' in p else list(range(len(pos)))
                if any(i < 0 or i >= len(pos) for i in indices): err('Primitive index out of range')
                mode = p.get('mode',4)
                if mode == 4:
                    if len(indices)%3: err('Triangle index count not divisible by three')
                    triangles += len(indices)//3
                elif mode in (5,6): triangles += max(0,len(indices)-2)
                else: err('Non-triangle primitive')
                for key,acc in p['attributes'].items():
                    if len(g.accessor(acc)) != len(pos): err('Attribute count differs from POSITION: '+key)
            if len(mats) != 1: err('Mesh does not use exactly one material')
        report.update(triangles=triangles, vertices=vertices, mesh_count=len(d.get('meshes',[])), material_count=len(d.get('materials',[])))
        if triangle_limit and triangles > triangle_limit: err('Triangle budget exceeded')
        if byte_limit and report['bytes'] > byte_limit: err('File-size budget exceeded')
        names = [n.get('name','') for n in nodes]
        skins = d.get('skins',[])
        signatures = []
        for s in skins:
            joints = s['joints']
            if len(set(joints)) != len(joints): err('Duplicate skin joint')
            if any(not 0 <= i < len(nodes) for i in joints): raise ValueError('Skin joint node out of range')
            if len(set(names[i] for i in joints)) != len(joints): err('Duplicate or absent joint names')
            jointset = set(joints)
            signatures.append(sorted((names[i], names[parents[i]] if parents.get(i) in jointset else None) for i in joints))
            if 'inverseBindMatrices' in s and len(g.accessor(s['inverseBindMatrices'])) != len(joints): err('Inverse-bind count differs from joint count')
        report['skeletons'] = signatures
        coords = []
        weighted = 0
        for ni,n in enumerate(nodes):
            if 'mesh' not in n: continue
            skin = skins[n['skin']] if 'skin' in n else None
            bind = g.accessor(skin['inverseBindMatrices']) if skin and 'inverseBindMatrices' in skin else ([IDENTITY]*len(skin['joints']) if skin else [])
            for p in d['meshes'][n['mesh']]['primitives']:
                a = p['attributes']; pos = g.accessor(a['POSITION'])
                if not skin:
                    err('Mesh node is not skinned')
                    coords.extend(point(world(ni),v) for v in pos)
                    continue
                if 'JOINTS_0' not in a or 'WEIGHTS_0' not in a:
                    err('Skinned primitive missing JOINTS_0 or WEIGHTS_0'); continue
                jointsets = [(g.accessor(a['JOINTS_'+str(k)]),g.accessor(a['WEIGHTS_'+str(k)])) for k in range(8) if 'JOINTS_'+str(k) in a and 'WEIGHTS_'+str(k) in a]
                jm = [mul(world(j),ib) for j,ib in zip(skin['joints'],bind)]
                for vi,v in enumerate(pos):
                    influences = [(int(j),w) for js,ws in jointsets for j,w in zip(js[vi],ws[vi])]
                    if any(j < 0 or j >= len(jm) for j,w in influences): err('Vertex joint index out of range'); continue
                    total = sum(w for j,w in influences)
                    if any(w < 0 for j,w in influences) or abs(total-1)>1e-4: err('Vertex weights negative or not normalized')
                    if total <= 0: err('Unweighted vertex')
                    else: weighted += 1
                    vv = [0.,0.,0.]
                    for j,w in influences:
                        q = point(jm[j],v)
                        for axis in range(3): vv[axis] += w*q[axis]
                    coords.append(vv)
        report['weighted_vertices'] = weighted
        if coords:
            bounds = [[min(p[k] for p in coords) for k in range(3)], [max(p[k] for p in coords) for k in range(3)]]
            report['rest_world_bounds'] = bounds
            if abs(bounds[0][1]) > .015: err('Rest geometry foot plane is not near Y=0 (15 mm tolerance)')
            if bounds[1][1] <= 0: err('Geometry does not extend above Y=0')
        anims = d.get('animations',[])
        clips = {}
        root_motion = []
        for an in anims:
            name = an.get('name','')
            if name in clips: err('Duplicate animation name: '+name)
            starts, ends = [], []
            targets = set()
            loop_delta = 0.
            if not an.get('channels'): err('Animation has no channels: '+name)
            for ch in an.get('channels',[]):
                s = an['samplers'][ch['sampler']]
                ts = [r[0] for r in g.accessor(s['input'])]
                values = g.accessor(s['output'])
                if not ts or any(b<=a for a,b in zip(ts,ts[1:])): err('Animation times not strictly increasing: '+name); continue
                starts.append(ts[0]); ends.append(ts[-1])
                target = ch['target']; node = target.get('node'); prop = target['path']
                if node is None or not 0<=node<len(nodes): err('Animation target node invalid'); continue
                key = (node,prop)
                if key in targets: err('Duplicate animation target: '+name)
                targets.add(key)
                cubic = s.get('interpolation','LINEAR') == 'CUBICSPLINE'
                if prop != 'weights' and len(values) != len(ts)*(3 if cubic else 1): err('Animation input/output count mismatch: '+name)
                first,last = (values[1],values[-2]) if cubic else (values[0],values[-1])
                delta = max(abs(x-y) for x,y in zip(first,last))
                if prop == 'rotation':
                    delta = min(delta,max(abs(x+y) for x,y in zip(first,last)))
                    for q in (values[1::3] if cubic else values):
                        if abs(sum(x*x for x in q)-1)>1e-3: err('Animation quaternion not normalized: '+name); break
                loop_delta = max(loop_delta,delta)
                if prop == 'translation' and (node not in parents or names[node].lower() in ('root','armature','hips','pelvis')):
                    pm = world(parents[node]) if node in parents else IDENTITY
                    translations = [point(pm,v) for v in (values[1::3] if cubic else values)]
                    span = [max(v[k] for v in translations)-min(v[k] for v in translations) for k in (0,2)]
                    if max(span)>1e-4: root_motion.append({'clip':name,'node':names[node],'horizontal_span':span})
            duration = max(ends)-min(starts) if ends else 0
            clips[name] = {'duration':duration,'channels':len(an.get('channels',[])),'loop_endpoint_max_delta':loop_delta}
            if starts and abs(min(starts))>1e-5: err('Animation does not start at zero: '+name)
            if loop_delta > 1e-4: err('Animation endpoints do not loop: '+name)
        report['animations'] = clips
        report['root_motion'] = root_motion
        if root_motion: err('Unexpected horizontal root translation')
        is_human = kind == 'human' or (kind == 'auto' and ('hand.R.tool' in names or {'run','swing','talk','wave'} & set(clips)))
        report['kind'] = 'human' if is_human else 'creature'
        budget = triangle_limit if triangle_limit is not None else (4000 if is_human else 2000)
        report['triangle_budget'] = budget
        if triangles > budget: err('Triangle budget exceeded')
        size_budget = byte_limit if byte_limit is not None else 300000
        report['byte_budget_exclusive'] = size_budget
        if report['bytes'] >= size_budget: err('File-size target not met')
        if is_human and (len(skins) != 1 or set(names[i] for i in skins[0]['joints']) != HUMAN_JOINTS): err('Human skin does not have the required 18 named joints')
        wanted = expected if expected is not None else (HUMAN_CLIPS if is_human else {'idle':2.0,'walk':1.0,'special':1.5})
        if set(clips) != set(wanted): err('Clip names differ from required names: '+', '.join(wanted))
        for name,duration in wanted.items():
            if name in clips and duration is not None and abs(clips[name]['duration']-duration)>1e-4: err('Wrong clip duration: '+name)
        if is_human and 'hand.R.tool' not in names: err('Missing hand.R.tool bone')
        if is_human and not any('hand.R.tool' in [names[i] for i in s['joints']] for s in skins): err('Tool bone is not a skin joint')
        warn('glTF specifies +Y up; semantic +Z facing and visual anatomy require render review')
    except (ValueError,KeyError,IndexError,TypeError,struct.error) as exc:
        err(type(exc).__name__+': '+str(exc))
    report['errors'] = list(dict.fromkeys(report['errors']))
    report['warnings'] = list(dict.fromkeys(report['warnings']))
    report['passed'] = not report['errors']
    return report

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('directory',nargs='?',default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument('--out',default='validation_report.json')
    ap.add_argument('--markdown',default='validation_summary.md')
    ap.add_argument('--triangle-limit',type=int)
    ap.add_argument('--byte-limit',type=int)
    ap.add_argument('--expected',help='JSON mapping filename to clip name/duration mapping')
    args = ap.parse_args()
    expectations = json.loads(Path(args.expected).read_text()) if args.expected else {}
    files = sorted(Path(args.directory).rglob('*.glb'))
    reports = [audit(p,args.triangle_limit,args.byte_limit,expected=expectations.get(p.name)) for p in files]
    humans = [r for r in reports if r.get('kind')=='human']
    if humans:
        signature = humans[0].get('skeletons')
        for r in humans[1:]:
            if r.get('skeletons') != signature:
                r['errors'].append('Human skin hierarchy/names differ from '+humans[0]['file']); r['passed']=False
    result = {'validator':'independent stdlib GLB structural audit','all_passed':bool(reports) and all(r['passed'] for r in reports),'asset_count':len(reports),'human_count':len(humans),'creature_count':len(reports)-len(humans),'assets':reports,'limitations':['No visual anatomy, material style, semantic facing, pose deformation, or runtime playback verification.','Counts stored mesh geometry once, not node instances.','Animation endpoint equality does not establish derivative continuity.']}
    Path(args.out).write_text(json.dumps(result,indent=2)+'\n')
    lines = ['## Independent GLB validation','',f"Result: {'PASS' if result['all_passed'] else 'FAIL'} ({len(reports)} assets; {len(humans)} humans, {len(reports)-len(humans)} creatures).",'', '| Asset | Triangles | Bytes | Weighted vertices | Result |','|---|---:|---:|---:|---|']
    for r in reports:
        lines.append(f"| {r['file']} | {r.get('triangles','?')} | {r['bytes']} | {r.get('weighted_vertices','?')} | {'PASS' if r['passed'] else 'FAIL'} |")
    lines += ['', 'Checks include embedded buffers/textures, primitive indices, per-mesh material count, skin indices and normalized weights, shared human bone hierarchy, exact human clip names/durations, numerical loop endpoint equality, horizontal root motion, and rest-pose skinned world-space foot plane.', '', 'glTF defines +Y up. Semantic facing, visual style, anatomy, animation quality, and gameplay suitability still require visual/runtime review.']
    for r in reports:
        if r['errors']:
            lines += ['', '**'+r['file']+'**']+['- '+e for e in r['errors']]
    Path(args.markdown).write_text('\n'.join(lines)+'\n')
    print(json.dumps({'all_passed':result['all_passed'],'asset_count':len(reports),'errors':{r['file']:r['errors'] for r in reports if r['errors']}},indent=2))
    return 0 if result['all_passed'] else 1

if __name__ == '__main__':
    raise SystemExit(main())
