import { expect, test } from 'bun:test';
import { newPlay } from '../play/harness.sim.ts';

function waiting() {
  const p = newPlay(); p.advance(.5);
  p.sys.quests.skipTo('night');
  p.game.flags.set('camp.pitched', true);
  p.game.flags.set('camp.fire', true);
  p.teleport('camp'); p.advance(.5);
  p.sys.time.setTimeOfDay(.5);
  return p;
}

test('the lit campfire lets the waiting player reach the first night through normal interaction', () => {
  const p = waiting();
  expect(p.game.flags.get('quest.night.step')).toBe('bed');
  expect(p.prompt()).toBe('Wait until dusk');
  const day = p.game.clock.day;
  expect(p.sys.interact.act()).toBe(true);
  expect(p.game.clock.timeOfDay).toBeCloseTo(.73, 9);
  expect(p.game.clock.day).toBe(day);
  expect(p.sys.interact.nearest()?.id).not.toBe('ground:fire');
  expect(p.until(() => p.game.flags.is('night.fox'), 2)).toBe(true);
  expect(p.until(() => p.sys.hall.fox() !== null, 2)).toBe(true);
  expect(p.game.flags.is('night.over')).toBe(false);
  expect(p.game.clock.day).toBe(day);
  expect(p.heard.filter(e => e.name === 'slept')).toHaveLength(0);
  expect(p.heard.filter(e => e.name === 'night.started')).toHaveLength(1);
  const q = p.reload(); q.advance(.5);
  expect(q.prompt()).not.toBe('Wait until dusk');
  expect(q.game.clock.day).toBe(day);
});

test('waiting is offered only at a lit fire during the active first-night waiting step', () => {
  const p = waiting();
  for (const [flag, value] of [['camp.fire', false], ['quest.night.done', true], ['quest.night.step', 'door']] as const) {
    const old = p.game.flags.get(flag);
    p.game.flags.set(flag, value);
    expect(p.prompt()).not.toBe('Wait until dusk');
    p.game.flags.set(flag, old!);
  }
  p.game.player.busy = true;
  const before = { ...p.game.clock };
  expect(p.sys.interact.act()).toBe(false);
  expect(p.game.clock).toEqual(before);
});
