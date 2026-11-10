"""Refined cast: shared connected garment forms, expressive faces, bespoke outfits."""
from mathutils import Vector
from shared import Builder,make_armature
from humans import humanoid_bones,human_actions,SPECS
import hero_refined as H

BASE_PALETTE=H.P.copy()
PALETTES={
 'tamsin':dict(cape='805A3E',skin='E6B68A',shadow='C99069',hair='A9987F',hairLight='C1AF91',shirt='775139',pants='654A37',boot='4E3934',accent='B98D54',secondary='8F683F'),
 'maren':dict(skin='F1C69E',shadow='D99B78',hair='69432F',hairLight='82573A',shirt='4E6946',pants='D9C99F',boot='5D4035',accent='536F48',secondary='F1DFB0'),
 'odo':dict(skin='F0BD8E',shadow='D68F63',hair='82492D',hairLight='A36138',shirt='F1DCB1',pants='79523D',boot='594036',accent='AF7252',secondary='F9E8BD'),
 'gus':dict(skin='E8B486',shadow='C78E65',hair='6A412B',hairLight='8B5A35',shirt='BE9058',pants='4E657D',boot='644531',accent='D6B370',secondary='526B81'),
 'mira':dict(skin='E9B68E',shadow='CC8C6C',hair='693A30',hairLight='804C39',shirt='795062',pants='705040',boot='573B34',accent='B68A52',secondary='E8D3A4'),
 'wren':dict(skin='F1C49A',shadow='D99D75',hair='65432D',hairLight='875B35',shirt='647044',pants='E3D0A1',boot='70503A',accent='B19148',secondary='9A763D'),
 'juniper':dict(skin='F3C79D',shadow='DDA17A',hair='62402B',hairLight='835533',shirt='C1965B',pants='76543E',boot='745039',accent='AC5545',secondary='E9D8AE'),
 'brack':dict(skin='D6A77B',shadow='B88560',hair='67533F',hairLight='8D785E',shirt='495363',pants='50423D',boot='513A33',accent='B3954C',secondary='C7AB70'),
 'villager-a':dict(skin='F0BF95',shadow='D29A78',hair='744633',hairLight='905F42',shirt='805647',pants='945643',boot='634237',accent='A46752',secondary='EBD3A7'),
 'villager-b':dict(skin='E5B68C',shadow='C99470',hair='78604B',hairLight='947A5D',shirt='EAD5AF',pants='87523E',boot='644536',accent='96703F',secondary='BA9865')}

class PersonBuilder(Builder):
    def __init__(self,name,palette):
        super().__init__(name);self.palette=palette;self.phase='body';self.stocky={'odo':1.18,'gus':1.12,'villager-b':1.07}.get(name,1.0)
    def mesh(self,label,verts,faces,color,bone):
        # Keep the same joint pivots and rest orientations for all people.
        if self.phase=='body' and label in ['Diagonal leather strap','Shaped satchel','Satchel flap','Satchel stud']:
            return
        if self.phase=='body' and ((self.name in ['maren','odo','gus','villager-a'] and label in ['Buckle frame','Buckle inset']) or (self.name=='gus' and label=='Leather belt')):
            return
        if self.phase=='head' and label.startswith('Swept chunky lock') and self.name not in ['wren','juniper']:
            return
        if self.phase=='head' and self.name=='odo' and (label in ['Eye contour','Eye white','Amber iris','Pupil','Catchlight','Expressive brow','Gentle smile']):
            return
        vv=[list(v) for v in verts]
        if self.name in ['tamsin','gus','brack','villager-b'] and (label=='Layered hair cap' or 'fringe' in label.lower() or label=='Soft temple lock'):
            for v in vv:
                if v[2]>1.63:v[2]=1.63+(v[2]-1.63)*.02
        if label=='Brown wool waistcoat':
            for v in vv:v[0]*=1.07
        if self.name=='maren' and label=='Gentle smile':
            for v in vv:v[2]=1.301-(v[2]-1.30)*.25
        if self.stocky!=1:
            if label in ['Cream tunic','Trouser seat','Leather belt']:
                for v in vv:v[0]*=self.stocky;v[1]*=1+(self.stocky-1)*.45
            elif self.phase=='head':
                for v in vv:v[0]*=1+(self.stocky-1)*.32
        if self.phase=='head' and label in ['Eye contour','Eye white','Amber iris','Pupil','Catchlight']:
            factor=.71 if self.name=='maren' else .86 if self.name in ['tamsin','brack','villager-b'] else 1
            for v in vv:
                v[2]=1.427+(v[2]-1.427)*factor
                if self.name=='maren' and v[2]>1.44:v[2]=1.44+(v[2]-1.44)*.15
        if self.name=='juniper' and label.startswith('Flowing trousers'):
            # Pale lower stockings; a separate short trouser cuff is added by the outfit.
            color=self.palette['secondary']
        fabric_blend=label in ['Cream embroidered gown front','Blue overall bib','Apron bib']
        if label=='Cream embroidered gown front':
            for v in vv:v[1]-=.010
        start=len(self.verts)
        super().mesh(label,vv,faces,color,bone)
        if fabric_blend:
            for i,v in enumerate(vv):
                upper=max(0,min(1,(v[2]-.75)/.15))
                self.weights[start+i]={'hips':1-upper,'chest':upper}



