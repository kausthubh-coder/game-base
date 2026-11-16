// The rules act 1 added to the lab's fight: the hero's numbers, the gear, a machine's plates, a pack, the Mark's
// reach on a beast that does not fight, the rootsnare's hold, the kit and the four companions' jobs.
import { describe, expect, test } from 'bun:test';
import { FITTING, HERO, HERO_STATS, KIT_FIGHT, PACK_GUARD, ROOTED, SWORD, beastOf, encounterOf, ENCOUNTERS } from '../content/fight.ts';
import { arenaStage } from './arena.sim.ts';
import { createBot, type BotLevel } from './bot.sim.ts';
import { createFight, type Fight, type FightEvent, type FightOptions } from './fight.sim.ts';
import { worldStage } from './world-stage.sim.ts';

const DT = 1 / 60;

function lab(options: FightOptions = {}): { fight: Fight; heard: FightEvent[]; run(s: number, each?: () => void): void; until(done: () => boolean, limit?: number, each?: () => void): boolean } {
  const fight = createFight(arenaStage(0, 0), { way: 'hero', ...options });
  const heard: FightEvent[] = [];
  const step = (each?: () => void): void => { each?.(); fight.step(DT); heard.push(...fight.events); fight.events.length = 0; };
  return {
    fight, heard,
    run(s, each) { for (let t = 0; t < s - 1e-9; t += DT) step(each); },
    until(done, limit = 30, each) { for (let t = 0; t < limit; t += DT) { if (done()) return true; step(each); } return done(); },
  };
}

/** One cut at the first beast from a point, aimed at it. */
function cutFrom(l: ReturnType<typeof lab>, x: number, z: number): void {
  const b = l.fight.beasts[0]!;
  l.fight.placeHero(x, z);
  l.fight.input.aimX = b.x;
  l.fight.input.aimZ = b.z;
  l.fight.press('attack');
  l.run(SWORD.quick.total + 0.05);
}

const guardTaken = (l: ReturnType<typeof lab>): number => l.heard.filter((e) => e.type === 'guard' && e.text === 'hero').reduce((sum, e) => sum + e.n, 0);

describe("the hero's numbers", () => {
  test('a fight starts the hero at the health and stamina it is given, and a faint wakes them there', () => {
    const l = lab({ stats: { maxHealth: 160, maxStamina: 120 } });
    expect(l.fight.hero.health).toBe(160);
    expect(l.fight.hero.stamina).toBe(120);
    expect(l.fight.maxHealth).toBe(160);
    l.fight.bring('boar');
    const b = l.fight.beasts[0]!;
    l.until(() => l.fight.hero.act === 'faint', 120, () => { l.fight.placeHero(b.x, b.z + b.def.radius + 1); });
    l.until(() => l.fight.hero.act !== 'faint', 5);
    expect(l.fight.hero.health).toBe(160);
  });

  test('each step of the weapon breaks more guard', () => {
    const one = lab(), three = lab({ gear: { tier: 3, fitting: null } });
    for (const l of [one, three]) { const b = l.fight.bring('thistlehog'); cutFrom(l, b.x, b.z + 1.4); }
    expect(guardTaken(one)).toBeCloseTo(SWORD.quick.guard);
    expect(guardTaken(three)).toBeCloseTo(SWORD.quick.guard * (HERO_STATS.tier[2] as number));
  });

  test('the quill edge makes every third hit break more', () => {
    const l = lab({ gear: { tier: 1, fitting: 'quill_edge' } });
    const b = l.fight.bring('boar');
    for (let i = 0; i < 3; i++) cutFrom(l, b.x, b.z + b.def.radius + 1);
    const hits = l.heard.filter((e) => e.type === 'guard' && e.text === 'hero').map((e) => e.n);
    expect(hits).toEqual([SWORD.quick.guard, SWORD.quick.guard, SWORD.quick.guard * FITTING.quillGuard]);
  });
});

