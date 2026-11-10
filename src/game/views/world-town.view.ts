// Draws the models of the Hollowmere town kit that the region plan sets down (content/town/a.ts and b.ts).
// Every placed model is merged into two meshes when the view installs, one for its painted Body and one
// for the warm Glow of its windows and lanterns, so the whole town is two draw calls and their shadows.
//
// The Glow is dim by day and brighter than white at night, so the bloom of the final picture catches it.
// The light on the ground comes from blocks of lantern light the plan puts beside the lamps and doors.
// A building that stands between the camera and the hero fades to a dither, the way blocks are cut away.
// Without models in the plan, nothing is loaded.
import * as THREE from 'three';
import { TOWN_MODELS } from '../../content/town-kit.ts';
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

interface Part { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }

export async function install(view: GameView): Promise<void> {
  const placed = placedModels();
  if (placed.length === 0) return;
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const base = new URL('assets/', document.baseURI).href;
  const manifest = await (await fetch(`${base}manifest.json`)).json() as { models: Record<string, { file: string }> };

  // One body and at most one glow per kit model, in the model's own space.
  const names = [...new Set(placed.map((m) => m.plan.model))];
  const kit = new Map<string, { body: Part | null; glow: Part | null }>();
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
  function merge(which: 'body' | 'glow'): THREE.BufferGeometry | null {
    let vertices = 0, indices = 0;
    for (const m of placed) {
      const part = kit.get(m.plan.model)?.[which];
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
      if (!part) return;
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
  const bodyGeometry = merge('body'), glowGeometry = merge('glow');
  const bodyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: DAY_GLOW.clone() });
  dither(bodyMaterial);
  dither(glowMaterial);
  if (bodyGeometry) {
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.name = 'town models: body';
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
  }
  if (glowGeometry) {
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.name = 'town models: glow';
    group.add(glow);
  }
  for (const part of kit.values()) { part.body?.geometry.dispose(); part.glow?.geometry.dispose(); }
  view.scene.add(group);

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
  view.onFrame((dt) => {
    glowMaterial.color.copy(DAY_GLOW).lerp(NIGHT_GLOW, darkness(view.ctx.ambient.timeOfDay));
    eye.copy(view.ctx.camera.position);
    const hero = view.playerPosition;
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
