import type * as THREE from 'three';
// The three vaults as they are drawn: where each piece of the room kit (src/features/props/builders/rooms.ts) stands
// in the Pump House's two floors, the Lamp Gallery and the Seed Vault, from their sheets in
// assets-src/concept/rooms/. Places are blocks from the room's north-west corner, as in src/game/ruins/rooms.sim.ts,
// and every one the rules use (the lever, the eyes, the gates, the channels, the doors, the dais) is read from there.
//
// The camera looks from the south-east, so the north and west walls stand full and the south and east ones are cut low.
import { SEED_RING, VAULT_EARTH, VAULT_TRENCH } from '../../features/props/builders/rooms.ts';
import { GALLERY_EYES, type RoomDef, type RoomId, type RoomProp } from '../ruins/rooms.sim.ts';

/** The rooms drawn as kits. */
export const KIT_ROOMS: ReadonlySet<RoomId> = new Set(['pump-upper', 'pump-lower', 'gallery', 'seedvault']);

/** A wall on this side of a room faces in when its piece is turned this far. */
const N = 0, W = Math.PI / 2, S = Math.PI, E = -Math.PI / 2;
/** The stand-ins of a room's plan that the kit draws itself. */
const REPLACED = new Set(['plinth', 'banner', 'ruinPillar', 'giantRoot', 'shutDoor', 'partShaft', 'partWheel', 'lantern', 'crystals']);

/** What a room shows that changes as it is played. */
export interface KitState {
  lever: boolean;
  /** The gallery's glass eyes that are lit, 0 to 6. */
  eyes: number;
}

type Piece = RoomProp;
const piece = (kind: string, variant: string | undefined, x: number, z: number, turn = 0, y = 0): Piece => ({ kind, variant, x, z, turn, y });

/** A place given along a wall and out from it, for a wall piece standing at (x, z) turned `turn`. */
function off(x: number, z: number, turn: number, along: number, out: number): [number, number] {
  return [x + along * Math.cos(turn) + out * Math.sin(turn), z - along * Math.sin(turn) + out * Math.cos(turn)];
}

function pumpLower(room: RoomDef): Piece[] {
  const d = -VAULT_TRENCH, out: Piece[] = [
    piece('vaultEarth', 'sluice', 13, 11, 0, -VAULT_EARTH.drop),
    piece('vaultFloor', 'sluice', 13, 11),
    piece('vaultWalls', 'sluice north', 13, 1, N),
    piece('vaultWalls', 'sluice west', 1, 11, W),
    piece('vaultLow', 'sluice south', 13, 21, S),
    piece('vaultLow', 'sluice east', 25, 11, E),
    piece('vaultOutlet', undefined, 25.5, 11, W, d),
    piece('vaultChannel', undefined, 13, 11, 0, d),
    piece('vaultBridge', undefined, 8.5, 11, 0, d),
    piece('vaultBridge', undefined, 17.5, 11, 0, d),
    piece('vaultDais', 'wide', (room.spots.keystone![0] + room.spots.memory![0]) / 2, room.spots.keystone![1]),
    piece('vaultShaft', undefined, 7.75, 1.95),
    piece('vaultShelf', 'books', 1.05, 15.75, W),
    piece('vaultRoot', 'floor', 4, 20.9, S),
  ];
  for (const c of room.keeper?.channels ?? []) out.push(piece('vaultSluice', undefined, c.gate[0], c.gate[1]));
  for (const x of [5.5, 10, 16, 20.5]) out.push(piece('vaultSconce', 'lit', x, 1.45, N, 2.5));
  for (const z of [17.5, 14, 8, 4.5]) out.push(piece('vaultSconce', 'lit', 1.45, z, W, 2.5));
  for (const x of [3.25, 18.25]) out.push(piece('vaultBanner', undefined, x, 0.46, N, 1.25), piece('vaultPlanter', x < 10 ? 'flowers' : 'trough', x, 1.55, N));
  for (const z of [19.25, 2.75]) out.push(piece('vaultBanner', undefined, 0.46, z, W, 1.25));
  out.push(piece('vaultPlanter', 'trough', 1.55, 19.25, W), piece('vaultPlanter', 'pot', 9.2, 1.7), piece('vaultPlanter', 'pot', 16.8, 1.7));
  for (const [x, z] of [[2.2, 6.9], [24.2, 17.2], [14.5, 20.3], [22.3, 6.2]] as const) out.push(piece('vaultPlanter', 'pot', x, z));
  for (const [x, z] of [[6.2, 15.2], [19.8, 15.2]] as const) out.push(piece('vaultPlanter', 'flowers', x, z, 0.3));
  // Stores along the walls, as the sheet's lived-in corners.
  out.push(piece('crate', 'stack', 2.1, 15.2), piece('barrel', 'closed', 2, 16.9), piece('sack', 'pile', 19.6, 1.9), piece('barrel', 'open', 2.3, 5.4), piece('crate', 'single', 10.6, 20.2), piece('sack', 'one', 21.6, 20.1));
  return out;
}

