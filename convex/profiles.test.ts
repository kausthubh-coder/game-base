import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import { as, newBackend, player, refusalOf } from './test.setup';

describe('profiles', () => {
  test('a signed-out caller has no profile to read, make or rename', async () => {
    const t = newBackend();
    expect(await refusalOf(t.query(api.profiles.me, {}))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.profiles.ensure, {}))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.profiles.rename, { name: 'Nobody' }))).toBe('signedOut');
    expect(await t.run((ctx) => ctx.db.query('profiles').take(5))).toEqual([]);
  });

  test('the first sign-in makes one profile, and the next ones find it', async () => {
    const t = newBackend();
    const ada = as(t, 'user_ada');
    expect(await ada.query(api.profiles.me, {})).toBeNull();
    const first = await ada.mutation(api.profiles.ensure, { name: '  Ada   Lovelace \n' });
    expect(first.name).toBe('Ada Lovelace');
    // A later call keeps the stored name, whatever it is handed.
    expect(await ada.mutation(api.profiles.ensure, { name: 'Someone else' })).toEqual(first);
    expect(await ada.query(api.profiles.me, {})).toEqual(first);
    expect(await t.run((ctx) => ctx.db.query('profiles').take(5))).toHaveLength(1);
  });

  test('a new player with no name is called Player, or what Clerk calls them', async () => {
    const t = newBackend();
    expect((await as(t, 'user_named').mutation(api.profiles.ensure, {})).name).toBe('user_named');
    const nameless = t.withIdentity({ subject: 'user_nameless', issuer: 'https://clerk.test' });
    expect((await nameless.mutation(api.profiles.ensure, { name: ' \u200b ' })).name).toBe('Player');
  });

  test('a player renames only themselves', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    expect(ada.id).not.toBe(bo.id);
    expect(await bo.session.mutation(api.profiles.rename, { name: 'Bo the builder of a very long name' })).toBe('Bo the builder of a very');
    expect((await ada.session.query(api.profiles.me, {}))?.name).toBe('user_ada');
    expect((await bo.session.query(api.profiles.me, {}))?.name).toBe('Bo the builder of a very');
    expect(await refusalOf(ada.session.mutation(api.profiles.rename, { name: '   ' }))).toBe('badName');
  });

  test('a signed-in player with no profile yet cannot rename', async () => {
    const t = newBackend();
    expect(await refusalOf(as(t, 'user_new').mutation(api.profiles.rename, { name: 'New' }))).toBe('noProfile');
  });
});
