// Shows what a click would act on, and only that: a thin box around the block under the pointer (or the
// crosshair) when it is in reach, which closes in and turns warm as the block breaks. On a tree the box goes
// around the whole tree, since one hold fells all of it. On a station it goes around the station, since a
// hold takes that back and leaves the block it stands on.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import { findTree, type TreeRules } from '../actions/tree.sim.ts';
import type { Placed, Systems, TreeBox } from '../api.sim.ts';
import { FELLING } from '../content/drops.ts';
import { footprint } from '../content/placeables.ts';
import type { GameView } from '../shell/view.ts';

const LOG = BLOCKS.map((block) => block.surface === 'wood' && /_log$/.test(block.key));
const LEAF = BLOCKS.map((block) => block.surface === 'leaves');
const RULES: TreeRules = { isLog: (id) => LOG[id] === true, isLeaf: (id) => LEAF[id] === true, maxLogs: FELLING.maxLogs, leafReach: FELLING.leafReach };

export function install(view: GameView): void {
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, fog: false, toneMapped: false });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), material);
  outline.name = 'aim';
  outline.renderOrder = 10;
  outline.visible = false;
  outline.frustumCulled = false;
  view.scene.add(outline);
  const calm = new THREE.Color(0xffffff), warm = new THREE.Color(0xffb347);

  // The tree or station under the pointer, worked out again only when the pointed block or the held item changes.
  const last = { x: NaN, y: NaN, z: NaN, nx: 0, ny: 0, nz: 0, id: -1, axe: false, placed: 0 };
  let box: TreeBox | null = null;
  const station: TreeBox = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
  let onStation = false;
  const sys = view.game.systems as Partial<Systems>;

  /** The station a click on this hit acts on, found as the actions system finds it. */
  function stationAt(x: number, y: number, z: number, nx: number, ny: number, nz: number): Placed | null {
    const placeables = sys.placeables;
    if (!placeables) return null;
    return placeables.at(x, y, z) ?? (nx || ny || nz ? placeables.at(x + nx, y + ny, z + nz) : null);
  }

  view.onFrame(() => {
    const aim = view.aim;
    const game = view.game;
    outline.visible = aim !== null && view.started && !view.paused && !game.player.busy;
    if (!aim || !outline.visible) return;
    const held = game.systems.inventory?.held() ?? null;
    const axe = held !== null && game.systems.items.get(held.id).tool?.kind === 'axe';
    const id = view.world.sim.getBlock(aim.x, aim.y, aim.z);
    const placedCount = sys.placeables?.all().length ?? 0;
    if (aim.x !== last.x || aim.y !== last.y || aim.z !== last.z || aim.nx !== last.nx || aim.ny !== last.ny || aim.nz !== last.nz
      || id !== last.id || axe !== last.axe || placedCount !== last.placed) {
      last.x = aim.x; last.y = aim.y; last.z = aim.z; last.nx = aim.nx; last.ny = aim.ny; last.nz = aim.nz;
      last.id = id; last.axe = axe; last.placed = placedCount;
      const placed = stationAt(aim.x, aim.y, aim.z, aim.nx, aim.ny, aim.nz);
      const def = placed ? sys.placeables?.defs().find((d) => d.kind === placed.kind) : undefined;
      onStation = placed !== null && def !== undefined;
      if (placed && def) {
        const [sx, sy, sz] = footprint(def.size, placed.quarterTurns);
        station.x0 = placed.x; station.y0 = placed.y; station.z0 = placed.z;
        station.x1 = placed.x + sx; station.y1 = placed.y + sy; station.z1 = placed.z + sz;
      }
      box = onStation ? station : LOG[id] || (axe && LEAF[id]) ? findTree(view.world.sim, aim.x, aim.y, aim.z, RULES)?.box ?? null : null;
    }
    const breaking = game.systems.actions?.breaking() ?? null;
    let progress = 0;
    if (breaking && box && (breaking.tree || onStation)) progress = breaking.progress;
    else if (breaking && breaking.x === aim.x && breaking.y === aim.y && breaking.z === aim.z) progress = breaking.progress;
    const shrink = 1 - 0.12 * progress;
    if (box) {
      outline.position.set((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2);
      outline.scale.set((box.x1 - box.x0 + 0.02) * shrink, (box.y1 - box.y0 + 0.02) * shrink, (box.z1 - box.z0 + 0.02) * shrink);
    } else {
      outline.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5);
      outline.scale.setScalar(1.01 * shrink);
    }
    material.color.copy(calm).lerp(warm, Math.min(1, progress * 1.5));
    material.opacity = 0.55 + 0.45 * progress;
  });
}
