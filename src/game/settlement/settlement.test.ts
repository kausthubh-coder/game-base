// The settlement: the Heartstone's ladder on its own, then the people, their needs, jobs, wishes, the dinner
// table and the steps, played through the real rules from the quests that bring them.
import { describe, expect, test } from 'bun:test';
import type { Placed } from '../api.sim.ts';
import { HEART_LADDER, HEARTS, LARDER_BRINGS, SETTLER } from '../content/people.ts';
import { loadPlay, newPlay, type Play } from '../play/harness.sim.ts';
import { mossPen } from '../scenarios/settlement-kitchen.sim.ts';
import { NO_FACTS, heartLevel, landLevel, nextStep, type HeartFacts } from './ladder.sim.ts';

describe('the ladder', () => {
  const at = (more: Partial<HeartFacts>): HeartFacts => ({ ...NO_FACTS, seen: true, ...more });
  const one = { water: true, fire: true };
  const two = { ...one, kitchen: true, beds: 3, living: 1 };
  const three = { ...two, living: 3, settlers: 2, met: 2 };
  const four = { ...three, wheel: true, terrace: true };
  const five = { ...four, households: 3, living: 6, moving: true, hearts: 60 };

  test('each step needs what chapter 30 asks, and every step below it', () => {
    expect(landLevel(NO_FACTS)).toBe(0);
    expect(landLevel(at({}))).toBe(0);
    expect(landLevel(at(one))).toBe(1);
    expect(landLevel(at({ ...two, beds: 2 }))).toBe(1);
    expect(landLevel(at(two))).toBe(2);
    // Three living farms, but someone on the land still wants a lamp.
    expect(landLevel(at({ ...three, met: 1 }))).toBe(2);
    expect(landLevel(at(three))).toBe(3);
    expect(landLevel(at(four))).toBe(4);
    expect(landLevel(at({ ...five, hearts: 59 }))).toBe(4);
    expect(landLevel(at(five))).toBe(5);
    // A wheel turning is no use without the kitchen and the beds under it.
    expect(landLevel(at({ ...four, kitchen: false }))).toBe(1);
    expect(landLevel(at({ stag: true }))).toBe(6);
  });

  test('the pump holds the stone a step down, so 5 cannot be reached while it runs', () => {
    expect(heartLevel(at({ ...five, pump: true }))).toBe(4);
    expect(heartLevel(at({ ...one, pump: true }))).toBe(0);
  });

  test('the next step says what it asks for and what it puts in reach', () => {
    const next = nextStep(at({ ...two, living: 2, settlers: 2, met: 2 }))!;
    expect(next.level).toBe(3);
    expect(next.reach).toBe(HEART_LADDER[2].reach);
    expect(next.parts).toEqual([{ label: 'Living farms', have: 2, need: 3 }, { label: 'Everyone\'s needs met', have: 1, need: 1 }]);
    expect(nextStep(at({ stag: true }))).toBeNull();
    expect(nextStep(NO_FACTS)).toBeNull();
  });
});

/** A new game at the start of a quest, with the hero on the plot. */
function at(quest: Parameters<Play['sys']['quests']['skipTo']>[0]): Play {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo(quest);
  p.advance(1.5);
  p.teleport('grant.center');
  p.advance(0.5);
  return p;
}

/** Sets a building down on the plot, `dx` and `dz` blocks from the grant's north-west corner. */
function build(p: Play, kind: string, dx: number, dz: number, turns = 0): Placed {
  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  const placed = p.sys.placeables.place(kind, g.x + dx, y, g.z + dz, turns);
  if (!placed) throw new Error(`could not set down ${kind} at ${dx}, ${dz}`);
  return placed;
}

/** Scene 18, Hobb and Dax at the gate: the story starts it with the hero by the grant stone, and the player talks it through. */
function meetAtGate(p: Play): void {
  expect(p.sys.talk.active).toBe(true);
  expect(p.heard.findLast((e) => e.name === 'talk.started')?.data).toEqual({ npc: '', conversation: 'scene.18' });
  expect(p.talkThrough()).toContain('A miracle, they tell me. Miracles still eat breakfast. Where is your kitchen?');
  expect(p.game.flags.is('scene.18')).toBe(true);
  p.advance(1.5);
}