def build_refined_human(name):
    if name=='hero':
        H.P.clear();H.P.update(BASE_PALETTE)
        return H.build_refined_hero()
    palette=BASE_PALETTE.copy();palette.update(PALETTES[name]);palette['cloth']=palette['shirt'];b=PersonBuilder(name,palette)
    H.P.clear();H.P.update(palette);H.P['cream']=palette['shirt'];H.P['cloth']=palette['shirt']
    H.body(b)
    H.P.clear();H.P.update(palette);b.phase='head';H.head(b)
    if name=='odo':
        for x in [-.102,.102]:
            H.tube(b,'Happy eye',[(x-.034,-.235,1.43),(x,-.247,1.447),(x+.034,-.235,1.43)],[.008,.010,.008],palette['dark'],'head',segments=5)
            H.tube(b,'Baker brow',[(x-.04,-.209,1.527),(x,-.224,1.54),(x+.035,-.213,1.534)],[.008,.01,.006],palette['hair'],'head',segments=5)
        H.tube(b,'Baker smile',[(-.046,-.211,1.312),(0,-.224,1.295),(.046,-.211,1.312)],[.006,.008,.006],palette['dark'],'head',segments=6)
    if name in ['tamsin','brack','villager-b']:
        for s in [-1,1]:
            H.tube(b,'Gentle eye crease',[(s*.16,-.198,1.419),(s*.18,-.184,1.412)],[.004,.003],palette['shadow'],'head',segments=5)
    b.phase='outfit'
    if name in ['tamsin','maren','odo','gus','mira']:
        from outfits_a import add_outfit
    else:
        from outfits_b import add_outfit
    add_outfit(b,name,palette)
    # Exact specified visual height, including all hair/hats, with origin on the soles.
    floor=min(v[2] for v in b.verts);height=max(v[2] for v in b.verts)-floor
    target=SPECS[name]['height'];scale=target/height
    b.verts=[(v[0]*scale,v[1]*scale,(v[2]-floor)*scale) for v in b.verts]
    bones=humanoid_bones((scale,scale,scale))
    if floor:
        bones=[(n,(h[0],h[1],h[2]-floor*scale),(t[0],t[1],t[2]-floor*scale),parent) for n,h,t,parent in bones]
    rig=make_armature(name,bones);actions=human_actions(rig)
    H.P.clear();H.P.update(BASE_PALETTE)
    return b,rig,actions,{'kind':'human','revision':'full refined cast','design_height_m':target,'reference_status':'Compared with supplied sprite sheets; shaped face and continuous weighted limbs plus individually designed clothes and hair.'}
