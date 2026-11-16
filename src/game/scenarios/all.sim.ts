// Every scenario, in the order `bun tools/sim.ts scenarios` plays them. A test fails when a file in this
// folder is missing from the list. This file must not be called index.sim.ts: src/game/systems.ts would
// take the folder for a system.
import type { Scenario } from '../play/scenario.sim.ts';
import { befriendAPet } from './befriend-a-pet.sim.ts';
import { buildStroke } from './build-stroke.sim.ts';
import { calmByTheHeartstone } from './calm-by-the-heartstone.sim.ts';
import { fellATree } from './fell-a-tree.sim.ts';
import { fightsInTheWorld } from './fights-in-the-world.sim.ts';
import { greywoodArrival } from './greywood-arrival.sim.ts';
import { grantDay } from './grant-day.sim.ts';
import { landFollowsTheStory } from './land-follows-the-story.sim.ts';
import { goodsGranary } from './goods-granary.sim.ts';
import { goodsLedger } from './goods-ledger.sim.ts';
import { goodsMarketDay } from './goods-market-day.sim.ts';
import { goodsPump } from './goods-pump.sim.ts';
import { leavesAreNoRoof } from './leaves-are-no-roof.sim.ts';
import { nothingLeftFloating } from './nothing-left-floating.sim.ts';
import { nothingSetDownOnACrop } from './nothing-set-down-on-a-crop.sim.ts';
import { ruinsGalleryAndSeeds } from './ruins-gallery-and-seeds.sim.ts';
import { ruinsPumpHouse } from './ruins-pump-house.sim.ts';
import { ruinsRootworks } from './ruins-rootworks.sim.ts';
import { ruinsShrines } from './ruins-shrines.sim.ts';
import { settlementDinner } from './settlement-dinner.sim.ts';
import { settlementKitchen } from './settlement-kitchen.sim.ts';
import { storyBlessing } from './story-blessing.sim.ts';
import { storyDinner } from './story-dinner.sim.ts';
import { storyVaults } from './story-vaults.sim.ts';
import { threeFarms } from './three-farms.sim.ts';
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
  grantDay,
  // Act 1's settlement.
  settlementKitchen,
  settlementDinner,
  // Act 1's story: scenes as the player reaches them, the vaults in any order, the dinner table.
  storyBlessing,
  storyVaults,
  storyDinner,
  threeFarms,
  fightsInTheWorld,
  greywoodArrival,
  calmByTheHeartstone,
  landFollowsTheStory,
  // Act 1's goods: the granary and the ledger, the pump, market day, the whole ledger and its orders.
  goodsGranary,
  goodsPump,
  goodsMarketDay,
  goodsLedger,
  // Act 1's ruins: the vaults and their rooms, the Rootworks and the Stag's hall, the shrines and the small ruins.
  ruinsPumpHouse,
  ruinsGalleryAndSeeds,
  ruinsRootworks,
  ruinsShrines,
  // Bugs the bots found, kept as scenarios.
  nothingSetDownOnACrop,
  nothingLeftFloating,
  leavesAreNoRoof,
];
