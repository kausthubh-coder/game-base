import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import { INVITE_LIFE_MS, MAX_MEMBERS, MAX_OPEN_INVITES } from './model/limits';
import { newBackend, player, refusalOf } from './test.setup';

afterEach(() => {
  vi.useRealTimers();
});

describe('invites', () => {
  test('a signed-out caller makes, reads, takes back and uses none', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const { inviteId, code } = await ada.session.mutation(api.invites.create, { worldId });
    expect(await refusalOf(t.mutation(api.invites.create, { worldId }))).toBe('signedOut');
    expect(await refusalOf(t.query(api.invites.forWorld, { worldId }))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.invites.revoke, { inviteId }))).toBe('signedOut');
    expect(await refusalOf(t.mutation(api.invites.accept, { code }))).toBe('signedOut');
  });

  test('only the owner makes, reads and takes back the invites of a world', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const { inviteId, code, expiresAt } = await ada.session.mutation(api.invites.create, { worldId });
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{16}$/);

    expect(await refusalOf(bo.session.mutation(api.invites.create, { worldId }))).toBe('forbidden');
    expect(await refusalOf(bo.session.query(api.invites.forWorld, { worldId }))).toBe('forbidden');
    expect(await refusalOf(bo.session.mutation(api.invites.revoke, { inviteId }))).toBe('forbidden');
    expect(await ada.session.query(api.invites.forWorld, { worldId })).toEqual([{ _id: inviteId, code, expiresAt, acceptedBy: null }]);

    // A member is still not the owner.
    await bo.session.mutation(api.invites.accept, { code });
    expect(await refusalOf(bo.session.mutation(api.invites.create, { worldId }))).toBe('forbidden');
    expect(await ada.session.query(api.invites.forWorld, { worldId })).toEqual([{ _id: inviteId, code, expiresAt, acceptedBy: 'user_bo' }]);
  });

  test('one code lets one player in, typed in any case and with dashes', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const cy = await player(t, 'user_cy');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const { code } = await ada.session.mutation(api.invites.create, { worldId });
    const typed = `${code.slice(0, 4)}-${code.slice(4, 8)} ${code.slice(8)}`.toLowerCase();

    expect(await bo.session.mutation(api.invites.accept, { code: typed })).toEqual({ worldId, name: 'Hollow Oak' });
    // Again changes nothing, for the member and for the owner.
    expect(await bo.session.mutation(api.invites.accept, { code })).toEqual({ worldId, name: 'Hollow Oak' });
    expect(await ada.session.mutation(api.invites.accept, { code })).toEqual({ worldId, name: 'Hollow Oak' });
    expect(await refusalOf(cy.session.mutation(api.invites.accept, { code }))).toBe('inviteUsed');
    expect(await refusalOf(cy.session.mutation(api.invites.accept, { code: 'AAAAAAAAAAAAAAAA' }))).toBe('notFound');
    expect(await refusalOf(cy.session.mutation(api.invites.accept, { code: '' }))).toBe('notFound');
    expect(await t.run((ctx) => ctx.db.query('members').take(10))).toHaveLength(1);
  });

  test('an invite runs out after a week, and one taken back stops working', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const madeAt = Date.now();
    const old = await ada.session.mutation(api.invites.create, { worldId });
    const takenBack = await ada.session.mutation(api.invites.create, { worldId });
    // The fake clock moves a millisecond or two while the backend works.
    expect(old.expiresAt - madeAt - INVITE_LIFE_MS).toBeGreaterThanOrEqual(0);
    expect(old.expiresAt - madeAt - INVITE_LIFE_MS).toBeLessThan(1_000);

    // A code one character short is no invite.
    expect(await refusalOf(bo.session.mutation(api.invites.accept, { code: takenBack.code.replace(/.$/, '') }))).toBe('notFound');

    await ada.session.mutation(api.invites.revoke, { inviteId: takenBack.inviteId });
    expect(await refusalOf(bo.session.mutation(api.invites.accept, { code: takenBack.code }))).toBe('notFound');

    vi.setSystemTime(old.expiresAt);
    expect(await refusalOf(bo.session.mutation(api.invites.accept, { code: old.code }))).toBe('inviteExpired');
    expect(await bo.session.query(api.worlds.mayEnter, { worldId })).toEqual({ allowed: false, reason: 'notAllowed' });
    // Making the next invite clears the one that ran out.
    await ada.session.mutation(api.invites.create, { worldId });
    expect((await ada.session.query(api.invites.forWorld, { worldId })).map((invite) => invite.code)).not.toContain(old.code);
  });

  test('a solo world has no invites, a world holds only so many open ones, and a full world lets nobody in', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const soloId = await t.run((ctx) => ctx.db.insert('worlds', { ownerId: ada.id, name: 'My plot', kind: 'solo', lastPlayedAt: 0, playersNow: [] }));
    expect(await refusalOf(ada.session.mutation(api.invites.create, { worldId: soloId }))).toBe('soloWorld');

    const worldId = await ada.session.mutation(api.worlds.create, { name: 'Hollow Oak' });
    const codes: string[] = [];
    for (let i = 0; i < MAX_OPEN_INVITES; i++) codes.push((await ada.session.mutation(api.invites.create, { worldId })).code);
    expect(new Set(codes).size).toBe(MAX_OPEN_INVITES);
    expect(await refusalOf(ada.session.mutation(api.invites.create, { worldId }))).toBe('tooMany');

    for (let i = 0; i < MAX_MEMBERS; i++) {
      const guest = await player(t, `user_guest_${i}`);
      await guest.session.mutation(api.invites.accept, { code: codes[i] });
    }
    const late = await player(t, 'user_late');
    expect(await refusalOf(late.session.mutation(api.invites.accept, { code: codes[MAX_MEMBERS] }))).toBe('worldFull');
  });
});
