// The fight lab's arena in the world: the cells of `src/game/fight/arena.sim.ts` stamped into the block world
// as water and barriers, with painted boulders over the wall and three painted trees over the trunks.
//
// The blocks are part of the lab's save, so they are stamped once. The boulders and the trees are drawn
// things, so they are set up again every time the lab opens.
import * as THREE from 'three';
import { blockId } from '../../content/blocks.ts';
import { EMERALD, PAINTED_TREES } from '../../content/painted.ts';
import { buildTree, createStand, foliageMaterials, loadTextures } from '../../features/painted/index.ts';
import { ARENA, pondCells } from '../fight/arena.sim.ts';
import type { GameView } from '../shell/view.ts';

/** Writes the pond, the wall and the trunks into the block world around a middle block whose feet height is `y`. */
export function stampArena(view: GameView, ox: number, y: number, oz: number): void {
  const world = view.world.sim, water = blockId('water'), barrier = blockId('barrier'), stone = blockId('stone');
  // Without the painted look nothing draws a boulder over a barrier, so the wall is stone blocks.
  const wall = view.painted ? barrier : stone;
  const p = ARENA.pond;
  for (const cell of pondCells()) {
    world.setBlock(ox + cell.x, y - 1, oz + cell.z, water);
    // Deeper toward the middle, so the water darkens there.
    const dx = (cell.x + 0.5 - p.x) / p.rx, dz = (cell.z + 0.5 - p.z) / p.rz;
    if (dx * dx + dz * dz < 0.4) world.setBlock(ox + cell.x, y - 2, oz + cell.z, water);
  }
  for (const cell of ARENA.wall) for (let dy = 0; dy < 2; dy++) world.setBlock(ox + cell.x, y + dy, oz + cell.z, wall);
  for (const cell of ARENA.trees) for (let dy = 0; dy < 2; dy++) world.setBlock(ox + cell.x, y + dy, oz + cell.z, barrier);
}

/** Draws the boulders of the wall and the three trees. The painted look only: without it the blocks stand bare. */
export async function dressArena(view: GameView, ox: number, y: number, oz: number): Promise<void> {
  if (!view.painted) return;
  const rock = view.standIns.get('rock');
  ARENA.wall.forEach((cell, i) => {
    // Big stones shoulder to shoulder, each turned and sized a little differently.
    rock?.place(ox + cell.x + 0.5, y, oz + cell.z + 0.5 + (i % 2 ? 0.12 : -0.1), i * 2.1, 2.1 + (i % 3) * 0.22, i);
  });

  const textures = await loadTextures('./assets/painted/');
  const oaks = PAINTED_TREES.oak ?? [];
  const group = new THREE.Group();
  group.name = 'fight-trees';
  ARENA.trees.forEach((cell, i) => {
    const kind = oaks[i % oaks.length];
    if (!kind) return;
    // The same leafy crown the valley's trees have: see `leafy` in world-painted.view.ts.
    const spec = { ...kind.spec, card: Math.max(0.62, Math.min(1, kind.spec.card * 0.76)), cover: 1.9, inset: [0.6, 1.08] as [number, number], core: 0.55, coreColor: '#1d8c58', under: -0.8 };
    const materials = foliageMaterials(textures, { mask: textures.rosettes[kind.spray] as THREE.Texture, tones: [...EMERALD], vary: 0.3, top: 0.25 });
    const stand = createStand(buildTree(spec), materials, 1, true);
    const top = Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5) + spec.crown * spec.squash;
    stand.plant([{ x: ox + cell.x + 0.5, y: y - 0.12, z: oz + cell.z + 0.5, scale: (6.4 / top) * 1.2, turn: i * 1.7, tint: new THREE.Color(1, 1, 1) }]);
    group.add(stand.group);
  });
  view.scene.add(group);
}
