import { loadEnvironmentModels } from '../../features/props/models.view.ts';
// Draws each crop's solid Blender model on its soil block. The sheet coordinates identify its stage;
// no crop texture is sampled. Wet soil gets a dark patch.
// Two draw calls: one for all plants, one for all wet patches.
//
// No event tells a view that a crop is gone or that a save was loaded, so each frame the list is compared
// with what was drawn, slot by slot, and only the rows that differ are written again.
import { BLOCKS } from '../../content/blocks.ts';
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { PLANT_STRIDE, WET_STRIDE, createCropMeshes } from '../worldview/crop-mesh.ts';

/** The patch floats this far above the soil's top. */
const WET_LIFT = 0.012;
/** One use of the can wets soil for this long. Only bare soil is timed here: a crop says how wet its own soil is. */
const WATER_SECONDS = 180;
/** A plant looks at the light around it again this often, in frames. */
const LIGHT_EVERY = 45;
const NEVER = -1000;

/** A number from 0 to 1 that depends only on the column, so each plant sways in its own time. */
function own(x: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export async function install(view: GameView): Promise<void> {
  await loadEnvironmentModels();
  const { game, assets } = view;
  if (!assets.sheetNames().includes('crops')) {
    console.warn('[crops] the manifest lists no crops sheet, so crops are not drawn.');
    return;
  }
  const sheet = assets.sheet('crops');
  const sim = view.world.sim;
  const meshes = createCropMeshes(sheet.texture, sheet.tile / sheet.pixels.width, sheet.tile / sheet.pixels.height);
  view.scene.add(meshes.plants, meshes.wet);
  const tilled = BLOCKS.find((block) => block.key === 'tilled_soil')?.id ?? -1;

  /** For each crop: u and v of the tile of each stage. A crop the sheet does not have borrows the first one's tiles. */
  const tiles = new Map<string, Float32Array>();
  function tilesOf(crop: string): Float32Array {
    let found = tiles.get(crop);
    if (!found) {
      const name = sheet.names.includes(crop) ? crop : sheet.names[0];
      if (name !== crop) console.warn(`[crops] the crops sheet has no tiles for ${crop}, so it is drawn as ${name}.`);
      const cells = name === undefined ? [] : sheet.cells(name);
      found = new Float32Array(Math.max(1, cells.length) * 2);
      cells.forEach((cell, i) => { found![i * 2] = cell.uv[0]; found![i * 2 + 1] = cell.uv[1]; });
      tiles.set(crop, found);
    }
    return found;
  }

  // What each slot showed last frame.
  let room = 64;
  let seenAt = new Int32Array(room * 3), seenStage = new Int16Array(room);
  /** Seconds of water each slot's soil had. */
  let seenWet = new Float32Array(room);
  let drawn = 0, wetCount = 0, frames = 0;

  /** Wet soil with no crop on it. The crops system does not list it, so it is followed from `crop.watered`. */
  const bare: { x: number; y: number; z: number; until: number }[] = [];
  let bareChanged = false, nextDry = Infinity;

  game.events.on('crop.watered', ({ x, y, z }) => {
    const until = game.clock.seconds + WATER_SECONDS;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (sim.getBlock(x + dx, y, z + dz) !== tilled) continue;
        const known = bare.find((spot) => spot.x === x + dx && spot.y === y && spot.z === z + dz);
        if (known) known.until = until;
        else bare.push({ x: x + dx, y, z: z + dz, until });
      }
    }
    bareChanged = true;
  });
  // The soil is dry in the morning.
  game.events.on('slept', () => { bare.length = 0; bareChanged = true; });
  game.events.on('crop.planted', () => { bareChanged = true; });
  // A harvest leaves the soil as wet as it was. The crop is already gone, so its last frame says how wet.
  game.events.on('crop.harvested', ({ x, y, z }) => {
    for (let i = 0; i < drawn; i++) {
      if (seenAt[i * 3] !== x || seenAt[i * 3 + 1] !== y || seenAt[i * 3 + 2] !== z) continue;
      if (seenWet[i] > 0) bare.push({ x, y, z, until: game.clock.seconds + seenWet[i] });
      break;
    }
    bareChanged = true;
  });
  game.events.on('block.broken', () => { bareChanged = true; });
  game.events.on('block.placed', () => { bareChanged = true; });

  function writeLight(row: number, x: number, y: number, z: number): boolean {
    const data = meshes.plantData;
    const sky = sim.skyLightAt(x + 0.5, y + 1.5, z + 0.5) / 15, lamp = sim.blockLightAt(x + 0.5, y + 1.5, z + 0.5) / 15;
    if (data[row + 8] === sky && data[row + 9] === lamp) return false;
    data[row + 8] = sky;
    data[row + 9] = lamp;
    return true;
  }

  view.onFrame(() => {
    const crops = (game.systems as Partial<Systems>).crops;
    const list = crops?.all();
    const count = list ? list.length : 0;
    const now = view.ctx.time;
    if (count > room) {
      while (room < count) room *= 2;
      const at = new Int32Array(room * 3), stage = new Int16Array(room), wet = new Float32Array(room);
      at.set(seenAt); stage.set(seenStage); wet.set(seenWet);
      seenAt = at; seenStage = stage; seenWet = wet;
    }
    meshes.reserve(count, count + bare.length);
    const data = meshes.plantData;
    const lightPass = ++frames % LIGHT_EVERY === 0;
    let plantsChanged = false, wetChanged = bareChanged || count !== drawn || game.clock.seconds >= nextDry;

    for (let i = 0; list && i < count; i++) {
      const crop = list[i], state = crop.state;
      const row = i * PLANT_STRIDE;
      const same = i < drawn && seenAt[i * 3] === crop.x && seenAt[i * 3 + 1] === crop.y && seenAt[i * 3 + 2] === crop.z;
      if (!same || (seenWet[i] > 0) !== (state.wet > 0)) wetChanged = true;
      if (!same || seenStage[i] !== state.stage) {
        const cells = tilesOf(state.crop);
        const stage = Math.min(Math.max(state.stage, 0), cells.length / 2 - 1);
        data[row] = crop.x + 0.5; data[row + 1] = crop.y + 1; data[row + 2] = crop.z + 0.5; data[row + 3] = own(crop.x, crop.z);
        data[row + 4] = cells[stage * 2]; data[row + 5] = cells[stage * 2 + 1];
        // It pops only when the plant that stood here grew. A plant that just came into the list does not.
        data[row + 6] = same && state.stage > seenStage[i] ? now : NEVER;
        data[row + 7] = 0;
        writeLight(row, crop.x, crop.y, crop.z);
        plantsChanged = true;
      } else if (lightPass && writeLight(row, crop.x, crop.y, crop.z)) {
        plantsChanged = true;
      }
      seenAt[i * 3] = crop.x; seenAt[i * 3 + 1] = crop.y; seenAt[i * 3 + 2] = crop.z;
      seenStage[i] = state.stage;
      seenWet[i] = state.wet;
    }
    drawn = count;

    if (wetChanged) {
      const spots = meshes.wetData;
      wetCount = 0;
      nextDry = Infinity;
      for (let i = 0; list && i < count; i++) {
        const crop = list[i];
        if (crop.state.wet <= 0) continue;
        spots[wetCount * WET_STRIDE] = crop.x + 0.5; spots[wetCount * WET_STRIDE + 1] = crop.y + 1 + WET_LIFT; spots[wetCount * WET_STRIDE + 2] = crop.z + 0.5;
        wetCount++;
      }
      for (let i = bare.length - 1; i >= 0; i--) {
        const spot = bare[i];
        // Dry again, dug up, or planted: a crop's own soil is drawn from the crop.
        if (spot.until <= game.clock.seconds || sim.getBlock(spot.x, spot.y, spot.z) !== tilled || crops?.at(spot.x, spot.y, spot.z)) {
          bare.splice(i, 1);
          continue;
        }
        spots[wetCount * WET_STRIDE] = spot.x + 0.5; spots[wetCount * WET_STRIDE + 1] = spot.y + 1 + WET_LIFT; spots[wetCount * WET_STRIDE + 2] = spot.z + 0.5;
        wetCount++;
        if (spot.until < nextDry) nextDry = spot.until;
      }
      bareChanged = false;
    }

    meshes.commit(count, wetCount, plantsChanged, wetChanged);
    const a = view.ctx.ambient;
    meshes.frame(now, Math.cos(a.windDir), Math.sin(a.windDir), a.wind, view.sky.look.light);
  });
}
