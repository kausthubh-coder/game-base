// Rebuilds the CC0 stand-in cast from KayKit's Adventurers pack: one small GLB with three bodies on one shared rig,
// and the five clips the game plays. The pack's own files are 3.6 MB each, mostly 76 clips we never play.
//
//   bun tools/models/cast/stand-ins.mjs        downloads the pack's files once into tools/models/cast/.cache/
//                                               and writes public/assets/stand-ins/kaykit/cast.glb
//
// What it does to the pack:
// - Each body is put together from parts of the pack's characters, which all share one rig: a head from one, a
//   body from another. slim is the rogue with the knight's short hair, dress the mage with the rogue's long hair,
//   stout the barbarian. Weapons, shields, hats and helmets are left out. Our own hats are built by code.
// - The pack paints with one texture of swatches. Each vertex keeps the swatch it sampled as a colour slot
//   (skin, hair, top, bottom...) and how light or dark it was, so the game can recolour each person freely.
//   That is the attribute `_TONE`: slot, shade (0 to 255 for 0 to 2), part, 0.
// - A part a person may wear or not (a second head, a beard, a cape) is a part number in `_TONE`. The mesh's
//   `extras.parts` names them in order. Part 0 is always worn.
// - Bones nothing is skinned to (the pack's IK helpers) are dropped. The clips keep only rotations, and the hips'
//   movement.
// - `Talk` is made here from `Idle`: the right arm lifts and turns over, the head nods.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import * as THREE from 'three';

const root = resolve(import.meta.dirname, '../../..');
const cache = resolve(import.meta.dirname, '.cache');
const outDir = resolve(root, 'public/assets/stand-ins/kaykit');
export const SOURCE = 'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0';
const RAW = 'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main';
const FOLDER = 'addons/kaykit_character_pack_adventures/Characters/gltf';
const TEXTURE = { Rogue: 'rogue', Mage: 'mage', Barbarian: 'barbarian', Knight: 'knight' };

/** Colour slots. The game's cast data gives a colour for each. */
const SKIN = 0, HAIR = 1, EYES = 2, TOP = 3, BOTTOM = 4, ACCENT = 5, LEATHER = 6, METAL = 7;

/** Swatch cell (column + 8 x row of the 8 x 4 texture) to slot, per source mesh. Cells not listed are an error. */
const CELLS = {
  Rogue_Head: { 0: SKIN, 1: HAIR, 2: EYES, 3: METAL },
  Mage_Head: { 0: SKIN, 1: HAIR, 2: EYES, 9: ACCENT },
  Knight_Head: { 0: SKIN, 1: HAIR, 2: EYES },
  Barbarian_Head: { 0: SKIN, 1: HAIR, 2: EYES },
  Rogue_Body: { 3: METAL, 5: LEATHER, 6: LEATHER, 8: TOP, 9: ACCENT, 15: BOTTOM },
  Rogue_ArmLeft: { 5: LEATHER, 8: TOP, 9: ACCENT, 21: LEATHER },
  Rogue_LegLeft: { 0: SKIN, 15: BOTTOM, 19: LEATHER },
  Rogue_Cape: { 9: ACCENT },
  Mage_Body: { 3: METAL, 4: ACCENT, 5: LEATHER, 8: TOP, 15: BOTTOM, 16: ACCENT, 18: LEATHER },
  Mage_ArmLeft: { 4: ACCENT, 8: TOP, 23: SKIN },
  Mage_LegLeft: { 15: BOTTOM, 19: LEATHER },
  Barbarian_Body: { 3: METAL, 6: LEATHER, 7: BOTTOM, 8: TOP, 10: ACCENT, 15: BOTTOM },
  Barbarian_ArmLeft: { 3: METAL, 6: LEATHER, 9: TOP, 10: ACCENT, 23: LEATHER },
  Barbarian_LegLeft: { 6: LEATHER, 10: ACCENT, 15: BOTTOM, 19: LEATHER },
};
for (const side of ['Rogue', 'Mage', 'Barbarian']) {
  CELLS[`${side}_ArmRight`] = CELLS[`${side}_ArmLeft`];
  CELLS[`${side}_LegRight`] = CELLS[`${side}_LegLeft`];
}

const limbs = (from) => ['Body', 'ArmLeft', 'ArmRight', 'LegLeft', 'LegRight'].map((mesh) => ({ from, mesh: `${from}_${mesh}` }));

