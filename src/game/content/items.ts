// Every item of the first part, as data. Adding an item here needs no code change.
// Icons are names from public/assets/manifest.json. A block item with no icon of its own borrows the
// nearest one, so the interface may draw the block's own tile when `block` is set.
import { blockId } from '../../content/blocks.ts';
import type { ItemDef } from '../api.sim.ts';
import { HOME_ITEMS } from './people.ts';

const STACK = 99;

export const ITEMS: readonly ItemDef[] = [
  // resources
  { id: 'oak_log', name: 'Oak log', icon: 'wood', stack: STACK, description: 'Wood from a tree. One log saws into four planks.' },
  // A plank is also what the player builds with: it places the oak plank block, and that block gives a plank back.
  { id: 'plank', name: 'Plank', icon: 'plank', stack: STACK, description: 'A sawn board. Build with it or craft with it.', block: blockId('oak_plank') },
  { id: 'fiber', name: 'Fiber', icon: 'fiber', stack: STACK, description: 'Tough strands from leaves and grass.' },
  { id: 'moss_fiber', name: 'Moss fiber', icon: 'act1-moss-fiber', stack: STACK, description: 'Soft and faintly bright. A mossling left it.' },
  { id: 'berry', name: 'Berry', icon: 'berry', stack: STACK, description: 'Sweet. Small animals like them. Planted, a berry grows into a hedge.', treat: true, seed: 'berry_bush' },
  { id: 'wheat', name: 'Wheat', icon: 'act1-wheat', stack: STACK, description: 'A ripe sheaf, ready for the granary.' },
  { id: 'wheat_seeds', name: 'Wheat seeds', icon: 'wheat_seeds', stack: STACK, description: 'Plant them in tilled soil and keep it wet.', seed: 'wheat' },
  { id: 'bread', name: 'Bread', icon: 'bread', stack: STACK, description: 'A round loaf from the market green. It keeps.', food: { stamina: 30 } },

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
  { id: 'sprinkler', name: 'Sprinkler', icon: 'watering_can', stack: 9, description: 'Wets the eight blocks round it while a shaft brings it power. Uses 1 power.', placeable: 'sprinkler' },

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

  // ---- act 1 (handbook chapter 30, playthrough/farms.js). The ids are GOOD_IDS, PART_IDS and KIT_IDS in ids.ts.
  // The goods and the kit have their own icons (the act1-farm, act1-found and act1-kit sheets). The machine parts
  // still borrow one until a parts sheet is drawn. Each part sets down the placeable of its own name.

  // goods: what farms make, and what is found in the world
  { id: 'carrot_seeds', name: 'Carrot seeds', icon: 'act1-seeds', stack: STACK, description: 'Your fox dug them up. Plant them in wet soil.', seed: 'carrot' },
  { id: 'carrot', name: 'Carrot', icon: 'act1-carrot', stack: STACK, description: 'Burrowers want these more than you do.' },
  { id: 'sunroot_seeds', name: 'Sunroot seeds', icon: 'act1-seed', stack: STACK, description: 'Nobody sells these. Your fox found them.', seed: 'sunroot' },
  { id: 'sunroot', name: 'Sunroot', icon: 'act1-sunroot', stack: STACK, description: 'A root that keeps. Meals for a long road.' },
  { id: 'quill', name: 'Quill', icon: 'act1-quills', stack: STACK, description: 'Shed by a thistlehog on a post.' },
  { id: 'copper', name: 'Copper', icon: 'act1-copper', stack: STACK, description: 'Thrown up by burrowers among the carrots.' },
  { id: 'gear_spring', name: 'Gear spring', icon: 'act1-gear-spring', stack: STACK, description: 'Dropped by a gearling that stopped in the dark.' },
  { id: 'frog_slick', name: 'Frog slick', icon: 'act1-frog-slick', stack: STACK, description: 'Left on the bank where frogs ate.' },
  { id: 'honey', name: 'Honey', icon: 'act1-honey', stack: STACK, description: 'From a bee box among flowers.' },
  { id: 'wax', name: 'Wax', icon: 'act1-wax', stack: STACK, description: 'From a bee box. Every lamp needs some.' },
  { id: 'glow_dust', name: 'Glow dust', icon: 'act1-glow-dust', stack: STACK, description: 'Lanternflies leave it in a lamp trap.' },
  { id: 'vine_rope', name: 'Vine rope', icon: 'act1-vine-rope', stack: STACK, description: 'Grown by a rootsnare asleep in the sun.' },
  { id: 'old_brass', name: 'Old brass', icon: 'act1-old-brass', stack: STACK, description: 'Ancient metal. Found, never farmed.' },
  { id: 'tusk_tip', name: 'Tusk tip', icon: 'act1-tusk-tip', stack: STACK, description: 'Bramble sheds one on the gatepost.' },
  { id: 'shed_pelt', name: 'Shed pelt', icon: 'act1-shed-pelt', stack: STACK, description: 'The grey coat a calmed beast leaves behind.' },
  { id: 'heartwood', name: 'Heartwood', icon: 'act1-heartwood', stack: STACK, description: 'From a fallen oak inside the grey forest.' },
  { id: 'meal', name: 'Meal', icon: 'act1-hobbs-meal', stack: STACK, description: 'Hobb\'s cooking. One a day gives you an extra heart.' },
  { id: 'travel_meal', name: 'Travel meal', icon: 'act1-travel-meal', stack: STACK, description: 'From the smokehouse. It keeps for a week.' },

  // machine parts and simple builds
  { id: 'spade', name: 'Spade', icon: 'act1-spade', stack: 1, description: 'Digs a hole. Beside water it fills, and a ditch carries water on flat or downhill ground.', tool: { kind: 'shovel', tier: 1 } },
  { id: 'waterwheel', name: 'Waterwheel', icon: 'hammer', stack: 9, description: 'Turns flowing water into power: 4 on flat water, 6 where it drops.', placeable: 'waterwheel' },
  { id: 'gear_shaft', name: 'Gear shaft', icon: 'hammer', stack: STACK, description: 'Carries power. Nothing grows where it runs.', placeable: 'gear_shaft' },
  { id: 'lever', name: 'Lever', icon: 'hammer', stack: 9, description: 'Turns everything on its shaft on or off.', placeable: 'lever' },
  { id: 'chute', name: 'Chute', icon: 'plank', stack: STACK, description: 'Carries goods downhill, or uphill when powered.', placeable: 'chute' },
  { id: 'collector_chest', name: 'Collector chest', icon: 'chest', stack: 9, description: 'Takes in loose goods within three blocks.', placeable: 'collector_chest' },
  { id: 'pusher', name: 'Pusher', icon: 'hammer', stack: 9, description: 'Shoves the block, good or creature in front of it.', placeable: 'pusher' },
  { id: 'sensor', name: 'Sensor', icon: 'lantern', stack: 9, description: 'On when it sees a creature, a good, light, dry soil or a ripe crop.', placeable: 'sensor' },
  { id: 'switch_lamp', name: 'Switchable lamp', icon: 'lamp', stack: 9, description: 'A lamp that a sensor or a lever turns on and off.', placeable: 'switch_lamp' },
  { id: 'harvester_arm', name: 'Harvester arm', icon: 'hammer', stack: 9, description: 'Cuts the ripe crop in front of it and replants.', placeable: 'harvester_arm' },
  { id: 'saw_arm', name: 'Saw arm', icon: 'axe', stack: 9, description: 'Fells the tree in front of it and plants the sapling.', placeable: 'saw_arm' },
  { id: 'bee_box', name: 'Bee box', icon: 'chest', stack: 9, description: 'Bees come to it where the land is alive enough.', placeable: 'bee_box' },
  { id: 'post', name: 'Post', icon: 'plank', stack: STACK, description: 'A thistlehog scratches on it and sheds quills.', placeable: 'post' },
  { id: 'clapper', name: 'Clapper', icon: 'hammer', stack: 9, description: 'A sudden noise. A thistlehog bolts past every post.', placeable: 'clapper' },
  { id: 'rope_ladder', name: 'Rope ladder', icon: 'act1-vine-rope', stack: 9, description: 'Hangs down a drop you cannot climb. Vine rope and planks.' },
  { id: 'hatch', name: 'Hatch', icon: 'plank', stack: 9, description: 'A roof that opens to let the sun in.', placeable: 'hatch' },

  // the kit: used up when it works
  { id: 'quill_strip', name: 'Quill strip', icon: 'act1-quill-strip', stack: 9, description: 'A beast that lands on it flinches, and its guard drops.' },
  { id: 'lamp_post_kit', name: 'Lamp post', icon: 'act1-lamp-post', stack: 9, description: 'A beast that fears light will not cross its circle.' },
  { id: 'slick_patch', name: 'Slick patch', icon: 'act1-slick-patch', stack: 9, description: 'Whatever crosses it slides straight on.' },
  { id: 'clapper_kit', name: 'Clapper', icon: 'act1-clapper', stack: 9, description: 'A beast bolts in a straight line away from it.' },
  { id: 'pusher_plate', name: 'Pusher plate', icon: 'act1-pusher-plate', stack: 9, description: 'Shoves whatever steps on it, once.' },
  { id: 'salve', name: 'Salve', icon: 'act1-salve', stack: 9, description: 'Gets your companion back on their feet, once.' },

  // the settlement's buildings: each is set down where it stands
  ...HOME_ITEMS,
];
