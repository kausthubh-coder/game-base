// Shows what a click would act on: a thin box around the block under the pointer when it is in reach,
// which closes in and turns warm as the block breaks. On a tree the box goes around the whole tree,
// since one hold fells all of it.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import { findTree, type TreeRules } from '../actions/tree.sim.ts';
import type { TreeBox } from '../api.sim.ts';
import { FELLING } from '../content/drops.ts';
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

  // The tree under the pointer, worked out again only when the pointed block or the held item changes.
  const last = { x: NaN, y: NaN, z: NaN, id: -1, axe: false };
  let tree: TreeBox | null = null;

  view.onFrame(() => {
    const aim = view.aim;
    const game = view.game;
    outline.visible = aim !== null && view.started && !view.paused && !game.player.busy;
    if (!aim || !outline.visible) return;
    const held = game.systems.inventory?.held() ?? null;
    const axe = held !== null && game.systems.items.get(held.id).tool?.kind === 'axe';
    const id = view.world.sim.getBlock(aim.x, aim.y, aim.z);
    if (aim.x !== last.x || aim.y !== last.y || aim.z !== last.z || id !== last.id || axe !== last.axe) {
      last.x = aim.x; last.y = aim.y; last.z = aim.z; last.id = id; last.axe = axe;
      tree = game.systems.trees?.at(aim.x,aim.y,aim.z)?.box ?? (LOG[id] || (axe && LEAF[id]) ? findTree(view.world.sim, aim.x, aim.y, aim.z, RULES)?.box ?? null : null);
    }
    const breaking = game.systems.actions?.breaking() ?? null;
    let progress = 0;
    if (breaking && tree && breaking.tree) progress = breaking.progress;
    else if (breaking && breaking.x === aim.x && breaking.y === aim.y && breaking.z === aim.z) progress = breaking.progress;
    const shrink = 1 - 0.12 * progress;
    if (tree) {
      outline.position.set((tree.x0 + tree.x1) / 2, (tree.y0 + tree.y1) / 2, (tree.z0 + tree.z1) / 2);
      outline.scale.set((tree.x1 - tree.x0 + 0.02) * shrink, (tree.y1 - tree.y0 + 0.02) * shrink, (tree.z1 - tree.z0 + 0.02) * shrink);
    } else {
      outline.position.set(aim.x + 0.5, aim.y + 0.5, aim.z + 0.5);
      outline.scale.setScalar(1.01 * shrink);
    }
    material.color.copy(calm).lerp(warm, Math.min(1, progress * 1.5));
    material.opacity = 0.55 + 0.45 * progress;
  });
}