/**
 * The three bodies. Each part is a mesh of a pack character; `part` makes it optional by name. A `split` moves the
 * vertices of a slot below a height to another part, so a beard can come off a head and leave the brows. One head
 * each: a second head would cost its triangles on everyone of that body, worn or not.
 */
const BODIES = {
  slim: [...limbs('Rogue'), { from: 'Knight', mesh: 'Knight_Head' }, { from: 'Rogue', mesh: 'Rogue_Cape', part: 'cape' }],
  dress: [...limbs('Mage'), { from: 'Rogue', mesh: 'Rogue_Head' }],
  stout: [...limbs('Barbarian'), { from: 'Barbarian', mesh: 'Barbarian_Head', split: { slot: HAIR, below: 'eyes', part: 'beard' } }],
};

const CLIPS = { Idle: 'Idle', Walk: 'Walking_A', Run: 'Running_A', Tool: '1H_Melee_Attack_Chop' };
const TALK_SECONDS = 32 / 15;
/** Bones kept even though nothing is skinned to them, so a held thing has a place to hang. */
const KEEP_BONES = ['handslot.r', 'handslot.l'];

// ------------------------------------------------------------------ reading the pack

async function fetchOnce(file) {
  const path = resolve(cache, file.split('/').pop());
  if (!existsSync(path)) {
    mkdirSync(cache, { recursive: true });
    const response = await fetch(`${RAW}/${file}`);
    if (!response.ok) throw new Error(`${file}: the server answered ${response.status}`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
    console.log(`downloaded ${file}`);
  }
  return path;
}

const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARRAY = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function readGlb(path) {
  const buf = readFileSync(path);
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString());
  const bin = buf.subarray(28 + jsonLength);
  const accessor = (index) => {
    const a = json.accessors[index];
    const view = json.bufferViews[a.bufferView];
    const Type = ARRAY[a.componentType];
    const size = SIZE[a.type];
    const start = bin.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = view.byteStride ?? size * Type.BYTES_PER_ELEMENT;
    const out = new Type(a.count * size);
    const bytes = new DataView(bin.buffer);
    for (let i = 0; i < a.count; i++) {
      for (let k = 0; k < size; k++) {
        const at = start + i * stride + k * Type.BYTES_PER_ELEMENT;
        out[i * size + k] = Type === Float32Array ? bytes.getFloat32(at, true) : Type === Uint8Array ? bytes.getUint8(at)
          : Type === Uint16Array ? bytes.getUint16(at, true) : bytes.getUint32(at, true);
      }
    }
    return out;
  };
  const parent = [];
  json.nodes.forEach((node, i) => (node.children ?? []).forEach((c) => { parent[c] = i; }));
  const local = (i) => {
    const n = json.nodes[i];
    return new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
  };
  const world = (i) => (parent[i] === undefined ? local(i) : world(parent[i]).multiply(local(i)));
  const nodeNamed = (name) => {
    const i = json.nodes.findIndex((n) => n.name === name);
    if (i < 0) throw new Error(`${path}: no node named ${name}`);
    return i;
  };
  return { json, accessor, world, parent, nodeNamed };
}

