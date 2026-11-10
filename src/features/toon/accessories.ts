// Things a person wears, built by code and added to a body as parts they may wear or not: hats, a circlet, a
// headscarf, an apron, a moustache, a chick, a hoe for the hand. Each is placed from the body itself: hats on the
// top of its head, the apron over its front, the hoe in its right hand.
import * as THREE from 'three';
import { addPiece, addShell, lathe, place, type Pieces } from './shapes.ts';

export const ACCESSORIES = ['wide-hat', 'straw-hat', 'cone-hat', 'cap', 'headscarf', 'circlet', 'apron', 'moustache', 'chick', 'bun', 'curls', 'hoe'] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export function isAccessory(name: string): name is Accessory {
  return (ACCESSORIES as readonly string[]).includes(name);
}

/** What an accessory needs to know about the body it goes on. */
export interface Fit {
  /** Bone indices. `hand` is the right hand's slot for a held thing. */
  head: number;
  hand: number;
  /** The head's box in the bind pose. */
  headBox: THREE.Box3;
  /** Where the hand's slot is in the bind pose. */
  handBind: THREE.Matrix4;
  /** Heights of the chest and the knees, and the half width of the body at the waist. */
  chestY: number;
  kneeY: number;
  waist: number;
}

/** The head's box: vertices skinned mostly to the head bone. */
export function headBox(pieces: Pieces, head: number): THREE.Box3 {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (let i = 0; i < pieces.position.length / 3; i++) {
    if (pieces.skinIndex[i * 4] !== head || pieces.skinWeight[i * 4] < 0.9) continue;
    box.expandByPoint(p.fromArray(pieces.position, i * 3));
  }
  return box;
}

/** The half width of the body between two heights. */
export function waistOf(pieces: Pieces, from: number, to: number): number {
  let half = 0;
  for (let i = 0; i < pieces.position.length / 3; i++) {
    const y = pieces.position[i * 3 + 1];
    if (pieces.tone[i * 4 + 2] !== 0 || y < from || y > to) continue;
    half = Math.max(half, Math.abs(pieces.position[i * 3]));
  }
  return half;
}