describe("a machine's plates", () => {
  test('a cut on its front glances off; one on its back gets through', () => {
    const l = lab({ plates: true });
    const g = l.fight.bring('gearling');
    // It faces south at first (facing pi), toward the hero's start.
    g.facing = Math.PI;
    cutFrom(l, g.x, g.z + 1.4);
    const front = guardTaken(l);
    expect(front).toBeCloseTo(SWORD.quick.guard * beastOf('gearling').plates!);
    expect(l.heard.some((e) => e.type === 'plated')).toBe(true);
    g.facing = Math.PI;
    (g as { doing: string }).doing = 'stun';
    g.until = 9;
    cutFrom(l, g.x, g.z - 1.4);
    expect(guardTaken(l) - front).toBeCloseTo(SWORD.quick.guard);
  });

  test('the lab is fought without them', () => {
    const l = lab();
    const g = l.fight.bring('gearling');
    cutFrom(l, g.x, g.z + 1.4);
    expect(guardTaken(l)).toBeCloseTo(SWORD.quick.guard);
  });
});

describe('a pack', () => {
  test('three foxes come in a row, each with a share of its guard and the depth the encounter gives', () => {
    const l = lab();
    const foxes = l.fight.bringAll([{ kind: 'fox', depth: 2 }, { kind: 'fox', depth: 2 }, { kind: 'fox', depth: 2 }]);
    expect(foxes).toHaveLength(3);
    for (const f of foxes) { expect(f.depth).toBe(2); expect(f.full).toBeCloseTo(beastOf('fox').guard * PACK_GUARD); }
    expect(l.fight.record.enemy).toBe('fox+fox+fox');
  });

  test('they take turns: no two wind up at once', () => {
    const l = lab();
    l.fight.bringAll([{ kind: 'fox' }, { kind: 'fox' }, { kind: 'fox' }]);
    l.fight.wake();
    let most = 0;
    l.run(20, () => {
      l.fight.hero.health = HERO.health;
      most = Math.max(most, l.fight.beasts.filter((b) => b.doing === 'windup').length);
    });
    expect(most).toBe(1);
  });
});

describe("the Mark's reach", () => {
  test('a passive boar waits; the hand held out to it says it is out of reach, and nothing else happens', () => {
    const l = lab({ reach: 2 });
    const [boar] = l.fight.bringAll([{ kind: 'boar', passive: true }]);
    l.fight.placeHero(boar!.x, boar!.z + boar!.def.radius + 1.5);
    l.run(3);
    expect(boar!.doing).toBe('asleep');
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold + 0.1);
    const beyond = l.heard.find((e) => e.type === 'beyond');
    expect(beyond?.n).toBe(5);
    expect(boar!.doing).toBe('asleep');
    expect(l.fight.phase).not.toBe('won');
  });

  test('a machine is shut down whatever the Heartstone holds', () => {
    const l = lab({ reach: 0 });
    const g = l.fight.bring('gearling');
    l.until(() => g.doing === 'dizzy', 120, () => { l.fight.hero.health = HERO.health; l.fight.placeHero(g.x, g.z + 1.4); l.fight.input.aimX = g.x; l.fight.input.aimZ = g.z; l.fight.press('attack'); });
    l.run(0.5);
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold + 0.2, () => l.fight.placeHero(g.x, g.z + 1.4));
    expect(g.doing).toBe('calmed');
  });
});