// ------------------------------------------------------------------ the parts

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** One mesh of the pack in the rig's bind pose, with slots, shades and joints named by bone. */
async function readPart(glbs, textures, spec, slotReference) {
  const glb = glbs[spec.from];
  const node = glb.nodeNamed(spec.mesh);
  const mesh = glb.json.meshes[glb.json.nodes[node].mesh];
  if (mesh.primitives.length !== 1) throw new Error(`${spec.mesh}: expected one primitive`);
  const prim = mesh.primitives[0];
  const position = glb.accessor(prim.attributes.POSITION);
  const normal = glb.accessor(prim.attributes.NORMAL);
  const uv = glb.accessor(prim.attributes.TEXCOORD_0);
  const index = glb.accessor(prim.indices);
  const count = position.length / 3;
  const joints = new Array(count * 4).fill('');
  const weights = new Float32Array(count * 4);
  const skin = glb.json.nodes[node].skin;
  if (skin !== undefined) {
    const jointNodes = glb.json.skins[skin].joints;
    const j = glb.accessor(prim.attributes.JOINTS_0), w = glb.accessor(prim.attributes.WEIGHTS_0);
    for (let i = 0; i < count * 4; i++) {
      weights[i] = w[i];
      joints[i] = w[i] > 0 ? glb.json.nodes[jointNodes[j[i]]].name : '';
    }
  } else {
    // A rigid part on a bone: into the bind pose, with all its weight on that bone.
    let bone = glb.parent[node];
    const matrix = glb.world(node);
    for (let i = 0; i < count; i++) {
      const p = new THREE.Vector3().fromArray(position, i * 3).applyMatrix4(matrix);
      p.toArray(position, i * 3);
      const n = new THREE.Vector3().fromArray(normal, i * 3).transformDirection(matrix);
      n.toArray(normal, i * 3);
      joints[i * 4] = glb.json.nodes[bone].name;
      weights[i * 4] = 1;
    }
  }
  const cells = CELLS[spec.mesh];
  if (!cells) throw new Error(`${spec.mesh}: no cell table`);
  const texture = textures[TEXTURE[spec.from]];
  const slot = new Uint8Array(count), shade = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = uv[i * 2], v = uv[i * 2 + 1];
    const cell = Math.floor(v * 4) * 8 + Math.floor(u * 8);
    if (cells[cell] === undefined) throw new Error(`${spec.mesh}: vertex ${i} samples cell ${cell}, which has no slot`);
    slot[i] = cells[cell];
    const x = Math.min(1023, Math.max(0, Math.floor(u * 1024))), y = Math.min(1023, Math.max(0, Math.floor(v * 1024)));
    const o = (y * 1024 + x) * texture.channels;
    const colour = [texture.data[o] / 255, texture.data[o + 1] / 255, texture.data[o + 2] / 255];
    // How light this vertex is next to the slot's colour in the first part that used the slot. The pack's
    // swatches are gradients, so this keeps its shading; and a darker belt stays darker than a lighter boot.
    const key = slot[i];
    slotReference[key] ??= lum(colour);
    shade[i] = Math.min(2, Math.max(0.25, lum(colour) / Math.max(0.02, slotReference[key])));
  }
  return { name: spec.mesh, position, normal, index, joints, weights, slot, shade };
}

/**
 * Gives every vertex of a part its part number. With a split, the vertices of the split's slot below the eyes go
 * to the split part, and a triangle that joins the two parts gets its own copies of the vertices it shares with
 * the rest: it goes with the split part, so taking that part off leaves no sliver behind.
 */
function assignParts(p, part, splitPart) {
  let count = p.position.length / 3;
  const partOf = new Array(count).fill(part);
  if (splitPart >= 0) {
    let below = Infinity;
    for (let i = 0; i < count; i++) if (p.slot[i] === EYES) below = Math.min(below, p.position[i * 3 + 1]);
    for (let i = 0; i < count; i++) if (p.slot[i] === p.spec.split.slot && p.position[i * 3 + 1] < below) partOf[i] = splitPart;
    const position = [...p.position], normal = [...p.normal], joints = [...p.joints], weights = [...p.weights];
    const slot = [...p.slot], shade = [...p.shade], index = [...p.index];
    const copy = new Map();
    for (let i = 0; i < index.length; i += 3) {
      const tri = [index[i], index[i + 1], index[i + 2]];
      if (!tri.some((k) => partOf[k] === splitPart) || tri.every((k) => partOf[k] === splitPart)) continue;
      for (let k = 0; k < 3; k++) {
        const old = tri[k];
        if (partOf[old] === splitPart) continue;
        if (!copy.has(old)) {
          copy.set(old, count++);
          position.push(...p.position.subarray(old * 3, old * 3 + 3));
          normal.push(...p.normal.subarray(old * 3, old * 3 + 3));
          joints.push(...p.joints.slice(old * 4, old * 4 + 4));
          weights.push(...p.weights.subarray(old * 4, old * 4 + 4));
          slot.push(p.slot[old]);
          shade.push(p.shade[old]);
          partOf.push(splitPart);
        }
        index[i + k] = copy.get(old);
      }
    }
    Object.assign(p, {
      position: Float32Array.from(position), normal: Float32Array.from(normal), joints, weights: Float32Array.from(weights),
      slot: Uint8Array.from(slot), shade: Float32Array.from(shade), index: Uint16Array.from(index),
    });
  }
  p.partOf = Uint8Array.from(partOf);
}

// ------------------------------------------------------------------ clips

