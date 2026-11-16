import { expect, test } from 'bun:test';
import { PLACES, stage } from './fakes.ts';

function road() {
  PLACES.arches = [-25, 0];
  const s = stage();
  s.game.systems.quests.skipTo('count');
  s.game.flags.set('been.town', true);
  s.game.flags.set('scene.22', true);
  s.game.flags.set('step.count.sow', true);
  s.moveTo('arches');
  return s;
}

test('the road lighting waits for evening, then the next morning observes the grass at the arches', () => {
  const s = road();
  s.game.clock.timeOfDay = 0.5;
  s.run(3);
  expect(s.game.systems.talk.active).toBe(false);
  s.game.clock.timeOfDay = 0.75;
  s.run(3);
  expect(s.game.systems.talk.current()?.scene).toBe(23);
  s.through();
  s.run(3);
  expect(s.game.flags.is('scene.23')).toBe(true);
  expect(s.game.flags.is('step.count.grey')).toBe(false);
  // Save during the lit night. The next morning's observation must survive Continue.
  const saved = JSON.parse(JSON.stringify(s.kernel.save()));
  const again = stage();
  again.kernel.load(saved);
  again.moveTo('arches');
  again.game.clock.day += 1;
  again.game.clock.timeOfDay = 0.27;
  again.run(3);
  expect(again.game.flags.is('step.count.grey')).toBe(true);
  expect(again.game.flags.get('quest.count.step')).toBe('lynx');
});
