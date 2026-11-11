// Every scenario, in the order `bun tools/sim.ts scenarios` plays them. A test fails when a file in this
// folder is missing from the list. This file must not be called index.sim.ts: src/game/systems.ts would
// take the folder for a system.
import type { Scenario } from '../play/scenario.sim.ts';
import { befriendAPet } from './befriend-a-pet.sim.ts';
import { buildStroke } from './build-stroke.sim.ts';
import { fellATree } from './fell-a-tree.sim.ts';
import { leavesAreNoRoof } from './leaves-are-no-roof.sim.ts';
import { nothingLeftFloating } from './nothing-left-floating.sim.ts';
import { nothingSetDownOnACrop } from './nothing-set-down-on-a-crop.sim.ts';
import { townIsProtected } from './town-is-protected.sim.ts';
import { wheatSaveLoad } from './wheat-save-load.sim.ts';
import { wheatThreeNights } from './wheat-three-nights.sim.ts';
import { workbenchCrafting } from './workbench-crafting.sim.ts';

export const SCENARIOS: readonly Scenario[] = [
  wheatThreeNights,
  wheatSaveLoad,
  buildStroke,
  workbenchCrafting,
  fellATree,
  befriendAPet,
  townIsProtected,
  // Bugs the bots found, kept as scenarios.
  nothingSetDownOnACrop,
  nothingLeftFloating,
  leavesAreNoRoof,
];
