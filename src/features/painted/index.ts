// The painted world: the look of a hand-painted film background, drawn over the game's own blocks. The land
// is one smooth surface, lit by one painted light that every painted surface shares.
export { createLand, fbm, meadowColor, smoothstep, type Land, type LandBlocks } from './land.ts';
export { paint, paintDepth, shared, type PaintOptions } from './paint.ts';
export { loadTextures, type Textures } from './textures.ts';
export { createGrass, type Grass } from './grass.ts';
export { createBackdrop, type Backdrop, type SkyWeather } from './sky.ts';
export { buildTree, createStand, foliageMaterials, type Foliage, type Placement, type Stand, type Tones, type TreeShape, type TreeSpec } from './trees.ts';
export * from './scatter.ts';
export { createWater, type PaintedWater, type WaterLook, type WaterRings } from './water.ts';
export { createFarLand, type FarLand, type FarSource } from './far.ts';
export { createImpostors, type Impostors, type Sitter } from './impostors.ts';
