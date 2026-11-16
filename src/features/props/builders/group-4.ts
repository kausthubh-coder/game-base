// River landmarks. Origins sit on the riverbed; +z is the river-facing side.
import type * as THREE from 'three';
import { ShapeUtils, Vector2 } from 'three';
import { P } from '../palette.ts';
import { Shape } from '../shape.ts';

// The explicit Hearth handoff overrides the older prop palette for ancient masonry.
const STONE = [0x9c91a7, 0xdec398, 0xf4deb2] as const;
const MOSS = 0x89936b;
const BRASS = 0xb58c47;
const TEAL = 0x648f88;
const TAU = Math.PI * 2;
type Point = [number, number, number];

const WOOD = [P.timber, P.plankDark, P.plank, P.plankLight] as const;
const METAL = [P.umber, BRASS, P.gold, P.butter] as const;
const ROOF = [P.tealDeep, TEAL, P.teal] as const;
function block(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  if (s.detail < 1 || Math.min(w,h,d) < .8) { s.box(x,y,z,w,h,d,STONE,{bevel:s.detail < 1 ? 0 : Math.min(.06,h/4),skin:'stone'}); return; }
  s.roundBox(x, y, z, w, h, d, STONE, { round: Math.min(.09, h / 4), segments: 1, skin: 'stone', moss: .12, key: .3, mottle: .12 });
}
function masonry(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  block(s, x, y, z, w, h, d);
}
function beam(s: Shape, a: Point, b: Point, r = .16, color: number = P.timber) {
  s.tube([a, b], [r, r], 4, color === P.timber ? WOOD : color, { cap: 'both', flat: true, turn: Math.PI / 4, skin: color === P.timber ? 'grain' : 'flat' });
}
function arch(s: Shape, x: number, spring: number, z: number, r: number, width: number, depth: number, color: number | readonly number[] = STONE) {
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 10, b = (i + 1) * Math.PI / 10;
    const pts = [[r * Math.cos(a), r * Math.sin(a)], [(r + width) * Math.cos(a), (r + width) * Math.sin(a)], [(r + width) * Math.cos(b), (r + width) * Math.sin(b)], [r * Math.cos(b), r * Math.sin(b)]];
    for (const side of [-1, 1]) s.poly(pts.map(([px, py]) => [x + px, spring + py, z + side * depth / 2] as Point), color, { toward: [0, 0, side], skin: 'stone' });
    for (let j = 0; j < 4; j++) {
      const p = pts[j], q = pts[(j + 1) % 4];
      s.poly([[x + p[0], spring + p[1], z - depth / 2], [x + q[0], spring + q[1], z - depth / 2], [x + q[0], spring + q[1], z + depth / 2], [x + p[0], spring + p[1], z + depth / 2]], color, { skin: 'stone' });
    }
  }
}
function ivy(s: Shape, x: number, y: number, z: number, length: number) {
  // Broad leaves sit on the masonry; the stems do not obscure its cream face.
  for (let i = 0; i < length * 3; i++) {
    const xx = x + Math.sin(i * 2) * .22, yy = y - i * .3;
    s.poly([[xx-.3,yy,z],[xx-.12,yy+.16,z+.08],[xx+.27,yy-.06,z],[xx+.06,yy-.26,z+.09]], [MOSS, P.leaf, P.moss], { two: true, skin: 'moss' });
  }
}

