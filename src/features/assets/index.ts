// The asset loader: the manifest, the files it lists, and the one atlas every sprite is drawn from.
export {
  PLACEHOLDER_NAME, browserIO, loadAssets,
  type AssetIO, type Assets, type AssetsOptions, type AtlasPlace, type BlockAtlasAsset, type IconAsset, type ImageAsset,
  type LoadProgress, type SpriteAsset, type SpriteAtlas, type TileCell, type TileSheetAsset,
} from './assets.view.ts';
export {
  AssetError, parseManifest,
  type AnimationEntry, type BlocksEntry, type IconsEntry, type Manifest, type SpriteDirection, type SpriteEntry, type TileSheetEntry,
} from './manifest.ts';
export { packAtlas, type PackItem, type PackOptions, type PackResult, type Placement } from './pack.ts';
export { parseColor, recolor, type ColorMap, type Pixels } from './pixels.ts';
