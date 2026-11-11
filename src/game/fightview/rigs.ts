// The four rigs of the third way to fight, as simple shapes: a lamp, a snare vine, a spring plate and a water
// channel. They are stand-ins until the props feature has real ones. Each is a few boxes and rounds in the
// palette's wood, leaf, stone and brass, with lume teal for the lamp's light.
import * as THREE from 'three';
import type { RigKind } from '../content/fight.ts';
import type { Rig } from '../fight/fight.sim.ts';
import type { GameView } from '../shell/view.ts';

export interface RigViews {
  /** Brings the drawn rigs in line with the fight's: adds, removes and shows the ones that went off. Call it every frame. */
  sync(rigs: readonly Rig[], groundAt: (x: number, z: number) => number): void;
  /** A see-through rig at the pointer, or none with `null`. `ok` tints it. */
  ghost(kind: RigKind | null, x: number, y: number, z: number, alongX: boolean, ok: boolean): void;
}

const WOOD = 0x9b6f3e, LEAF = 0x516b3c, LEAF_LIGHT = 0x8d9a4a, STONE = 0xb8b3a6, BRASS = 0xd4aa58, WATER = 0x6fb7e6, LUME = 0x5ff5dc;

export function createRigViews(view: GameView): RigViews {
  const lambert = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });
  const wood = lambert(WOOD), leaf = lambert(LEAF), leafLight = lambert(LEAF_LIGHT), stone = lambert(STONE), brass = lambert(BRASS);
  const lume = new THREE.MeshBasicMaterial({ color: LUME }), dark = lambert(0x5b5750);
  const water = new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.82 });
  const ghostOk = new THREE.MeshBasicMaterial({ color: 0x8ff5c8, transparent: true, opacity: 0.45, depthWrite: false });
  const ghostNo = new THREE.MeshBasicMaterial({ color: 0xff7a5c, transparent: true, opacity: 0.45, depthWrite: false });

  const pole = new THREE.CylinderGeometry(0.06, 0.09, 1.3, 6).translate(0, 0.65, 0);
  const foot = new THREE.CylinderGeometry(0.2, 0.26, 0.12, 6).translate(0, 0.06, 0);
  const globe = new THREE.IcosahedronGeometry(0.24, 1).translate(0, 1.42, 0);
  const cap = new THREE.ConeGeometry(0.3, 0.16, 6).translate(0, 1.7, 0);
  const loop = new THREE.TorusGeometry(0.46, 0.07, 5, 10).rotateX(Math.PI / 2).translate(0, 0.08, 0);
  const coil = new THREE.TorusGeometry(0.24, 0.05, 5, 8).rotateX(Math.PI / 2).translate(0.05, 0.12, -0.04);
  const slab = new THREE.BoxGeometry(0.92, 0.12, 0.92).translate(0, 0.06, 0);
  const plate = new THREE.BoxGeometry(0.66, 0.06, 0.66).translate(0, 0.15, 0);
  const sheet = new THREE.BoxGeometry(1, 0.04, 0.84).translate(0, 0.02, 0);
  const bank = new THREE.BoxGeometry(1, 0.1, 0.08).translate(0, 0.05, 0);

  /** The meshes of one rig. `parts.act` is the part that changes when it goes off. */
  function build(kind: RigKind, alongX: boolean): { group: THREE.Group; act: THREE.Mesh | null } {
    const group = new THREE.Group();
    let act: THREE.Mesh | null = null;
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, z = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, 0, z);
      mesh.castShadow = material !== water;
      group.add(mesh);
      return mesh;
    };
    if (kind === 'lamp') {
      add(foot, stone);
      add(pole, wood);
      add(cap, brass);
      act = add(globe, lume);
    } else if (kind === 'snare') {
      add(loop, leaf);
      act = add(coil, leafLight);
    } else if (kind === 'plate') {
      add(slab, stone);
      act = add(plate, brass);
    } else {
      for (const o of [-1, 0, 1]) {
        add(sheet, water, o, 0);
        add(bank, stone, o, 0.46);
        add(bank, stone, o, -0.46);
      }
      if (!alongX) group.rotation.y = Math.PI / 2;
    }
    return { group, act };
  }

  const shown = new Map<Rig, { group: THREE.Group; act: THREE.Mesh | null; armed: boolean }>();
  const ghosts = new Map<string, THREE.Group>();
  let ghostShown: THREE.Group | null = null;

  return {
    sync(rigs, groundAt) {
      for (const [rig, made] of shown) {
        if (rigs.includes(rig)) continue;
        view.scene.remove(made.group);
        shown.delete(rig);
      }
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i] as Rig;
        let made = shown.get(rig);
        if (!made) {
          made = { ...build(rig.kind, rig.alongX), armed: true };
          const ground = groundAt(rig.x, rig.z);
          made.group.position.set(rig.x, ground, rig.z);
          view.scene.add(made.group);
          shown.set(rig, made);
        }
        if (made.armed && !rig.armed) {
          made.armed = false;
          // Gone off: the lamp is dark, the plate has sprung, the vine has closed, the channel is dry.
          if (rig.kind === 'lamp' && made.act) made.act.material = dark;
          else if (rig.kind === 'plate' && made.act) made.act.position.y = 0.45;
          else if (rig.kind === 'snare' && made.act) made.act.scale.setScalar(0.5);
          else if (rig.kind === 'channel') for (const child of made.group.children) if ((child as THREE.Mesh).material === water) child.visible = false;
        }
      }
    },
    ghost(kind, x, y, z, alongX, ok) {
      const key = kind ? `${kind}:${alongX}:${ok}` : '';
      let next: THREE.Group | null = null;
      if (kind) {
        next = ghosts.get(key) ?? null;
        if (!next) {
          next = build(kind, alongX).group;
          next.traverse((child) => { if ((child as THREE.Mesh).isMesh) { (child as THREE.Mesh).material = ok ? ghostOk : ghostNo; child.castShadow = false; } });
          ghosts.set(key, next);
        }
        next.position.set(x, y, z);
      }
      if (next === ghostShown) return;
      if (ghostShown) view.scene.remove(ghostShown);
      if (next) view.scene.add(next);
      ghostShown = next;
    },
  };
}
