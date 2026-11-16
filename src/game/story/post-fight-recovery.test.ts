import { expect, test } from 'bun:test';
import { FLAG } from '../content/flags.ts';
import type { FightNumber, QuestId } from '../content/ids.ts';
import { QUESTS, satisfy } from '../content/quests.ts';
import { armingSteps, fightPlace } from '../fights/index.sim.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { apply } from '../quests/rules.sim.ts';

/** Real rules through the fight's open quest step and its completed introduction. */
function beforeFight(n: FightNumber): Play {
  const p = newPlay({ seed: 7 });
  p.advance(0.5);
  const arming = armingSteps(n)!;
  p.sys.quests.skipTo(arming.quest);
  p.advance(0.5);
  for (const step of QUESTS.find(q => q.id === arming.quest)!.steps) {
    if (arming.steps.includes(step.id)) break;
    for (const effect of satisfy(step.done)) apply(p.game, effect);
    p.advance(0.2);
  }
  p.advance(0.5);
  p.talkThrough();
  expect(p.game.flags.get(FLAG.questStep(arming.quest as QuestId))).toBe(arming.steps[0]);
  return p;
}

test('Continue recovers a victory saved before its post-fight conversation starts', () => {
  const p = beforeFight(2);
  p.game.flags.set(FLAG.fightWon(2), true);
  expect(p.sys.talk.active).toBe(false);
  const continued = p.reload();
  continued.advance(1.5);
  expect(continued.sys.talk.current()?.scene).toBe(19);
  expect(continued.sys.talk.current()?.text).toBe('Grey runs out of its quills. It blinks, sneezes, and starts scratching itself on your fence post.');
  continued.talkThrough();
  continued.advance(0.6);
  expect(continued.game.flags.is(FLAG.questDone('kitchen'))).toBe(true);
});

test('Continue restarts an interrupted earned victory scene without repeating fight gifts', () => {
  const p = beforeFight(2), at = fightPlace(2);
  p.sys.time.setTimeOfDay(0.85);
  p.teleport({ x: at.x, z: at.z + 6 });
  p.advance(0.2);
  expect(p.sys.fights.active()).toBe(2);
  p.sys.fights.autoplay!('middle');
  expect(p.until(() => p.game.flags.is(FLAG.fightWon(2)), 240)).toBe(true);
  expect(p.until(() => p.sys.talk.current()?.scene === 19, 5)).toBe(true);
  const quills = p.count('quill'), hearts = p.game.flags.get(FLAG.hearts);
  expect(quills).toBeGreaterThanOrEqual(4);
  p.sys.talk.advance();
  expect(p.sys.talk.current()?.text).toBe('Huh. (a pause) It\'s staying, isn\'t it.');
  const continued = p.reload();
  continued.advance(1.5);
  expect(continued.sys.talk.current()?.text).toBe('Grey runs out of its quills. It blinks, sneezes, and starts scratching itself on your fence post.');
  continued.talkThrough();
  continued.advance(0.6);
  expect(continued.game.flags.is(FLAG.questDone('kitchen'))).toBe(true);
  expect(continued.count('quill')).toBe(quills);
  expect(continued.game.flags.get(FLAG.hearts)).toBe(hearts);
  expect(continued.heard.filter(e => e.name === 'fight.ended')).toEqual([]);
  expect(continued.heard.filter(e => e.name === 'scene.played' && (e.data as { scene: number }).scene === 19)).toHaveLength(1);
  const completed = continued.reload();
  completed.advance(4);
  expect(completed.sys.talk.current()?.scene).not.toBe(19);
  expect(completed.count('quill')).toBe(quills);
  expect(completed.heard.filter(e => e.name === 'scene.played' && (e.data as { scene: number }).scene === 19)).toEqual([]);
}, 60_000);

test('Continue recovers denial after an earlier completed victory without replaying that victory', () => {
  const p = beforeFight(4);
  expect(p.game.flags.is(FLAG.fightWon(2))).toBe(true);
  expect(p.game.flags.is(FLAG.scene(19))).toBe(true);
  p.game.flags.set(FLAG.fightDenied(4), true);
  const continued = p.reload();
  continued.advance(1.5);
  expect(continued.sys.talk.current()?.scene).toBe(21);
  continued.talkThrough();
  continued.advance(0.6);
  expect(continued.game.flags.is(FLAG.scene(21))).toBe(true);
  expect(continued.game.flags.is(FLAG.fightDenied(4))).toBe(true);
  expect(continued.game.flags.is(FLAG.fightWon(4))).toBe(false);
  expect(continued.heard.filter(e => e.name === 'talk.started' && (e.data as { conversation: string }).conversation === 'scene.19')).toEqual([]);
});

test('loading an earlier state in the same kernel ignores a stale queued post-fight scene', () => {
  const p = beforeFight(2), earlier = p.kernel.save();
  p.game.flags.set(FLAG.fightWon(2), true);
  p.kernel.load(earlier);
  p.advance(1.5);
  expect(p.game.flags.is(FLAG.fightWon(2))).toBe(false);
  expect(p.sys.talk.current()?.scene).not.toBe(19);
  expect(p.game.flags.is(FLAG.scene(19))).toBe(false);
  p.game.flags.set(FLAG.fightWon(2), true);
  p.advance(1.5);
  expect(p.sys.talk.current()?.scene).toBe(19);
});