function pumpUpper(): Piece[] {
  const out: Piece[] = [
    piece('vaultEarth', 'shaft room', 11, 8, 0, -VAULT_EARTH.drop),
    piece('vaultFloor', 'shaft room', 11, 8),
    piece('vaultWalls', 'shaft room north', 11, 1, N),
    piece('vaultWalls', 'shaft room west', 1, 8, W),
    piece('vaultLow', 'shaft room south', 11, 15, S),
    piece('vaultLow', 'shaft room east', 21, 8, E),
    piece('vaultLow', 'well west', 17, 12, W),
    piece('vaultLow', 'well north', 20.5, 9, S),
    piece('vaultStairwell', undefined, 19, 12.5, 0, -2),
    piece('vaultPier', 'column', 4.5, 2.5),
    piece('vaultPier', 'column', 15.5, 2.5),
    piece('vaultShelf', 'books', 11, 1.05, N),
    piece('vaultShelf', 'jars', 1.05, 2, W),
    piece('vaultBanner', undefined, 1.02, 4.5, W, 2.4),
  ];
  for (const x of [1.6, 4.6, 7.6]) out.push(piece('vaultBearing', undefined, x, 4.5));
  for (const x of [5, 9, 13, 17]) out.push(piece('vaultSconce', 'lit', x, 1.45, N, 2.5));
  for (const z of [10.5, 6]) out.push(piece('vaultSconce', 'lit', 1.45, z, W, 2.5));
  for (const x of [3, 7, 15, 19]) out.push(piece('vaultPlanter', x === 7 ? 'trough' : 'flowers', x, 1.55, N));
  for (const z of [12.75, 8.25]) out.push(piece('vaultPlanter', 'trough', 1.55, z, W));
  for (const [x, z] of [[8.6, 14.2], [13.2, 14.2], [20.2, 3.6], [12.6, 5.2]] as const) out.push(piece('vaultPlanter', 'pot', x, z));
  // A desk under a window, and stores by the door.
  out.push(piece('homeTable', undefined, 7, 2.2), piece('homeChair', undefined, 7, 3.1, S), piece('crate', 'single', 5.2, 13.8), piece('sack', 'one', 14.6, 2.2));
  return out;
}

function gallery(state: KitState): Piece[] {
  const awake = state.eyes >= GALLERY_EYES.length, out: Piece[] = [
    piece('vaultEarth', 'gallery', 8, 16, 0, -VAULT_EARTH.drop),
    piece('vaultFloor', 'gallery', 8, 16),
    piece('vaultWalls', 'gallery north', 8, 1, N),
    piece('vaultWalls', 'gallery walk', 1, 24.75, W),
    piece('vaultWalls', 'gallery arena', 1, 9.75, W),
    piece('vaultLow', 'gallery south', 8, 31, S),
    piece('vaultLow', 'gallery east', 15, 16, E),
    piece('vaultGateway', undefined, 8, 31.5),
    piece('vaultDais', 'wide', 8, 1.6),
    piece('vaultPier', 'cover', 2.5, 12.5),
    piece('vaultPier', 'cover', 13.5, 12.5),
    piece('vaultRoot', 'wall', 1, 5.8, W),
    piece('vaultRoot', 'floor', 13.7, 29.4, E),
    piece('vaultRoot', 'floor', 4.5, 30.8, S),
    piece('vaultPlanter', 'pot', 5.3, 30.1),
    piece('vaultPlanter', 'pot', 10.7, 30.1),
    piece('vaultPlanter', 'flowers', 1.55, 17.3, W),
    piece('vaultPlanter', 'trough', 14.4, 14.6, E),
  ];
  for (const z of [20.5, 24.5, 28.5]) for (const x of [4.3, 11.7]) out.push(piece('vaultPier', 'sight', x, z));
  // The chairs of those who watched the trials, by the piers.
  for (const [x, z, turn] of [[3.2, 22.4, W], [12.8, 22.4, E], [3.2, 26.4, W], [12.8, 26.6, E]] as const) out.push(piece('homeChair', undefined, x, z, turn));
  for (const z of [13.5, 8.5, 3.5]) out.push(piece('vaultBanner', undefined, 0.46, z, W, 1.25));
  for (const z of [16, 11, 6]) out.push(piece('vaultSconce', awake ? 'lit' : 'dark', 1.45, z, W, 2.5));
  // The six glass eyes, each on its own wall, and the pair of sensor lamps each one lights: in the west wall's
  // niches, on the east wall's piers.
  GALLERY_EYES.forEach((eye, i) => {
    const lit = i < state.eyes ? 'lit' : 'dark', west = eye.x < 8;
    out.push(piece('vaultLamp', lit, 0.75, eye.z, W, 0.75), piece('vaultLamp', lit, 15.5, eye.z, E, 1.55));
    out.push(west ? piece('vaultEye', lit, 1.03, eye.z, W, 3.45) : piece('vaultEye', lit, 14.92, eye.z, E, 0.5));
  });
  return out;
}

