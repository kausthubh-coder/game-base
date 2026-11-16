// Draws the models of the Hollowmere town kit that the region plan sets down (content/town/a.ts and b.ts).
//
// The kit is not part of the start-up load. Until it arrives, each building and landmark stands as a plain
// block of plaster under a teal roof, the size of its body. When the hero comes within LOAD_REACH blocks of
// the town, the kit's Draco-compressed GLBs and Three's Draco decoder are fetched in the
// background, and the placed models of each square of CELL blocks are merged into two meshes, one for their
// painted Body and one for the warm Glow of their windows and lanterns. A square within `cityReach`
// (src/content/quality.ts) of the hero is drawn so, two draw calls and their shadows; past it the square keeps its
// far versions: a few dozen triangles each in the shape of its roofs and walls, wearing pictures of its model
// (src/features/painted/far-buildings.ts), as the city's far buildings are. Each square is culled on its own, so the
// town's shadow costs only the squares the sun's shadow camera sees. Outside the painted world a far square keeps its
// stand-ins.
//
// The Glow is dim by day and brighter than white at night, so the bloom of the final picture catches it.
// The light on the ground comes from blocks of lantern light the plan puts beside the lamps and doors.
// A building that stands between the camera and the hero fades to a dither, the way blocks are cut away.
// In the painted world the bodies take the painted light and its air, and the kit is fetched from much
// farther off, so the town shows across the vale.
// Without models in the plan, nothing is drawn or loaded.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { QUALITY } from '../../content/quality.ts';
import { TOWN_MODELS } from '../../content/town-kit.ts';
import { createFarBuildings, paint, type FarBuildings, type FarPart } from '../../features/painted/index.ts';
import { darkness } from '../../features/props/light.sim.ts';
import { REGION } from '../content/region.ts';
import { placedModels } from '../region/land.sim.ts';
import type { GameView } from '../shell/view.ts';

/** The most buildings that can fade. A street prop never fades. */
const FADERS = 48;
/** The glow of a window by day and by night, as linear colour. Night is above 1, for the bloom. */
const DAY_GLOW = new THREE.Color(0.55, 0.42, 0.22), NIGHT_GLOW = new THREE.Color(2.1, 1.25, 0.5);
/** How faded a building between the camera and the hero is, and how fast it gets there, per second. */
const FADED = 0.28, FADE_RATE = 6;
/** The kit is fetched once the hero is this many blocks from the town's middle. The game starts about 185 away. */
const LOAD_REACH = 140;
/** The same in the painted world, where the town can be seen from as far as the far land reaches. */
const PAINTED_REACH = 330;
/**
 * The town is merged in squares of this many blocks, each drawn whole or as its stand-ins by its distance. The
 * squares start SHIFT blocks off the grid, where the old town falls into four of about the same size: each
 * square is two draw calls, so fewer is cheaper, and one is no cheaper than the whole town.
 */
const CELL = 48, SHIFT = 8;
/** Seconds between choosing again which squares are drawn whole. */
const EVERY = 0.5;
const WHITE = new THREE.Color(1, 1, 1);
/** The stand-ins' plaster walls and teal roofs, as linear colour. */
const PLASTER = new THREE.Color(0xe6dcc5), ROOF = new THREE.Color(0x397876);

interface Part { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }

type Kit = Map<string, { body: Part | null; glow: Part | null }>;

/** One body and at most one glow per kit model, in the model's own space, Draco-decoded. */
async function loadKit(names: readonly string[]): Promise<Kit> {
  const [{ GLTFLoader }, { DRACOLoader, DRACO_GLTF_CONFIG }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
  ]);
  // The glTF build of Three's Draco decoder, which the bundler ships beside the code.
  const draco = new DRACOLoader().setDecoderPath(DRACO_GLTF_CONFIG);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const base = new URL('assets/', document.baseURI).href;
  const manifest = await (await fetch(`${base}manifest.json`)).json() as { models: Record<string, { file: string }> };
  const kit: Kit = new Map();
  await Promise.all(names.map(async (name) => {
    const gltf = await loader.loadAsync(base + manifest.models[`town-${name}`].file);
    gltf.scene.updateMatrixWorld(true);
    const found = { body: null as Part | null, glow: null as Part | null };
    gltf.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const material = node.material as THREE.Material;
      const part = { geometry: node.geometry as THREE.BufferGeometry, matrix: node.matrixWorld.clone() };
      if (/glow/i.test(material.name)) found.glow = part; else found.body = part;
      material.dispose();
    });
    kit.set(name, found);
  }));
  draco.dispose();
  return kit;
}

