// The four rigs of the third way to fight, drawn with the game's props: the lure lamp, the snare vine, the
// spring plate and the water channel (`src/content/props.ts`, built in `src/features/props/builders/rigs.ts`).
// A rig is its armed prop while it is set and its spent prop for the moment after it goes off. A channel is
// three pieces in a row along the way it lies. The rig in the hand is the same shape, see-through, tinted by
// whether it can be set down there.
//
// The props stand through the game's own props (`worldProps`), so a kind costs one draw call however many
// stand. What the lab adds so a rig reads at the fight's zoom (a ring under it, a light) is drawn by `draw.ts`
// on the ground, not here.
import * as THREE from 'three';
import type { RigKind } from '../content/fight.ts';
import { buildProp } from '../../features/props/index.ts';
import type { Rig } from '../fight/fight.sim.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps } from '../worldview/props.ts';

export interface RigViews {
  /** Brings the drawn rigs in line with the fight's: adds, removes and shows the ones that went off. Call it every frame. */
  sync(rigs: readonly Rig[], groundAt: (x: number, z: number) => number): void;
  /** A see-through rig at the pointer, or none with `null`. `ok` tints it. */
  ghost(kind: RigKind | null, x: number, y: number, z: number, alongX: boolean, ok: boolean): void;
}

/** The prop for each rig, armed and spent. */
const PROP: Record<RigKind, { armed: string; spent: string }> = {
  lamp: { armed: 'rigLamp', spent: 'rigLampSpent' },
  snare: { armed: 'rigSnare', spent: 'rigSnareSpent' },
  plate: { armed: 'rigPlate', spent: 'rigPlateSpent' },
  channel: { armed: 'rigChannel', spent: 'rigChannelSpent' },
};

/** A channel piece is one block long along z. Lying along x it turns a quarter. */
const turnOf = (rig: { kind: RigKind; alongX: boolean }): number => (rig.kind === 'channel' && rig.alongX ? Math.PI / 2 : 0);
/** Where each piece of a rig stands, from its middle: a channel's three, or the one. */
const PIECES: Record<RigKind, readonly number[]> = { lamp: [0], snare: [0], plate: [0], channel: [-1, 0, 1] };

export function createRigViews(view: GameView): RigViews {
  const props = worldProps(view);
  const ghostOk = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xd0fff0, transparent: true, opacity: 0.85, fog: false });
  const ghostNo = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xff8a6a, transparent: true, opacity: 0.7, fog: false });

  interface Shown { handles: number[]; armed: boolean; y: number }
  const shown = new Map<Rig, Shown>();

  /** Stands the rig's prop, armed or spent, piece by piece. */
  function stand(rig: Rig, made: Shown): void {
    for (const handle of made.handles) props.remove(handle);
    made.handles.length = 0;
    const kind = made.armed ? PROP[rig.kind].armed : PROP[rig.kind].spent, turn = turnOf(rig);
    for (const o of PIECES[rig.kind]) {
      const x = rig.x + (rig.alongX ? o : 0), z = rig.z + (rig.alongX ? 0 : o);
      made.handles.push(props.place(kind, 0, x, made.y, z, turn, 1, true));
    }
  }

  const ghosts = new Map<string, THREE.Group>();
  let ghostShown: THREE.Group | null = null;

  function ghostOf(kind: RigKind, alongX: boolean, ok: boolean): THREE.Group {
    const key = `${kind}:${alongX}:${ok}`;
    let group = ghosts.get(key);
    if (group) return group;
    group = new THREE.Group();
    const geometry = buildProp(PROP[kind].armed, 0);
    for (const o of PIECES[kind]) {
      const mesh = new THREE.Mesh(geometry, ok ? ghostOk : ghostNo);
      mesh.position.set(alongX ? o : 0, 0.02, alongX ? 0 : o);
      mesh.rotation.y = turnOf({ kind, alongX });
      mesh.renderOrder = 9;
      group.add(mesh);
    }
    ghosts.set(key, group);
    return group;
  }

  return {
    sync(rigs, groundAt) {
      for (const [rig, made] of shown) {
        if (rigs.includes(rig)) continue;
        for (const handle of made.handles) props.remove(handle);
        shown.delete(rig);
      }
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i] as Rig;
        let made = shown.get(rig);
        if (!made) {
          made = { handles: [], armed: true, y: groundAt(rig.x, rig.z) };
          stand(rig, made);
          shown.set(rig, made);
        }
        // Gone off: the lamp is cracked and dark, the vine has knotted shut, the plate has sprung, the channel is dry.
        if (made.armed && !rig.armed) {
          made.armed = false;
          stand(rig, made);
        }
      }
    },
    ghost(kind, x, y, z, alongX, ok) {
      const next = kind ? ghostOf(kind, alongX, ok) : null;
      if (next) next.position.set(x, y, z);
      if (next === ghostShown) return;
      if (ghostShown) view.scene.remove(ghostShown);
      if (next) view.scene.add(next);
      ghostShown = next;
    },
  };
}
