// Who walks in the demo: every sprite in the manifest, and a few color variants of the two villagers,
// the pet and the critter. A variant swaps exact colors of the locked palette (assets-src/palette.json),
// so it costs no new art.
import type { Assets, ColorMap } from '../../src/features/assets/index.ts';
import type { Look } from './crowd.ts';

// The palette's ramps, dark to light.
const RED = ['#5f3539', '#894949', '#ab5e4e', '#d67c59'];
const GOLD = ['#6a4b2e', '#946635', '#b68a3f', '#d4aa58'];
const BLUE = ['#35506b', '#4d7193', '#6d96b6', '#94c6cd'];
const GREEN = ['#3c5537', '#516b3c', '#6c8043', '#8d9a4a'];
const GREY = ['#51455d', '#726c7a', '#918996', '#b2a8b0'];
const MAUVE = ['#684354', '#925d79', '#b68e99', '#e7bcb5'];

/** Swaps one ramp for another, shade for shade. */
function ramp(from: string[], to: string[]): ColorMap {
  return Object.fromEntries(from.map((color, i) => [color, to[i]]));
}

interface Member {
  sprite: string;
  speed: number;
  /** How many of every 20 characters are this sprite, split evenly over its looks. */
  share: number;
  variants: ColorMap[];
}

const MEMBERS: Member[] = [
  { sprite: 'hero', speed: 2.4, share: 2, variants: [] },
  // The villager's red dress and hair, in blue and in green.
  { sprite: 'villager-a', speed: 1.7, share: 5, variants: [ramp(RED, BLUE), ramp(RED, GREEN)] },
  // The other villager's brown coat and cap, in grey and in green.
  { sprite: 'villager-b', speed: 1.6, share: 5, variants: [ramp(GOLD, GREY), ramp(GOLD, GREEN)] },
  // The fox, grey and gold.
  { sprite: 'pet', speed: 2.8, share: 4, variants: [ramp(RED, GREY), ramp(RED, GOLD)] },
  // The green critter, blue and mauve. Its lightest green is a fifth shade, off the end of the ramp.
  { sprite: 'critter', speed: 1.1, share: 4, variants: [{ ...ramp(GREEN, BLUE), '#adac59': '#ccdbde' }, { ...ramp(GREEN, MAUVE), '#adac59': '#f7d3a1' }] },
];

/**
 * The looks to draw the crowd from: the five above with their variants, then every other sprite the
 * manifest lists, so a character the asset pipeline adds later walks in without a change here.
 * `names` replaces the list (for `?cast=hero,ghost`). A name the manifest does not have gets no
 * variants, and the sprite system draws its placeholder.
 */
export function buildCast(assets: Assets, names?: string[]): Look[] {
  const known = (sprite: string): Member => MEMBERS.find((m) => m.sprite === sprite) ?? {
    sprite,
    // Small creatures scurry. People stroll.
    speed: assets.hasSprite(sprite) && assets.sprite(sprite).worldHeight < 1.2 ? 2.2 : 1.6,
    share: names ? 4 : 1,
    variants: [],
  };
  const listed = names ?? [...MEMBERS.map((m) => m.sprite), ...Object.keys(assets.manifest.sprites).filter((n) => !MEMBERS.some((m) => m.sprite === n))];
  const looks: Look[] = [];
  for (const member of listed.map(known)) {
    const sprites = [member.sprite];
    if (assets.hasSprite(member.sprite)) for (const map of member.variants) sprites.push(assets.variant(member.sprite, map).name);
    for (let i = 0; i < member.share; i++) looks.push({ sprite: sprites[i % sprites.length], speed: member.speed });
  }
  return looks;
}
