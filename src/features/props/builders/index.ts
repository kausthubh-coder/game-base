// Every builder by the name an entry in src/content/props.ts gives as `builder`.
// A builder gets the variant's index and its entry, and returns one merged geometry from a `Shape`.
import type * as THREE from 'three';
import type { PropDef } from '../../../content/props.ts';
import { barrel, cart, crate, sack } from './clutter.ts';
import { log, rock, stump } from './ground.ts';
import { banner, brazier, bunting, elderOak, lantern, noticeBoard, planter, rootFountain, stringLights } from './hollowmere.ts';
import { berryBush, bush, flower, grassTuft, lilyPad, mushroom, reeds, tallGrass } from './plants.ts';
import { gateArch, hallLamp, heartstone, muralSlab, plinth, ruinPillar, shutDoor } from './ruin.ts';
import { bed, chest, forge, sprinkler, stove, workbench } from './stations.ts';
import { awning, bench, chimney, door, fence, gate, lampPost, sign, signpost, stall, townWindow, well } from './town.ts';
import { birch, oak, pine } from './trees.ts';
import { pastureFence, footbridge, mossStump, wildflowers, hayBale, harvestStall } from './valley.ts';

export type PropBuilder = (variant: number, def: PropDef) => THREE.BufferGeometry;

export const BUILDERS: Record<string, PropBuilder> = {
  pastureFence, footbridge, mossStump, wildflowers, hayBale, harvestStall,
  oak, birch, pine,
  grassTuft, tallGrass, flower, reeds, lilyPad, mushroom, bush, berryBush,
  rock, log, stump,
  door, window: townWindow, chimney, sign, awning, stall, well, fence, gate, lampPost, signpost, bench,
  banner, lantern, stringLights, bunting, brazier, planter, noticeBoard, rootFountain, elderOak,
  shutDoor, heartstone, gateArch, hallLamp, muralSlab, ruinPillar, plinth,
  barrel, crate, cart, sack,
  workbench, forge, stove, chest, bed, sprinkler,
};
