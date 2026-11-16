// Draws Saltgate: the models of the quarter (content/saltgate.ts) instanced in the painted light, held to the
// landmarks' triangle budget and reach from the quality table, and the things of grant day no model is made for
// yet, built here as stand-ins: the painted wall over the bunk (the film's own wall), Mina's wall of maps, the
// mirror, the rack with its sword, bow and staff, her ladder, Hobb's porridge, the deeds and the gate's doors.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import muralArt from '../../../demos/opening/art/mural.webp?url';
import { PROPS as MODELS, propDef } from '../../content/props.ts';
import { QUALITY } from '../../content/quality.ts';
import { paint } from '../../features/painted/index.ts';
import { buildProp } from '../../features/props/index.ts';
import { PROPS, SALTGATE, SPOTS } from '../content/saltgate.ts';
import { saltgateAt } from '../opening/land.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The quarter is drawn while the hero is this close to its middle. */
const SHOWN = 420;
/** The models in view are chosen again after this many seconds. */
const EVERY = 0.75;
/** A model already drawn weighs this much more when the models are picked again, so one at the edge of the budget does not blink out and back. */
const KEEP = 1.6;
/** Blocks a hidden building's box grows by before the hero is out from behind it, so it does not flash back for a frame at its edge. */
const HIDE_GROW = 0.6, SHOW_GROW = 1.8;
const G = SALTGATE.ground;

export interface SaltgateDressing {
  /** Shows what the step has: the porridge until breakfast, the weapon taken off the rack, the deeds at the grant. */
  update(state: { ate: boolean; weapon: string | null; grant: boolean }): void;
  readonly group: THREE.Group;
}

// ---------------------------------------------------------------------------------------------- stand-in kit

/** Simple shapes in one colour each, merged into one geometry with vertex colours. */
class Kit {
  private parts: THREE.BufferGeometry[] = [];
  add(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    const c = new THREE.Color(color).convertSRGBToLinear();
    const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }
  box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0, rz = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, 0, ry, rz);
  }
  rod(r: number, h: number, color: number, x: number, y: number, z: number, rx = 0, rz = 0): this {
    return this.add(new THREE.CylinderGeometry(r, r, h, 6), color, x, y, z, rx, 0, rz);
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts) as THREE.BufferGeometry;
    g.computeVertexNormals();
    return g;
  }
}

const OAK = 0x8a5a32, WALNUT = 0x5a3a24, BRASS = 0xb58c47, STEEL = 0xc9ccd3, PAPER = 0xefe4c8, PORRIDGE = 0xe9d9b0, BOWL = 0x7a5236;

/** The rack in the yard against the west wall: a frame, then the three weapons, each its own mesh so one can be taken. */
function rack(): { frame: THREE.BufferGeometry; sword: THREE.BufferGeometry; bow: THREE.BufferGeometry; staff: THREE.BufferGeometry } {
  const frame = new Kit()
    .box(0.12, 1.7, 0.12, OAK, 0, 0, -1.1).box(0.12, 1.7, 0.12, OAK, 0, 0, 1.1)
    .box(0.1, 0.1, 2.4, WALNUT, 0, 0.35, 0).box(0.1, 0.1, 2.4, WALNUT, 0, 1.45, 0)
    .box(0.5, 0.08, 2.3, OAK, 0.2, 0.05, 0)
    .build();
  const sword = new Kit()
    .box(0.05, 1.0, 0.1, STEEL, 0.12, 0.35, -0.7).box(0.07, 0.07, 0.36, BRASS, 0.12, 1.3, -0.7).box(0.06, 0.26, 0.06, WALNUT, 0.12, 1.36, -0.7)
    .build();
  const arc = new THREE.TorusGeometry(0.62, 0.035, 5, 12, Math.PI * 0.9);
  const bow = new Kit()
    .add(arc, WALNUT, 0.16, 0.95, 0, 0, Math.PI / 2, Math.PI * 0.55)
    .add(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 3), PAPER, 0.16, 0.95, -0.06)
    .build();
  const staff = new Kit()
    .rod(0.04, 1.75, OAK, 0.12, 0.95, 0.7)
    .add(new THREE.OctahedronGeometry(0.11), 0x7fd6c8, 0.12, 1.88, 0.7)
    .add(new THREE.TorusGeometry(0.1, 0.02, 4, 8), BRASS, 0.12, 1.76, 0.7, Math.PI / 2)
    .build();
  return { frame, sword, bow, staff };
}

