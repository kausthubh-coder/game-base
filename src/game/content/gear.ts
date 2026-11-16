// The gear record: what the hero carries into a fight. The bench writes it, the fights read it, and the opening
// sets its weapon on grant day (the choice `choice.weapon`). From handbook chapter 30 and `playthrough/farms.js`
// (`gear` and `kit`). The fight lab owns the numbers each step and fitting changes; this file only names them.

import type { WeaponKind } from './fight.ts';
import type { ItemId, KitId } from './ids.ts';

export type { WeaponKind };

/** The four steps of the bench: 1 guild issue, 2 copper-bound, 3 brass-fitted, 4 tusk and root. */
export type GearTier = 1 | 2 | 3 | 4;

/** Two fittings at each step from 2, each made with another farm's good. */
export type FittingId = 'quill_edge' | 'padded_grip' | 'spring_hilt' | 'glow_cap' | 'slick_sheath' | 'honey_binding';

/** The kit has three slots. An empty one is null. */
export type KitSlots = [KitId | null, KitId | null, KitId | null];

export interface Gear {
  /** The weapon in hand: the one picked on grant day, or another made at the bench from step 2. */
  weapon: WeaponKind;
  /** The bench step the weapon is at. */
  tier: GearTier;
  /** The fitting picked at that step, or null at step 1, which has none. */
  fitting: FittingId | null;
  /** The bench step the armour is at: canvas, padded, quill coat, root-weave. Armour adds health. */
  armor: GearTier;
  kit: KitSlots;
}

/** What a new game carries: the guild's sword, canvas, an empty kit. Grant day's choice changes the weapon. */
export const STARTING_GEAR: Readonly<Gear> = { weapon: 'sword', tier: 1, fitting: null, armor: 1, kit: [null, null, null] };

export interface GearStep {
  tier: GearTier;
  name: string;
  /** The quest this step is made in, by chapter 27. */
  quest: 'grantday' | 'copper' | 'seeds' | 'keystones';
  weapons: Record<WeaponKind, string>;
  armor: string;
  /** The farm good the step takes, and the thing found out in the world. Empty at step 1, a guild loan. */
  takes: readonly ItemId[];
  found: readonly ItemId[];
  fittings: readonly FittingId[];
}

export const GEAR_STEPS: readonly GearStep[] = [
  {
    tier: 1, name: 'Guild issue', quest: 'grantday',
    weapons: { sword: 'Guild sword', bow: 'Guild bow', staff: 'Guild staff' }, armor: 'Canvas jacket',
    takes: [], found: [], fittings: [],
  },
  {
    tier: 2, name: 'Copper-bound', quest: 'copper',
    weapons: { sword: 'Copper-edged sword', bow: 'Copper-tipped arrows', staff: 'Copper-shod staff' }, armor: 'Padded jacket',
    takes: ['copper'], found: ['shed_pelt'], fittings: ['quill_edge', 'padded_grip'],
  },
  {
    tier: 3, name: 'Brass-fitted', quest: 'seeds',
    weapons: { sword: 'Spring-hilted sword', bow: 'Spring bow', staff: 'Brass-capped staff' }, armor: 'Quill coat',
    takes: ['gear_spring'], found: ['old_brass'], fittings: ['spring_hilt', 'glow_cap'],
  },
  {
    tier: 4, name: 'Tusk and root', quest: 'keystones',
    weapons: { sword: 'Tusk blade', bow: 'Tusk bow', staff: 'Rootwood staff' }, armor: 'Root-weave',
    takes: ['tusk_tip', 'vine_rope'], found: ['heartwood'], fittings: ['slick_sheath', 'honey_binding'],
  },
];

/**
 * What each step takes beyond the guild's loan, for a weapon and for armour: the farm good and the found thing, in
 * the amounts the bench asks. A fitting adds its own good on top (`FITTING_COST`). The design names the goods;
 * the counts are a first proposal, like every number in chapter 30.
 */
