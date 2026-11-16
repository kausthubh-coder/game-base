// Every builder by the name an entry in src/content/props.ts gives as `builder`.
// A builder gets the variant's index, its entry and the detail level, and returns one merged geometry from a
// `Shape`. A builder that draws soft forms passes the detail to its Shape: `new Shape(seed, detail)`.
import type * as THREE from 'three';
import type { PropDef } from '../../../content/props.ts';
import { rigLamp, rigLampSpent, rigSnare, rigSnareSpent, rigPlate, rigPlateSpent, rigChannel, rigChannelSpent } from './rigs.ts';
import { campfire, tent } from './camp.ts';
import { barrel, cart, crate, sack } from './clutter.ts';
import { log, rock, stump } from './ground.ts';
import { banner, brazier, bunting, elderOak, lantern, noticeBoard, planter, rootFountain, stringLights } from './hollowmere.ts';
import { berryBush, bush, flower, grassTuft, lilyPad, mushroom, reeds, tallGrass } from './plants.ts';
import { gateArch, hallLamp, heartstone, muralSlab, plinth, ruinPillar, shutDoor } from './ruin.ts';
import { bed, chest, forge, sprinkler, stove, workbench } from './stations.ts';
import { awning, bench, chimney, door, fence, gate, lampPost, sign, signpost, stall, townWindow, well } from './town.ts';
import { birch, oak, pine } from './trees.ts';
import { bulrush, fallenLog, fern, greyGrass, scree, steppingStone, surfaceRoot } from './wilds.ts';
import { pastureFence, footbridge, mossStump, wildflowers, hayBale, harvestStall } from './valley.ts';

export type PropBuilder = (variant: number, def: PropDef, detail: number) => THREE.BufferGeometry;

export const BUILDERS: Record<string, PropBuilder> = {
  rigLamp, rigLampSpent, rigSnare, rigSnareSpent, rigPlate, rigPlateSpent, rigChannel, rigChannelSpent,
  pastureFence, footbridge, mossStump, wildflowers, hayBale, harvestStall,
  oak, birch, pine,
  grassTuft, tallGrass, flower, reeds, lilyPad, mushroom, bush, berryBush,
  rock, log, stump,
  door, window: townWindow, chimney, sign, awning, stall, well, fence, gate, lampPost, signpost, bench,
  banner, lantern, stringLights, bunting, brazier, planter, noticeBoard, rootFountain, elderOak,
  shutDoor, heartstone, gateArch, hallLamp, muralSlab, ruinPillar, plinth,
  barrel, crate, cart, sack,
  workbench, forge, stove, chest, bed, sprinkler,
  // world/biomes
  fern, surfaceRoot, fallenLog, greyGrass, bulrush, steppingStone, scree,
  campfire, tent,
};

// world/models-8
import { rockArch, boulders, fallenGiant, stiltHut, boardwalk } from './group-8.ts';
Object.assign(BUILDERS, { rockArch, boulders, fallenGiant, stiltHut, boardwalk });
// world/models-1
import { highRoadArch, roadStair, roadPylon, fallenSpan } from './group-1.ts';
Object.assign(BUILDERS, { highRoadArch, roadStair, roadPylon, fallenSpan });
// world/models-2
import { terraceWall, terraceStair, oldGate, colossus, giantRoot } from './group-2.ts';
Object.assign(BUILDERS, { terraceWall, terraceStair, oldGate, colossus, giantRoot });
// world/models-7
import { galleryMouth, caveMouth, vaultRoots, crystals } from './group-7.ts';
Object.assign(BUILDERS, { galleryMouth, caveMouth, vaultRoots, crystals });
// world/models-4
import { pumpHouse, weir, oldMill, jetty } from './group-4.ts';
Object.assign(BUILDERS, { pumpHouse, weir, oldMill, jetty });
// world/models-6
// world/models-5
import { chapel, orderPump, orderEngine, watchPost, dawnDome } from './group-5.ts';
Object.assign(BUILDERS, { chapel, orderPump, orderEngine, watchPost, dawnDome });
// act1-models-6
import { sunkTower, forestStair, muralWall, deadCottage, colonnade } from "./group-6.ts";
Object.assign(BUILDERS, { sunkTower, forestStair, muralWall, deadCottage, colonnade });