describe("the rootsnare's hold", () => {
  test('it takes the companion, its heart is shut while it holds them, and cutting the vines frees them', () => {
    const l = lab({ companion: 'fox' });
    const r = l.fight.bring('rootsnare');
    l.fight.wake();
    const held = l.until(() => l.fight.companion.mode === 'held', 20, () => { l.fight.hero.health = HERO.health; l.fight.placeHero(r.x + 4, r.z + 7); });
    expect(held).toBe(true);
    const vines = l.fight.targets.find((t) => t.name === 'vines')!;
    expect(vines.guard).toBe(ROOTED.vines);
    // A cut on its heart now does a little.
    const before = guardTaken(l);
    l.fight.placeHero(r.x, r.z + r.def.radius + 1.2);
    l.fight.input.aimX = r.x;
    l.fight.input.aimZ = r.z;
    l.fight.press('attack');
    l.run(SWORD.quick.total + 0.05);
    expect(guardTaken(l) - before).toBeCloseTo(SWORD.quick.guard * ROOTED.shut);
    // Cut the vines.
    l.until(() => l.fight.companion.mode !== 'held', 10, () => {
      l.fight.hero.health = HERO.health;
      l.fight.placeHero(vines.x, vines.z + 1.2);
      l.fight.input.aimX = vines.x;
      l.fight.input.aimZ = vines.z;
      l.fight.press('attack');
    });
    expect(l.fight.companion.mode).not.toBe('held');
    expect(l.heard.some((e) => e.type === 'freed')).toBe(true);
  });

  test('a salve from the kit frees the companion too, once', () => {
    const l = lab({ companion: 'dax', kit: ['salve', null, null] });
    const r = l.fight.bring('rootsnare');
    l.fight.wake();
    expect(l.fight.useKit(0)).toBe('Your companion is on their feet.');
    l.until(() => l.fight.companion.mode === 'held', 20, () => { l.fight.hero.health = HERO.health; l.fight.placeHero(r.x + 4, r.z + 7); });
    expect(l.fight.useKit(0)).toBeNull();
    expect(l.fight.companion.mode).toBe('heel');
    expect(l.fight.kitSlots()).toEqual([null, null, null]);
  });
});

describe('the kit in a fight', () => {
  test('a quill strip is set down from its slot, once, and a beast that lands on it flinches and loses guard', () => {
    const l = lab({ kit: ['quill_strip', null, null] });
    const lynx = l.fight.bring('lynx');
    const hx = lynx.x, hz = lynx.z + 7;
    l.fight.placeHero(hx, hz);
    expect(l.fight.placeRig('quill_strip', hx, hz - 3.5)).toBeNull();
    expect(l.fight.kitSlots()[0]).toBeNull();
    expect(l.fight.placeRig('quill_strip', hx + 2, hz - 3.5)).toBe('Your kit has none left.');
    // It comes for the hero down the line, over the strip.
    l.fight.wake();
    const stepped = l.until(() => l.heard.some((e) => e.type === 'rig'), 10, () => { l.fight.hero.health = HERO.health; l.fight.placeHero(hx, hz); });
    expect(stepped).toBe(true);
    expect(lynx.doing).toBe('stun');
    expect(lynx.guard).toBeLessThan(lynx.full * (1 - KIT_FIGHT.quillShare) + 0.01);
  });

  test("the traps' rigs are not the kit", () => {
    const l = lab({ kit: ['quill_strip', null, null] });
    l.fight.bring('lynx');
    expect(l.fight.placeRig('lamp', 2, 8)).toBe('Rigs belong to the traps.');
  });

  test('a lamp post keeps a beast that fears light out of its circle', () => {
    const l = lab({ kit: ['lamp_post_kit', null, null] });
    const fox = l.fight.bring('fox');
    const at = { x: l.fight.hero.x, z: l.fight.hero.z - 1 };
    expect(l.fight.placeRig('lamp_post_kit', at.x, at.z)).toBeNull();
    l.fight.wake();
    let closest = Infinity;
    l.run(12, () => { l.fight.hero.health = HERO.health; closest = Math.min(closest, Math.hypot(fox.x - (Math.floor(at.x) + 0.5), fox.z - (Math.floor(at.z) + 0.5))); });
    expect(closest).toBeGreaterThan(KIT_FIGHT.lampRadius - 0.5);
  });

  test('a clapper sends every beast near bolting away', () => {
    const l = lab({ kit: ['clapper_kit', null, null] });
    const fox = l.fight.bring('fox');
    l.fight.wake();
    l.until(() => Math.hypot(fox.x - l.fight.hero.x, fox.z - l.fight.hero.z) < 4 && fox.doing === 'stalk', 20, () => { l.fight.hero.health = HERO.health; });
    const h = l.fight.hero, d0 = Math.hypot(fox.x - h.x, fox.z - h.z), k = 1.5 / d0;
    expect(d0).toBeLessThan(KIT_FIGHT.clapReach);
    expect(l.fight.placeRig('clapper_kit', h.x + (fox.x - h.x) * k, h.z + (fox.z - h.z) * k)).toBeNull();
    expect(fox.doing).toBe('flung');
    l.run(0.5);
    expect(Math.hypot(fox.x - l.fight.hero.x, fox.z - l.fight.hero.z)).toBeGreaterThan(d0);
  });
});

