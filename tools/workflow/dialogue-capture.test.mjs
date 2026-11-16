import { expect, test } from 'bun:test';
import { dialogueCoverage, presentedDialogueLine } from '../lib/dialogue-capture.mjs';

const observation = (text, camera = 0, kind = 'film') => ({ line: { text, scene: 10, kind }, camera });

test('a later film line is captured after rendering before a camera settle could advance it', async () => {
  let current = observation('Your back is against the stone door.'), settles = 0;
  const result = await presentedDialogueLine({
    expected: current, first: false,
    settle: async () => { settles++; current = observation('You lower your hand.', 2); },
    waitText: async text => { expect(current.line.text).toBe(text); current = { ...current, camera: 1 }; },
    waitClear: async () => {}, read: async () => current,
  });
  expect(result.same).toBe(true);
  expect(result.actual).toEqual(observation('Your back is against the stone door.', 1));
  expect(settles).toBe(0);
});

test('entry and ordinary talk still settle and use the rendered observation', async () => {
  for (const [first, kind] of [[true, 'film'], [false, 'talk']]) {
    let current = observation('The door.', 0, kind), settles = 0;
    const result = await presentedDialogueLine({ expected: current, first,
      settle: async () => { settles++; current = observation('The door.', 1, kind); },
      waitText: async () => {}, waitClear: async () => {}, read: async () => current,
    });
    expect(settles).toBe(1);
    expect(result.same).toBe(true);
    expect(result.actual.camera).toBe(1);
  }
});

test('a line that changes during rendering and a missed automatic line both fail', async () => {
  const result = await presentedDialogueLine({ expected: observation('First.'), first: false,
    settle: async () => {}, waitText: async () => {}, waitClear: async () => {}, read: async () => observation('Second.'),
  });
  expect(result.same).toBe(false);
  expect(dialogueCoverage(['Earlier.'], ['First.', 'Third.'], ['Earlier.', 'First.', 'Second.', 'Third.']).complete).toBe(false);
  expect(dialogueCoverage(['Earlier.'], ['First.', 'Second.'], ['Earlier.', 'First.', 'Second.']).complete).toBe(true);
  expect(dialogueCoverage(['Earlier.'], ['Second.'], ['First.', 'Second.']).complete).toBe(false);
});
