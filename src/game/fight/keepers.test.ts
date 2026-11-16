import { describe, expect, test } from 'bun:test';
import { KEEPERS, type KeeperKind } from '../content/fight.ts';
import { createFight, type Fight, type FightRecord } from './fight.sim.ts';
import { createKeeper, createKeeperBot, keeperRoom, type Keeper, type KeeperEvent } from './keepers.sim.ts';

const DT = 1 / 60;

interface Room { fight: Fight; keeper: Keeper; told: KeeperEvent[]; ended: FightRecord[]; run(seconds: number, each?: () => void): void; until(done: () => boolean, limit?: number, each?: () => void): boolean }

function room(kind: KeeperKind, companion = 'wren'): Room {
  const r = keeperRoom(kind, 0, 0);
  const fight = createFight(r.stage, { way: 'hero', companion, random: () => 0.4 });
  const ended: FightRecord[] = [], told: KeeperEvent[] = [];
  const keeper = createKeeper(kind, fight, r, { onEnd: (rec) => ended.push(rec) });
  const step = (each?: () => void): void => {
    each?.();
    fight.step(DT);
    keeper.step(DT);
    told.push(...keeper.events);
    keeper.events.length = 0;
    fight.events.length = 0;
  };
  return {
    fight, keeper, told, ended,
    run(seconds, each) { for (let t = 0; t < seconds - 1e-9; t += DT) step(each); },
    until(done, limit = 60, each) { for (let t = 0; t < limit; t += DT) { if (done()) return true; step(each); } return done(); },
  };
}

/** Lets the rule-made player fight it, for at most `limit` seconds. */
function play(kind: KeeperKind, limit = 240): Room {
  const r = room(kind);
  const bot = createKeeperBot(r.fight, r.keeper);
  r.until(() => r.keeper.won, limit, () => bot.step(DT));
  return r;
}

describe('the keepers', () => {
  test('each sleeps until the hero comes in, and its heart starts shut', () => {
    for (const kind of ['sluice', 'lamplighter', 'harvester'] as const) {
      const r = room(kind);
      expect(r.keeper.body.doing).toBe('asleep');
      expect(r.keeper.heart.open).toBe(false);
      r.run(1);
      expect(r.keeper.body.doing).toBe('asleep');
      r.fight.placeHero(r.keeper.room.stage.center.x, r.keeper.room.stage.center.z + 4);
      r.run(0.2);
      expect(r.told.some((e) => e.type === 'woke')).toBe(true);
    }
  });

  test('the sluice keeper: a hit on it does nothing until a flooded channel stalls it', () => {
    const r = room('sluice');
    const k = r.keeper, cells = k.room.channels![0]!.cells;
    r.fight.placeHero(k.room.stage.center.x, k.room.stage.center.z + 3);
    r.run(0.5);
    expect(k.heart.open).toBe(false);
    // Open the first gate, then bring the keeper onto its channel.
    const gate = k.parts[0]!;
    gate.guard = 0.0001;
    r.fight.placeHero(gate.x, gate.z + 1.2);
    r.fight.input.aimX = gate.x;
    r.fight.input.aimZ = gate.z;
    r.fight.press('attack');
    r.run(0.4);
    expect(k.flooded(0)).toBeGreaterThan(0);
    k.body.x = cells[2]!.x;
    k.body.z = cells[2]!.z;
    (k.body as { doing: string }).doing = 'wait';
    r.run(0.1);
    expect(k.body.doing).toBe('stalled');
    expect(k.heart.open).toBe(true);
    // The water runs out and the gate stands again.
    r.run(KEEPERS.sluice.gate.flood + 0.5, () => { r.fight.placeHero(gate.x, gate.z + 1.2); r.fight.hero.health = 100; });
    expect(k.flooded(0)).toBe(0);
    expect(k.parts[0]!.broken).toBe(false);
  });

  test('the lamplighter: a beam that crosses a lit lamp blinds it, and opens its heart', () => {
    const r = room('lamplighter');
    const k = r.keeper, lamp = k.parts[0]!, p = k.room.lamps![0]!;
    lamp.guard = 0.0001;
    r.fight.placeHero(p.x + 1, p.z);
    r.fight.input.aimX = p.x;
    r.fight.input.aimZ = p.z;
    r.fight.press('attack');
    r.run(0.4);
    expect(k.lit(0)).toBeGreaterThan(0);
    // Behind the lamp, on the line from the post.
    const away = Math.hypot(p.x - k.body.x, p.z - k.body.z);
    const bx = p.x + ((p.x - k.body.x) / away) * 2, bz = p.z + ((p.z - k.body.z) / away) * 2;
    const blinded = r.until(() => k.body.doing === 'blinded', 12, () => { r.fight.placeHero(bx, bz); r.fight.hero.health = 100; });
    expect(blinded).toBe(true);
    expect(k.heart.open).toBe(true);
    expect(r.fight.record.hitBy.beam ?? 0).toBe(0);
  });

  test('the harvester: its heart is shut while a pod stands, and the companion holds the arm', () => {
    const r = room('harvester');
    const k = r.keeper;
    r.fight.placeHero(k.room.stage.center.x, k.room.stage.center.z + 8);
    r.until(() => k.parts.length > 0, 10, () => { r.fight.hero.health = 100; });
    expect(k.heart.open).toBe(false);
    r.fight.press('skill');
    r.run(0.2, () => { r.fight.hero.health = 100; });
    expect(k.body.doing).toBe('held');
  });

  for (const kind of ['sluice', 'lamplighter', 'harvester'] as const) {
    test(`the rule-made player shuts the ${kind} keeper down`, () => {
      const r = play(kind);
      expect(r.keeper.won).toBe(true);
      expect(r.ended).toHaveLength(1);
      expect(r.ended[0]!.result).toBe('calmed');
      expect(r.keeper.body.doing).toBe('down');
    }, 30_000);
  }
});