/** Wheel in the XY plane, hub at origin, horizontal axle along Z. */
function wheel(s: Shape, radius: number, depth: number, brass: boolean) {
  const tone = brass ? METAL : WOOD, skin = brass ? 'flat' : 'grain';
  // Solid annular rims, with a rounded outer lip, rather than disconnected rods.
  for (const z of [-depth / 2 + .14, depth / 2 - .14]) {
    s.at(0, 0, z, { rx: Math.PI / 2 }, () => s.lathe(0, 0, 0,
      [[radius-.48,-.12],[radius-.08,-.12],[radius,0],[radius-.08,.12],[radius-.48,.12],[radius-.48,-.12]], tone,
      { sides: 24, cap: false, skin, key: .4, cavity: .2 }));
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      s.tube([[Math.cos(a)*(radius-.25),Math.sin(a)*(radius-.25),z+.12],[Math.cos(a)*(radius-.25),Math.sin(a)*(radius-.25),z+.19]], [.075,.075], 6, brass ? P.gold : P.iron, { cap: 'both', skin: 'flat' });
    }
  }
  for (let i = 0; i < 12; i++) s.at(0,0,0,{rz:i*TAU/12},()=>
    s.box(0,.4,0,brass ? .44 : .3,radius-.8,.3,tone,{bevel:s.detail < 1 ? 0 : .035,skin}));
  for (let i = 0; i < 24; i++) s.at(0, 0, 0, { rz: i * TAU / 24 }, () =>
    s.box(0, radius - .76, 0, .17, .68, depth - .08, tone, { skin }));
  s.at(0,0,0,{rx:Math.PI/2},()=>s.lathe(0,0,0,
    [[.48,-depth/2],[.68,-depth/2+.1],[.68,-.3],[.48,.3],[.68,depth/2-.1],[.48,depth/2]],tone,
    {sides:16,skin,key:.4}));
}
function roof(s: Shape, cx: number, base: number, cz: number, length: number, radius: number) {
  // Barrel vault with overlapping courses. The enlarged wheel clears its crown.
  for (let i = 0; i < 12; i++) for (let j = 0; j < Math.ceil(length / 2); j++) {
    const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
    const x0 = cx - length / 2 + j * 2, x1 = Math.min(cx + length / 2, x0 + 1.97);
    const at = (x: number, t: number): Point => [x,base+Math.sin(t)*radius,cz+Math.cos(t)*radius];
    s.mesh([at(x0,a),at(x1,a),at(x1,b),at(x0,b)].flat(),[0,1,2,0,2,3], ROOF, { hints:Array(4).fill([0,1,0]).flat(), skin:'flat', key:.4, mottle:.3 });

  }
  for (const x of [cx-length/2,cx+length/2]) {
    s.poly(Array.from({length:25},(_,i):Point=>[x,base+Math.sin(i*Math.PI/24)*radius,cz+Math.cos(i*Math.PI/24)*radius]),STONE,{two:true,skin:'stone'});
    s.sweep(Array.from({length:13},(_,i):Point=>[x,base+Math.sin(i*Math.PI/12)*radius,cz+Math.cos(i*Math.PI/12)*radius]),Array(13).fill(.17),STONE,{sides:6,steps:1,skin:'stone',cap:'both'});
  }
}
function pumpBody(s: Shape) {
  block(s, 0, 0, 0, 22, .7, 16);
  masonry(s, -2, .7, -1.6, 18, 9.3, 10.8);
  roof(s, -2, 10.12, -1.6, 17.6, 5.7);
  // A staggered face grid bakes broad ashlar colour changes without building each block.
  for (let row=0;row<9;row++) {
    const cuts=[-10.9];
    for(let x=-10.9+(row%2?1:2);x<6.9;x+=2)cuts.push(x);
    cuts.push(6.9);
    for(let i=1;i<cuts.length;i++) {
      const x0=cuts[i-1]+.018,x1=cuts[i]-.018,y=.8+row;
      s.mesh([x0,y,3.805,x1,y,3.805,x1,y+.97,3.805,x0,y+.97,3.805],[0,1,2,0,2,3],STONE,{skin:'stone',key:.3,mottle:.2,hints:[0,0,1,0,0,1,0,0,1,0,0,1]});
    }
  }

  // Tall recessed river windows with brass mullions and stone voussoirs.
  for (const x of [-6, -.3, 5.2]) {
    s.box(x, 2, 3.84, 2.6, 5.8, .1, [P.navy, P.tealDark, P.ice], { skin: 'flat' });
    s.poly(Array.from({ length: 14 }, (_, i) => { const a = i * Math.PI / 13; return [x + Math.cos(a) * 1.3, 7.8 + Math.sin(a) * 1.3, 3.9] as Point; }), P.navy, { two: true });
    arch(s, x, 7.8, 3.98, 1.3, .4, .3);
    for (const side of [-1, 1]) block(s, x + side * 1.5, 2, 3.98, .4, 5.8, .4);
    for (const dx of [-.65, 0, .65]) s.box(x + dx, 2, 4.02, .06, 6.1, .08, BRASS);
    for (const y of [3, 4.5, 6, 7.5]) s.box(x, y, 4.02, 2.5, .06, .08, BRASS);
  }

  for (const x of [-10, -3.1, 2.6, 6.6]) {
    block(s, x, .7, 4.2, .9, 9.5, 1.1);
    block(s, x, 10, 4.2, 1.3, .35, 1.4);
  }
  // Low door annex occupies the right end, leaving the wheel unobstructed.
  masonry(s, 8.7, .7, 1.5, 4.6, 6.3, 10);
  roof(s, 8.7, 7, 1.5, 4.2, 2.1);
  s.at(8.7, 3.7, 6.96, 0, () => {
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      beam(s, [Math.cos(a) * .35, Math.sin(a) * .35, 0], [Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0], .045, P.gold);
    }
    s.tube([[0, 0, 0], [0, 0, .1]], [.3, .3], 12, P.gold, { cap: 'both' });
  });
  s.tube([[8.7, 3.7, 6.56], [8.7, 3.7, 6.75]], [1.7, 1.7], 24, BRASS, { cap: 'both' });
  arch(s, 8.7, 3.7, 6.6, 1.8, .4, .5);
  for (let i = 0; i < 5; i++) block(s, 8.7, .7 + i * .22, 7.5 - i * .23, 3.5, .22, .8);
  for (const z of [4.5, 7.6]) {
    block(s, -4.8, .7, z, 2.2, 7.65, .6);
    block(s, -4.8, 8.35, z, 2.5, .35, .7);
  }
  s.tube([[-4.8, 9, 3.9], [-4.8, 9, 7.9]], [.28, .28], 12, BRASS, { cap: 'both' });
  for (const x of [-10, 2.6, 6.6]) ivy(s, x, 9.9, 4.85, 1.8);
  s.shadowBox(-2, .7, -1.6, 18, 13, 11);
  s.shadowBox(8.7, .7, 1.5, 4.6, 8, 10);
}