/** A glTF animation sampler, evaluated at a time: linear, with slerp for rotations. */
function sampler(glb, s) {
  const times = glb.accessor(s.input), values = glb.accessor(s.output);
  const size = values.length / times.length;
  return (t, out) => {
    let i = 0;
    while (i < times.length - 2 && times[i + 1] <= t) i++;
    const span = times[i + 1] - times[i];
    const f = times.length < 2 || span <= 0 ? 0 : Math.min(1, Math.max(0, (t - times[i]) / span));
    const j = Math.min(times.length - 1, i + 1);
    if (size === 4) {
      const a = new THREE.Quaternion().fromArray(values, i * 4), b = new THREE.Quaternion().fromArray(values, j * 4);
      a.slerp(b, f).toArray(out);
    } else {
      for (let k = 0; k < size; k++) out[k] = values[i * size + k] * (1 - f) + values[j * size + k] * f;
    }
    return out;
  };
}

/** A clip as tracks of bone name and path, sampled at 30 a second, with the times. */
function sampleClip(glb, name, keep, seconds, edit) {
  const anim = glb.json.animations.find((a) => a.name === name);
  if (!anim) throw new Error(`no clip ${name}`);
  const duration = Math.max(...anim.samplers.map((s) => glb.json.accessors[s.input].max[0]));
  const length = seconds ?? duration;
  const frames = Math.round(length * 30);
  const times = Float32Array.from({ length: frames + 1 }, (_, i) => (i / frames) * length);
  const tracks = [];
  for (const channel of anim.channels) {
    const bone = glb.json.nodes[channel.target.node].name;
    if (!keep.has(bone)) continue;
    if (channel.target.path === 'scale') continue;
    if (channel.target.path === 'translation' && bone !== 'hips') continue;
    const read = sampler(glb, anim.samplers[channel.sampler]);
    const size = channel.target.path === 'rotation' ? 4 : 3;
    const values = new Float32Array(times.length * size);
    const v = new Array(size);
    for (let i = 0; i < times.length; i++) {
      read(times[i] % (duration + 1e-6), v);
      edit?.(bone, channel.target.path, times[i], v);
      values.set(v, i * size);
    }
    tracks.push({ bone, path: channel.target.path, values });
  }
  return { times, tracks };
}

/** Turns `q` by `angle` about a bone-local axis. */
function turn(v, axis, angle) {
  const q = new THREE.Quaternion().fromArray(v);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis).normalize(), angle));
  q.toArray(v);
}

/** Idle with a gesture: the right forearm lifts and turns the palm up twice, the head nods with it. */
function talkEdit(bone, path, t, v) {
  if (path !== 'rotation') return;
  const phase = (t / TALK_SECONDS) * Math.PI * 2;
  const lift = 0.5 - 0.5 * Math.cos(phase);          // 0 at the ends, 1 in the middle
  const beat = Math.sin(phase * 2);
  if (bone === 'upperarm.r') turn(v, [1, 0, 0], -0.55 * lift);
  if (bone === 'lowerarm.r') turn(v, [1, 0, 0], -0.9 * lift - 0.15 * beat * lift);
  if (bone === 'wrist.r') turn(v, [0, 1, 0], 1.1 * lift);
  if (bone === 'upperarm.l') turn(v, [1, 0, 0], -0.12 * lift);
  if (bone === 'head') turn(v, [1, 0, 0], 0.07 * beat);
}

// ------------------------------------------------------------------ writing the GLB

