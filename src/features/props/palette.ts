// The colors a prop may use. Every value is copied from the locked palette, assets-src/palette.json,
// and a test fails when one is not in it. A builder uses these names and never a hex of its own.
//
// A single color is a `number`. A ramp is a list from dark to light: a shape picks from it face by face,
// so the top of a leaf clump is light and its underside is dark.

export const P = {
  // browns
  ink: 0x302529, umber: 0x493335, bark: 0x65453a, wood: 0x815940, tan: 0xa27151, clay: 0xc48d64, peach: 0xe4af7b, cream: 0xf7d3a1, ivory: 0xfff0cf,
  soil: 0x5e4128, timber: 0x664930, timberLight: 0x6e5138,
  // planks, from dark to light
  plankDark: 0x916534, plank: 0x9b6f3e, plankLight: 0xb78b5a, plankPale: 0xb28655,
  oakDark: 0x6a4b2e, oak: 0x946635, ochre: 0xb68a3f, gold: 0xd4aa58, butter: 0xeeca76, lemon: 0xf7e09a,
  // reds and pinks
  wine: 0x5f3539, brick: 0x894949, rust: 0xab5e4e, coral: 0xd67c59, apricot: 0xefab7a,
  plum: 0x684354, mauve: 0x925d79, rose: 0xb68e99, blush: 0xe7bcb5,
  // greys with a little violet: iron and slate
  night: 0x352e40, slate: 0x51455d, iron: 0x726c7a, pewter: 0x918996, ash: 0xb2a8b0, pearl: 0xd3c8c6,
  // greens
  pineDeep: 0x253c34, pine: 0x3c5537, moss: 0x516b3c, leaf: 0x6c8043, lime: 0x8d9a4a, straw: 0xadac59, hay: 0xcac476,
  grassDark: 0x65733d, grass: 0x6d7b45, grassLight: 0x75834d,
  // blues
  navy: 0x35506b, denim: 0x4d7193, sky: 0x6d96b6, ice: 0x94c6cd, mist: 0xccdbde,
  // the muted roof teal. The bright lume teal is for magic and old machines only.
  tealDeep: 0x1d5c5a, tealDark: 0x2d6c6a, teal: 0x397876, tealLight: 0x498886, tealPale: 0x559492,
  lumeDeep: 0x206560, lume: 0x2bab9c, lumeLight: 0x66e4cf,
  // cloth, plaster and bone
  bone: 0xeae6cd, plaster: 0xe6dcc5, plasterLight: 0xf6ecd5, sand: 0xdac291, sandDark: 0xd2ba89, burlap: 0xbba67a, burlapLight: 0xd1bc90,
  // the warm light of a lamp
  lamp: 0xf4d594, lampHot: 0xfcdd9c,
} as const;

export const RAMP = {
  oakLeaf: [0x3c5537, 0x516b3c, 0x587132, 0x688142, 0x748d4e],
  birchLeaf: [0x946635, 0xb68a3f, 0xd4aa58, 0xeeca76, 0xf7e09a],
  pineLeaf: [0x253c34, 0x3c5537, 0x3c5537, 0x516b3c],
  bushLeaf: [0x3c5537, 0x516b3c, 0x6c8043, 0x8d9a4a],
  grass: [0x516b3c, 0x6c8043, 0x8d9a4a],
  grassDry: [0x6c8043, 0x8d9a4a, 0xadac59],
  reed: [0x516b3c, 0x6c8043, 0xadac59],
  bark: [0x65453a, 0x815940, 0xa27151],
  pineBark: [0x493335, 0x5e4128, 0x664930],
  birchBark: [0xd3c8c6, 0xeae6cd, 0xfff0cf],
  stone: [0x65635c, 0x75736c, 0x817f78, 0x918f88, 0x9d9b94],
  mossStone: [0x7c806c, 0x848874, 0x8c907c],
  brick: [0x7a7871, 0x85837c, 0x908e87],
  plank: [0x916534, 0x9b6f3e, 0xb78b5a],
  burlap: [0xab8f64, 0xbba67a, 0xd1bc90],
  hay: [0xb68a3f, 0xd4aa58, 0xeeca76],
} as const;

/** Every color above, for the test that holds them to the palette. */
export function paletteColors(): number[] {
  return [...Object.values(P), ...Object.values(RAMP).flat()];
}
