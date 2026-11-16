// act1-kit-settlement. Metres, +z front. Runtime placement supplies collision and effects.
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

const WOOD = RAMP.plank;
const WALL = [P.burlapLight, P.plaster, P.plasterLight];
const STONE = [0x9c91a7, 0xdec398, 0xf4deb2];
type Point = [number, number, number];
function softBox(s: Shape, ...args: Parameters<Shape['roundBox']>) {
  if (s.detail >= .75) { s.roundBox(...args); return; }
  const [x, y, z, w, h, d, tone, options] = args;
  s.box(x, y, z, w, h, d, tone, { bevel: Math.min(.04, w / 4, h / 4, d / 4), skin: options?.skin });
}
function plank(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  s.box(x, y, z, w, h, d, WOOD, { bevel: 0, skin: 'grain' });
}
function beam(s: Shape, a: Point, b: Point, r = .09) {
  s.sweep([a, b], [r, r], WOOD, { sides: 6, steps: 1, cap: 'none', skin: 'grain', lump: .02 });
  // Flat cut ends avoid the extra rounded rings of a branch cap.
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const axis = b.map((n, i) => (n - a[i]) / length);
  const u = Math.abs(axis[1]) < .9 ? [-axis[2], 0, axis[0]] : [0, -axis[2], axis[1]];
  const norm = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] /= norm;
  const v = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  for (const centre of [a, b]) s.poly(Array.from({ length: 6 }, (_, i) => centre.map((n, j) => n + r * (u[j] * Math.cos(i * Math.PI / 3) + v[j] * Math.sin(i * Math.PI / 3))) as Point), P.plankLight, { two: true, skin: 'grain' });
}
function stone(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  if (s.detail < .75) s.box(x, y, z, w, h, d, STONE, { bevel: .04, skin: 'stone' });
  else softBox(s, x, y, z, w, h, d, STONE, { round: .06, skin: 'stone', wobble: .015 });
}
function lamp(s: Shape, x: number, y: number, z: number) {
  s.lathe(x, y, z, [[.12, 0], [.17, .08], [.17, .34], [.1, .4]], [P.lamp, P.lampHot], { sides: 6, glow: 1, skin: 'flat' });
  for (const dy of [0, .36]) s.box(x, y + dy, z, .34, .05, .34, P.timber, { skin: 'grain' });
  s.light(x, y + .2, z);
}
// The same sampled surface seats patches and stitching on the canvas.
function canvasY(x: number, z: number) {
  const slope = 1 - Math.abs(x / 1.35);
  const span = Math.cos(Math.PI * z / 3.5);
  const fold = Math.sin(z * 4.6 + slope * 2.8) + .4 * Math.sin(z * 8.5 - slope * 3);
  return .17 + 2.30 * slope ** 1.12 - .23 * span * slope
    + .105 * fold * Math.sin(Math.PI * slope)
    + .065 * (1 - slope) * Math.sin(z * 5.4 + .7);
}
// A curved gable surface, with gently dipped ridge and ragged eaves. Seams live in the skin.
function roof(s: Shape, w: number, d: number, eave: number, rise: number, cloth = false) {
  const nx = s.detail < .75 ? 4 : 8, nz = s.detail < .75 ? 3 : 6, points: number[] = [], tris: number[] = [], hints: number[] = [], uv: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = (i / nx - .5) * w, z = (j / nz - .5) * d;
    const slope = 1 - Math.abs(2 * i / nx - 1);
    const y = eave + rise * slope ** 1.3 - .1 * Math.sin(Math.PI * j / nz) + .025 * Math.cos(i * 3 + j * 2);
    points.push(x, y, z); hints.push(Math.sign(x) * .6, 1, 0); uv.push(z, Math.abs(x));
    if (i < nx && j < nz) { const a = j * (nx + 1) + i; tris.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  }
  s.mesh(points, tris, cloth ? WALL : RAMP.hay, { hints, uvs: uv, skin: cloth ? 'flat' : 'thatch', cavity: .2, mottle: .24 });
  // Downward-facing underside and thick curved eave edges.
  s.mesh(points.map((v, i) => i % 3 === 1 ? v - .1 : v), tris, cloth ? WALL : RAMP.hay, { hints: hints.map(v => -v), skin: cloth ? 'flat' : 'thatch' });
  if (!cloth) {
    // Thick thatch edges follow the roof surface; no round timber-like border.
    for (const j of [0, nz]) for (let i = 0; i < nx; i++) {
      const a = (j * (nx + 1) + i) * 3, b = a + 3;
      s.poly([[points[a], points[a + 1], points[a + 2]], [points[b], points[b + 1], points[b + 2]], [points[b], points[b + 1] - .22, points[b + 2]], [points[a], points[a + 1] - .22, points[a + 2]]], RAMP.hay, { two: true, skin: 'thatch' });
    }
    for (const i of [0, nx]) for (let j = 0; j < nz; j++) {
      const a = (j * (nx + 1) + i) * 3, b = a + (nx + 1) * 3;
      s.poly([[points[a], points[a + 1], points[a + 2]], [points[b], points[b + 1], points[b + 2]], [points[b], points[b + 1] - .22, points[b + 2]], [points[a], points[a + 1] - .22, points[a + 2]]], RAMP.hay, { two: true, skin: 'thatch' });
    }
  }
  if (!cloth) s.sweep([[0, eave + rise, -d / 2], [0, eave + rise - .08, 0], [0, eave + rise, d / 2]], [.16, .18, .16], RAMP.hay, { sides: 8, steps: 2, skin: 'thatch' });
  s.shadowBox(0, eave, 0, w, rise, d);
}
// Interpolate the same triangle used by the roof mesh. Analytic heights alone let
// a small repair intersect a coarse panel, especially at low quality.
function tentSurface(s: Shape, x: number, z: number) {
  const nx = s.detail < .75 ? 8 : 16, nz = s.detail < .75 ? 6 : 12;
  const u = (x / 2.7 + .5) * nx, v = (z / 3.5 + .5) * nz;
  const i = Math.min(nx - 1, Math.max(0, Math.floor(u)));
  const j = Math.min(nz - 1, Math.max(0, Math.floor(v)));
  const fx = u - i, fz = v - j;
  const h = (di: number, dj: number) => canvasY(((i + di) / nx - .5) * 2.7, ((j + dj) / nz - .5) * 3.5);
  return fx >= fz
    ? h(0, 0) * (1 - fx) + h(1, 0) * (fx - fz) + h(1, 1) * fz
    : h(0, 0) * (1 - fz) + h(1, 1) * fx + h(0, 1) * (fz - fx);
}
function tentRoof(s: Shape) {
  const nx = s.detail < .75 ? 8 : 16, nz = s.detail < .75 ? 6 : 12;
  const points: number[] = [], tris: number[] = [], hints: number[] = [], uv: number[] = [], shifts: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = (i / nx - .5) * 2.7, z = (j / nz - .5) * 3.5;
    points.push(x, canvasY(x, z), z); hints.push(Math.sign(x) * .6, 1, 0); uv.push(z, Math.abs(x));
    shifts.push(.19 * Math.sin(z * 4.6 + (1 - Math.abs(x / 1.35)) * 2.8) + .08 * Math.cos(z * 2 - x * 3));
    if (i < nx && j < nz) { const a = j * (nx + 1) + i; tris.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1); }
  }
  const canvas = [P.burlap, P.burlapLight, P.sand, P.plasterLight];
  s.mesh(points, tris, canvas, { hints, uvs: uv, skin: 'plaster', cavity: .4, mottle: .3, shifts });
  // Even the 'flat' skin adds the outdoor sky tint. Sheltered cloth uses the
  // shared material's Lambert path to retain its warm palette in daylight.
  s.mesh(points.map((v, i) => i % 3 === 1 ? v - .014 : v), tris, [P.clay, P.peach, P.cream], { hints: hints.map(v => -v), cavity: .08, light: 0, mottle: .3, shifts });
  s.shadowBox(0, .12, 0, 2.7, 2.35, 3.5);
}
function window(s: Shape, x: number, y: number, z: number, w = .85) {
  s.box(x, y, z, w, .85, .06, P.lamp, { glow: 1, skin: 'flat' });
  for (const dx of [-w / 2, 0, w / 2]) plank(s, x + dx, y - .06, z + .06, .08, .97, .13);
  for (const dy of [-.06, .42, .85]) plank(s, x, y + dy, z + .06, w + .16, .08, .13);
  s.light(x, y + .4, z + .15);
}
// Front opening is exactly 1 x 2 above the .15 floor. No door leaf blocks it.
function room(s: Shape, w: number, d: number, base: number, h: number, open = false, northWindow = false) {
  if (base > 0) { stone(s, -.65, base, 0, w - 1.3, .15, d); stone(s, w / 2 - .65, base, -1.85, 1.3, .15, 1.3); }
  else stone(s, 0, base, 0, w, .15, d);
  const y = base + .15, wallH = h - .15;
  if (base > 0) softBox(s, 0, y, d / 2 - .13, 1, 2, .26, WALL, { skin: 'plaster', round: .04 });
  if (!open) {
    for (const sign of [-1, 1]) {
      s.box(sign * (w / 4 + .25), y, d / 2 - .1, w / 2 - .5, .3, .3, STONE, { bevel: .04, skin: 'stone' });
      plank(s, sign * (w / 4 + .25), y + .65, d / 2 + .03, w / 2 - .5, .14, .16);
      s.box(sign * (w / 2 - .1), y, 0, .3, .3, d, STONE, { bevel: .04, skin: 'stone' });
    }
    s.box(0, y, -d / 2 + .1, w, .3, .3, STONE, { bevel: .04, skin: 'stone' });
    for (const x of [-1, 1]) softBox(s, x * (w / 4 + .25), y, d / 2 - .13, w / 2 - .5, wallH, .26, WALL, { skin: 'plaster', round: .04 });
    softBox(s, 0, y + 2, d / 2 - .13, 1, wallH - 2, .26, WALL, { skin: 'plaster', round: .04 });
    softBox(s, 0, y, -d / 2 + .13, w, wallH, .26, WALL, { skin: 'plaster', round: .04 });
    for (const x of [-w / 2 + .13, w / 2 - .13]) softBox(s, x, y, 0, .26, wallH, d, WALL, { skin: 'plaster', round: .04 });
    for (const x of [-w * .31, w * .31]) window(s, x, y + .9, d / 2 + .015);
    if (northWindow) s.at(0, 0, -d / 2 - .04, Math.PI, () => window(s, 0, y + 1, 0, w - 1));
  }
  for (const x of [-w / 2 + .1, w / 2 - .1]) for (const z of [-d / 2 + .1, d / 2 - .1]) plank(s, x, y, z, .3, wallH, .3);
  if (!open) for (const sign of [-1, 1]) s.at(sign * (w / 2 + .045), 0, 0, sign * Math.PI / 2, () => {
    plank(s, 0, y, .01, .16, wallH, .15);
    plank(s, 0, y + .65, .01, d, .14, .15);
    window(s, -d * .26, y + .95, .03, .7);
  });
  for (const z of [-d / 2, d / 2]) {
    plank(s, 0, base + h - .16, z, w, .18, .22);
    for (const x of [-w / 2 + .2, w / 2 - .2]) beam(s, [x, base + h - .7, z], [x - Math.sign(x) * .6, base + h - .18, z]);
  }
  s.shadowBox(0, base, 0, w, h, d);
}
function gables(s: Shape, w: number, d: number, y: number, rise: number) {
  for (const z of [-d / 2, d / 2]) {
    s.poly([[-w / 2, y, z], [0, y + rise, z], [w / 2, y, z]], WALL, { two: true, skin: 'plaster' });
    beam(s, [-w / 2, y, z], [0, y + rise, z]); beam(s, [0, y + rise, z], [w / 2, y, z]);
    plank(s, 0, y, z + .02, .15, rise, .16);
  }
}
function bed(s: Shape) {
  for (const x of [-.41, .41]) for (const z of [-.87, .87]) s.box(x, 0, z, .16, .4, .16, WOOD, { skin: 'grain' });
  s.box(0, .22, 0, 1, .13, 2, WOOD, { skin: 'grain' });
  if (s.detail < .75) s.box(0, .35, 0, .96, .15, 1.96, WALL, { bevel: .04, skin: 'flat' });
  else softBox(s, 0, .35, 0, .96, .15, 1.96, WALL, { round: .06, skin: 'flat' });
  s.box(0, .5, -.65, .75, .07, .4, P.plasterLight, { skin: 'flat' });
  s.box(0, .5, .35, .97, .035, .65, P.rust, { skin: 'flat' });
  s.shadowBox(0, 0, 0, 1, .5, 2);
}
export function homeBed(_v: number, _def: unknown, detail = 1) { const s = new Shape(9100, detail); bed(s); return s.done(); }
export function homeBedroll(v: number, _def: unknown, detail = 1) {
  const s = new Shape(9101, detail);
  if (v === 0) { if (s.detail < .75) s.box(0, 0, 0, 1, .12, 2, WALL, { bevel: .04, skin: 'flat' }); else softBox(s, 0, 0, 0, 1, .12, 2, WALL, { skin: 'flat', round: .04 }); s.box(0, .12, .3, 1, .025, .7, P.rust, { skin: 'flat' }); }
  else {
    s.sweep([[-.5, .23, 0], [.5, .23, 0]], [.23, .23], WALL, { sides: 8, steps: 1, skin: 'flat' });
    for (const x of [-.3, .3]) s.tube([[x - .04, .23, 0], [x + .04, .23, 0]], [.24, .24], 8, P.timber, { cap: 'none', skin: 'grain' });
  }
  s.shadowBox(0, 0, 0, 1, .12, v ? .5 : 2); return s.done();
}
function drawTent(s: Shape, part: 'all' | 'cloth' | 'frame' | 'furniture') {
  const cloth = part === 'all' || part === 'cloth';
  if (cloth)
  tentRoof(s);
  if (part === 'all' || part === 'frame') {
  for (const z of [-1.65, 1.65]) {
    beam(s, [-1.25, .05, z], [.1, 2.55, z]); beam(s, [1.25, .05, z], [-.1, 2.55, z]);
    for (const x of [-1.42, 1.42]) { plank(s, x, 0, z * 1.15, .12, .28, .12); s.tube([[x, .2, z * 1.15], [x * .75, .5, z]], [.018, .018], 5, P.burlap, { cap: 'none' }); }
  }
  s.sweep([[0, 2.20, -1.8], [0, 1.97, 0], [0, 2.20, 1.8]], [.075, .075, .075], WOOD, { sides: 6, steps: 2, cap: 'none', skin: 'grain', lump: .01 });
  for (const z of [-1.66, 1.66]) for (let i = 0; i < 4; i++) {
    s.tube([[-.13, 2.23 + i * .055, z], [.13, 2.23 + i * .055, z]], [.12, .12], 6, P.burlapLight, { cap: 'none' });
  }
  }
  if (cloth) {
  // The back wall has hanging folds too; a single triangle reads as a hard panel.
  for (let i = 0; i < 8; i++) {
    const x0 = -1.2 + i * .3, x1 = x0 + .3;
    const edge = (x: number): Point => [x, .12, -1.7 + .055 * Math.cos(x * Math.PI / .3)];
    s.poly([edge(x0), edge(x1), [0, 2.4, -1.7]], [P.clay, P.peach, P.cream], { two: true });
  }
  // Tied-back flaps preserve the open triangular entrance.
  for (const sign of [-1, 1]) {
    // Gathered canvas at the tie, opening again into a loose hem at the ground.
    const rows = [[1.28, .89, .1], [1.08, .77, .5], [.84, .75, 1.12], [.66, .38, 1.4], [.42, .10, 1.85], [.08, 0, 2.4]];
    const points: number[] = [], hints: number[] = [], tris: number[] = [];
    // Six samples across three half-waves retain the folds. The previous four
    // samples landed exactly on every zero of sin(4*pi*t), flattening the flap.
    const columns = 6;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= columns; i++) {
      const [outer, inner, y] = rows[j], t = i / columns;
      points.push(sign * (outer + (inner - outer) * t), y - .14 * Math.sin(t * Math.PI) * Math.sin(y / 2.4 * Math.PI), 1.76 + (.065 + .07 * Math.abs(y - 1.12)) * Math.sin(t * Math.PI * 3));
      hints.push(0, 0, 1);
      if (j < rows.length - 1 && i < columns) { const k = j * (columns + 1) + i; tris.push(k, k + 1, k + columns + 2, k, k + columns + 2, k + columns + 1); }
    }
    s.mesh(points, tris, [P.burlap, P.burlapLight, P.plasterLight], { hints, skin: 'plaster', cavity: .35 });
    s.mesh(points, tris, [P.burlap, P.burlapLight], { hints: hints.map(v => -v), skin: 'plaster' });
    for (const y of [1.08, 1.13]) s.tube([[sign * .64, y, 1.81], [sign * .8, y, 1.81]], [.022, .022], 5, P.burlap, { cap: 'none' });
  }
  }
  if (part === 'all' || part === 'furniture') {
  // A thick mattress and folded quilt sit in the visible left half of the doorway.
  softBox(s, -.38, .02, .54, .94, .22, 2, [P.burlap, P.sand, P.plasterLight], { round: .09, skin: 'plaster' });
  softBox(s, -.38, .24, .35, .95, .10, .85, [P.rust, P.burlap, P.burlapLight], { round: .045, skin: 'plaster' });
  softBox(s, -.38, .24, 1.24, .76, .15, .38, [P.burlapLight, P.sand, P.plasterLight], { round: .07, skin: 'plaster' });
  s.at(-.30, 0, .38, 0, () => {
    softBox(s, .67, .02, 1.05, .65, .48, .65, WOOD, { round: .04, skin: 'grain' });
    s.box(.67, .50, 1.05, .68, .09, .68, WOOD, { bevel: .025, skin: 'grain' });
    for (const x of [.45, .89]) s.box(x, .03, 1.40, .065, .55, .035, P.timber, { skin: 'flat' });
    s.box(.67, .38, 1.42, .10, .15, .04, P.ochre, { skin: 'flat' });
    for (const y of [.18, .34]) s.box(.67, y, 1.382, .59, .012, .008, P.oakDark, { skin: 'grain' });
  });
  // Bring the lantern forward into the opening, clear of the near roof slope.
  s.at(-.25, 0, .14, 0, () => {
  // Amber glass stays below the exposure that washes a tiny pane white.
  s.lathe(.15, 1.39, 1.6, [[.10, 0], [.13, .04], [.13, .27], [.08, .30]], [P.ochre, P.gold, P.lamp], { sides: 6, glow: .36, skin: 'flat' });
  for (const y of [1.35, 1.69]) s.box(.15, y, 1.6, .29, .055, .29, P.timber, { skin: 'grain' });
  for (const x of [.025, .275]) for (const z of [1.475, 1.725])
    s.box(x, 1.39, z, .035, .31, .035, P.timber, { skin: 'grain' });
  s.cone(.15, 1.75, 1.6, .18, .10, 6, P.timber, { skin: 'grain' });
  s.light(.15, 1.55, 1.6);
  beam(s, [.15, 1.85, 1.6], [.25, 2.4, 1.6], .018);
  });
  }
  if (cloth) {
  // Subdivided repairs follow the cloth instead of cutting through it as flat quads.
  for (const [cx, cz, tone] of [[.87, .38, P.burlap], [-.9, -.45, P.rust]]) {
    const points: number[] = [], tris: number[] = [], hints: number[] = [], uv: number[] = [];
    for (let j = 0; j <= 6; j++) for (let i = 0; i <= 4; i++) {
      const x = cx + (i / 4 - .5) * .39 + .035 * Math.sin(j * 1.6), z = cz + (j / 6 - .5) * .48 + .025 * Math.sin(i * 2);
      points.push(x, tentSurface(s, x, z) + .028, z); hints.push(Math.sign(cx), 1, 0); uv.push(x, z);
      if (i < 4 && j < 6) { const k = j * 5 + i; tris.push(k, k + 1, k + 6, k, k + 6, k + 5); }
      if ((i === 0 || i === 4 || j === 0 || j === 6) && (i + j) % 2 === 0) {
        s.tube([[x - .025, tentSurface(s, x - .025, z) + .045, z], [x + .025, tentSurface(s, x + .025, z) + .045, z]], [.009, .009], 3, P.burlap, { cap: 'none' });
      }
    }
    s.mesh(points, tris, [P.burlap, tone, P.burlapLight], { hints, uvs: uv, skin: 'plaster', mottle: .24, cavity: .3 });
  }

  }
}
// A painted lantern bounce uses the existing dusk-driven vertex channel. It is
// baked once, stays inside this prop, and adds neither lights nor frame work.
function finishTent(s: Shape) {
  const geometry = s.done();
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), fx = geometry.getAttribute('aFx');
  for (let i = 0; i < p.count; i++) {
    if (fx.getY(i) > 0) continue; // Preserve the glass itself.
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(x) > 1.32 || z < -1.73 || z > 1.8 || y > 2.4) continue;
    // Cloth blocks light from reaching its outward-facing side.
    if (Math.abs(x) > .5 && y > .45 && x * n.getX(i) > 0) continue;
    const dx = -.1 - x, dy = 1.55 - y, dz = 1.74 - z;
    const distance2 = dx * dx + dy * dy + dz * dz;
    const facing = Math.max(0, (dx * n.getX(i) + dy * n.getY(i) + dz * n.getZ(i)) / Math.max(.1, Math.sqrt(distance2)));
    fx.setY(i, .35 * facing / (1 + .16 * distance2));
  }
  return geometry;
}
export function homeTent(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9110, detail); drawTent(s, 'all'); return finishTent(s);
}
/** Construction pieces share the tent's local origin; do not also draw the registry model. */
export function homeTentParts(detail = 1) {
  const frame = new Shape(9110, detail), cloth = new Shape(9110, detail), furniture = new Shape(9110, detail);
  drawTent(frame, 'frame'); drawTent(cloth, 'cloth'); drawTent(furniture, 'furniture');
  return { frame: finishTent(frame), cloth: finishTent(cloth), furniture: finishTent(furniture) };
}
export function homeFire(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9120, detail);
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; s.rock(Math.cos(a) * 1.18, 0, Math.sin(a) * 1.18, .62, .4, .62, STONE, { level: 2, skin: 'rock' }); }
  for (const turn of [-.6, .7]) s.at(0, 0, 0, turn, () => s.sweep([[-.7, .16, 0], [.7, .16, 0]], [.15, .13], [P.umber, P.bark], { sides: 8, steps: 1, skin: 'bark' }));
  s.lathe(0, .08, 0, [[.5, 0], [.4, .1], [.15, .14]], [P.rust, P.lamp], { sides: 12, glow: 1, skin: 'flat' }); s.light(0, .45, 0);
  return s.done();
}
function table(s: Shape, w: number, d: number) {
  for (let i = 0; i < 4; i++) s.box(0, .7, (i - 1.5) * d / 4, w, .1, d / 4 - .015, WOOD, { skin: 'grain' });
  for (const x of [-w / 2 + .25, w / 2 - .25]) { for (const z of [-d * .32, d * .32]) s.box(x, 0, z, .14, .7, .14, WOOD, { skin: 'grain' }); s.box(x, .2, 0, .14, .12, d * .8, WOOD, { skin: 'grain' }); }
  s.shadowBox(0, .7, 0, w, .1, d);
}
export function homeTable(_v: number, _def: unknown, detail = 1) { const s = new Shape(9130, detail); table(s, 3, 1); return s.done(); }
export function homeDinnerTable(_v: number, _def: unknown, detail = 1) { const s = new Shape(9131, detail); table(s, 2, 2); return s.done(); }
export function homeBench(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9132, detail); plank(s, 0, .4, 0, 2, .1, .45); for (const x of [-.7, .7]) plank(s, x, 0, 0, .15, .4, .4); s.shadowBox(0, 0, 0, 2, .5, .45); return s.done();
}
export function homeLamp(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9133, detail); stone(s, 0, 0, 0, .45, .25, .45); plank(s, 0, .2, 0, .16, 2.6, .16); plank(s, .25, 2.65, 0, .6, .12, .14); lamp(s, .45, 2.1, 0); return s.done();
}
function oven(s: Shape) {
  for (const x of [-.78, .78]) stone(s, x, 0, 0, .44, .8, 2);
  stone(s, 0, .75, 0, 2, .2, 2);
  s.sweep([[0, .95, -.65], [0, .95, .7]], [.92, .88], STONE, { sides: 16, steps: 1, bore: .62, gap: Math.PI, cap: 'none', skin: 'stone', floor: .94 });
  s.box(0, .97, .3, .9, .04, 1, P.lamp, { glow: 1, skin: 'flat' }); s.light(0, 1.1, .6);
  s.lathe(0, 1.7, -.5, [[.22, 0], [.18, .1], [.18, 1.15], [.26, 1.2]], [P.iron, P.pewter], { sides: 8, skin: 'flat' });
  s.shadowBox(0, 0, 0, 2, 1.8, 2);
}
export function homeOven(_v: number, _def: unknown, detail = 1) { const s = new Shape(9140, detail); oven(s); return s.done(); }
export function homeKitchen(v: number, _def: unknown, detail = 1) {
  const s = new Shape(9150, detail); room(s, 6, 5, 0, 2.6, true);
  // North and west enclosures leave the east counter open toward the river.
  if (v) {
    for (const x of [-1.75, 1.75]) softBox(s, x, .15, 2.37, 2.5, 2.3, .26, WALL, { skin: 'plaster' });
    softBox(s, 0, 2.15, 2.37, 1, .3, .26, WALL, { skin: 'plaster' });
    softBox(s, 2.87, .15, 0, .26, .75, 5, WALL, { skin: 'plaster' });
    softBox(s, 2.87, 2.2, 0, .26, .25, 5, WALL, { skin: 'plaster' });
    s.at(3.01, 0, 0, Math.PI / 2, () => window(s, 0, 1.1, 0, 3.8));
    softBox(s, 0, .15, -2.37, 5.7, 2.3, .26, WALL, { skin: 'plaster' }); softBox(s, -2.87, .15, -1, .26, 2.3, 2.7, WALL, { skin: 'plaster' }); gables(s, 6, 5, 2.6, 1.3); }
  roof(s, 6.6, 5.6, 2.6, v ? 1.3 : .4, !v);
  s.at(-1.8, .15, -1.2, 0, () => oven(s));
  if (v) { stone(s, -1.8, 2.8, -1.2, .55, 1.6, .55); s.box(-1.8, 4.4, -1.2, .65, .12, .65, P.iron, { skin: 'flat' }); } s.at(0, .15, .5, 0, () => table(s, 3, 1));
  plank(s, 2.55, .15, 0, .5, .7, 4.3); plank(s, 2.55, .85, 0, .8, .1, 4.5); lamp(s, 2.6, 1.8, 2.2);
  return s.done();
}
export function homeSmall(v: number, _def: unknown, detail = 1) {
  const s = new Shape(9160, detail); const y = v === 2 ? 5 : 2.5;
  room(s, 5, 5, 0, 2.5); if (v === 2) room(s, 5, 5, 2.5, 2.5);
  gables(s, 5, 5, y, 1.3); roof(s, 5.6, 5.6, y, 1.3);
  // Shared sleeping room: three beds, an open centre aisle and unobstructed south entry.
  for (const [x, z] of (v === 2 ? [[-1.6, -.9], [-1.6, 1.2], [0, -.9]] : [[-1.6, -.9], [1.6, -.9], [-1.6, 1.2]])) s.at(x, .15, z, 0, () => bed(s));
  if (v === 2) for (let i = 0; i < 10; i++) plank(s, 1.65, .15 + i * .25, 1.65 - i * .3, 1, .25, .32);
  if (v) s.at(0, 0, 3.5, 0, () => { stone(s, 0, 0, 0, 5, .15, 2); for (const x of [-2.35, 2.35]) plank(s, x, .15, .85, .24, 2.15, .24); roof(s, 5.5, 2.3, 2.25, .25); });
  return s.done();
}
export function homeMapRoom(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9170, detail); room(s, 7, 6, 0, 2.8, false, true); gables(s, 7, 6, 2.8, 1.5); roof(s, 7.6, 6.6, 2.8, 1.5);
  s.at(0, .15, -.4, 0, () => table(s, 3, 2)); s.box(0, .96, -.4, 2.6, .015, 1.6, P.sand, { skin: 'flat' });
  s.at(2.5, .15, 0, 0, () => bed(s));
  for (let i = 0; i < 3; i++) s.box(-2.8 + i * .55, 1.65, 3.07, .45, .65, .025, WALL, { skin: 'flat' });
  return s.done();
}
export function homeSmokehouse(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9180, detail); room(s, 3, 4, 0, 2.6, true); roof(s, 3.6, 4.6, 2.6, 1.5);
  softBox(s, 0, .15, -1.85, 3, 2.4, .3, WOOD, { skin: 'grain' });
  s.at(-.5, .15, -.8, 0, () => oven(s)); stone(s, -.5, 2.5, -.9, .55, 2, .55);
  for (const y of [1, 1.6, 2.15]) plank(s, 1.05, y, -.7, .45, .08, 2.2);
  for (let i = 0; i < 5; i++) s.sweep([[.8, 2.2, -1.4 + i * .4], [.8, 1.85, -1.4 + i * .4]], [.07, .12], RAMP.hay, { sides: 6, steps: 1, skin: 'thatch' });
  lamp(s, 1.3, 1.65, 1.8); return s.done();
}
export function homeSeedShed(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9190, detail); room(s, 3, 3, 0, 2.5, true); roof(s, 3.6, 3.6, 2.5, 1.3);
  softBox(s, 0, .15, -1.35, 3, 2.3, .3, WOOD, { skin: 'grain' });
  for (const y of [.35, 1.05]) for (const x of [-.85, 0, .85]) {
    plank(s, x, y, -.9, .8, .4, .6); s.box(x, y + .4, -.9, .65, .04, .45, RAMP.hay, { skin: 'thatch' });
  }
  lamp(s, 1.25, 1.7, 1.2); return s.done();
}
function fence(s: Shape, length: number) {
  const n = Math.ceil(length / 2); for (let i = 0; i <= n; i++) plank(s, -length / 2 + i * length / n, 0, 0, .15, 1, .15);
  for (const y of [.35, .8]) plank(s, 0, y, 0, length, .12, .1);
}
export function homeBeastYard(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9200, detail);
  for (const x of [-3.9, 3.9]) s.at(x, 0, 0, Math.PI / 2, () => fence(s, 5.8));
  s.at(0, 0, -2.9, 0, () => fence(s, 7.8));
  for (const x of [-2.5, 2.5]) s.at(x, 0, 2.9, 0, () => fence(s, 2.8)); // 2.2 m open gate, no leaf.
  s.at(-2.1, 0, -1.7, 0, () => { room(s, 3, 2, 0, 2.3, true); roof(s, 3.5, 2.5, 2.3, 1); });
  stone(s, 2.8, 0, -1.5, .9, .25, 2); for (const x of [2.38, 3.22]) plank(s, x, .25, -1.5, .08, .3, 2);
  for (const z of [-2.45, -.55]) plank(s, 2.8, .25, z, .9, .3, .08);
  return s.done();
}
export function homeWatchPost(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9210, detail); stone(s, 0, 0, 0, 3, .5, 3);
  for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) plank(s, x, .5, z, .18, 2, .18);
  roof(s, 3, 3, 2.5, .2, true); lamp(s, 1, 1.75, 1.1);
  for (let i = 0; i < 2; i++) stone(s, 0, i * .2, 1.7 - i * .15, 1, .2, .5);
  plank(s, -1, 1.2, .5, .6, .65, .08); beam(s, [-1, 1.85, .5], [-1, 2.5, .5], .025);
  return s.done();
}
export function homeHeartstone(v: number, _def: unknown, detail = 1) {
  const s = new Shape(9220, detail);
  stone(s, 0, 0, 0, 10, .03, 10);
  for (const x of [-3, 3]) stone(s, x, .03, 4.8, 4, .65, .4);
  for (const x of [-4.8, 4.8]) stone(s, x, .03, 0, .4, .65, 9.6);
  s.lathe(0, 0, 0, [[1.9, 0], [2, .12], [2, .3], [1.9, .38]], STONE, { sides: 32, skin: 'stone' });
  s.lathe(0, .38, 0, [[.55, 0], [.55, .2], [.45, .26]], STONE, { sides: 16, skin: 'stone' });
  // Twin lobes and a tapering lower point form the heart, all states keep identical geometry.
  s.sweep([[0, .72, 0], [-.4, 1.45, 0], [-.4, 1.8, 0]], [.12, .48, .35], STONE, { sides: 10, steps: 2, skin: 'stone' });
  s.sweep([[0, .72, 0], [.4, 1.45, 0], [.4, 1.8, 0]], [.12, .48, .35], STONE, { sides: 10, steps: 2, skin: 'stone' });
  for (let i = 0; i < 6; i++) s.at(0, 0, 0, i * Math.PI / 3, () => {
    s.poly([[0, .04, 2], [-.5, .04, 3], [0, .04, 4], [.5, .04, 3]], STONE, { two: true, skin: 'stone' });
    const tone = i < v ? P.lumeLight : P.tealDeep;
    s.poly([[0, .05, 2.15], [-.36, .05, 3], [0, .05, 3.85], [.36, .05, 3]], tone, { two: true, glow: i < v ? 2 : 0, skin: 'flat' });
    if (i < v) s.light(0, .1, 3);
  });
  s.sweep([[0, .8, .14], [-.1, 1.2, .43], [.1, 1.5, .45], [0, 1.8, .4]], [.025, .025, .025, .025], v ? P.lumeLight : P.tealDeep, { sides: 6, steps: 1, glow: v ? 2 : 0, skin: 'flat' });
  return s.done();
}

