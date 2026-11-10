// Every kind of block, as data. Adding a block here needs no engine change: the world reads these
// tables, the atlas paints or loads a tile for each tile name, and the mesher looks tiles up by face.
import type { Surface } from '../engine/types.ts';

export interface BlockTiles {
  top: string;
  side: string;
  bottom: string;
}

export interface BlockDef {
  /** The number stored in a chunk. 0 is air. Never reuse or reorder ids: saves hold them. */
  id: number;
  key: string;
  name: string;
  /** A body collides with it. */
  solid: boolean;
  /** It hides the faces behind it and stops light. */
  opaque: boolean;
  /** What a foot hears and kicks up on it. */
  surface: Surface;
  /** Light it gives off, 0 to 15. */
  light: number;
  /** Tile names in the block atlas. An empty name draws nothing. */
  tiles: BlockTiles;
  /** Made by terrain. Natural blocks get three texture variants picked by position. */
  natural: boolean;
  /** Bodies swim in it. */
  liquid: boolean;
  /** Its faces ignore light levels and glow. */
  glows: boolean;
  /** A flat color for maps and for a tile nobody painted. */
  color: number;
}

const all = (tile: string): BlockTiles => ({ top: tile, side: tile, bottom: tile });
const capped = (top: string, side: string, bottom = top): BlockTiles => ({ top, side, bottom });

type Row = [key: string, name: string, surface: Surface, tiles: BlockTiles, color: number, extra?: Partial<BlockDef>];

const rows: Row[] = [
  ['air', 'Air', 'grass', all(''), 0x000000, { solid: false, opaque: false }],
  ['grass', 'Grass', 'grass', capped('grass_top', 'grass_side', 'dirt'), 0x69b83e, { natural: true }],
  ['dirt', 'Dirt', 'dirt', all('dirt'), 0x8f6242, { natural: true }],
  ['tilled_soil', 'Tilled soil', 'dirt', capped('tilled_top', 'dirt', 'dirt'), 0x5d3d2a],
  ['path', 'Path', 'dirt', capped('path_top', 'path_side', 'dirt'), 0xc2b29b],
  ['sand', 'Sand', 'sand', all('sand'), 0xdcc892, { natural: true }],
  ['clay', 'Clay', 'dirt', all('clay'), 0xa9a2a0, { natural: true }],
  ['stone', 'Stone', 'stone', all('stone'), 0x8e87a0, { natural: true }],
  ['mossy_stone', 'Mossy stone', 'stone', all('mossy_stone'), 0x7d9a78, { natural: true }],
  ['cobble', 'Cobble', 'stone', all('cobble'), 0x9b95a3],
  ['stone_brick', 'Stone brick', 'stone', all('stone_brick'), 0xaca6b2],
  ['oak_log', 'Oak log', 'wood', capped('oak_log_top', 'oak_log_side'), 0x705034],
  ['oak_plank', 'Oak plank', 'wood', all('oak_plank'), 0x9a6b3e],
  ['birch_log', 'Birch log', 'wood', capped('birch_log_top', 'birch_log_side'), 0xd8d4c4],
  ['pine_log', 'Pine log', 'wood', capped('pine_log_top', 'pine_log_side'), 0x4d3524],
  ['thatch', 'Thatch', 'tallGrass', all('thatch'), 0xc9a94e],
  ['shingle', 'Shingle', 'stone', all('shingle'), 0x419596],
  ['plaster', 'Plaster', 'stone', all('plaster'), 0xf1e3c2],
  ['glass', 'Glass', 'stone', all('glass'), 0xbfe0ea, { opaque: false }],
  ['oak_leaves', 'Oak leaves', 'leaves', all('oak_leaves'), 0x4f9a3a, { natural: true }],
  ['pine_needles', 'Pine needles', 'leaves', all('pine_needles'), 0x2f6b4a, { natural: true }],
  ['water', 'Water', 'water', all('water'), 0x3f86c8, { solid: false, opaque: false, liquid: true }],
  ['lume_crystal', 'Lume crystal', 'stone', all('lume_crystal'), 0x4fe0c8, { light: 10, glows: true }],
  ['lamp', 'Lamp', 'metal', capped('lamp_top', 'lamp_side'), 0xffd890, { light: 14, glows: true }],
  // Fills the cells of a placed station, so a body and a click stop at it. It has no tiles, so the mesher draws
  // nothing for it, and light passes through. The station's prop is what the player sees.
  ['barrier', 'Barrier', 'wood', all(''), 0x9a6b3e, { opaque: false }],
  // The light inside a lantern prop, so the ground around a lantern is lit like the ground around a lamp. It has
  // no tiles and no body: the mesher skips it, the hero walks through it, and the prop is what the player sees.
  ['lantern_light', 'Lantern light', 'wood', all(''), 0xffd890, { solid: false, opaque: false, light: 14 }],
];

export const BLOCKS: readonly BlockDef[] = rows.map(([key, name, surface, tiles, color, extra], id) => ({
  id, key, name, surface, tiles, color,
  solid: true, opaque: true, light: 0, natural: false, liquid: false, glows: false,
  ...extra,
}));

export const AIR = 0;

const byKey = new Map(BLOCKS.map((b) => [b.key, b]));

/** The id of a block by its key. It throws on a key that is not in the table, so a typo fails early. */
export function blockId(key: string): number {
  const def = byKey.get(key);
  if (!def) throw new Error(`no block called ${key}`);
  return def.id;
}

/** Every tile name the blocks use, in a stable order. */
export function blockTileNames(): string[] {
  const names = new Set<string>();
  for (const b of BLOCKS) for (const t of [b.tiles.top, b.tiles.side, b.tiles.bottom]) if (t) names.add(t);
  return [...names];
}

/** Tiles that belong to a natural block, so they get three variants when drawn in code. */
export function naturalTileNames(): Set<string> {
  const names = new Set<string>();
  for (const b of BLOCKS) if (b.natural) for (const t of [b.tiles.top, b.tiles.side, b.tiles.bottom]) if (t) names.add(t);
  return names;
}
