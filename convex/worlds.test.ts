import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import { MAX_WORLDS_OWNED } from './model/limits';
import { as, newBackend, player, refusalOf } from './test.setup';

describe('the world list', () => {
  test('a signed-out caller is refused everything but the question mayEnter answers', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    expect(await refusalOf(t.query(api.worlds.list, {}))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.worlds.create, { name: 'Mine' }))).toBe('signedOut');
    expect(await refusalOf(t.query(api.worlds.members, { worldId }))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.worlds.removeMember, { worldId, playerId: ada.id }))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.worlds.leave, { worldId }))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.worlds.remove, { worldId }))).toBe('signedOut');
    expect(await t.query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'signedOut' });
  });

  test('a world shows in its owner\'s list and in nobody else\'s', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: '  Hollow   Oak ' });
    const cards = await ada.session.query(api.worlds.list, {});
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ _id: worldId, name: 'Hollow Oak', kind: 'online', role: 'owner', ownerName: 'user_ada', playersNow: [], backup: null });
    expect(await bo.session.query(api.worlds.list, {})).toEqual([]);
    // Signed in, but `profiles.ensure` has not run: an empty list, not an error.
    expect(await as(t, 'user_new').query(api.worlds.list, {})).toEqual([]);
  });

  test('a world needs a name, and one player owns only so many', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    expect(await refusalOf(ada.session.mutation(api.worlds.create, { name: ' ' }))).toBe('badName');
    for (let i = 0; i < MAX_WORLDS_OWNED; i++) await ada.session.mutation(api.worlds.create, { name: `World ${i}` });
    expect(await refusalOf(ada.session.mutation(api.worlds.create, { name: 'One too many' }))).toBe('tooMany');
  });
});

describe('mayEnter, the world server\'s question', () => {
  test('the owner may, a member may, and everyone else may not', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const cy = await player(t, 'user_cy');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });

    expect(await ada.session.query(api.worlds.mayEnter, { worldId })).toEqual({
      allowed: true, role: 'owner', playerId: ada.id, playerName: 'user_ada', worldName: 'Hollow Oak', kind: 'online',
    });
    expect(await bo.session.query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'notAllowed' });

    const { code } = await ada.session.mutation(api.invites.create, { worldId });
    await bo.session.mutation(api.invites.accept, { code });
    expect(await bo.session.query(api.worlds.mayEnter, { worldId })).toEqual({
      allowed: true, role: 'member', playerId: bo.id, playerName: 'user_bo', worldName: 'Hollow Oak', kind: 'online',
    });
    expect(await cy.session.query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'notAllowed' });
  });

  test('an id that is no world, and a player with no profile, are answered and not thrown', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    for (const bad of ['', 'not-an-id', ada.id, `${worldId}x`]) {
      expect(await ada.session.query(api.worlds.mayEnter, { worldId: bad })).toEqual({ allowed: false, reason: 'notAllowed' });
    }
    expect(await as(t, 'user_new').query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'notAllowed' });
  });

  test('a member who leaves, or is taken out, may no longer enter', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const cy = await player(t, 'user_cy');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    for (const guest of [bo, cy]) {
      const { code } = await ada.session.mutation(api.invites.create, { worldId });
      await guest.session.mutation(api.invites.accept, { code });
    }
    expect((await bo.session.query(api.worlds.list, {})).map((card) => [card.name, card.role, card.ownerName])).toEqual([['Hollow Oak', 'member', 'user_ada']]);
    expect(await cy.session.query(api.worlds.members, { worldId })).toEqual([
      { playerId: ada.id, name: 'user_ada', role: 'owner' },
      { playerId: bo.id, name: 'user_bo', role: 'member' },
      { playerId: cy.id, name: 'user_cy', role: 'member' },
    ]);

    await bo.session.mutation(api.worlds.leave, { worldId });
    await ada.session.mutation(api.worlds.removeMember, { worldId, playerId: cy.id });
    for (const guest of [bo, cy]) {
      expect(await guest.session.query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'notAllowed' });
      expect(await guest.session.query(api.worlds.list, {})).toEqual([]);
      expect(await refusalOf(guest.session.query(api.worlds.members, { worldId }))).toBe('forbidden');
    }
  });
});

describe('another player\'s world', () => {
  test('player B cannot see into, change or delete player A\'s world', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const { code } = await ada.session.mutation(api.invites.create, { worldId });

    expect(await refusalOf(bo.session.query(api.worlds.members, { worldId }))).toBe('forbidden');
    expect(await refusalOf(bo.session.mutation(api.worlds.removeMember, { worldId, playerId: ada.id }))).toBe('forbidden');
    expect(await refusalOf(bo.session.mutation(api.worlds.remove, { worldId }))).toBe('forbidden');

    // A member is still not the owner.
    await bo.session.mutation(api.invites.accept, { code });
    expect(await refusalOf(bo.session.mutation(api.worlds.removeMember, { worldId, playerId: bo.id }))).toBe('forbidden');
    expect(await refusalOf(bo.session.mutation(api.worlds.remove, { worldId }))).toBe('forbidden');
    expect((await ada.session.query(api.worlds.list, {})).map((card) => card._id)).toEqual([worldId]);
  });

  test('the owner deletes a world with its members and invites', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const { code } = await ada.session.mutation(api.invites.create, { worldId });
    await bo.session.mutation(api.invites.accept, { code });
    await ada.session.mutation(api.invites.create, { worldId });

    await ada.session.mutation(api.worlds.remove, { worldId });
    expect(await ada.session.query(api.worlds.list, {})).toEqual([]);
    expect(await bo.session.query(api.worlds.list, {})).toEqual([]);
    const left = await t.run(async (ctx) => ({
      worlds: await ctx.db.query('worlds').take(5),
      members: await ctx.db.query('members').take(5),
      invites: await ctx.db.query('invites').take(5),
    }));
    expect(left).toEqual({ worlds: [], members: [], invites: [] });
    expect(await refusalOf(ada.session.mutation(api.worlds.remove, { worldId }))).toBe('notFound');
  });
});