// act1-models-3
import { hallDoor, shrine, waystone, standingStones } from './group-3.ts';
Object.assign(BUILDERS, { hallDoor, shrine, waystone, standingStones });
// act1-city-buildings
import { cityCottage, cityFamilyHouse, cityLongHouse, cityTallHouse, cityMerchantRowHouse, cityCornerShop, cityBakery, cityGuildLodge, cityWorkshop, cityGranary, cityWarehouse, cityLampHouse, cityWheelwrightYard, cityTownMill, cityCivicHall, cityCourtyardTenement } from './city-buildings.ts';
Object.assign(BUILDERS, { cityCottage, cityFamilyHouse, cityLongHouse, cityTallHouse, cityMerchantRowHouse, cityCornerShop, cityBakery, cityGuildLodge, cityWorkshop, cityGranary, cityWarehouse, cityLampHouse, cityWheelwrightYard, cityTownMill, cityCivicHall, cityCourtyardTenement });
// act1-city-streets
import { cityStall, cityCart, cityCrate, cityBarrel, cityBench, cityLamp, citySign, cityBanner, cityWell, cityFountain, cityPlanter, cityFence, cityFenceCorner, cityPavingEdge, cityStringLights, cityQuayWall, cityQuayCorner, cityQuaySteps, cityBollard, cityDock, citySkiff, cityCargoBoat, cityNetRack, cityCrane, cityGangplank, cityParapet, cityJetty } from './city-streets.ts';
Object.assign(BUILDERS, { cityStall, cityCart, cityCrate, cityBarrel, cityBench, cityLamp, citySign, cityBanner, cityWell, cityFountain, cityPlanter, cityFence, cityFenceCorner, cityPavingEdge, cityStringLights, cityQuayWall, cityQuayCorner, cityQuaySteps, cityBollard, cityDock, citySkiff, cityCargoBoat, cityNetRack, cityCrane, cityGangplank, cityParapet, cityJetty });
// act1-kit-parts
import { PART_BUILDERS } from "./parts.ts";
Object.assign(BUILDERS, PART_BUILDERS);
// act1-kit-settlement
import { homeChair, homeCarryingChest, homeTent, homeFire, homeBedroll, homeBed, homeTable, homeDinnerTable, homeBench, homeLamp, homeOven, homeKitchen, homeSmall, homeMapRoom, homeSmokehouse, homeSeedShed, homeBeastYard, homeWatchPost, homeHeartstone } from './settlement.ts';
Object.assign(BUILDERS, { homeChair, homeCarryingChest, homeTent, homeFire, homeBedroll, homeBed, homeTable, homeDinnerTable, homeBench, homeLamp, homeOven, homeKitchen, homeSmall, homeMapRoom, homeSmokehouse, homeSeedShed, homeBeastYard, homeWatchPost, homeHeartstone });
// act1-city-parts
import { cityPartPlinth, cityPartWall, cityPartWallWindow, cityPartWallDoor, cityPartCorner, cityPartRoofEnd, cityPartRoof, cityPartRidge, cityPartRoofHip, cityPartChimney, cityPartWindow, cityPartDoor, cityPartBalcony, cityPartStair, cityPartArch, cityPartAwning, cityPartHouse } from './city-parts.ts';
Object.assign(BUILDERS, { cityPartPlinth, cityPartWall, cityPartWallWindow, cityPartWallDoor, cityPartCorner, cityPartRoofEnd, cityPartRoof, cityPartRidge, cityPartRoofHip, cityPartChimney, cityPartWindow, cityPartDoor, cityPartBalcony, cityPartStair, cityPartArch, cityPartAwning, cityPartHouse });

// act1-rooms-models
import { vaultWalls, vaultLow, vaultFloor, vaultEarth, vaultSconce, vaultLamp, vaultEye, vaultBanner, vaultPlanter, vaultJars, vaultShelf, vaultPier, vaultDais, vaultKeystone, vaultChannel, vaultBridge, vaultSluice, vaultOutlet, vaultShaft, vaultBearing, vaultLever, vaultStairwell, vaultGateway, vaultDoor, vaultArm, vaultPod, vaultRoot } from './rooms.ts';
Object.assign(BUILDERS, { vaultWalls, vaultLow, vaultFloor, vaultEarth, vaultSconce, vaultLamp, vaultEye, vaultBanner, vaultPlanter, vaultJars, vaultShelf, vaultPier, vaultDais, vaultKeystone, vaultChannel, vaultBridge, vaultSluice, vaultOutlet, vaultShaft, vaultBearing, vaultLever, vaultStairwell, vaultGateway, vaultDoor, vaultArm, vaultPod, vaultRoot });
// act1-city-models
import { cityChapel, cityBridge, cityGateway, cityLowWall, cityStallGoods, cityHangingGoods, cityBaskets, cityTower, cityRoofCluster } from './city-2.ts';
Object.assign(BUILDERS, { chapel: cityChapel, cityBridge, cityGateway, cityLowWall, cityStallGoods, cityHangingGoods, cityBaskets, cityTower, cityRoofCluster });
// act1-hall-models
import * as hallModels from "./hall.ts";
Object.assign(BUILDERS, { hallDoor: hallModels.hallDoor, heartstone: hallModels.heartstone, hallLamp: hallModels.hallLamp, homeDinnerTable: hallModels.homeDinnerTable, homeBench: hallModels.homeBench, homeChair: hallModels.homeChair, hallCourt: hallModels.hallCourt, hallRill: hallModels.hallRill, hallRillBridge: hallModels.hallRillBridge, hallArch: hallModels.hallArch, hallMural: hallModels.hallMural, memoryStone: hallModels.memoryStone, custodianPlinth: hallModels.custodianPlinth, fieldBookStand: hallModels.fieldBookStand, deadGate: hallModels.deadGate, hallWall: hallModels.hallWall, dinnerLanternPole: hallModels.dinnerLanternPole, dinnerSpread: hallModels.dinnerSpread });
// act1-wilds-kit-forest
import { forestSnag, forestHollowTrunk, forestStumps, forestRootFan, forestMushrooms, forestMossMound, forestBranch, forestRocks, forestVines, forestBeeComb, forestWall, forestStatue, forestGatePost, forestShrineRing, greyBrush, greyDrift, greyDen, wrenCamp } from './wilds-forest.ts';
Object.assign(BUILDERS, { forestSnag, forestHollowTrunk, forestStumps, forestRootFan, forestMushrooms, forestMossMound, forestBranch, forestRocks, forestVines, forestBeeComb, forestWall, forestStatue, forestGatePost, forestShrineRing, greyBrush, greyDrift, greyDen, wrenCamp });