export function install(view: GameView): void {
  const placed = placedModels();
  if (placed.length === 0) return;

  // Buildings and landmarks fade; the index each one fades by, or -1.
  const fader = new Map<number, number>();
  const boxes: { x0: number; x1: number; y1: number; z0: number; z1: number }[] = [];
  placed.forEach((m, i) => {
    const def = TOWN_MODELS[m.plan.model];
    if (def.category === 'street' || boxes.length >= FADERS) return;
    fader.set(i, boxes.length);
    boxes.push({ x0: m.x0, x1: m.x1 + 1, y1: REGION.townGround + def.size[1], z0: m.z0, z1: m.z1 + 1 });
  });

  /** All the placed copies of one part (body or glow) as one geometry, with the fader each vertex follows. */
  function merge(kit: Kit, which: 'body' | 'glow', of: ReadonlySet<number>): THREE.BufferGeometry | null {
    let vertices = 0, indices = 0;
    for (let n = 0; n < placed.length; n++) {
      if (!of.has(n)) continue;
      const part = kit.get((placed[n] as (typeof placed)[number]).plan.model)?.[which];
      if (!part) continue;
      vertices += part.geometry.getAttribute('position').count;
      indices += part.geometry.index?.count ?? part.geometry.getAttribute('position').count;
    }
    if (vertices === 0) return null;
    const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), color = new Float32Array(vertices * 3);
    const fade = new Float32Array(vertices), index = new Uint32Array(indices);
    const place = new THREE.Matrix4(), turn = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), v = new THREE.Vector3();
    let vAt = 0, iAt = 0;
    placed.forEach((m, n) => {
      const part = kit.get(m.plan.model)?.[which];
      if (!part || !of.has(n)) return;
      place.makeRotationY(m.rotation).setPosition(m.x, REGION.townGround, m.z).multiply(turn.copy(part.matrix));
      normalMatrix.getNormalMatrix(place);
      const g = part.geometry, p = g.getAttribute('position'), nrm = g.getAttribute('normal'), col = g.getAttribute('color');
      const own = fader.get(n) ?? -1;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(place);
        position.set([v.x, v.y, v.z], (vAt + i) * 3);
        if (nrm) { v.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize(); normal.set([v.x, v.y, v.z], (vAt + i) * 3); }
        if (col) color.set([col.getX(i), col.getY(i), col.getZ(i)], (vAt + i) * 3); else color.fill(1, (vAt + i) * 3, (vAt + i) * 3 + 3);
        fade[vAt + i] = own;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) index[iAt + i] = g.index.getX(i) + vAt;
      else for (let i = 0; i < p.count; i++) index[iAt + i] = vAt + i;
      vAt += p.count;
      iAt += g.index?.count ?? p.count;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('aFader', new THREE.BufferAttribute(fade, 1));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }

  const fades = new Float32Array(FADERS).fill(1);
  const uniforms = { uFade: { value: fades } };
  /** Discards a dither of the pixels of a building that fades, by its fader's share. */
  const dither = (material: THREE.Material): void => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFade = uniforms.uFade;
      shader.vertexShader = `attribute float aFader;\nuniform float uFade[${FADERS}];\nvarying float vFade;\n` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vFade = aFader < 0.0 ? 1.0 : uFade[int(aFader)];`);
      shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (vFade < 0.99 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;`);
    };
  };

  const group = new THREE.Group();
  group.name = 'town models';
  // The painted body: the same fade, written as the painted light's own hooks, and air instead of the near world's edge.
  const bodyMaterial = view.painted
    ? paint({
      vertexColors: true, brush: 0.22, bands: 0.55, wrap: 0.25, brushScale: 0.22, see: 'solid',
      uniforms: { uFade: uniforms.uFade },
      vertexPars: `attribute float aFader;\nuniform float uFade[${FADERS}];\nvarying float vFade;`,
      vertexBegin: 'vFade = aFader < 0.0 ? 1.0 : uFade[int(aFader)];',
      fragmentPars: 'varying float vFade;',
      fragmentAlbedo: 'if (vFade < 0.99 && fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) > vFade) discard;',
      fragmentFinal: 'vec3 outgoingLight = paintAir(paintShade(diffuseColor.rgb, paintLit(0.0))) + totalEmissiveRadiance;',
    })
    : new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: DAY_GLOW.clone() });
  if (!view.painted) dither(bodyMaterial);
  dither(glowMaterial);
  view.scene.add(group);

  // ---- the squares: which placed models each holds, and the nearest a square's models come to a point
  interface Square { of: Set<number>; x0: number; x1: number; z0: number; z1: number; standIn: THREE.Mesh | null; body: THREE.Mesh | null; glow: THREE.Mesh | null; triangles: number; d: number; whole: boolean }
  const squares = new Map<string, Square>();
  /** The square each placed model is in. */
  const squareOf: Square[] = [];
  placed.forEach((m, i) => {
    const key = `${Math.floor((m.x + SHIFT) / CELL)},${Math.floor((m.z + SHIFT) / CELL)}`;
    let square = squares.get(key);
    if (!square) squares.set(key, (square = { of: new Set(), x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, standIn: null, body: null, glow: null, triangles: 0, d: 0, whole: false }));
    square.of.add(i);
    squareOf[i] = square;
    square.x0 = Math.min(square.x0, m.x0); square.x1 = Math.max(square.x1, m.x1 + 1);
    square.z0 = Math.min(square.z0, m.z0); square.z1 = Math.max(square.z1, m.z1 + 1);
  });

  // ---- the stand-ins: a block of wall over each body's solid columns, and a roof over its footprint
  const standInOf = (of: ReadonlySet<number>): THREE.Mesh | null => {
    const parts: THREE.BufferGeometry[] = [];
    const paint = (geometry: THREE.BufferGeometry, color: THREE.Color, own: number): THREE.BufferGeometry => {
      const n = geometry.getAttribute('position').count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute('aFader', new THREE.BufferAttribute(new Float32Array(n).fill(own), 1));
      geometry.deleteAttribute('uv');
      return geometry;
    };
    placed.forEach((m, i) => {
      const def = TOWN_MODELS[m.plan.model];
      if (!of.has(i) || def.category === 'street' || m.solid.length === 0) return;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < m.solid.length; k += 2) {
        x0 = Math.min(x0, m.solid[k]); x1 = Math.max(x1, m.solid[k] + 1);
        z0 = Math.min(z0, m.solid[k + 1]); z1 = Math.max(z1, m.solid[k + 1] + 1);
      }
      const wall = Math.max(2, def.size[1] * 0.55), roof = def.size[1] - wall;
      parts.push(paint(new THREE.BoxGeometry(x1 - x0, wall, z1 - z0).translate((x0 + x1) / 2, REGION.townGround + wall / 2, (z0 + z1) / 2), PLASTER, fader.get(i) ?? -1));
      parts.push(paint(new THREE.BoxGeometry(m.x1 + 1 - m.x0, Math.max(0.6, roof), m.z1 + 1 - m.z0).translate((m.x0 + m.x1 + 1) / 2, REGION.townGround + wall + Math.max(0.6, roof) / 2, (m.z0 + m.z1 + 1) / 2), ROOF, fader.get(i) ?? -1));
    });
    if (parts.length === 0) return null;
    const mesh = new THREE.Mesh(mergeGeometries(parts), bodyMaterial);
    for (const part of parts) part.dispose();
    mesh.name = 'town models: stand-ins';
    mesh.castShadow = QUALITY[view.ctx.quality].propShadows;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  for (const square of squares.values()) square.standIn = standInOf(square.of);

  // ---- the roofs: a hero inside a building has its roof and upper walls lifted (the camera's sight rule)
  for (const m of placed) {
    const def = TOWN_MODELS[m.plan.model];
    if (def.category === 'street' || m.solid.length === 0) continue;
    view.camera.roofs.push({ x0: m.x0, z0: m.z0, x1: m.x1 + 1, z1: m.z1 + 1, floor: REGION.townGround, eaves: REGION.townGround + Math.max(2, def.size[1] * 0.55) });
  }

  // ---- the kit, fetched once, in the background, when the hero comes near
  let loading = false, arrived = false;
  /** The far versions once the kit has come, and the square of each of their copies. */
  let distant: FarBuildings | null = null;
  const copySquare: Square[] = [];
  async function arrive(): Promise<void> {
    const kit = await loadKit([...new Set(placed.map((m) => m.plan.model))]);
    for (const square of squares.values()) {
      const bodyGeometry = merge(kit, 'body', square.of), glowGeometry = merge(kit, 'glow', square.of);
      if (bodyGeometry) {
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.name = 'town models: body';
        // Its shadow costs every triangle of the square again: only where props cast shadows (src/content/quality.ts).
        body.castShadow = QUALITY[view.ctx.quality].propShadows;
        body.receiveShadow = true;
        body.visible = false;
        group.add(body);
        square.body = body;
      }
      if (glowGeometry) {
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.name = 'town models: glow';
        glow.visible = false;
        group.add(glow);
        square.glow = glow;
      }
      square.triangles = ((bodyGeometry?.index?.count ?? 0) + (glowGeometry?.index?.count ?? 0)) / 3;
    }
    // The far versions of the buildings and landmarks, made from the same models before they are let go.
    if (view.painted) {
      const models: string[] = [], parts: FarPart[][] = [], copies: { model: number; matrix: THREE.Matrix4 }[] = [];
      placed.forEach((m, n) => {
        const found = kit.get(m.plan.model);
        if (TOWN_MODELS[m.plan.model].category === 'street' || !found?.body) return;
        let model = models.indexOf(m.plan.model);
        if (model < 0) {
          model = models.push(m.plan.model) - 1;
          const own = (part: Part, color?: THREE.Color): FarPart => ({ geometry: part.geometry, matrix: part.matrix, color: color ?? (part.geometry.getAttribute('color') ? undefined : WHITE) });
          parts.push(found.glow ? [own(found.body), own(found.glow, DAY_GLOW)] : [own(found.body)]);
        }
        copySquare.push(squareOf[n] as Square);
        copies.push({ model, matrix: new THREE.Matrix4().makeRotationY(m.rotation).setPosition(m.x, REGION.townGround, m.z) });
      });
      distant = createFarBuildings(view.renderer, parts, copies);
      group.add(distant.group);
    }
    for (const part of kit.values()) { part.body?.geometry.dispose(); part.glow?.geometry.dispose(); }
    arrived = true;
    since = EVERY;
  }
  /**
   * Draws the squares within `cityReach` of the hero whole, the nearest first, while they fit in `townTriangles`
   * (a body's shadow counted too), and the rest as their far versions, or their stand-ins until those are made.
   */
  let since = EVERY;
  const order = [...squares.values()];
  function choose(x: number, z: number): void {
    const q = QUALITY[view.ctx.quality];
    for (const square of order) square.d = Math.hypot(Math.max(0, square.x0 - x, x - square.x1), Math.max(0, square.z0 - z, z - square.z1));
    order.sort((a, b) => a.d - b.d);
    let budget = q.townTriangles;
    for (const square of order) {
      const cost = square.triangles * (q.propShadows ? 2 : 1);
      square.whole = arrived && square.d < q.cityReach && cost <= budget && (square.body !== null || square.glow !== null);
      if (square.whole) budget -= cost;
      if (square.body) square.body.visible = square.whole;
      if (square.glow) square.glow.visible = square.whole;
      if (square.standIn) square.standIn.visible = !square.whole && distant === null;
    }
    distant?.show((c) => { const square = copySquare[c] as Square; return !square.whole && square.d <= q.landmarkReach; });
  }

  // Once a frame: the windows follow the dark, and a building between the camera and the hero fades.
  const eye = new THREE.Vector3(), head = new THREE.Vector3(), ray = new THREE.Vector3();
  /** The part of the line from the camera to the hero's head inside a box, as shares from `near` to `far`. */
  let near = 0, far = 1;
  const slab = (o: number, d: number, lo: number, hi: number): void => {
    if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) near = 2; return; }
    const t0 = (lo - o) / d, t1 = (hi - o) / d;
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
  };
  const center = REGION.townCenter;
  view.onFrame((dt) => {
    const hero = view.playerPosition;
    if (!loading && Math.hypot(hero.x - center.x, hero.z - center.z) < (view.painted ? PAINTED_REACH : LOAD_REACH)) {
      loading = true;
      arrive().catch((error) => console.warn('[town] the town kit did not load, so its stand-ins stay:', error));
    }
    since += dt;
    if (since >= EVERY) { since = 0; choose(hero.x, hero.z); }
    glowMaterial.color.copy(DAY_GLOW).lerp(NIGHT_GLOW, darkness(view.ctx.ambient.timeOfDay));
    eye.copy(view.ctx.camera.position);
    head.set(hero.x, hero.y + 1.2, hero.z);
    ray.subVectors(head, eye);
    const step = Math.min(1, dt * FADE_RATE);
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      near = 0; far = 1;
      slab(eye.x, ray.x, b.x0, b.x1);
      slab(eye.y, ray.y, -1e9, b.y1);
      slab(eye.z, ray.z, b.z0, b.z1);
      fades[i] += ((near <= far ? FADED : 1) - fades[i]) * step;
    }
  });
}
