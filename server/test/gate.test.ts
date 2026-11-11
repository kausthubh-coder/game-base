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
    const yes = { allowed: true, role: 'owner', playerId: 'p1', playerName: 'Ann', worldName: 'Hollow Oak', kind: 'online' };
    const { fetcher, calls } = convex(() => Response.json({ status: 'success', value: yes, logLines: [] }));
    expect(await convexGate(config, fetcher).mayEnter('w1', 'the-players-token')).toEqual({ playerId: 'p1', playerName: 'Ann' });
    expect(calls).toEqual([{
      url: 'https://happy-otter-123.convex.cloud/api/query',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer the-players-token' },
      body: { path: 'worlds:mayEnter', args: { worldId: 'w1' }, format: 'json' },
    }]);
  });

  test('only `allowed: true` lets a player in', async () => {
    const answers: [unknown, boolean][] = [
      [{ allowed: true }, true], [{ allowed: false, reason: 'notAllowed' }, false], [{ allowed: false, reason: 'signedOut' }, false],
      [true, false], [false, false], [null, false], ['yes', false],
    ];
    for (const [value, expected] of answers) {
      const { fetcher } = convex(() => Response.json({ status: 'success', value }));
      expect((await convexGate(config, fetcher).mayEnter('w1', 't')) !== null, JSON.stringify(value)).toBe(expected);
    }
    const failed = convex(() => Response.json({ status: 'error', errorMessage: 'Not signed in' }));
    expect(await convexGate(config, failed.fetcher).mayEnter('w1', 't')).toBeNull();
    const down = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
    expect(await convexGate(config, down).mayEnter('w1', 't')).toBeNull();
  });

  test('the card is posted to /world-server/card with the shared secret', async () => {
    const { fetcher, calls } = convex(() => new Response(null, { status: 200 }));
    const card = { worldId: 'w1', playersNow: ['p1'], lastPlayedAt: 1_800_000_000_000 };
    await convexGate(config, fetcher).postCard(card);
    expect(calls).toEqual([{
      url: 'https://happy-otter-123.convex.site/world-server/card',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer s3cret' },
      body: card,
    }]);
  });

  test('a card that cannot be posted does not throw', async () => {
    const refused = convex(() => new Response('no', { status: 401 }));
    await convexGate(config, refused.fetcher).postCard({ worldId: 'w1', playersNow: [], lastPlayedAt: 0 });
    const down = (async () => { throw new Error('no network'); }) as unknown as typeof fetch;
    await convexGate(config, down).postCard({ worldId: 'w1', playersNow: [], lastPlayedAt: 0 });
  });
});

describe('the stand-ins', () => {
  test('the open gate lets everyone in, the shut gate nobody', async () => {
    expect(await openGate.mayEnter('w1', 't')).toEqual({});
    expect(await shutGate.mayEnter('w1', 't')).toBeNull();
  });
});