/** Adds one accessory as `part`: to the body itself, or to its shadow with the body given as `body`. */
export function addAccessory(into: Pieces, accessory: Accessory, fit: Fit, part: number, body: Pieces = into): void {
  const box = fit.headBox;
  const r = (box.max.x - box.min.x) / 2;
  const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
  const top = box.max.y, front = box.max.z, height = box.max.y - box.min.y;
  const head = fit.head;
  switch (accessory) {
    case 'wide-hat': {
      // A soft felt hat with a wide brim, tipped back a little: Tamsin's.
      const hat = lathe([[0.0, -0.02], [1.42 * r, -0.03], [1.48 * r, 0.02], [1.05 * r, 0.05], [0.98 * r, 0.42 * r], [0.75 * r, 0.6 * r], [0.0, 0.64 * r]], 12);
      addPiece(into, hat, { slot: 'hat', bone: head, part, matrix: place(cx, top - 0.38 * r, cz - 0.03, -0.12) });
      const band = new THREE.CylinderGeometry(1.0 * r, 1.03 * r, 0.12 * r, 12, 1, true);
      addPiece(into, band, { slot: 'accent', bone: head, part, matrix: place(cx, top - 0.38 * r + 0.1 * r, cz - 0.03, -0.12) });
      const feather = new THREE.SphereGeometry(0.1 * r, 6, 4);
      addPiece(into, feather, { slot: 'extra', bone: head, part, matrix: place(cx + 0.95 * r, top - 0.38 * r + 0.3 * r, cz - 0.05, 0.3, 0, -0.5, 0.6, 2.6, 0.6) });
      break;
    }
    case 'straw-hat': {
      // A farmer's straw hat, broad and flat: Gus's.
      const hat = lathe([[0.0, -0.01], [1.6 * r, -0.04], [1.65 * r, 0.0], [1.08 * r, 0.06], [0.95 * r, 0.42 * r], [0.0, 0.5 * r]], 14);
      addPiece(into, hat, { slot: 'hat', bone: head, part, matrix: place(cx, top - 0.32 * r, cz) });
      const band = new THREE.CylinderGeometry(1.0 * r, 1.05 * r, 0.11 * r, 14, 1, true);
      addPiece(into, band, { slot: 'hat', shade: 0.62, bone: head, part, matrix: place(cx, top - 0.32 * r + 0.1 * r, cz) });
      break;
    }
    case 'cone-hat': {
      // A wide conical straw hat: Brack's, the ferryman.
      const hat = lathe([[0.0, -0.02], [1.7 * r, -0.05], [1.72 * r, -0.01], [0.0, 0.85 * r]], 14);
      addPiece(into, hat, { slot: 'hat', bone: head, part, matrix: place(cx, top - 0.26 * r, cz) });
      break;
    }
    case 'cap': {
      // A flat cloth cap with a short peak.
      const crown = new THREE.SphereGeometry(1.06 * r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      addPiece(into, crown, { slot: 'hat', bone: head, part, matrix: place(cx, top - 0.42 * r, cz - 0.02, -0.1, 0, 0, 1.04, 0.62, 1.08) });
      const peak = new THREE.CylinderGeometry(0.9 * r, 0.9 * r, 0.05 * r, 14, 1, false, -Math.PI / 2.6, Math.PI / 1.3);
      addPiece(into, peak, { slot: 'hat', shade: 0.8, bone: head, part, matrix: place(cx, top - 0.38 * r, cz + 0.42 * r, 0.12) });
      break;
    }
    case 'headscarf': {
      // A scarf over the top and back of the head, knotted behind.
      const scarf = new THREE.SphereGeometry(1.08 * r, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58);
      addPiece(into, scarf, { slot: 'hat', bone: head, part, matrix: place(cx, top - 0.98 * r, cz - 0.05 * r, -0.35, 0, 0, 1.02, 1.0, 1.04) });
      const knot = new THREE.SphereGeometry(0.2 * r, 8, 6);
      addPiece(into, knot, { slot: 'hat', shade: 0.85, bone: head, part, matrix: place(cx, top - 0.95 * r, box.min.z - 0.04 * r) });
      break;
    }
    case 'circlet': {
      // Round the brow, under the hair at the back.
      const ring = new THREE.TorusGeometry(1.0 * r, 0.045 * r, 5, 20);
      addPiece(into, ring, { slot: 'metal', bone: head, part, matrix: place(cx, top - 0.62 * r, cz, Math.PI / 2 - 0.3, 0, 0, 1.0, 1.04, 1) });
      const gem = new THREE.OctahedronGeometry(0.09 * r);
      addPiece(into, gem, { slot: 'accent', bone: head, part, glow: 0.15, matrix: place(cx, top - 0.5 * r, cz + 1.0 * r) });
      break;
    }
    case 'apron': {
      // From the chest to the knees, flaring a little, over whatever the body wears.
      const w = fit.waist * 0.78;
      addShell(into, body, { slot: 'extra', part, x: [-w, w], y: [fit.chestY + 0.02, fit.kneeY - 0.02], flare: 0.18, lift: 0.025 });
      break;
    }
    case 'moustache': {
      const y = box.min.y + height * 0.36;
      for (const side of [-1, 1]) {
        const tuft = new THREE.CapsuleGeometry(0.075 * r, 0.22 * r, 3, 6);
        addPiece(into, tuft, { slot: 'hair', bone: head, part, matrix: place(cx + side * 0.17 * r, y, front - 0.03 * r, 0, 0, side * 1.2) });
      }
      break;
    }
    case 'chick': {
      // A small yellow bird that rides on the head: Wren's.
      const at = new THREE.Vector3(cx + 0.35 * r, top - 0.06 * r, cz + 0.05 * r);
      addPiece(into, new THREE.SphereGeometry(0.2 * r, 9, 7), { slot: 'extra', bone: head, part, matrix: place(at.x, at.y + 0.17 * r, at.z, 0, 0, 0, 1, 0.9, 1.1) });
      addPiece(into, new THREE.SphereGeometry(0.14 * r, 9, 7), { slot: 'extra', bone: head, part, matrix: place(at.x, at.y + 0.38 * r, at.z + 0.1 * r) });
      addPiece(into, new THREE.ConeGeometry(0.05 * r, 0.12 * r, 5), { slot: 'hat', bone: head, part, matrix: place(at.x, at.y + 0.37 * r, at.z + 0.27 * r, Math.PI / 2) });
      for (const side of [-1, 1]) {
        addPiece(into, new THREE.SphereGeometry(0.025 * r, 5, 4), { slot: 'eyes', bone: head, part, matrix: place(at.x + side * 0.07 * r, at.y + 0.42 * r, at.z + 0.21 * r) });
      }
      break;
    }
    case 'bun': {
      // Hair gathered in a bun high at the back: Mira's.
      addPiece(into, new THREE.SphereGeometry(0.34 * r, 10, 8), { slot: 'hair', bone: head, part, matrix: place(cx, top - 0.18 * r, box.min.z + 0.12 * r) });
      addPiece(into, new THREE.TorusGeometry(0.22 * r, 0.06 * r, 5, 12), { slot: 'accent', bone: head, part, matrix: place(cx, top - 0.3 * r, box.min.z + 0.3 * r, 0.9) });
      break;
    }
    case 'curls': {
      // A mop of curls over the top of the head: Odo's.
      const curls = [[0, 0.05, 0.1], [0.55, -0.05, 0.25], [-0.55, -0.05, 0.25], [0.3, 0.05, -0.35], [-0.3, 0.05, -0.35], [0.7, -0.3, -0.25], [-0.7, -0.3, -0.25], [0, -0.05, -0.65], [0.3, 0.0, 0.6], [-0.3, 0.0, 0.6]];
      for (const [x, y, z] of curls) {
        addPiece(into, new THREE.IcosahedronGeometry(0.36 * r, 0), { slot: 'hair', bone: head, part, matrix: place(cx + x * r, top - 0.22 * r + y * r, cz + z * r) });
      }
      break;
    }
    case 'hoe': {
      // Held in the right hand: a wooden handle with an iron blade. It is only worn while working.
      const handle = new THREE.CylinderGeometry(0.022, 0.022, 0.78, 6);
      addPiece(into, handle, { slot: 'leather', shade: 1.15, bone: fit.hand, part, matrix: fit.handBind.clone().multiply(place(0, 0.18, 0, 0, 0, 0)) });
      const blade = new THREE.BoxGeometry(0.16, 0.035, 0.13);
      addPiece(into, blade, { slot: 'metal', bone: fit.hand, part, matrix: fit.handBind.clone().multiply(place(0, 0.56, 0.06)) });
      break;
    }
  }
}