function ladder(): THREE.BufferGeometry {
  const k = new Kit();
  const tilt = 0.22;
  k.add(new THREE.BoxGeometry(0.08, 3.6, 0.08), OAK, -0.3, 1.75, 0.45, tilt).add(new THREE.BoxGeometry(0.08, 3.6, 0.08), OAK, 0.3, 1.75, 0.45, tilt);
  for (let i = 0; i < 7; i++) k.add(new THREE.BoxGeometry(0.6, 0.06, 0.06), WALNUT, 0, 0.35 + i * 0.45, 0.9 - i * 0.1, tilt);
  return k.build();
}

function porridge(): THREE.BufferGeometry {
  return new Kit()
    .add(new THREE.SphereGeometry(0.16, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BOWL, 0, 0.16, 0)
    .add(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 10), PORRIDGE, 0, 0.15, 0)
    .add(new THREE.BoxGeometry(0.03, 0.3, 0.03), STEEL, 0.03, 0.26, 0, 0, 0, 0.3)
    .build();
}

function deeds(): THREE.BufferGeometry {
  const k = new Kit();
  for (let i = 0; i < 6; i++) k.box(0.32, 0.015, 0.42, PAPER, -0.9 + (i % 3) * 0.6, i * 0.004, -0.2 + Math.floor(i / 3) * 0.5, (i * 0.37) % 0.3);
  k.box(0.08, 0.12, 0.08, WALNUT, 0.8, 0, 0.1).rod(0.008, 0.3, PAPER, 0.82, 0.24, 0.1, 0, 0.4);
  return k.build();
}

function mirrorFrame(): THREE.BufferGeometry {
  return new Kit()
    .box(0.08, 1.9, 1.1, BRASS, 0, 0, 0).box(0.1, 0.12, 1.25, WALNUT, 0.02, 1.88, 0).box(0.1, 0.12, 1.25, WALNUT, 0.02, -0.04, 0)
    .build();
}

function gateLeaves(): THREE.BufferGeometry {
  // The guild's door: two oak leaves standing open against the gate's posts, banded in brass.
  const k = new Kit();
  for (const side of [-1, 1]) {
    const x = side * 2.1;
    k.box(0.12, 3, 1.9, OAK, x, 0, 0.95).box(0.14, 0.1, 1.9, BRASS, x, 0.5, 0.95).box(0.14, 0.1, 1.9, BRASS, x, 2.3, 0.95);
  }
  return k.build();
}

// ---------------------------------------------------------------------------------------------- the map wall

/** Mina's wall: survey sheets pinned edge to edge, and last year's and this year's of plot forty-one side by side. */
function mapWall(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.fillStyle = '#5a3a24';
  x.fillRect(0, 0, 1024, 512);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sheet = (sx: number, sy: number, w: number, h: number, tone: string, wood: string | null) => {
    x.save();
    x.translate(sx + w / 2, sy + h / 2);
    x.rotate((rand() - 0.5) * 0.05);
    x.fillStyle = 'rgba(20,10,0,0.35)';
    x.fillRect(-w / 2 + 5, -h / 2 + 6, w, h);
    x.fillStyle = tone;
    x.fillRect(-w / 2, -h / 2, w, h);
    // Coast, river and hills in ink.
    x.strokeStyle = 'rgba(70,52,34,0.75)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-w / 2 + 8, -h / 2 + h * (0.3 + rand() * 0.4));
    for (let i = 1; i <= 6; i++) x.lineTo(-w / 2 + (w / 6) * i, -h / 2 + h * (0.2 + rand() * 0.6));
    x.stroke();
    x.strokeStyle = 'rgba(64,110,140,0.85)';
    x.beginPath();
    x.moveTo(w * (rand() - 0.5) * 0.6, -h / 2);
    x.quadraticCurveTo(w * (rand() - 0.5), 0, w * (rand() - 0.5) * 0.6, h / 2);
    x.stroke();
    if (wood) {
      x.fillStyle = wood;
      x.beginPath();
      x.ellipse(-w * 0.12, -h * 0.18, w * 0.22, h * 0.14, 0.2, 0, Math.PI * 2);
      x.fill();
      // Plot forty-one, ringed in red.
      x.strokeStyle = '#a63c2c';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(w * 0.05, h * 0.18, 12, 0, Math.PI * 2);
      x.stroke();
    }
    x.fillStyle = '#b58c47';
    x.beginPath();
    x.arc(0, -h / 2 + 7, 4, 0, Math.PI * 2);
    x.fill();
    x.restore();
  };
  const tones = ['#ecdfbf', '#e2d2ac', '#efe6cf', '#dccaa0'];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
    if (row === 1 && (col === 2 || col === 3 || col === 4)) continue;
    sheet(14 + col * 144 + rand() * 10, 12 + row * 166 + rand() * 8, 120 + rand() * 14, 140 + rand() * 12, tones[(row + col) % 4], null);
  }
  // The two surveys of Greenhollow at the middle, a year apart: the wood north of the plot green, then grey.
  sheet(300, 176, 200, 160, '#f1e7cc', '#5e8a4a');
  sheet(520, 176, 200, 160, '#f1e7cc', '#8d8a86');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ---------------------------------------------------------------------------------------------- the dressing

