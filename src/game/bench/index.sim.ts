// The bench: its four steps, the two fittings at each, the weapons you did not pick, armour, and the kit. It writes
// the gear record (src/game/content/gear.ts) that the fights read. Handbook chapter 30, "The bench" and "The kit".
//
// - Every step takes one good from a farm and one thing found in the world, and at each step from 2 you choose one
//   of two fittings, each another farm's good. A weapon goes up one step at a time; a step opens with its quest.
// - From step 2 the bench also makes the two weapons you did not take on grant day. Each weapon keeps its own step
//   and fitting, and the one in hand is the gear record's.
// - Armour climbs the same four steps with no fitting: canvas, padded, quill coat, root-weave.
// - The kit has three slots. A slot holds a kind of kit thing from the bag; a fight uses one up when it works.
//
// It finishes the quest steps the bench finishes by setting their `step.<quest>.<step>` flags while they are open.

import type { BenchApi, BenchMake, Game, SimSystem, Stack } from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import {
  FITTING_COST, GEAR_STEPS, STARTING_GEAR, STEP_COST, type FittingId, type Gear, type GearTier, type WeaponKind,
} from '../content/gear.ts';
import { CHOICES, KIT_IDS, type KitId, type QuestId } from '../content/ids.ts';
import type { Kernel } from '../kernel.sim.ts';

/** How far from a workbench the hero may stand to use it, as for any recipe. */
const BENCH_REACH = 5;

export interface BenchSave {
  version: 1;
  weapons: { weapon: WeaponKind; tier: GearTier; fitting: FittingId | null }[];
  wielding: WeaponKind | null;
  armor: GearTier;
  kit: (KitId | null)[];
  made: string[];
}

const isWeapon = (value: unknown): value is WeaponKind => (CHOICES.weapon as readonly unknown[]).includes(value);
const isKit = (value: unknown): value is KitId => (KIT_IDS as readonly unknown[]).includes(value);