function seedVault(): Piece[] {
  const cx = 13, cz = 13, n = SEED_RING.bays, half = SEED_RING.width / 2, out: Piece[] = [
    piece('vaultEarth', 'seed', cx, cz, 0, -VAULT_EARTH.drop),
    piece('vaultFloor', 'seed', cx, cz),
    piece('vaultArm', 'base', 12.5, 12.5),
    piece('vaultRoot', 'crown', 13, 1.2),
    piece('vaultRoot', 'crown', 2.1, 9, W),
    piece('vaultDais', 'narrow', 12.5, 2.8),
    piece('vaultDoor', undefined, 12.5, 24.5),
  ];
  // The ring's sixteen bays from the north round by the west: the shrine behind the dais, the root gap in the west,
  // jars and racks between, and the bays toward the camera cut low.
  const kinds: Readonly<Record<number, string>> = { 0: 'seed shrine', 1: 'seed jars', 2: 'seed rack', 3: 'seed jars', 4: 'seed gap', 5: 'seed jars', 6: 'seed rack', 7: 'seed step', 13: 'seed step', 14: 'seed rack', 15: 'seed jars' };
  for (let i = 0; i < n; i++) {
    const turn = (i / n) * Math.PI * 2, x = cx - Math.sin(turn) * SEED_RING.apothem, z = cz - Math.cos(turn) * SEED_RING.apothem;
    const kind = kinds[i];
    out.push(kind ? piece('vaultWalls', kind, x, z, turn) : piece('vaultLow', 'seed', x, z, turn));
    if (!kind || kind === 'seed step') continue;
    // On the pilaster at the bay's left edge: banners either side of the shrine, lamps round the rest.
    const [px, pz] = off(x, z, turn, -half, 0.46);
    out.push(i === 0 || i === 15 ? piece('vaultBanner', undefined, px, pz, turn, 1.7) : piece('vaultSconce', 'lit', px, pz, turn, 2.5));
    if (i === 2 || i === 6 || i === 14) out.push(piece('vaultRoot', 'wall', ...off(x, z, turn, half * 0.55, 0), turn));
    if (i === 2 || i === 5 || i === 14) out.push(piece('vaultRoot', 'floor', ...off(x, z, turn, 0, 0.5), turn));
    if (i === 3 || i === 14 || i === 6) out.push(piece('vaultPlanter', i === 3 ? 'flowers' : 'pot', ...off(x, z, turn, -1.1, 1.1), turn));
  }
  for (const [x, z] of [[15.2, 3.4], [9.8, 3.4], [22.4, 17], [17.2, 22.6], [8.4, 22.4]] as const) out.push(piece('vaultPlanter', 'pot', x, z));
  for (const [x, z, turn] of [[5.4, 6.1, 0.8], [20.3, 5.6, -0.7], [3.4, 16.6, 1.9], [22.6, 9.4, -1.5]] as const) out.push(piece('vaultJars', 'three', x, z, turn));
  for (const [x, z, turn] of [[9.2, 2.4, 0.2], [17.6, 3.3, -0.5]] as const) out.push(piece('vaultJars', 'row', x, z, turn));
  return out;
}

/** Every piece of a kit room in the state it is in: the kit, then what is left of the plan's own dressing. */
export function kitOf(room: RoomDef, state: KitState): Piece[] {
  const out = room.id === 'pump-lower' ? pumpLower(room) : room.id === 'pump-upper' ? pumpUpper() : room.id === 'gallery' ? gallery(state) : seedVault();
  for (const p of room.props) {
    if (REPLACED.has(p.kind)) {
      // A lantern of the plan lights a block of the room: a lamp post stands there.
      if (p.kind === 'lantern') out.push(piece('vaultLamp', 'post lit', p.x, p.z));
      continue;
    }
    if (p.kind === 'partLever') {
      // The Pump House's lever; the sluices' own levers are part of their frames.
      if (room.id === 'pump-upper') out.push(piece('vaultLever', state.lever ? 'pulled' : 'rest', p.x, p.z));
      continue;
    }
    if (p.kind === 'partSprinkler') {
      if (room.id === 'pump-upper') out.push({ ...p, variant: state.lever ? 'working' : 'starved' });
      continue;
    }
    out.push(p);
  }
  return out;
}

/** Replace every instance of a moving part while keeping its pose and visibility. */
export function replaceVaultParts(root: THREE.Object3D, before: Record<string, THREE.BufferGeometry>, after: Record<string, THREE.BufferGeometry>): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const key of Object.keys(before)) if (mesh.geometry === before[key]) {
      mesh.geometry = after[key];
      break;
    }
  });
  for (const geometry of new Set(Object.values(before))) geometry.dispose();
}