describe("act 1's companions", () => {
  test('the fox gets a fainted hero up once a fight', () => {
    const l = lab({ companion: 'fox' });
    const boar = l.fight.bring('boar');
    l.until(() => l.heard.some((e) => e.type === 'faint' || e.type === 'revived'), 120, () => l.fight.placeHero(boar.x, boar.z + boar.def.radius + 1));
    expect(l.heard.find((e) => e.type === 'faint' || e.type === 'revived')?.type).toBe('revived');
    l.until(() => l.heard.some((e) => e.type === 'faint'), 120, () => l.fight.placeHero(boar.x, boar.z + boar.def.radius + 1));
    expect(l.heard.filter((e) => e.type === 'revived')).toHaveLength(1);
  });

  test('Wren goes for a beast the hero is not fighting, and pins it', () => {
    const l = lab({ companion: 'wren' });
    const [a, b] = l.fight.bringAll([{ kind: 'fox' }, { kind: 'fox' }]);
    l.fight.wake();
    // The hero cuts the first: it becomes the focus.
    l.run(0.9);
    cutFrom(l, a!.x, a!.z + 1.2);
    let pinned = false;
    l.run(6, () => { l.fight.hero.health = HERO.health; if (b!.doing === 'held') pinned = true; });
    expect(pinned).toBe(true);
  });
});

/** Fights an encounter's foes with the middle player and act 1's numbers, as the world does. */
function encounter(n: number, companion: string, level: BotLevel = 'middle', seed = 3, reach = 6): { won: boolean; faints: number; length: number } {
  const def = encounterOf(n);
  const stage = arenaStage(0, 0);
  const seeded = (k: number) => { let s = k >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const fight = createFight(stage, { way: 'hero', companion, reach, plates: true, random: seeded(seed * 31) });
  const bot = createBot(fight, stage, { level, random: seeded(seed) });
  fight.bringAll(def.foes);
  for (let t = 0; t < 300 && fight.phase !== 'won'; t += DT) { bot.step(DT); fight.step(DT); fight.events.length = 0; }
  return { won: fight.phase === 'won', faints: fight.record.faints, length: fight.record.length };
}

describe("act 1's beast fights can be won by the middle player", () => {
  for (const def of ENCOUNTERS.filter((e) => e.kind === 'beasts')) {
    const companion = def.companion ?? 'fox';
    test(`fight ${def.n}: ${def.foes.map((f) => f.kind).join(' and ')} with ${companion}`, () => {
      const r = encounter(def.n, companion);
      expect(r.won).toBe(true);
    }, 30_000);
  }
});

describe('a stage made from the world', () => {
  const ground = {
    height: (x: number) => (x > 6 ? 14 : 10),
    water: (x: number, z: number) => z > 8 && x < -4,
    blocked: (x: number, z: number) => x === -3 && z === -3,
  };
  const stage = worldStage(ground, { x: 0.5, z: 0.5, radius: 10, from: { x: 0.5, z: 20 } });

  test('a rise is a wall, water is water, a tree is solid, and the circle is its edge', () => {
    expect(stage.solid(7.5, 0.5)).toBe(true);
    expect(stage.solid(8.5, 0.5)).toBe(false);
    expect(stage.solid(0.5, 0.5)).toBe(false);
    expect(stage.water(-6.5, 9.2)).toBe(true);
    expect(stage.solid(-2.5, -2.5)).toBe(true);
    expect(stage.inside(0.5, 10.4)).toBe(true);
    expect(stage.inside(0.5, 11)).toBe(false);
    expect(stage.radius).toBe(10);
  });

  test('a hero who comes from outside starts and wakes at the edge on their side', () => {
    expect(stage.start.z).toBeGreaterThan(7);
    expect(stage.wake.z).toBeGreaterThan(7);
    expect(stage.inside(stage.start.x, stage.start.z)).toBe(true);
  });
});
