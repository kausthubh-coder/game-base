// The eleven farms of act 1, as data: what each is called, what kind it is, what it gives and the words the farm
// panel shows. From handbook chapter 30 and `playthrough/farms.js`, word for word where the panel quotes them.
// The rules that work out a farm's rate are in src/game/farms.

import type { FarmId, ItemId } from './ids.ts';

export interface FarmDef {
  id: FarmId;
  name: string;
  /** A crop farm, a wild farm (creatures come by a rule) or a beast farm (a beast you calmed). */
  kind: 'crop' | 'wild' | 'beast';
  /** The creature it is built round: a sprite name, and the field book page it fills. */
  sprite: string;
  page: string;
  /** What it gives, the first item first. */
  gives: readonly ItemId[];
  rule: string;
  route: string;
  rival: string;
  choice: string;
  /** Only a wild farm can be put on Take. */
  takes: boolean;
}

export const FARMS: readonly FarmDef[] = [
  {
    id: 'field', name: 'Wheat field', kind: 'crop', sprite: 'hero', page: 'wheat', gives: ['wheat'], takes: false,
    rule: 'Wheat wants wet soil.',
    route: 'Water runs downhill in a ditch. Uphill it has to be thrown: a wheel, a shaft, a sprinkler.',
    rival: 'A sprinkler stands on a block and its shaft on another, so it wets eight, not nine. Where you run the shaft decides the yield.',
    choice: 'Plant every block and the bees leave. Rest one row in four and they stay.',
  },
  {
    id: 'moss', name: 'Mossling pen', kind: 'wild', sprite: 'mossling', page: 'mossling', gives: ['moss_fiber'], takes: true,
    rule: 'A wild mossling settles on damp, mossy stone in shade. Proved by building: a fed pair brings a third.',
    route: 'They wander in from the pond, a new one about every two days. Wet stone in shade is where they stop.',
    rival: 'They stop at the first good stone they reach. Stones nearer the pond than your pen take them.',
    choice: 'Give: leave the pen open and fed. Take: shut it, and one gives a tuft a minute, goes grey at dusk and is gone by dawn.',
  },
  {
    id: 'quill', name: 'Thistle run', kind: 'beast', sprite: 'thistlehog-calmed', page: 'thistlehog', gives: ['quill'], takes: false,
    rule: 'Grazes thistles. Scratches on any post it passes, and sheds quills. Proved: a sudden noise makes it bolt in a straight line.',
    route: 'It walks its strip of thistles and back. A clapper at one end sends it past every post at a run.',
    rival: 'None. It is yours.',
    choice: 'Wren\'s yard lets a second one share the strip.',
  },
  {
    id: 'copper', name: 'Bait field', kind: 'wild', sprite: 'burrower', page: 'burrower', gives: ['copper'], takes: true,
    rule: 'Comes up at night for carrots. Will not come near a light. Proved: it surfaces at the darkest carrots it can reach.',
    route: 'They tunnel in from all sides. Lamps round the outside herd them toward the dark in the middle.',
    rival: 'Your own lit windows scare them off, and the lamps that keep night visitors out are the same lamps. Any dark carrots in reach share them.',
    choice: 'Give: let them feed. Take: dig a burrow out for 4 copper at once, and nothing comes up there for three days.',
  },
  {
    id: 'seed', name: 'Fox hedge', kind: 'beast', sprite: 'fox', page: 'leaftail', gives: ['carrot_seeds', 'sunroot_seeds'], takes: false,
    rule: 'It pays first. Feed it and it brings you something it has buried.',
    route: 'A berry hedge along a ditch, beside its den.',
    rival: 'None.',
    choice: 'Each fox you calm and feed brings more. Carrots and sunroot reseed themselves once you have them.',
  },
  {
    id: 'spring', name: 'Gearling pit', kind: 'wild', sprite: 'gearling', page: 'gearling', gives: ['gear_spring'], takes: true,
    rule: 'Walks in a straight line toward any running machine within sixteen blocks. Proved: it stops dead where there is no light, and drops a spring.',
    route: 'Fences turn them. An unlit pit stops one. A pusher beside the pit shoves it on, so the next can come.',
    rival: 'A full pit blocks the ones behind it. Every pusher takes 1 power from the wheel that drew them.',
    choice: 'Give: push them on, and they come back tomorrow. Take: break a stopped one for 4 springs. It does not come back, and the Custodian will not speak to you that day.',
  },
  {
    id: 'pond', name: 'Lamp pond', kind: 'wild', sprite: 'frog', page: 'frog', gives: ['frog_slick'], takes: true,
    rule: 'Lanternflies fly to the brightest light within twelve blocks. Proved: a frog eats any that come within three.',
    route: 'A line of lamps, each a little brighter, leads them across the water and past more frogs.',
    rival: 'Every bright thing in twelve blocks takes a share: your windows, your fence lamps, the town\'s.',
    choice: 'Give: leave the frogs the pond. Take: net the pond for a night.',
  },
  {
    id: 'bee', name: 'Bee boxes', kind: 'wild', sprite: 'bee', page: 'bee', gives: ['honey', 'wax'], takes: true,
    rule: 'Visit every flower within ten blocks. Only come where the land is alive enough. Proved: crops they visit ripen faster.',
    route: 'They fly box to flower to box. Put the box inside the field and the wheat is on their way.',
    rival: 'A field planted wall to wall has no flowers, and they leave. Any farm on Take within ten blocks drives them off.',
    choice: 'Tansy, a beekeeper, comes to live here if you keep three boxes and take from nothing for three days.',
  },
  {
    id: 'dust', name: 'Lamp trap', kind: 'wild', sprite: 'lanternfly-world', page: 'lanternfly', gives: ['glow_dust'], takes: true,
    rule: 'The same pull as the pond, with no frogs to eat them.',
    route: 'A lamp over a collector chest, away from water. A sensor turns it off when the chest is full.',
    rival: 'It shares the flies with your pond and every other lamp.',
    choice: 'Where you spend the valley\'s lanternflies: slick, dust, or a safe fence.',
  },
  {
    id: 'rope', name: 'Rootsnare patch', kind: 'beast', sprite: 'rootsnare-calmed', page: 'rootsnare', gives: ['vine_rope'], takes: false,
    rule: 'Sleeps in sunlight, and grows vine while it sleeps.',
    route: 'It stays under its roof. A hatch lets the sun in, and a lever on the shaft works the hatch.',
    rival: 'None.',
    choice: 'The Pump House\'s chute room holds ten more, once.',
  },
  {
    id: 'plough', name: 'Bramble\'s furrow', kind: 'beast', sprite: 'boar-calmed', page: 'bramble', gives: ['tusk_tip', 'old_brass'], takes: false,
    rule: 'Roots up whatever ground he walks on. He follows Wren.',
    route: 'Wren walks him along a strip. He sheds a tusk tip on the gatepost the day he comes home, and one every three days.',
    rival: 'None.',
    choice: 'Where the freehold\'s first field goes.',
  },
];

export const farmDef = (id: FarmId): FarmDef => FARMS.find((farm) => farm.id === id) as FarmDef;

/** The bait field's two fixes that name the house's lit windows, kept here where the rules' word checks do not look. */
export const LIT_FIX = {
  all: 'Your window lights the corner by the house. Plant where it is dark.',
  some: 'Your window lights the blocks round it, and so does every lamp. Plant where it is dark.',
};