// Enlarged by request: diameter 17, axle y=9, crown y=17.5; centred footprint 24.3 × 16.
export const PUMP_WHEEL_PIVOT = [-3.65, 9, 6] as const;
/** Static registry preview. The runtime should use pumpHouseParts instead, avoiding a duplicate wheel. */
export function pumpHouse(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(4001, detail);
  s.at(1.15, 0, 0, 0, () => pumpBody(s));
  s.at(...PUMP_WHEEL_PIVOT, 0, () => wheel(s, 8.5, 2, true));
  return s.done();
}
/** Mesh stationary with the shared prop material; place wheel at pivot and set rotation.z = seconds * .12.
 * Both rims, 12 spokes, 24 paddles and hub rotate together. Axle and hub-bearing piers stay still.
 * No per-frame geometry rebuild. River surface: local y=1.35. */
export function pumpHouseParts(detail = 1) {
  const body = new Shape(4001, detail), moving = new Shape(4002, detail);
  body.at(1.15, 0, 0, 0, () => pumpBody(body)); wheel(moving, 8.5, 2, true);
  const stationary = body.done(), rotor = moving.done();
  rotor.name = 'pumpHouse-wheel';
  return { stationary, wheel: rotor, pivot: PUMP_WHEEL_PIVOT };
}

/** Upstream water y=3.65, downstream y=.15. Falling sheet is exported separately. */
export function weir(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(4010, detail);
  masonry(s, 0, 0, -.8, 20, 3.5, 1.4);
  s.roundBox(0, 3.38, -.8, 20, .34, 1.6, STONE, { round: .16, segments: 2, skin: 'stone', moss: .15 });
  for (const x of [-10.8, 10.8]) {
    masonry(s, x, 0, 0, 2.3, 3.7, 3.6);
    block(s, x, 3.7, 0, 2.4, .3, 4);
    ivy(s, x + .5, 3.6, 1.83, 2);
  }
  for (const x of [-7.2, -2.4, 2.4, 7.2]) {
    s.mesh([[x-.6,0,-.2],[x+.6,0,-.2],[x+.6,0,2],[x-.6,0,2],[x-.38,2.9,-.2],[x+.38,2.9,-.2],[x+.38,2.9,1],[x-.38,2.9,1]].flat(), [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5],[0,1,5],[0,5,4]].flatMap(([a,b,c])=>[a,c,b]), STONE, {skin:'stone',smooth:false,moss:.2});
  }
  s.poly([[-9.6, .05, 2], [9.6, .05, 2], [9.6, 3.5, -.1], [-9.6, 3.5, -.1]], STONE, { two: true, skin: 'stone' });
  s.shadowBox(0, 0, -.8, 24, 3.5, 2);
  return s.done();
}
/** Use a transparent, double-sided river material, depthWrite=false and scrolling foam UVs.
 * Keep separate from opaque instanced stone. UV v follows the fall; origin matches weir(). */
