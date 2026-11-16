// The painted textures a prop's part may wear, by name. A `Shape` writes the skin's number into every corner
// of the part, and the prop material samples that layer of one texture array, so every skin still costs one
// draw call a kind. Most are the painted world's own paintings in public/assets/painted; three are drawn by
// code in skins.view.ts, where no painting fits.
//
// A skin only carries light and dark: each layer is divided by its own average colour when it is loaded, so
// the part's vertex colour (from the palette) stays its colour and the painting adds strokes to it.
//
// This file holds no Three.js and no page, so a builder and a test can read it.

export interface SkinDef {
  /**
   * The painting's name under `painted.textures` in public/assets/manifest.json, or the name of a texture
   * skins.view.ts draws. Null wears no texture, only the painted light.
   */
  source: { painting: string } | { draw: 'grain' | 'thatch' | 'plaster' | 'tiles' | 'slate' | 'limestone' } | null;
  /** Meters one repeat of the painting covers. */
  scale: number;
  /** How strongly its strokes show: 0 not at all, 1 as painted, above 1 with more contrast than the painting. */
  amount: number;
  /** Its strokes run one way (bark, grain, straw), so a sweep, lathe or box lays them along itself. The rest are painted on from three sides. */
  along?: boolean;
}

export const SKINS = {
  /** No texture: only the painted light, and the form's own shading. */
  flat: { source: null, scale: 1, amount: 0 },
  /** Broad lavender-grey planes of weathered rock. */
  rock: { source: { painting: 'rock' }, scale: 4, amount: 1.3 },
  /** Small broken stones. */
  scree: { source: { painting: 'scree' }, scale: 1.6, amount: 0.7 },
  /** A cushion of moss. Moss baked onto a part (`moss` in FormOptions) wears this on its upward faces too. */
  moss: { source: { painting: 'moss' }, scale: 2, amount: 0.85 },
  /** Ridged oak bark. Its ridges run along a sweep or a lathe. */
  bark: { source: { painting: 'bark' }, scale: 2.4, amount: 1.1, along: true },
  /** Old bark with moss in its furrows. */
  barkOld: { source: { painting: 'bark-old' }, scale: 1.8, amount: 0.7, along: true },
  /** The ancients' dressed stone: big blocks with cracks between. */
  stone: { source: { painting: 'terrace-stone' }, scale: 2.6, amount: 0.75 },
  /** Wet earth. */
  mud: { source: { painting: 'mud' }, scale: 2, amount: 0.6 },
  /** Wood grain along a plank, post or beam. */
  grain: { source: { draw: 'grain' }, scale: 1.4, amount: 0.8, along: true },
  /** Straw laid down a roof. */
  thatch: { source: { draw: 'thatch' }, scale: 2.2, amount: 1.2, along: true },
  /** Lime plaster, soft and a little uneven. */
  plaster: { source: { draw: 'plaster' }, scale: 2.2, amount: 0.45 },
  /** Roof tiles in rows down a slope, each its own shade, with dark joints. Its rows run across a roof. */
  tiles: { source: { draw: 'tiles' }, scale: 1.6, amount: 0.9, along: true },
  /** Small grey slates in rows, sharper and more broken than tiles. */
  slate: { source: { draw: 'slate' }, scale: 1.1, amount: 0.85, along: true },
  /** Dressed limestone: soft blotches, pits and faint bedding, no joints (blocks model their own). */
  limestone: { source: { draw: 'limestone' }, scale: 1.8, amount: 0.6 },
} as const satisfies Record<string, SkinDef>;

export type Skin = keyof typeof SKINS;

/** The skins in layer order. A corner's skin number is its place here plus one; 0 is a part with no skin. */
export const SKIN_NAMES = Object.keys(SKINS) as Skin[];

/** The number a corner carries for this skin. */
export function skinNumber(skin: Skin): number {
  return SKIN_NAMES.indexOf(skin) + 1;
}

/** Added to a skin's number when the part carries its own texture coordinates instead of being painted from three sides. */
export const SKIN_UV = 32;