/** Hobb and Dax at the gate, and the kitchen of the quest: an oven and a table, a cottage, a lamp by it. */
function homestead(p: Play): void {
  if (!p.game.flags.is('scene.18')) meetAtGate(p);
  build(p, 'oven', 10, 3);
  build(p, 'prep_table', 13, 3);
  build(p, 'cottage', 2, 2);
  build(p, 'lantern', 8, 4);
  p.advance(1.5);
}

/** Stands the hero at the oven's front, in reach of its prompt. */
function atOven(p: Play): void {
  const g = p.sys.region.grant();
  // The oven stands at 10 to 12 and 3 to 5 facing north: its door is a block before its north side.
  p.teleport({ x: g.x + 11, z: g.z + 2 });
  p.advance(0.5);
}

/** Gives Hobb and Dax their jobs as a save would hold them, and plays on from the load. */
function withJobs(p: Play): Play {
  const save = p.save();
  const data = save.game.systems.settlement as { settlers: { who: string; job: string | null }[] };
  for (const rec of data.settlers) rec.job = rec.who === 'hobb' ? 'kitchen' : 'watch';
  const q = loadPlay(save);
  q.advance(1.5);
  return q;
}

describe('the people on your land', () => {
  test('Hobb and Dax come after scene 18 and walk in; Hobb brings a larder', () => {
    const p = at('kitchen');
    expect(p.sys.settlement.settlers()).toEqual([]);
    expect(p.sys.people.get('hobb')).toBeUndefined();
    meetAtGate(p);
    expect(p.sys.settlement.settlers()).toEqual(['hobb', 'dax']);
    expect(p.game.flags.is('settler.hobb') && p.game.flags.is('settler.dax')).toBe(true);
    expect(p.sys.people.get('hobb')).toBeDefined();
    expect(p.sys.settlement.larder().meals).toBe(LARDER_BRINGS);
    expect(p.said).toContain(SETTLER.hobb.arrival);
    // Nothing yet: no bed, no lamp. They ate on the road.
    expect(p.sys.settlement.settler('hobb')!.needs).toEqual({ bed: false, meal: true, lamp: false });
    expect(p.sys.settlement.settler('hobb')!.note).toBe('Needs a bed under a roof and a lamp to work.');
    // The story's walk-up lines read the same needs: the card's Talk says the first one unmet.
    expect([p.game.flags.get('need.hobb.bed'), p.game.flags.get('need.hobb.meal'), p.game.flags.get('need.hobb.lamp')]).toEqual([true, undefined, true]);
    p.sys.talk.talkTo('hobb');
    expect(p.talkThrough()).toEqual(['I\'m sleeping on a sack of flour, Button. It isn\'t even good flour.']);
    // A roof and a lamp, and the lines are gone.
    homestead(p);
    expect([p.game.flags.get('need.hobb.bed'), p.game.flags.get('need.hobb.lamp')]).toEqual([false, false]);
  });

  test('the kitchen quest by building: oven and table, a roof with beds, a lamp, the first meal; the camp becomes a homestead', () => {
    const p = at('kitchen');
    homestead(p);
    const flags = p.game.flags;
    expect(flags.is('step.kitchen.kitchen')).toBe(true);
    expect(flags.is('step.kitchen.beds')).toBe(true);
    expect(p.sys.settlement.step()).toBe('homestead');
    expect(p.said).toContain('Smoke from Hobb\'s oven. Your camp has become a home.');
    const hobb = p.sys.settlement.settler('hobb')!;
    expect(hobb.needs).toEqual({ bed: true, meal: true, lamp: true });
    expect(hobb.home?.kind).toBe('cottage');
    expect(hobb.home?.residents).toEqual(['hobb', 'dax']);
    // Not at work yet, so not glad.
    expect(hobb.glad).toBe(false);
    expect(hobb.note).toBe('Choose a job, and walk them to it.');
    // "E" at the oven: Hobb's first meal.
    atOven(p);
    expect(p.prompt()).toBe('Eat Hobb\'s cooking');
    p.interact();
    expect(flags.get('meal.day')).toBe(p.game.clock.day);
    expect(flags.is('step.kitchen.meal')).toBe(true);
    expect(p.sys.settlement.larder().meals).toBe(LARDER_BRINGS - 1);
  });

  test('an oven alone is not a kitchen to walk Hobb to', () => {
    const p = at('kitchen');
    p.game.flags.set('scene.18', true);
    p.advance(1.5);
    build(p, 'oven', 10, 3);
    p.advance(1.5);
    expect(p.sys.settlement.lead('hobb', 'kitchen')).toBe('Build a kitchen first.');
    build(p, 'prep_table', 13, 3);
    p.advance(1.5);
    expect(p.sys.settlement.settler('hobb')!.jobs[0].ready).toBe(true);
  });

  test('a job is chosen by walking them to its room: Hobb follows the hero to the kitchen', () => {
    const p = at('kitchen');
    homestead(p);
    const g = p.sys.region.grant();
    // The smokehouse is not built, so Hobb cannot be walked there.
    expect(p.sys.settlement.lead('hobb', 'smokehouse')).toBe('Build a smokehouse first.');
    expect(p.sys.settlement.settler('hobb')!.jobs.map((j) => j.ready)).toEqual([true, false]);
    p.teleport({ x: g.x + 4, z: g.z + 10 });
    p.advance(1);
    const hobb = p.sys.people.get('hobb')!;
    hobb.pos.x = g.x + 5; hobb.pos.z = g.z + 11;
    expect(p.sys.settlement.lead('hobb', 'kitchen')).toBeNull();
    expect(p.sys.settlement.settler('hobb')!.leading).toBe('kitchen');
    // The hero walks to the kitchen; she follows, and takes it once both are by its door.
    const kitchen = { x: g.x + 11, y: hobb.pos.y, z: g.z + 6 };
    expect(p.walkTo(kitchen, { within: 1, seconds: 20, until: () => p.sys.settlement.settler('hobb')!.job === 'kitchen' })).toBe(true);
    expect(p.sys.settlement.settler('hobb')!.leading).toBeNull();
    expect(p.game.flags.get('job.hobb')).toBe('kitchen');
    expect(p.game.flags.get('choice.hobb')).toBe('kitchen');
    // And says so, in the dialogue box: the story remembers the choice from here.
    p.advance(2);
    expect(p.talkThrough()).toEqual(['A meal a day for everyone on this hill. That\'s what a kitchen\'s for.']);
    expect(p.said).toContain('Hobb takes the kitchen.');
  });

  test('Dax on the yard carries what lies loose on the land into the nearest collector chest, once an hour', () => {
    const p = at('kitchen');
    homestead(p);
    const chest = build(p, 'collector_chest', 20, 4);
    const y = p.sys.region.place('grant.center').at.y, g = p.sys.region.grant();
    p.sys.machines.drop('quill', 3, { x: g.x + 4.5, y, z: g.z + 14.5 });
    p.teleport({ x: g.x + 12, z: g.z + 20 });
    const inChest = (): number => (p.sys.machines.chest(`${chest.id}`) ?? []).reduce((n, s) => n + (s.id === 'quill' ? s.count : 0), 0);
    p.advance(p.sys.time.dayLength / 24 + 1);
    // Far from the chest, nobody carries it.
    expect(inChest()).toBe(0);
    p.game.flags.set('job.dax', 'yard');
    p.advance(p.sys.time.dayLength / 24 + 1);
    expect(inChest()).toBe(3);
    expect(p.sys.machines.loose().filter((good) => good.item === 'quill')).toEqual([]);
  });

  test('the Heartstone climbs with what lives on the land: a kitchen, three beds and a living farm make 2', () => {
    const p = at('kitchen');
    expect(p.sys.hall.heart().level).toBe(1);
    homestead(p);
    expect(p.sys.hall.heart().level).toBe(1);
    mossPen(p);
    expect(p.sys.farms.get('moss')).toMatchObject({ built: true, mode: 'give', living: true });
    expect(p.sys.hall.heart().level).toBe(2);
    expect(p.game.flags.get('heartstone')).toBe(2);
    expect(p.said).toContain(`The Custodian: ${HEART_LADDER[1].says}`);
    // The next step asks for three living farms and everyone's needs met.
    expect(p.sys.settlement.next()).toMatchObject({ level: 3, reach: 'The lynx' });
    // A farm on Take does not count.
    expect(p.sys.farms.setMode!('moss', 'take')).toBe(true);
    p.advance(3);
    expect(p.sys.farms.get('moss')?.living).toBe(false);
    expect(p.sys.hall.heart().level).toBe(1);
  });

  test('glad settlers give a heart each morning, and one more each when Hobb keeps the kitchen; the kitchen feeds them from the larder', () => {
    const p = at('kitchen');
    homestead(p);
    const q = withJobs(p);
    expect(q.sys.settlement.settler('hobb')!.glad).toBe(true);
    expect(q.sys.settlement.settler('dax')!.glad).toBe(true);
    const hearts = Number(q.game.flags.get('hearts')) || 0, meals = q.sys.settlement.larder().meals;
    // Supper in the evening, then the morning.
    q.sys.time.setTimeOfDay(0.7);
    q.advance(1.5);
    expect(q.sys.settlement.larder().meals).toBe(meals - 2);
    const day = q.game.clock.day;
    q.advance(q.sys.time.dayLength * 0.4);
    expect(q.game.clock.day).toBe(day + 1);
    expect(q.game.flags.get('hearts')).toBe(hearts + 2 * (HEARTS.glad + HEARTS.kitchen));
    expect(q.sys.settlement.settler('hobb')!.hearts).toBe(HEARTS.glad + HEARTS.kitchen);
  }, 60_000);

  test('every third evening two of them ask at the table; one is granted ten hearts and the other says one line', () => {
    const p = at('echo');
    homestead(p);
    p.game.flags.set('fight.5.won', true);
    p.advance(1.5);
    expect(p.sys.settlement.settlers()).toEqual(['hobb', 'dax', 'gus']);
    const table = build(p, 'dinner_table', 10, 8);
    p.advance(1);
    const asked: string[][] = [];
    p.game.events.on('dinner.asked', ({ asks }) => asked.push([...asks]));
    p.sys.time.setTimeOfDay(0.7);
    p.advance(1.5);
    expect(p.said).toContain('Dinner is on the table.');
    p.teleport({ x: table.x + 1, z: table.z - 1 });
    p.advance(0.5);
    expect(p.prompt()).toBe('Sit down to dinner');
    p.interact();
    expect(asked).toEqual([['gus', 'hobb']]);
    expect(p.sys.settlement.dinner()!.asks.map((a) => a.text)).toEqual([SETTLER.gus.ask!.text, SETTLER.hobb.ask!.text]);
    const hearts = Number(p.game.flags.get('hearts')) || 0;
    expect(p.sys.settlement.grant('gus')).toBe(SETTLER.hobb.ask!.other);
    expect(p.game.flags.get('hearts')).toBe(hearts + HEARTS.dinner);
    expect(p.game.flags.get('choice.dinner')).toBe('gus');
    expect(p.game.flags.is('dinner.gus')).toBe(true);
    // Only one is granted.
    expect(p.sys.settlement.grant('hobb')).toBeNull();
    // The next dinner is three evenings on, and Gus does not ask again.
    p.interact();
    expect(p.said.at(-1)).toBe(`Dinner is over. The next is on day ${p.game.clock.day + 3}.`);
  });

  test('on a dinner evening everyone sits at the long table, facing it, and the door side keeps its middle free', () => {
    const p = at('echo');
    homestead(p);
    p.game.flags.set('fight.5.won', true);
    p.advance(1.5);
    const table = build(p, 'dinner_table', 10, 8);
    p.sys.time.setTimeOfDay(0.7);
    p.advance(1.5);
    // The hero sits down at the door, on the north side in the middle; the people walk over and take their seats.
    p.teleport({ x: table.x + 3, z: table.z - 1 });
    p.advance(0.5);
    p.interact();
    p.advance(20);
    const middle = { x: table.x + 3, z: table.z + 1 };
    for (const who of ['hobb', 'dax', 'gus'] as const) {
      const actor = p.game.actors.get(`npc:${who}`)!;
      expect(actor.anim, who).toBe('sit');
      const spot = p.sys.settlement.spot(who)!;
      expect(spot.seat, who).toBeDefined();
      // Within a bench's reach of the table's long sides or its ends, never on it.
      const dx = Math.abs(actor.pos.x - middle.x), dz = Math.abs(actor.pos.z - middle.z);
      expect(dx <= 3.7 && dz <= 1.6 && (dz >= 1.4 || dx >= 3.5), who).toBe(true);
      // Facing the table: a step along their facing brings them nearer its middle line.
      const ahead = { x: actor.pos.x + Math.sin(actor.facing) * 0.5, z: actor.pos.z - Math.cos(actor.facing) * 0.5 };
      const toLine = (q: { x: number; z: number }): number => dz >= 1.4 ? Math.abs(q.z - middle.z) : Math.abs(q.x - middle.x);
      expect(toLine(ahead), who).toBeLessThan(toLine(actor.pos));
      // Nobody takes the hero's place at the door.
      expect(Math.hypot(actor.pos.x - (table.x + 3), actor.pos.z - (table.z - 0.5)) > 1, who).toBe(true);
    }
  }, 60_000);

  test('a wish comes true when the land shows it: Dax\'s post where he can see the gate and the road', () => {
    const p = at('kitchen');
    homestead(p);
    const stone = p.sys.region.place('grant.stone').at, g = p.sys.region.grant();
    const hearts = Number(p.game.flags.get('hearts')) || 0;
    build(p, 'watch_post', Math.floor(stone.x) - g.x - 6, Math.floor(stone.z) - g.z - 4);
    p.advance(2.5);
    expect(p.game.flags.is('wish.dax')).toBe(true);
    expect(p.game.flags.get('hearts')).toBe(hearts + HEARTS.wish);
    expect(p.sys.settlement.settler('dax')!.wish.granted).toBe(true);
  });

  test('Holt comes for a lamp on every home and along the path, and finishes the lamplighter\'s step', () => {
    const p = at('lights');
    p.game.flags.set('scene.18', true);
    p.advance(1.5);
    build(p, 'cottage', 2, 2);
    for (let i = 0; i < 6; i++) build(p, 'lantern', 8 + i * 2, 4);
    p.advance(1.5);
    expect(p.sys.settlement.settlers()).toContain('holt');
    expect(p.game.flags.get('job.holt')).toBe('lamps');
    expect(p.game.flags.is('step.lights.holt')).toBe(true);
  });

  test('Tansy comes for three bee boxes among flowers, with nothing on Take for three days, and keeps the hives', () => {
    const p = at('itself');
    for (const dx of [16, 18, 20]) build(p, 'bee_box', dx, 16);
    p.advance(3);
    expect(p.sys.farms.get('bee')).toMatchObject({ living: true, rate: 12 });
    // Nothing taken since the land was granted: from day 3 she comes.
    while (p.game.clock.day < 3) p.sys.time.sleep();
    p.advance(2);
    expect(p.sys.settlement.settlers()).toContain('tansy');
    expect(p.game.flags.get('job.tansy')).toBe('bees');
    expect(p.game.flags.is('step.itself.tansy')).toBe(true);
    p.advance(3);
    expect(p.sys.farms.get('bee')!.rate).toBe(18);
  });

  test('a save in the middle keeps who lives here, their jobs, the larder and tonight\'s dinner', () => {
    const p = at('kitchen');
    homestead(p);
    atOven(p);
    p.interact();
    const before = { settlers: [...p.sys.settlement.settlers()], larder: p.sys.settlement.larder(), step: p.sys.settlement.step() };
    const q = p.reload();
    q.advance(1.5);
    expect([...q.sys.settlement.settlers()]).toEqual(before.settlers);
    expect(q.sys.settlement.larder()).toEqual(before.larder);
    expect(q.sys.settlement.step()).toBe(before.step);
    expect(q.sys.settlement.settler('hobb')!.needs).toEqual({ bed: true, meal: true, lamp: true });
    expect(q.sys.people.get('hobb')).toBeDefined();
  });
});