export function weirWater(): THREE.BufferGeometry {
  const s = new Shape(4011);
  const path = [[3.68, -1.5], [3.73, -.5], [3.5, .05], [2.5, .7], [.2, 1.95]];
  for (let i = 1; i < path.length; i++) {
    const [a, z] = path[i - 1], [b, zz] = path[i];
    s.poly([[-9.6, a, z], [9.6, a, z], [9.6, b, zz], [-9.6, b, zz]], P.ice, { two: true });
  }
  const g = s.done();
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + 9.6) / 19.2; uv[i * 2 + 1] = (3.73 - p.getY(i)) / 3.53; }
  // Clone a two-component attribute to retain the builder's Three.js dependency boundary.
  const attr = g.getAttribute('aFx').clone(); attr.array.set(uv); g.setAttribute('uv', attr);
  g.name = 'weir-falling-water';
  return g;
}

/** Still wheel, roofless interior and broken gable; river y=.4. */
export function oldMill(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(4020, detail);
  block(s, 0, 0, 0, 10, .12, 8);
  for (const x of [-3.8, .9]) masonry(s, x, 0, 3.25, 2.4, 2.7, .55);
  arch(s, -1.45, 1.6, 3.25, 1.1, .5, .55);
  masonry(s, -4.7, 0, 0, .6, 3.2, 6.5);
  masonry(s, 2, 0, 0, .6, 3.3, 6.5);
  masonry(s, -1.35, 0, -3.25, 7.3, 2, .55);
  // Joined plaster masses follow the broken gable, leaving a real arched window.
  s.roundBox(-1.35,2.8,3.25,7.3,1.4,.45,[P.ash,P.plaster,P.cream],{round:.05,segments:1,skin:'plaster'});
  const plaster = (outline: [number,number][]) => {
    const faces = ShapeUtils.triangulateShape(outline.map(([x,y]) => new Vector2(x,y)), []).flat();
    for (const z of [3.025,3.475]) s.mesh(outline.flatMap(([x,y])=>[x,y,z]),faces,[P.ash,P.plaster,P.cream],{skin:'plaster',hints:outline.flatMap(()=>[0,0,z<3.25?-1:1]),key:.3});
    for (let i=0;i<outline.length;i++) {
      const [x,y]=outline[i], [xx,yy]=outline[(i+1)%outline.length];
      s.poly([[x,y,3.025],[xx,yy,3.025],[xx,yy,3.475],[x,y,3.475]],STONE,{two:true,skin:'stone'});
    }
  };
  plaster([[-4.8,4.2],[-4.8,4.6],[-3.8,4.6],[-3.8,5.2],[-2.8,5.2],[-2.8,5.8],[-1.8,5.8],[-1.8,7.1],[-.85,7.8],[-.85,4.2]]);
  plaster([[1.85,4.2],[1.85,8.8],[2.3,8.8],[2.3,4.2]]);
  // Stone closes the spandrel above the window; no floating plaster fragments.
  plaster([[-.85,6.5],[-.85,7.8],[-.4,7.8],[-.4,8.35],[.4,8.35],[.4,8.7],[1.85,8.7],[1.85,6.5],
    ...Array.from({length:11},(_,i):[number,number]=>[.5+Math.cos(i*Math.PI/10)*1.35,6.5+Math.sin(i*Math.PI/10)*1.35])]);
  for (const x of [-.85, 1.85]) block(s, x, 4.2, 3.25, .6, 2.3, .6);
  arch(s, .5, 6.5, 3.25, 1, .4, .6);
  for (const x of [-4.5, -1.6, 2]) beam(s, [x, 2.8, 3.6], [x, x === 2 ? 9 : 6.3, 3.6], .18);
  beam(s, [-4.5, 3.5, 3.6], [-3.1, 4.5, 3.6], .12);
  beam(s, [-1.6, 3.5, 3.6], [-2.8, 4.5, 3.6], .12);
  beam(s, [-4.8, 3.3, 3.6], [2.2, 3.3, 3.6], .22);
  for (const z of [-2.8, 0, 2.8]) {
    beam(s, [-4.6, 4.5, z], [-1.1, 6.8, z], .2);
    beam(s, [-1.1, 6.8, z], [1.8, 5, z], .2);
  }
  for (let j = 0; j < 4; j++) for (let k = 0; k < Math.min(2, 4 - j); k++) s.poly([[-4.8 + j * .5, 4.45 + j * .33, 2.65 + k * .6], [-4.3 + j * .5, 4.78 + j * .33, 2.65 + k * .6], [-4.3 + j * .5, 4.78 + j * .33, 3.23 + k * .6], [-4.8 + j * .5, 4.45 + j * .33, 3.23 + k * .6]], ROOF, { two: true, skin: 'flat' });
  // Side wheel: rotate its XY plane into ZY, fixed axle along X.
  s.at(3.3, 3.1, 0, Math.PI / 2, () => wheel(s, 3, 1.2, false));
  block(s, 4.65, 0, 0, .7, 2.65, 1.5);
  s.tube([[1.8, 3.1, 0], [4.9, 3.1, 0]], [.22, .22], 8, BRASS, { cap: 'both' });
  for (const [x, y] of [[2, 8.7], [-3.4, 4], [-4.4, 3.3]]) ivy(s, x, y, 3.65, 2.5);
  s.shadowBox(-1.4, 0, 0, 7.3, 3.2, 6.5);
  return s.done();
}