/** Optional door leaf for the caller. Origin is the lower left hinge; rotate around Y.
 * Place at [-.5, .15, depth/2 + .08] for a south-facing entry. The registry models leave
 * their 1 x 2 openings clear. Attach this only once, with collision following its angle. */
export function homeDoorParts(detail = 1) {
  const s = new Shape(9230, detail);
  for (let i = 0; i < 5; i++) plank(s, .1 + i * .2, 0, 0, .195, 1.98, .08);
  for (const y of [.3, 1.5]) s.box(.5, y, .05, .95, .09, .04, P.timber, { skin: 'grain' });
  s.box(.85, .9, .08, .07, .12, .08, P.iron, { skin: 'flat' });
  return { leaf: s.done(), hinge: [0, 0, 0] as const };
}

/** Chairs at the ends of the dinner table; benches seat the other six people. */
export function homeChair(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(9240, detail);
  plank(s, 0, .42, 0, .6, .08, .6);
  for (const x of [-.23, .23]) for (const z of [-.23, .23]) plank(s, x, 0, z, .1, z < 0 ? 1.05 : .42, .1);
  for (const y of [.68, .92]) plank(s, 0, y, -.23, .56, .12, .1);
  s.shadowBox(0, 0, 0, .6, 1.05, .6); return s.done();
}
/** Outbound and return chests use different carved marks, not generated lettering. */
export function homeCarryingChest(v: number, _def: unknown, detail = 1) {
  const s = new Shape(9250, detail);
  s.box(0, 0, 0, 1, .55, .65, WOOD, { bevel: .04, skin: 'grain' });
  s.box(0, .55, 0, 1.02, .1, .67, WOOD, { bevel: .025, skin: 'grain' });
  for (const x of [-.35, .35]) s.box(x, .01, .333, .07, .63, .025, P.iron, { skin: 'flat' });
  s.box(0, .42, .347, .1, .18, .04, P.iron, { skin: 'flat' });
  for (let i = 0; i <= v; i++) s.box(-.08 + i * .16, .16, .334, .06, .14, .02, P.sand, { skin: 'flat' });
  s.shadowBox(0, 0, 0, 1, .65, .67); return s.done();
}
/** Bell origin is its suspension, for rocking around Z. Place at [2.7, 2.2, 2.7]. */
export function homeKitchenBellParts(detail = 1) {
  const s = new Shape(9260, detail);
  s.lathe(0, -.4, 0, [[.2, 0], [.2, .06], [.12, .18], [.1, .32], [.035, .4]], [P.ochre, P.gold, P.butter], { sides: 12, skin: 'flat' });
  s.sweep([[0, -.45, 0], [0, -.25, 0]], [.035, .035], [P.iron, P.pewter], { sides: 6, steps: 1, cap: 'none', skin: 'flat' });
  return { bell: s.done(), pivot: [2.7, 2.2, 2.7] as const };
}
