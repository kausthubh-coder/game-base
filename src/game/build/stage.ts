// A small stage for the build tests: the actions stage with a grass floor, and the crops, build and
// sprinkler systems on it. Only tests import it.
import { blockId } from '../../content/blocks.ts';
import { makeStage, type Stage } from '../actions/stage.ts';
import type { BuildApi, BuildPlan, CellVerdict, ItemId } from '../api.sim.ts';
import { install as installCrops } from '../crops/index.sim.ts';
import { install as installSprinklers } from '../sprinklers/index.sim.ts';
import { install as installBuild } from './index.sim.ts';

export interface BuildStage extends Stage {
  build: BuildApi;
  /** The height of the floor's blocks, which a stroke works on. */
  floor: number;
  /** Puts the item in the bag and in the hand. */
  hold(item: ItemId, count?: number): void;
  /** Points at the top of a floor block. */
  point(x: number, z: number): void;
  /** One whole stroke: press at the first cell, drag to the second, release. Returns the cells it changed. */
  stroke(x0: number, z0: number, x1: number, z1: number): number;
  /** The verdict of every cell of the plan, as `x,z:verdict`. */
  verdicts(): string[];
  count(verdict: CellVerdict): number;
  /** The ids of the floor blocks from (x0, z0) to (x1, z1), row by row. */
  blocks(x0: number, z0: number, x1: number, z1: number, y?: number): number[];
}

/** The stage's floor is grass from 1 to 14 each way, and the town starts at x = 10. The player stands at 5.5, 5.5. */
export function makeBuildStage(seed = 1): BuildStage {
  const s = makeStage(seed);
  const floor = s.ground - 1;
  const grass = blockId('grass');
  for (let x = 1; x < 15; x++) for (let z = 1; z < 15; z++) s.world.setBlock(x, floor, z, grass);
  installCrops(s.kernel);
  installBuild(s.kernel);
  installSprinklers(s.kernel);
  const { build, inventory } = s.kernel.game.systems;
  // The first step lets the crops and the placeables add their click handlers.
  s.kernel.step();
  build.setActive(true);
  const point = (x: number, z: number): void => build.point({ x, y: floor, z, nx: 0, ny: 1, nz: 0 });
  const plan = (): BuildPlan => {
    const p = build.plan();
    if (!p) throw new Error('there is no plan: build mode is off or the pointer is on nothing');
    return p;
  };
  return {
    ...s, build, floor, point,
    hold(item, count = 1) {
      inventory.add(item, count);
      const at = inventory.slots.findIndex((slot) => slot?.id === item);
      if (at < 9) inventory.selected = at;
      else inventory.move(at, inventory.selected);
    },
    stroke(x0, z0, x1, z1) {
      point(x0, z0);
      if (!build.press()) return -1;
      point(x1, z1);
      return build.release();
    },
    verdicts: () => plan().cells.map((cell) => `${cell.x},${cell.z}:${cell.verdict}`),
    count: (verdict) => plan().cells.filter((cell) => cell.verdict === verdict).length,
    blocks(x0, z0, x1, z1, y = floor) {
      const out: number[] = [];
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push(s.world.getBlock(x, y, z));
      return out;
    },
  };
}
