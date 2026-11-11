// The block world. `createWorld` draws it, `World` is the rules alone (no drawing, runs anywhere).
export { createWorld, type Cutaway, type WorldOptions, type WorldStats, type WorldView } from './world.view.ts';
export { World, buildChunk, emptyHit, type RayHit, type WorldSave } from './world.sim.ts';
export { drawBlockAtlas, loadBlockAtlas, TILE, type AtlasSource, type BlockAtlasEntry } from './atlas.view.ts';
export { LANDMARKS, WATER_LEVEL, groundHeight, spawnPoint } from './terrain.sim.ts';
export { CHUNK, HEIGHT } from './chunk.sim.ts';
