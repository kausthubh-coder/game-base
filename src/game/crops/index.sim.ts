// Farming: tilled soil, water, and crops that grow in wet soil. The hoe, seeds, the can and the harvest
// click all come in through one handler on the actions system.
import { AIR, blockId } from '../../content/blocks.ts';
import { crops as table, farming, type CropEntry } from '../content/crops.ts';
import type { CropState, CropsApi, Game, ItemId, SimSystem, UseContext } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

const GRASS = blockId('grass');
const DIRT = blockId('dirt');
const TILLED = blockId('tilled_soil');

/** Steps of 0.05 seconds do not add up to exactly 45, so a stage is reached within this much. */
const EPSILON = 1e-6;

/** Item ids for the tools, used when the items system does not say what kind of tool an item is. */
const TOOLS: Record<string, string> = { hoe: 'hoe', watering_can: 'can' };

interface Planted {
  x: number;
  y: number;
  z: number;
  /** What the outside sees. The same object for the crop's whole life. */
  state: CropState;
  def: CropEntry;
  /** Seconds grown toward the next stage. */
  progress: number;
}

/** One block of tilled soil that is wet, planted or both. Coordinates are the soil block. */
interface Soil {
  x: number;
  y: number;
  z: number;
  wet: number;
  crop: Planted | null;
}

interface CropsSave {
  /** x, y, z, crop id, stage, progress, seconds of water. */
  crops: [number, number, number, string, number, number, number][];
  /** Wet soil with nothing planted: x, y, z, seconds of water. */
  soil: [number, number, number, number][];
}

export interface Crops {
  api: CropsApi;
  system: SimSystem;
  /** The click handler. The system adds it to `game.systems.actions` on its first step. */
  use(context: UseContext): boolean;
}

