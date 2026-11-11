// The calls the world server makes to Convex, against a stand-in that notes what it was sent.
import { describe, expect, test } from 'bun:test';
import { convexGate, openGate, shutGate } from '../gate.ts';

interface Call { url: string; method: string; headers: Record<string, string>; body: unknown }

function convex(answer: (call: Call) => Response): { fetcher: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    const call: Call = { url, method: String(init.method), headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    calls.push(call);
    return answer(call);
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

const config = { url: 'https://happy-otter-123.convex.cloud/', siteUrl: 'https://happy-otter-123.convex.site', secret: 's3cret' };

describe('the Convex gate', () => {
  test('mayEnter is the worlds:mayEnter query, asked with the player\'s token', async () => {
    const { fetcher, calls } = convex(() => Response.json({ status: 'success', value: true, logLines: [] }));
    expect(await convexGate(config, fetcher).mayEnter('w1', 'the-players-token')).toBe(true);
    expect(calls).toEqual([{
      url: 'https://happy-otter-123.convex.cloud/api/query',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer the-players-token' },
      body: { path: 'worlds:mayEnter', args: { worldId: 'w1' }, format: 'json' },
    }]);
  });

  test('only a plain yes lets a player in', async () => {
    const answers: [unknown, boolean][] = [[true, true], [{ allowed: true }, true], [false, false], [{ allowed: false }, false], [null, false], ['yes', false]];
    for (const [value, expected] of answers) {
      const { fetcher } = convex(() => Response.json({ status: 'success', value }));
      expect(await convexGate(config, fetcher).mayEnter('w1', 't')).toBe(expected);
    }
    const failed = convex(() => Response.json({ status: 'error', errorMessage: 'Not signed in' }));
    expect(await convexGate(config, failed.fetcher).mayEnter('w1', 't')).toBe(false);
    const down = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
    expect(await convexGate(config, down).mayEnter('w1', 't')).toBe(false);
  });

  test('the card is posted to /world-card with the shared secret', async () => {
    const { fetcher, calls } = convex(() => new Response(null, { status: 200 }));
    const card = { worldId: 'w1', players: [{ id: 'user_2abc', name: 'Ann' }], lastPlayed: 1_800_000_000_000 };
    await convexGate(config, fetcher).postCard(card);
    expect(calls).toEqual([{
      url: 'https://happy-otter-123.convex.site/world-card',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer s3cret' },
      body: card,
    }]);
  });

  test('a card that cannot be posted does not throw', async () => {
    const refused = convex(() => new Response('no', { status: 401 }));
    await convexGate(config, refused.fetcher).postCard({ worldId: 'w1', players: [], lastPlayed: 0 });
    const down = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
    await convexGate(config, down).postCard({ worldId: 'w1', players: [], lastPlayed: 0 });
  });
});

describe('the stand-ins', () => {
  test('the open gate lets everyone in, the shut gate nobody', async () => {
    expect(await openGate.mayEnter('w1', 't')).toBe(true);
    expect(await shutGate.mayEnter('w1', 't')).toBe(false);
  });
});
