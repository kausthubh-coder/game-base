// The painted world: the look of a hand-painted film background, drawn over the game's own blocks. The land
// is one smooth surface, lit by one painted light that every painted surface shares.
export { createLand, fbm, meadowColor, smoothstep, type Land, type LandBlocks } from './land.ts';
export { paint, paintDepth, seeCall, setSight, shared, type PaintOptions, type See, type SightInput, type SightShape } from './paint.ts';
export { loadTextures, type Textures } from './textures.ts';
export { createGrass, type Grass } from './grass.ts';
export { createBackdrop, type Backdrop, type SkyWeather } from './sky.ts';
export { buildTree, createStand, foliageMaterials, type Foliage, type Placement, type Stand, type Tones, type TreeShape, type TreeSpec } from './trees.ts';
export * from './scatter.ts';
export { createWater, type PaintedWater, type WaterLook, type WaterRings } from './water.ts';
export { createFarLand, type FarLand, type FarSource } from './far.ts';
export { createImpostors, type Impostors, type Sitter } from './impostors.ts';
export { createFarBuildings, type FarBuildings, type FarPart } from './far-buildings.ts';
export { createGround, MEADOW_ONLY, POOL_AT, type Ground, type Nature } from './nature.ts';
export { createWilds, type Wilds } from './wilds.ts';
export { createShafts, type ShaftLook, type Shafts } from './shafts.ts';
export { PAINTINGS, type Painting } from './textures.ts';
