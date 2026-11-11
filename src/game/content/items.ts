// Every item of the first part, as data. Adding an item here needs no code change.
// Icons are names from public/assets/manifest.json. A block item with no icon of its own borrows the
// nearest one, so the interface may draw the block's own tile when `block` is set.
import { blockId } from '../../content/blocks.ts';
import type { ItemDef } from '../api.sim.ts';

const STACK = 99;

export const ITEMS: readonly ItemDef[] = [
  // resources
  { id: 'oak_log', name: 'Oak log', icon: 'wood', stack: STACK, description: 'Wood from a tree. One log saws into four planks.' },
  // A plank is also what the player builds with: it places the oak plank block, and that block gives a plank back.
  { id: 'plank', name: 'Plank', icon: 'plank', stack: STACK, description: 'A sawn board. Build with it or craft with it.', block: blockId('oak_plank') },
  { id: 'fiber', name: 'Fiber', icon: 'fiber', stack: STACK, description: 'Tough strands from leaves and grass.' },
  { id: 'moss_tuft', name: 'Moss tuft', icon: 'moss_tuft', stack: STACK, description: 'Soft and faintly bright. A mossling left it.' },
  { id: 'berry', name: 'Berry', icon: 'berry', stack: STACK, description: 'Sweet. Small animals like them.', treat: true },
  { id: 'wheat', name: 'Wheat', icon: 'wheat', stack: STACK, description: 'A ripe sheaf, ready for the granary.' },
  { id: 'wheat_seeds', name: 'Wheat seeds', icon: 'wheat_seeds', stack: STACK, description: 'Plant them in tilled soil and keep it wet.', seed: 'wheat' },
  { id: 'bread', name: 'Bread', icon: 'bread', stack: STACK, description: 'One of Odo\'s loaves. It has a name.', food: { stamina: 30 } },

  // tools
  { id: 'axe', name: 'Axe', icon: 'axe', stack: 1, description: 'Cuts a log three times faster than hands.', tool: { kind: 'axe', tier: 1 } },
  { id: 'hoe', name: 'Hoe', icon: 'hoe', stack: 1, description: 'Turns grass or dirt into tilled soil.', tool: { kind: 'hoe', tier: 1 } },
  { id: 'watering_can', name: 'Watering can', icon: 'watering_can', stack: 1, description: 'Wets soil for three minutes.', tool: { kind: 'can', tier: 1 } },
  { id: 'pickaxe', name: 'Pickaxe', icon: 'pickaxe', stack: 1, description: 'Breaks stone, which hands cannot.', tool: { kind: 'pickaxe', tier: 1 } },

  // stations and furniture
  { id: 'workbench', name: 'Workbench', icon: 'workbench', stack: 9, description: 'Set it down to craft bigger things beside it.', placeable: 'workbench' },
  { id: 'bed', name: 'Bed', icon: 'bed', stack: 9, description: 'Sleep in it in the evening, under a roof.', placeable: 'bed' },
  { id: 'chest', name: 'Chest', icon: 'chest', stack: 9, description: 'A box with a good lid.', placeable: 'chest' },
  // These two borrow an icon until they get their own.
  { id: 'fence', name: 'Fence', icon: 'plank', stack: STACK, description: 'A post and two rails. It joins the fence beside it.', placeable: 'fence' },
  { id: 'sprinkler', name: 'Sprinkler', icon: 'watering_can', stack: 9, description: 'Keeps tilled soil wet two blocks each way.', placeable: 'sprinkler' },

  // blocks
  { id: 'dirt', name: 'Dirt', icon: 'stone', stack: STACK, description: 'A block of earth.', block: blockId('dirt') },
  { id: 'stone', name: 'Stone', icon: 'stone', stack: STACK, description: 'A block of grey stone.', block: blockId('stone') },
  { id: 'cobble', name: 'Cobble', icon: 'stone', stack: STACK, description: 'Rough stones set together.', block: blockId('cobble') },
  { id: 'oak_plank', name: 'Oak planks', icon: 'plank', stack: STACK, description: 'A block of planks.', block: blockId('oak_plank') },
  { id: 'lamp', name: 'Lamp', icon: 'lamp', stack: STACK, description: 'Moss light behind a wooden frame.', block: blockId('lamp') },
  { id: 'glass', name: 'Glass', icon: 'stone', stack: STACK, description: 'A clear block. Light passes through.', block: blockId('glass') },
  { id: 'thatch', name: 'Thatch', icon: 'fiber', stack: STACK, description: 'Bundled straw for a roof.', block: blockId('thatch') },
  { id: 'plaster', name: 'Plaster', icon: 'stone', stack: STACK, description: 'A pale wall block.', block: blockId('plaster') },
  { id: 'stone_brick', name: 'Stone brick', icon: 'stone', stack: STACK, description: 'Cut stone, laid square.', block: blockId('stone_brick') },
  { id: 'sand', name: 'Sand', icon: 'stone', stack: STACK, description: 'A block of river sand.', block: blockId('sand') },

  // story. The Almanac has a name and an icon for the interface, but the bag never holds it: see src/game/inventory.
  { id: 'almanac', name: 'Almanac', icon: 'book', stack: 1, description: 'Blank for forty years. It fills when you look closely.' },
  { id: 'river_lamp', name: 'River lamp', icon: 'lantern', stack: 1, description: 'A paper lamp to float on the Mere.' },
];