function writeGlb(path, json, chunks) {
  let length = 0;
  for (const c of chunks) length += Math.ceil(c.byteLength / 4) * 4;
  const bin = Buffer.alloc(length);
  let at = 0;
  for (const c of chunks) {
    Buffer.from(c.buffer, c.byteOffset, c.byteLength).copy(bin, at);
    at += Math.ceil(c.byteLength / 4) * 4;
  }
  json.buffers = [{ byteLength: bin.length }];
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, Buffer.from(text), binHead, bin]));
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const glbs = {}, textures = {};
  for (const name of Object.keys(TEXTURE)) {
    glbs[name] = readGlb(await fetchOnce(`${FOLDER}/${name}.glb`));
    const png = await fetchOnce(`${FOLDER}/${TEXTURE[name]}_texture.png`);
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    textures[TEXTURE[name]] = { data, channels: info.channels };
  }
  const license = await fetchOnce('LICENSE.txt');

  // The rig, from the rogue. Every character of the pack shares it; check that, bone by bone.
  const rig = glbs.Rogue;
  const skinJoints = rig.json.skins[0].joints.map((i) => rig.json.nodes[i].name);
  for (const [name, glb] of Object.entries(glbs)) {
    const joints = glb.json.skins[0].joints.map((i) => glb.json.nodes[i].name);
    if (joints.join() !== skinJoints.join()) throw new Error(`${name} has another rig`);
    for (const bone of joints) {
      const a = glb.world(glb.nodeNamed(bone)).elements, b = rig.world(rig.nodeNamed(bone)).elements;
      if (a.some((v, k) => Math.abs(v - b[k]) > 1e-4)) throw new Error(`${name}: bone ${bone} rests elsewhere`);
    }
  }

  // Read every part first, to know which bones carry weight.
  const bodies = {};
  const used = new Set(KEEP_BONES);
  for (const [body, specs] of Object.entries(BODIES)) {
    const slotReference = {};
    const parts = [];
    for (const spec of specs) {
      const part = await readPart(glbs, textures, spec, slotReference);
      for (let i = 0; i < part.joints.length; i++) if (part.weights[i] > 0) used.add(part.joints[i]);
      parts.push({ spec, ...part });
    }
    bodies[body] = parts;
  }
  // The bones: those with weight, and every bone above them.
  const keep = new Set();
  for (const name of used) {
    for (let i = rig.nodeNamed(name); i !== undefined; i = rig.parent[i]) {
      if (rig.json.nodes[i].name === 'Rig') break;
      keep.add(rig.json.nodes[i].name);
    }
  }
  const bones = rig.json.nodes.map((n) => n.name).filter((n) => keep.has(n));
  const boneIndex = new Map(bones.map((b, i) => [b, i]));

  const json = {
    asset: { version: '2.0', generator: 'tools/models/cast/stand-ins.mjs', copyright: 'KayKit Adventurers by Kay Lousberg, CC0' },
    scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], skins: [], accessors: [], bufferViews: [], animations: [],
  };
  const chunks = [];
  let offset = 0;
  const addView = (array, target) => {
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: array.byteLength, ...(target ? { target } : {}) });
    chunks.push(array);
    offset += Math.ceil(array.byteLength / 4) * 4;
    return json.bufferViews.length - 1;
  };
  const TYPE = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4', 16: 'MAT4' };
  const CODE = new Map([[Uint8Array, 5121], [Uint16Array, 5123], [Uint32Array, 5125], [Float32Array, 5126]]);
  const addAccessor = (array, size, { target, normalized, bounds } = {}) => {
    const view = addView(array, target);
    const accessor = { bufferView: view, componentType: CODE.get(array.constructor), count: array.length / size, type: TYPE[size] };
    if (normalized) accessor.normalized = true;
    if (bounds) {
      accessor.min = Array.from({ length: size }, (_, k) => { let m = Infinity; for (let i = k; i < array.length; i += size) m = Math.min(m, array[i]); return m; });
      accessor.max = Array.from({ length: size }, (_, k) => { let m = -Infinity; for (let i = k; i < array.length; i += size) m = Math.max(m, array[i]); return m; });
    }
    json.accessors.push(accessor);
    return json.accessors.length - 1;
  };

  // Bones as nodes, in the rest pose, with the same parents.
  const nodeOf = new Map();
  for (const name of bones) {
    const source = rig.json.nodes[rig.nodeNamed(name)];
    const node = { name };
    for (const key of ['translation', 'rotation', 'scale']) if (source[key]) node[key] = source[key];
    json.nodes.push(node);
    nodeOf.set(name, json.nodes.length - 1);
  }
  for (const name of bones) {
    const children = (rig.json.nodes[rig.nodeNamed(name)].children ?? []).map((c) => rig.json.nodes[c].name).filter((c) => keep.has(c));
    if (children.length) json.nodes[nodeOf.get(name)].children = children.map((c) => nodeOf.get(c));
  }
  const inverses = new Float32Array(bones.length * 16);
  bones.forEach((b, i) => rig.world(rig.nodeNamed(b)).invert().toArray(inverses, i * 16));
  json.skins.push({ joints: bones.map((b) => nodeOf.get(b)), skeleton: nodeOf.get('root'), inverseBindMatrices: addAccessor(inverses, 16) });

  const report = [];
  for (const [body, parts] of Object.entries(bodies)) {
    const partNames = ['body'];
    const nameOf = (name) => {
      if (!partNames.includes(name)) partNames.push(name);
      return partNames.indexOf(name);
    };
    for (const p of parts) assignParts(p, p.spec.part ? nameOf(p.spec.part) : 0, p.spec.split ? nameOf(p.spec.split.part) : -1);
    let vertices = 0, triangles = 0;
    for (const p of parts) { vertices += p.position.length / 3; triangles += p.index.length / 3; }
    const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3);
    const joints = new Uint8Array(vertices * 4), weights = new Uint8Array(vertices * 4), tone = new Uint8Array(vertices * 4);
    const index = new Uint16Array(triangles * 3);
    let v = 0, t = 0, mixed = 0;
    for (const p of parts) {
      const count = p.position.length / 3;
      const partOf = p.partOf;
      for (let i = 0; i < count; i++) {
        position.set(p.position.subarray(i * 3, i * 3 + 3), (v + i) * 3);
        normal.set(p.normal.subarray(i * 3, i * 3 + 3), (v + i) * 3);
        // Four weights in bytes that sum to 255, on kept bones.
        let sum = 0, given = 0, most = 0;
        for (let k = 0; k < 4; k++) sum += p.weights[i * 4 + k];
        for (let k = 0; k < 4; k++) {
          const w = p.weights[i * 4 + k];
          joints[(v + i) * 4 + k] = w > 0 ? boneIndex.get(p.joints[i * 4 + k]) : 0;
          weights[(v + i) * 4 + k] = Math.round((w / sum) * 255);
          given += weights[(v + i) * 4 + k];
          if (w > p.weights[i * 4 + most]) most = k;
        }
        weights[(v + i) * 4 + most] += 255 - given;
        tone[(v + i) * 4] = p.slot[i];
        tone[(v + i) * 4 + 1] = Math.round(p.shade[i] * 127.5);
        tone[(v + i) * 4 + 2] = partOf[i];
      }
      for (let i = 0; i < p.index.length; i += 3) {
        const a = p.index[i], b = p.index[i + 1], c = p.index[i + 2];
        if (partOf[a] !== partOf[b] || partOf[a] !== partOf[c]) mixed++;
        index[t + i] = a + v; index[t + i + 1] = b + v; index[t + i + 2] = c + v;
      }
      v += count;
      t += p.index.length;
    }
    if (mixed) console.warn(`${body}: ${mixed} triangles join two parts`);
    json.meshes.push({
      name: body,
      extras: { parts: partNames },
      primitives: [{
        attributes: {
          POSITION: addAccessor(position, 3, { target: 34962, bounds: true }),
          NORMAL: addAccessor(normal, 3, { target: 34962 }),
          JOINTS_0: addAccessor(joints, 4, { target: 34962 }),
          WEIGHTS_0: addAccessor(weights, 4, { target: 34962, normalized: true }),
          _TONE: addAccessor(tone, 4, { target: 34962 }),
        },
        indices: addAccessor(index, 1, { target: 34963 }),
      }],
    });
    json.nodes.push({ name: body, mesh: json.meshes.length - 1, skin: 0 });
    json.scenes[0].nodes.push(json.nodes.length - 1);
    report.push(`${body}: ${triangles} triangles, ${vertices} vertices, parts ${partNames.join(' ')}`);
  }
  json.scenes[0].nodes.push(nodeOf.get('root'));

  const clips = Object.entries(CLIPS).map(([name, source]) => [name, sampleClip(rig, source, keep)]);
  clips.push(['Talk', sampleClip(rig, 'Idle', keep, TALK_SECONDS, talkEdit)]);
  for (const [name, clip] of clips) {
    const input = addAccessor(clip.times, 1, { bounds: true });
    const anim = { name, samplers: [], channels: [] };
    for (const track of clip.tracks) {
      anim.samplers.push({ input, output: addAccessor(track.values, track.path === 'rotation' ? 4 : 3), interpolation: 'LINEAR' });
      anim.channels.push({ sampler: anim.samplers.length - 1, target: { node: nodeOf.get(track.bone), path: track.path } });
    }
    json.animations.push(anim);
  }

  const out = resolve(outDir, 'cast.glb');
  writeGlb(out, json, chunks);
  writeFileSync(resolve(outDir, 'LICENSE.txt'), readFileSync(license));
  for (const line of report) console.log(line);
  console.log(`${bones.length} bones, clips ${clips.map(([n, c]) => `${n} ${c.times.at(-1).toFixed(2)} s`).join(', ')}`);
  console.log(`wrote ${out}  ${(readFileSync(out).length / 1024).toFixed(1)} KB`);
}

if (import.meta.main) await main();