export const STEP_COST: Readonly<Record<Exclude<GearTier, 1>, { weapon: readonly { id: ItemId; count: number }[]; armor: readonly { id: ItemId; count: number }[] }>> = {
  2: { weapon: [{ id: 'copper', count: 4 }, { id: 'shed_pelt', count: 1 }], armor: [{ id: 'shed_pelt', count: 2 }, { id: 'moss_fiber', count: 4 }] },
  3: { weapon: [{ id: 'gear_spring', count: 4 }, { id: 'old_brass', count: 2 }], armor: [{ id: 'quill', count: 6 }, { id: 'gear_spring', count: 2 }] },
  4: { weapon: [{ id: 'tusk_tip', count: 2 }, { id: 'vine_rope', count: 3 }, { id: 'heartwood', count: 1 }], armor: [{ id: 'vine_rope', count: 4 }, { id: 'heartwood', count: 1 }] },
};

export const FITTING_COST: Readonly<Record<FittingId, readonly { id: ItemId; count: number }[]>> = {
  quill_edge: [{ id: 'quill', count: 3 }],
  padded_grip: [{ id: 'moss_fiber', count: 3 }],
  spring_hilt: [{ id: 'gear_spring', count: 3 }],
  glow_cap: [{ id: 'glow_dust', count: 2 }],
  slick_sheath: [{ id: 'frog_slick', count: 2 }],
  honey_binding: [{ id: 'wax', count: 1 }, { id: 'honey', count: 1 }],
};

/** The icon of a weapon at each step, from the act1-weapons sheet, and of each armour step and fitting. */
export const GEAR_ICONS: Readonly<Record<WeaponKind | 'armor', readonly [string, string, string, string]>> = {
  sword: ['act1-sword', 'act1-sword-copper', 'act1-sword-brass', 'act1-sword-tusk'],
  bow: ['act1-bow', 'act1-bow-copper', 'act1-bow-spring', 'act1-bow-tusk'],
  staff: ['act1-staff', 'act1-staff-copper', 'act1-staff-brass', 'act1-staff-rootwood'],
  armor: ['act1-canvas-jacket', 'act1-padded-jacket', 'act1-quill-coat', 'act1-root-weave'],
};
export const FITTING_ICONS: Readonly<Record<FittingId, string>> = {
  quill_edge: 'act1-quill-edge', padded_grip: 'act1-padded-grip', spring_hilt: 'act1-spring-hilt',
  glow_cap: 'act1-glow-cap', slick_sheath: 'act1-slick-sheath', honey_binding: 'act1-honey-binding',
};

export const FITTINGS: Readonly<Record<FittingId, { name: string; needs: readonly ItemId[]; does: string }>> = {
  quill_edge: { name: 'Quill edge', needs: ['quill'], does: 'Every third hit empties more guard.' },
  padded_grip: { name: 'Padded grip', needs: ['moss_fiber'], does: 'You dodge further.' },
  spring_hilt: { name: 'Spring hilt', needs: ['gear_spring'], does: 'Hold, and let go for one heavy strike.' },
  glow_cap: { name: 'Glow cap', needs: ['glow_dust'], does: 'Your hits mark a beast with light. Your companion hits what is marked harder.' },
  slick_sheath: { name: 'Slick sheath', needs: ['frog_slick'], does: 'A dodge leaves a slick. A beast that crosses it slips, and its guard opens.' },
  honey_binding: { name: 'Honey binding', needs: ['wax', 'honey'], does: 'Your stamina comes back faster.' },
};

/** The kit's six things: what each is made of and what it does in a fight. */
export const KIT: Readonly<Record<KitId, { name: string; needs: readonly ItemId[]; does: string }>> = {
  quill_strip: { name: 'Quill strip', needs: ['quill', 'shed_pelt'], does: 'A beast that lands on it flinches, and its guard drops.' },
  lamp_post_kit: { name: 'Lamp post', needs: ['plank', 'wax'], does: 'A beast that fears light will not cross its circle.' },
  slick_patch: { name: 'Slick patch', needs: ['frog_slick'], does: 'Whatever crosses it slides straight on, into the wall behind.' },
  clapper_kit: { name: 'Clapper', needs: ['plank', 'gear_spring'], does: 'A sudden noise. A beast bolts in a straight line away from it.' },
  pusher_plate: { name: 'Pusher plate', needs: ['copper', 'gear_spring'], does: 'Shoves whatever steps on it, once.' },
  salve: { name: 'Salve', needs: ['frog_slick', 'honey'], does: 'Gets your companion back on their feet, once.' },
};