export function createSaltgateDressing(view: GameView): SaltgateDressing {
  const group = new THREE.Group();
  group.name = 'saltgate';
  group.visible = false;
  view.scene.add(group);

  const material = paint({ vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22, see: 'solid' });
  const turn = new THREE.Quaternion(), at = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);

  // ---- the models, one instanced mesh a model and variant
  interface Spot { x: number; z: number; big: number; matrix: THREE.Matrix4; box: THREE.Box3; drawn: boolean }
  interface Kind { mesh: THREE.InstancedMesh; triangles: number; big: number; size: THREE.Box3; spots: Spot[] }
  const kinds = new Map<string, Kind>();
  const missing = new Set<string>();
  for (const p of PROPS) {
    if (!Object.hasOwn(MODELS, p.model)) { missing.add(p.model); continue; }
    const variant = Math.min(p.variant ?? 0, propDef(p.model).variants.length - 1);
    const key = `${p.model}:${variant}`;
    let kind = kinds.get(key);
    if (!kind) {
      const geometry = buildProp(p.model, variant);
      const count = PROPS.filter((q) => q.model === p.model && Math.min(q.variant ?? 0, propDef(p.model).variants.length - 1) === variant).length;
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = `saltgate: ${key}`;
      mesh.count = 0;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
      const index = geometry.index;
      geometry.computeBoundingBox();
      const size = geometry.boundingBox as THREE.Box3;
      const big = Math.max(size.max.x - size.min.x, size.max.y - size.min.y, size.max.z - size.min.z);
      kind = { mesh, triangles: (index ? index.count : geometry.getAttribute('position').count) / 3, big, size, spots: [] };
      kinds.set(key, kind);
    }
    const w = saltgateAt(p.x, p.z, p.y ?? G);
    at.set(w.x, w.y, w.z);
    turn.setFromAxisAngle(up, p.turn ?? 0);
    const s = p.scale ?? 1;
    const matrix = new THREE.Matrix4().compose(at, turn, one.clone().setScalar(s));
    kind.spots.push({ x: w.x, z: w.z, big: kind.big * s, matrix, box: kind.size.clone().applyMatrix4(matrix), drawn: false });
  }
  if (missing.size) console.debug(`[saltgate] models not made yet, so not drawn: ${[...missing].join(', ')}`);

  const chosen: { kind: Kind; spot: Spot; weight: number }[] = [];
  /** Picks the models in reach, the largest and nearest first, within the triangle budget. */
  function choose(): void {
    const p = view.playerPosition, q = QUALITY[view.ctx.quality];
    const all: { kind: Kind; spot: Spot; weight: number }[] = [];
    for (const kind of kinds.values()) for (const spot of kind.spots) {
      const d = Math.hypot(spot.x - p.x, spot.z - p.z);
      if (d > Math.min(q.landmarkReach, 60 + spot.big * 12)) continue;
      all.push({ kind, spot, weight: (spot.big / Math.max(6, d)) * (spot.drawn ? KEEP : 1) });
    }
    all.sort((a, b) => b.weight - a.weight);
    for (const c of chosen) c.spot.drawn = false;
    chosen.length = 0;
    let budget = q.landmarkTriangles;
    for (const c of all) {
      if (c.kind.triangles > budget) continue;
      budget -= c.kind.triangles;
      c.spot.drawn = true;
      chosen.push(c);
    }
    for (const kind of kinds.values()) kind.mesh.castShadow = q.propShadows;
    hiddenKey = -1;
  }

  // A building between the camera and the hero steps aside while it is there, as the town's do.
  const eye = new THREE.Vector3(), lens = new THREE.Vector3(), toward = new THREE.Vector3(), hitAt = new THREE.Vector3(), ray = new THREE.Ray(), grown = new THREE.Box3();
  const hidden = new Set<Spot>(), wasHidden = new Set<Spot>();
  let hiddenKey = -1;
  function show(): void {
    eye.set(view.playerPosition.x, view.playerPosition.y + 1, view.playerPosition.z);
    lens.copy(view.ctx.camera.position);
    const reach = eye.distanceTo(lens);
    ray.set(eye, toward.copy(lens).sub(eye).normalize());
    wasHidden.clear();
    for (const spot of hidden) wasHidden.add(spot);
    hidden.clear();
    // A number for what is hidden, so the instances are written again only when it changes.
    let key = 1;
    for (let i = 0; i < chosen.length; i++) {
      const c = chosen[i];
      if (c.spot.big < 4) continue;
      grown.copy(c.spot.box).expandByScalar(wasHidden.has(c.spot) ? SHOW_GROW : HIDE_GROW);
      const hit = ray.intersectBox(grown, hitAt);
      if (hit && hit.distanceTo(eye) < reach) { hidden.add(c.spot); key = (key * 31 + i + 1) % 1_000_000_007; }
    }
    if (key === hiddenKey) return;
    hiddenKey = key;
    for (const kind of kinds.values()) kind.mesh.count = 0;
    for (const c of chosen) if (!hidden.has(c.spot)) c.kind.mesh.setMatrixAt(c.kind.mesh.count++, c.spot.matrix);
    for (const kind of kinds.values()) {
      kind.mesh.instanceMatrix.needsUpdate = true;
      kind.mesh.computeBoundingSphere();
    }
  }

  // ---- the stand-ins
  const place = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, name = ''): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    const w = saltgateAt(x, z, y);
    mesh.position.set(w.x, w.y, w.z);
    mesh.rotation.y = ry;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = `saltgate: ${name}`;
    group.add(mesh);
    return mesh;
  };
  const r = rack();
  const rackAt = { x: 13.2, z: SPOTS.rack.z };
  place(r.frame, rackAt.x, G, rackAt.z, 0, 'rack');
  const weapons = { sword: place(r.sword, rackAt.x, G, rackAt.z, 0, 'sword'), bow: place(r.bow, rackAt.x, G, rackAt.z, 0, 'bow'), staff: place(r.staff, rackAt.x, G, rackAt.z, 0, 'staff') };
  place(ladder(), 42.2, G, 5.1, 0, 'ladder');
  const bowl = place(porridge(), SPOTS.porridge.x, G + 0.8, SPOTS.porridge.z - 0.3, 0, 'porridge');
  const papers = place(deeds(), 39.5, G + 0.8, 22, Math.PI / 2, 'deeds');
  place(mirrorFrame(), 33.96, G + 0.55, SPOTS.mirror.z, 0, 'mirror frame');
  place(gateLeaves(), 28, G, 29.95, 0, 'gate');

  // The painted wall over the bunks: the film's own wall, cut from its picture of the room.
  const loader = new THREE.TextureLoader();
  const mural = loader.load(muralArt);
  mural.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({ map: mural, color: 0xd8d0c4 }));
  const mw = saltgateAt(SPOTS.mural.x, SPOTS.mural.z + 0.03, G + 1.95);
  wall.position.set(mw.x, mw.y, mw.z);
  wall.name = 'saltgate: painted wall';
  group.add(wall);
  // Mina's wall of maps, on the north wall of the map hall.
  const maps = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.4), new THREE.MeshBasicMaterial({ map: mapWall(), color: 0xd8d0c4 }));
  const ww = saltgateAt(SPOTS.maps.x, 5.03, G + 1.9);
  maps.position.set(ww.x, ww.y, ww.z);
  maps.name = 'saltgate: map wall';
  group.add(maps);
  // The glass of the mirror: pale, catching the window's light.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.65), new THREE.MeshBasicMaterial({ color: 0xbfd2d8 }));
  const gw = saltgateAt(33.9, SPOTS.mirror.z, G + 1.5);
  glass.position.set(gw.x, gw.y, gw.z);
  glass.rotation.y = -Math.PI / 2;
  glass.name = 'saltgate: mirror';
  group.add(glass);

  // ---- choosing and showing
  const middle = saltgateAt(64, 40);
  let since = EVERY;
  view.onFrame((dt) => {
    const p = view.playerPosition;
    const near = Math.hypot(p.x - middle.x, p.z - middle.z) < SHOWN;
    group.visible = near;
    if (!near) return;
    since += dt;
    if (since >= EVERY) { since = 0; choose(); }
    show();
  });

  return {
    group,
    update({ ate, weapon, grant }) {
      bowl.visible = !ate;
      papers.visible = grant;
      weapons.sword.visible = weapon !== 'sword';
      weapons.bow.visible = weapon !== 'bow';
      weapons.staff.visible = weapon !== 'staff';
    },
  };
}