/** Deck y=2, river y=.8. Piles start y=0; site may extend them below the bed.
 * Three metres above deck, five including foundations. Caller supplies walk collision. */
export function jetty(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(4030, detail);
  for (const x of [-1.7, 1.7]) {
    s.box(x, 1.55, 0, .25, .35, 12, WOOD, { bevel: .04, skin: 'grain' });
    for (let i = 0; i < 6; i++) {
      const z = -5.7 + i * 2.28;
      s.cyl(x, 0, z, .21, .18, 2.25, 8, P.plankDark, { cap: 'both', capTone: P.plankLight, skin: 'grain' });
      s.cyl(x, 1.6, z, .225, .225, .3, 8, P.iron);
      if (i < 5) {
        beam(s, [x, .65, z], [x, 1.65, z + 2.28], .11);
        beam(s, [x, 1.65, z], [x, .65, z + 2.28], .11);
      }
    }
  }
  for (let i = 0; i < 30; i++) s.box(0, 1.85, -5.8 + i * .4, 4, .15, .37, i % 3 ? P.plankLight : P.plank, { bevel: .025, skin: 'grain' });
  beam(s, [-1.7, .5, 5.7], [1.7, 1.6, 5.7], .12);
  beam(s, [1.7, .5, 5.7], [-1.7, 1.6, 5.7], .12);
  s.cyl(1.4, 2, 5, .27, .25, .65, 12, WOOD, { skin: 'grain' });
  for (let i = 0; i < 4; i++) s.cyl(1.4, 2.1 + i * .1, 5, .29, .29, .065, 10, P.burlapLight);
  beam(s, [1.7, 2, 5.7], [1.7, 4.85, 5.7], .1);
  beam(s, [1.7, 4.85, 5.7], [.7, 4.85, 5.7], .1);
  beam(s, [1.7, 4.3, 5.7], [1, 4.85, 5.7], .075);
  s.box(.7, 4.05, 5.7, .36, .5, .36, P.lamp, { glow: 1 });
  for (const y of [4, 4.55]) s.box(.7, y, 5.7, .48, .08, .48, BRASS);
  for (const dx of [-.2, .2]) for (const dz of [-.2, .2]) s.box(.7 + dx, 4.08, 5.7 + dz, .04, .47, .04, BRASS);
  beam(s, [.7, 4.63, 5.7], [.7, 4.85, 5.7], .04, BRASS);
  s.light(.7, 4.3, 5.7);
  s.shadowBox(0, 1.55, 0, 4, .45, 12);
  return s.done();
}