export function createCrops(game: Game): Crops {
  const { world, events } = game;
  const bySeed = new Map<ItemId, CropEntry>(table.map((def) => [def.seed, def]));
  const byId = new Map<string, CropEntry>(table.map((def) => [def.id, def]));

  const soils = new Map<string, Soil>();
  // The same records as arrays, so a step and all() allocate nothing.
  const soilList: Soil[] = [];
  const planted: Planted[] = [];
  let wired = false;

  const keyOf = (x: number, y: number, z: number): string => `${x},${y},${z}`;

  function soilAt(x: number, y: number, z: number): Soil {
    const key = keyOf(x, y, z);
    let soil = soils.get(key);
    if (!soil) {
      soil = { x, y, z, wet: 0, crop: null };
      soils.set(key, soil);
      soilList.push(soil);
    }
    return soil;
  }

  function forget(soil: Soil): void {
    soils.delete(keyOf(soil.x, soil.y, soil.z));
    const i = soilList.indexOf(soil);
    soilList[i] = soilList[soilList.length - 1];
    soilList.pop();
  }

  function unplant(soil: Soil): void {
    const crop = soil.crop;
    if (!crop) return;
    planted.splice(planted.indexOf(crop), 1);
    soil.crop = null;
  }

  function wetSoil(x: number, y: number, z: number): Soil {
    const soil = soilAt(x, y, z);
    soil.wet = farming.waterSeconds;
    if (soil.crop) soil.crop.state.wet = soil.wet;
    return soil;
  }

  function grow(crop: Planted, stages: number): void {
    const last = crop.def.stages - 1;
    crop.state.stage = Math.min(last, crop.state.stage + stages);
    crop.state.ripe = crop.state.stage === last;
    if (crop.state.ripe) crop.progress = 0;
    events.emit('crop.grew', { x: crop.x, y: crop.y, z: crop.z, crop: crop.def.id, stage: crop.state.stage });
  }

  /** Pulls a crop out of soil that was broken or built over. The seed goes back to the bag. */
  function uproot(soil: Soil): void {
    const crop = soil.crop;
    if (!crop) return;
    unplant(soil);
    game.systems.inventory.add(crop.def.seed, 1);
  }

  const api: CropsApi = {
    defs: () => table,

    till(x, y, z) {
      const id = world.getBlock(x, y, z);
      if (id !== GRASS && id !== DIRT) return false;
      if (game.systems.region?.isProtected(x, y, z)) return false;
      world.setBlock(x, y, z, TILLED);
      events.emit('soil.tilled', { x, y, z });
      return true;
    },

    plant(x, y, z, seed) {
      const def = bySeed.get(seed);
      if (!def || world.getBlock(x, y, z) !== TILLED || world.getBlock(x, y + 1, z) !== AIR) return false;
      if (game.systems.placeables?.at(x, y + 1, z)) return false;
      const soil = soilAt(x, y, z);
      if (soil.crop) return false;
      soil.crop = { x, y, z, def, progress: 0, state: { crop: def.id, stage: 0, wet: soil.wet, ripe: def.stages <= 1 } };
      planted.push(soil.crop);
      events.emit('crop.planted', { x, y, z, crop: def.id });
      return true;
    },

    water(x, y, z) {
      if (world.getBlock(x, y, z) !== TILLED) return false;
      // One event for one use of the can. It names the soil that was aimed at, or a watered crop beside it when
      // that soil is bare, so a listener that asks which crop was watered gets an answer.
      let ex = x, ez = z, onCrop = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (world.getBlock(x + dx, y, z + dz) !== TILLED) continue;
          const soil = wetSoil(x + dx, y, z + dz);
          if (!soil.crop || (onCrop && (dx !== 0 || dz !== 0))) continue;
          ex = soil.x;
          ez = soil.z;
          onCrop = true;
        }
      }
      events.emit('crop.watered', { x: ex, y, z: ez });
      return true;
    },

    harvest(x, y, z) {
      const soil = soils.get(keyOf(x, y, z));
      const crop = soil?.crop;
      if (!soil || !crop || !crop.state.ripe) return false;
      const bag = game.systems.inventory;
      const from = { x: x + 0.5, y: y + 1.5, z: z + 0.5 };
      for (let i = 0; i < crop.def.gives.length; i++) {
        const give = crop.def.gives[i];
        const left = bag.add(give.id, give.count, from);
        if (left === 0) continue;
        // No room: take back what went in and leave the crop standing.
        if (left < give.count) bag.remove(give.id, give.count - left);
        for (let j = 0; j < i; j++) bag.remove(crop.def.gives[j].id, crop.def.gives[j].count);
        events.emit('toast', { text: 'Your bag is full.' });
        return false;
      }
      if (game.random() < crop.def.seedChance) bag.add(crop.def.seed, 1, from);
      unplant(soil);
      if (soil.wet <= 0) forget(soil);
      for (const give of crop.def.gives) game.flags.add(`harvested.${give.id}`, give.count);
      events.emit('crop.harvested', { x, y, z, crop: crop.def.id });
      return true;
    },

    at: (x, y, z) => soils.get(keyOf(x, y, z))?.crop?.state ?? null,
    all: () => planted,
  };

  /** The tool kind of a held item, from the items system when it is there. */
  function toolOf(id: ItemId): string | undefined {
    return game.systems.items?.get(id)?.tool?.kind ?? TOOLS[id];
  }

  function use(context: UseContext): boolean {
    const hit = context.hit;
    if (!hit) return false;

    if (context.button === 'primary') {
      // The pointer lands on the soil, or on a block beside the crop with the crop in front of it.
      let soil = soils.get(keyOf(hit.x, hit.y, hit.z));
      if (!soil?.crop) soil = soils.get(keyOf(hit.x + hit.nx, hit.y + hit.ny - 1, hit.z + hit.nz));
      if (!soil?.crop?.state.ripe) return false;
      api.harvest(soil.x, soil.y, soil.z);
      return true;
    }

    const held = context.held;
    if (!held) return false;
    const block = world.getBlock(hit.x, hit.y, hit.z);
    const tool = toolOf(held.id);
    if (tool === 'hoe') return api.till(hit.x, hit.y, hit.z);
    if (block !== TILLED) return false;
    if (tool === 'can') return api.water(hit.x, hit.y, hit.z);
    if (bySeed.has(held.id)) {
      if (api.plant(hit.x, hit.y, hit.z, held.id)) game.systems.inventory.remove(held.id, 1);
      return true;
    }
    return false;
  }

  events.on('block.broken', ({ x, y, z }) => {
    const soil = soils.get(keyOf(x, y, z));
    if (!soil) return;
    uproot(soil);
    forget(soil);
  });

  events.on('block.placed', ({ x, y, z, id }) => {
    // A block where the soil was, or a block on top of the crop.
    const here = soils.get(keyOf(x, y, z));
    if (here && id !== TILLED) {
      uproot(here);
      forget(here);
    }
    const below = soils.get(keyOf(x, y - 1, z));
    if (below?.crop && id !== AIR) {
      uproot(below);
      if (below.wet <= 0) forget(below);
    }
  });

  // A night's sleep: every crop in wet soil gains two stages, and the soil is dry by morning.
  events.on('slept', () => {
    for (let i = soilList.length - 1; i >= 0; i--) {
      const soil = soilList[i];
      const crop = soil.crop;
      if (crop && soil.wet > 0 && !crop.state.ripe) grow(crop, farming.sleepStages);
      soil.wet = 0;
      if (crop) crop.state.wet = 0;
      else forget(soil);
    }
  });

  const system: SimSystem = {
    step(dt) {
      if (!wired && game.systems.actions) {
        game.systems.actions.addHandler(use);
        wired = true;
      }
      const raining = game.ambient.rain > farming.rainWaters;
      for (let i = soilList.length - 1; i >= 0; i--) {
        const soil = soilList[i];
        if (raining && world.openSky(soil.x, soil.y + 1, soil.z)) soil.wet = farming.waterSeconds;
        const crop = soil.crop;
        if (soil.wet > 0) {
          if (crop && !crop.state.ripe) {
            crop.progress += dt;
            if (crop.progress + EPSILON >= crop.def.secondsPerStage) {
              crop.progress = Math.max(0, crop.progress - crop.def.secondsPerStage);
              grow(crop, 1);
            }
          }
          soil.wet = Math.max(0, soil.wet - dt);
        }
        if (crop) crop.state.wet = soil.wet;
        else if (soil.wet <= 0) forget(soil);
      }
    },

    save(): CropsSave {
      const out: CropsSave = { crops: [], soil: [] };
      for (const soil of soilList) {
        const crop = soil.crop;
        if (crop) out.crops.push([soil.x, soil.y, soil.z, crop.def.id, crop.state.stage, crop.progress, soil.wet]);
        else out.soil.push([soil.x, soil.y, soil.z, soil.wet]);
      }
      return out;
    },

    load(data) {
      const save = data as Partial<CropsSave> | null;
      soils.clear();
      soilList.length = 0;
      planted.length = 0;
      for (const [x, y, z, wet] of save?.soil ?? []) soilAt(x, y, z).wet = wet;
      for (const [x, y, z, id, stage, progress, wet] of save?.crops ?? []) {
        const def = byId.get(id);
        if (!def) continue;
        const soil = soilAt(x, y, z);
        soil.wet = wet;
        soil.crop = { x, y, z, def, progress, state: { crop: id, stage, wet, ripe: stage >= def.stages - 1 } };
        planted.push(soil.crop);
      }
    },
  };

  return { api, system, use };
}

export function install(kernel: Kernel): void {
  const crops = createCrops(kernel.game);
  kernel.add('crops', crops.api, crops.system);
}