export function createBench(game: Game): { api: BenchApi; system: SimSystem } {
  const { flags, events } = game;
  const sys = game.systems;
  const gear: Gear = { ...STARTING_GEAR, kit: [...STARTING_GEAR.kit] };
  /** The weapons made at the bench, beside the one picked on grant day. */
  const owned: { weapon: WeaponKind; tier: GearTier; fitting: FittingId | null }[] = [];
  let wielding: WeaponKind | null = null;
  const made = new Set<string>();
  let check = 0;

  /** The weapon picked on grant day, at its step: the guild's loan until the bench makes it better. */
  function weapons(): { weapon: WeaponKind; tier: GearTier; fitting: FittingId | null }[] {
    const picked = flags.get(FLAG.choice('weapon'));
    const first = isWeapon(picked) ? picked : STARTING_GEAR.weapon;
    if (!owned.some((w) => w.weapon === first)) owned.unshift({ weapon: first, tier: 1, fitting: null });
    return owned;
  }

  function cost(make: BenchMake): Stack[] {
    if (make.tier === 1) return [];
    const step = STEP_COST[make.tier];
    const out: Stack[] = (make.what === 'armor' ? step.armor : step.weapon).map((s) => ({ id: s.id, count: s.count }));
    if (make.what !== 'armor') {
      for (const s of FITTING_COST[make.fitting]) {
        const same = out.find((o) => o.id === s.id);
        if (same) same.count += s.count;
        else out.push({ id: s.id, count: s.count });
      }
    }
    return out;
  }

  /** A step opens with the quest it is made in: copper-bound in the quest of copper, and so on. */
  const opened = (tier: GearTier): boolean => {
    const quest = GEAR_STEPS[tier - 1].quest;
    return tier === 1 || flags.is(FLAG.questStarted(quest)) || flags.is(FLAG.questDone(quest));
  };

  function why(make: BenchMake): string | null {
    if (make.tier === 1) return 'The guild issue is a loan, not made.';
    // Padding is earned in the bench quest, before copper weapons open.
    const padding = make.what === 'armor' && make.tier === 2 && (flags.is(FLAG.questStarted('bench')) || flags.is(FLAG.questDone('bench')));
    if (!padding && !opened(make.tier)) return `The ${GEAR_STEPS[make.tier - 1].name.toLowerCase()} step is not open yet.`;
    if (make.what === 'armor') {
      if (gear.armor >= make.tier) return 'Your armour is already this good.';
      if (gear.armor !== make.tier - 1) return 'Armour goes up one step at a time.';
    } else {
      if (!GEAR_STEPS[make.tier - 1].fittings.includes(make.fitting)) return 'That fitting is not one of this step\'s two.';
      const have = weapons().find((w) => w.weapon === make.what);
      if (have && have.tier >= make.tier) return `Your ${make.what} is already this good.`;
      if (have && have.tier !== make.tier - 1) return 'A weapon goes up one step at a time.';
      // A weapon you did not pick is made new from step 2, at the step 2 makes.
      if (!have && make.tier !== 2) return `Make a ${make.what} at the copper-bound step first.`;
    }
    if (!sys.placeables?.near('workbench', game.player.pos, BENCH_REACH)) return 'Stand at a workbench.';
    const bag = sys.inventory;
    for (const need of cost(make)) if ((bag?.count(need.id) ?? 0) < need.count) return `It needs ${need.count} ${sys.items?.get(need.id).name.toLowerCase() ?? need.id}.`;
    return null;
  }

  function make(what: BenchMake): boolean {
    if (why(what) !== null) return false;
    const bag = sys.inventory;
    for (const need of cost(what)) bag.remove(need.id, need.count);
    if (what.what === 'armor') {
      gear.armor = what.tier;
      events.emit('gear.made', { what: 'armor', tier: what.tier, fitting: null });
    } else {
      const have = weapons().find((w) => w.weapon === what.what);
      if (have) { have.tier = what.tier; have.fitting = what.fitting; }
      else owned.push({ weapon: what.what, tier: what.tier, fitting: what.fitting });
      // The weapon just made is the one taken up.
      wielding = what.what;
      events.emit('gear.made', { what: what.what, tier: what.tier, fitting: what.fitting });
    }
    events.emit('ui.sound', { sound: 'click' });
    sync();
    quests();
    return true;
  }

  function sync(): void {
    const list = weapons();
    const hand = list.find((w) => w.weapon === wielding) ?? list[0];
    gear.weapon = hand.weapon;
    gear.tier = hand.tier;
    gear.fitting = hand.fitting;
  }

  const step = (quest: QuestId, id: string): void => {
    if (flags.get(FLAG.questStep(quest)) === id) flags.set(FLAG.step(quest, id), true);
  };

  function quests(): void {
    const best = Math.max(...weapons().map((w) => w.tier));
    const bag = sys.inventory;
    if (gear.armor >= 2) step('bench', 'jacket');
    if (made.has('quill_strip') || (bag?.count('quill_strip') ?? 0) > 0 || gear.kit.includes('quill_strip')) step('bench', 'kit');
    if (best >= 2) step('copper', 'bind');
    if (best >= 3) step('seeds', 'brass');
    if (best >= 4 && (made.has('rope_ladder') || (bag?.count('rope_ladder') ?? 0) > 0)) step('keystones', 'tusk');
    if (gear.kit.every((slot) => slot !== null) && (bag?.count('travel_meal') ?? 0) > 0 && (bag?.count('vine_rope') ?? 0) > 0) step('pilgrimage', 'pack');
  }

  events.on('item.crafted', ({ id }) => {
    made.add(id);
    quests();
  });
  // A kit thing used up in a fight leaves its slot when the last of its kind is gone.
  events.on('item.lost', ({ id }) => {
    if (!isKit(id) || (sys.inventory?.count(id) ?? 0) > 0) return;
    for (let i = 0; i < gear.kit.length; i++) if (gear.kit[i] === id) gear.kit[i] = null;
  });

  const api: BenchApi = {
    gear() {
      sync();
      return gear;
    },
    weapons,
    cost,
    why,
    make,
    wield(weapon) {
      if (!weapons().some((w) => w.weapon === weapon)) return false;
      wielding = weapon;
      sync();
      return true;
    },
    equip(slot, kit) {
      if (slot < 0 || slot > 2) return false;
      if (kit !== null && (sys.inventory?.count(kit) ?? 0) <= 0) return false;
      // One of each kind: putting a thing in a slot takes it out of any other.
      for (let i = 0; i < gear.kit.length; i++) if (kit !== null && gear.kit[i] === kit) gear.kit[i] = null;
      gear.kit[slot] = kit;
      quests();
      return true;
    },
  };

  const system: SimSystem = {
    step(dt) {
      check -= dt;
      if (check > 0) return;
      check = 1;
      quests();
    },
    save(): BenchSave {
      return { version: 1, weapons: owned.map((w) => ({ ...w })), wielding, armor: gear.armor, kit: [...gear.kit], made: [...made] };
    },
    load(data) {
      const save = data as Partial<BenchSave> | null;
      owned.length = 0;
      for (const w of save?.weapons ?? []) if (isWeapon(w.weapon)) owned.push({ weapon: w.weapon, tier: w.tier, fitting: w.fitting });
      wielding = isWeapon(save?.wielding) ? save.wielding : null;
      gear.armor = save?.armor ?? 1;
      const kit = save?.kit ?? [];
      gear.kit = [isKit(kit[0]) ? kit[0] : null, isKit(kit[1]) ? kit[1] : null, isKit(kit[2]) ? kit[2] : null];
      made.clear();
      for (const id of save?.made ?? []) made.add(id);
      sync();
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createBench(kernel.game);
  kernel.add('bench', api, system);
}
