import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import { MAX_PLAYERS_NOW } from './model/limits';
import { newBackend, player, type Backend } from './test.setup';

const SECRET = 'a-secret-only-the-world-server-holds';

const post = (t: Backend, body: unknown, secret: string | null = SECRET): Promise<Response> =>
  t.fetch('/world-server/card', {
    method: 'POST',
    headers: secret === null ? {} : { Authorization: `Bearer ${secret}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv('WORLD_SERVER_SECRET', SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the world server posts a card', () => {
  test('with the secret, the card is written and shows in the world list', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const before = (await ada.session.query(api.worlds.list, {}))[0].lastPlayedAt;

    const response = await post(t, { worldId, lastPlayedAt: before + 5_000, playersNow: [bo.id, ada.id, bo.id], name: '  Hollow Oak, rebuilt ' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await ada.session.query(api.worlds.list, {}))[0]).toMatchObject({
      name: 'Hollow Oak, rebuilt',
      lastPlayedAt: before + 5_000,
      playersNow: [{ playerId: bo.id, name: 'user_bo' }, { playerId: ada.id, name: 'user_ada' }],
    });

    // The world went to sleep: nobody is in it, the name stays, and an older time does not turn the clock back.
    expect((await post(t, { worldId, lastPlayedAt: before, playersNow: [] })).status).toBe(200);
    expect((await ada.session.query(api.worlds.list, {}))[0]).toMatchObject({ name: 'Hollow Oak, rebuilt', lastPlayedAt: before + 5_000, playersNow: [] });
  });

  test('a card made before the one already written does not put a departed player back', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const now = Date.now();
    const players = async () => (await ada.session.query(api.worlds.list, {}))[0].playersNow.map((p) => p.playerId);

    expect((await post(t, { worldId, lastPlayedAt: now, playersNow: [ada.id, bo.id], sentAt: 100 })).status).toBe(200);
    // Ada left, then Bo. The empty card arrives first, and the one-player card after it.
    expect((await post(t, { worldId, lastPlayedAt: now + 2, playersNow: [], sentAt: 102 })).status).toBe(200);
    expect((await post(t, { worldId, lastPlayedAt: now + 1, playersNow: [bo.id], sentAt: 101 })).status).toBe(200);
    expect(await players()).toEqual([]);
    expect((await ada.session.query(api.worlds.list, {}))[0].lastPlayedAt).toBe(now + 2);

    // A later card is taken as before, and so is one with the same stamp.
    expect((await post(t, { worldId, lastPlayedAt: now + 3, playersNow: [bo.id], sentAt: 103 })).status).toBe(200);
    expect(await players()).toEqual([bo.id]);
    expect((await post(t, { worldId, lastPlayedAt: now + 3, playersNow: 'x', sentAt: 104 })).status).toBe(400);
    expect((await post(t, { worldId, lastPlayedAt: now + 3, playersNow: [], sentAt: 'soon' })).status).toBe(400);
  });

  test('without the secret, or with a wrong one, nothing is written', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const card = { worldId, lastPlayedAt: Date.now() + 5_000, playersNow: [ada.id], name: 'Taken over' };

    for (const secret of [null, '', 'wrong', `${SECRET}x`, SECRET.slice(1), SECRET.toUpperCase()]) {
      const response = await post(t, card, secret);
      expect(response.status, `secret ${String(secret)}`).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
    }
    // The secret alone, without the word Bearer, is not accepted either.
    expect((await t.fetch('/world-server/card', { method: 'POST', headers: { Authorization: SECRET }, body: JSON.stringify(card) })).status).toBe(401);
    // A signed-in player is not the world server.
    expect((await ada.session.fetch('/world-server/card', { method: 'POST', body: JSON.stringify(card) })).status).toBe(401);
    expect((await ada.session.query(api.worlds.list, {}))[0]).toMatchObject({ name: 'Hollow Oak', playersNow: [] });
  });

  test('with no secret set on the deployment, everyone is refused', async () => {
    vi.stubEnv('WORLD_SERVER_SECRET', '');
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    for (const secret of [null, '', SECRET]) expect((await post(t, { worldId, lastPlayedAt: 1, playersNow: [] }, secret)).status).toBe(503);
  });

  test('a card that is not a card is refused with the reason', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const soloId = await t.run((ctx) => ctx.db.insert('worlds', { ownerId: ada.id, name: 'My plot', kind: 'solo', lastPlayedAt: 0, playersNow: [] }));
    const good = { worldId, lastPlayedAt: 1, playersNow: [] as string[] };

    const cases: [body: unknown, status: number, error: string][] = [
      ['{not json', 400, 'badJson'],
      [null, 400, 'badCard'],
      [{ ...good, worldId: 7 }, 400, 'badCard'],
      [{ ...good, lastPlayedAt: 'now' }, 400, 'badCard'],
      [{ ...good, playersNow: 'ada' }, 400, 'badCard'],
      [{ ...good, playersNow: [7] }, 400, 'badCard'],
      [{ ...good, playersNow: Array.from({ length: MAX_PLAYERS_NOW + 1 }, () => ada.id) }, 400, 'badCard'],
      [{ ...good, name: 7 }, 400, 'badCard'],
      [{ ...good, name: '   ' }, 400, 'badName'],
      [{ ...good, playersNow: ['not-a-player'] }, 400, 'badPlayer'],
      [{ ...good, playersNow: [worldId] }, 400, 'badPlayer'],
      [{ ...good, worldId: 'not-a-world' }, 404, 'noWorld'],
      [{ ...good, worldId: ada.id }, 404, 'noWorld'],
      [{ ...good, worldId: soloId }, 409, 'soloWorld'],
    ];
    for (const [body, status, error] of cases) {
      const response = await post(t, body);
      expect([response.status, await response.json()], JSON.stringify(body).slice(0, 80)).toEqual([status, { error }]);
    }
    expect((await ada.session.query(api.worlds.list, {})).find((card) => card._id === worldId)).toMatchObject({ name: 'Hollow Oak', playersNow: [] });
  });
});
