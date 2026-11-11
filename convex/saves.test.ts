import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MAX_SAVES, MAX_SAVE_BYTES } from './model/limits';
import { as, newBackend, player, refusalOf, type Backend } from './test.setup';

const SLOT = 'greenhollow.save';

/** Puts a file in storage, as the browser does when it POSTs a save to the upload address. */
const upload = (t: Backend, text: string): Promise<Id<'_storage'>> => t.run((ctx) => ctx.storage.store(new Blob([text], { type: 'application/json' })));

const fileExists = (t: Backend, storageId: Id<'_storage'>): Promise<boolean> => t.run(async (ctx) => (await ctx.storage.get(storageId)) !== null);

const backUp = (session: ReturnType<typeof as>, storageId: Id<'_storage'>, slot = SLOT) =>
  session.mutation(api.saves.commit, { storageId, slot, name: 'My plot', savedAt: 1_000, day: 3 });

describe('the backup of a solo save', () => {
  test('a signed-out caller uploads, backs up and reads nothing', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await upload(t, '{"version":1}');
    const backup = await backUp(ada.session, storageId);
    if (!backup.ok) throw new Error('the backup was refused');

    expect(await refusalOf(t.mutation(api.saves.uploadUrl, {}))).toBe('signedOut');
    expect(await refusalOf(backUp(t, await upload(t, '{}')))).toBe('signedOut');
    expect(await refusalOf(t.query(api.saves.mine, { slot: SLOT }))).toBe('signedOut');
    expect(await refusalOf(t.query(api.saves.downloadUrl, { worldId: backup.worldId }))).toBe('signedOut');
  });

  test('a signed-in player with no profile yet is refused too', async () => {
    const t = newBackend();
    const fresh = as(t, 'user_new');
    expect(await refusalOf(fresh.mutation(api.saves.uploadUrl, {}))).toBe('noProfile');
    expect(await refusalOf(backUp(fresh, await upload(t, '{}')))).toBe('noProfile');
  });

  test('a backup writes the solo world\'s card and can be fetched again by its owner', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
    expect(await ada.session.mutation(api.saves.uploadUrl, {})).toMatch(/^https?:\/\//);

    const text = JSON.stringify({ version: 1, at: 1_000, world: { edits: [] }, game: {} });
    const storageId = await upload(t, text);
    const backup = await backUp(ada.session, storageId);
    expect(backup).toMatchObject({ ok: true, bytes: text.length });
    if (!backup.ok) return;

    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ worldId: backup.worldId, name: 'My plot', bytes: text.length, savedAt: 1_000, day: 3 });
    const cards = await ada.session.query(api.worlds.list, {});
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ _id: backup.worldId, name: 'My plot', kind: 'solo', role: 'owner', lastPlayedAt: 1_000, backup: { slot: SLOT, bytes: text.length, savedAt: 1_000, day: 3 } });
    expect(await ada.session.query(api.saves.downloadUrl, { worldId: backup.worldId })).toMatch(/^https?:\/\//);
  });

  test('player B cannot read, fetch, replace or claim player A\'s save', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const adaFile = await upload(t, '{"owner":"ada"}');
    const backup = await backUp(ada.session, adaFile);
    if (!backup.ok) throw new Error('the backup was refused');

    // B has no backup in the same slot, sees no card of it, and may not fetch or enter it.
    expect(await bo.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
    expect(await bo.session.query(api.worlds.list, {})).toEqual([]);
    expect(await refusalOf(bo.session.query(api.saves.downloadUrl, { worldId: backup.worldId }))).toBe('forbidden');
    expect(await bo.session.query(api.worlds.mayEnter, { worldId: backup.worldId })).toEqual({ allowed: false, reason: 'notAllowed' });
    expect(await refusalOf(bo.session.mutation(api.worlds.remove, { worldId: backup.worldId }))).toBe('forbidden');

    // B cannot make A's file their own backup, and A cannot back the same file up twice.
    expect(await refusalOf(backUp(bo.session, adaFile))).toBe('forbidden');
    expect(await refusalOf(backUp(ada.session, adaFile, 'greenhollow.save.build'))).toBe('forbidden');

    // B's own backup in the same slot is a different world, and A's is untouched.
    const boBackup = await backUp(bo.session, await upload(t, '{"owner":"bo"}'));
    expect(boBackup.ok && boBackup.worldId).not.toBe(backup.worldId);
    expect(await fileExists(t, adaFile)).toBe(true);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ worldId: backup.worldId, bytes: '{"owner":"ada"}'.length });
  });

  test('a second backup replaces the first and deletes its file', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const first = await upload(t, '{"day":1}');
    const one = await backUp(ada.session, first);
    const second = await upload(t, '{"day":2,"more":true}');
    const two = await ada.session.mutation(api.saves.commit, { storageId: second, slot: SLOT, name: 'Renamed plot', savedAt: 2_000, day: 4 });

    expect(two).toMatchObject({ ok: true, worldId: one.ok ? one.worldId : null, bytes: '{"day":2,"more":true}'.length });
    expect(await fileExists(t, first)).toBe(false);
    expect(await fileExists(t, second)).toBe(true);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ name: 'Renamed plot', savedAt: 2_000, day: 4 });
    expect(await ada.session.query(api.worlds.list, {})).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query('saves').take(5))).toHaveLength(1);
  });

  test('a save from the future is dated now, and a test scene keeps its own backup', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const far = Date.now() + 1e9;
    await ada.session.mutation(api.saves.commit, { storageId: await upload(t, '{}'), slot: SLOT, name: 'My plot', savedAt: far, day: 1 });
    expect((await ada.session.query(api.saves.mine, { slot: SLOT }))?.savedAt).toBeLessThan(far);
    await backUp(ada.session, await upload(t, '{}'), 'greenhollow.save.build');
    expect(await ada.session.query(api.worlds.list, {})).toHaveLength(2);
  });

  test('a file that is too big is deleted and reported', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(MAX_SAVE_BYTES + 1)])));
    expect(await backUp(ada.session, storageId)).toEqual({ ok: false, reason: 'tooBig', bytes: MAX_SAVE_BYTES + 1, limit: MAX_SAVE_BYTES });
    expect(await fileExists(t, storageId)).toBe(false);
    expect(await ada.session.query(api.worlds.list, {})).toEqual([]);
  });

  test('a bad slot, a missing file and too many saves are refused', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await upload(t, '{}');
    for (const slot of ['', 'Has Spaces', '../etc', 'x'.repeat(65)]) expect(await refusalOf(backUp(ada.session, storageId, slot))).toBe('badSlot');
    expect(await refusalOf(ada.session.mutation(api.saves.commit, { storageId, slot: SLOT, name: ' ', savedAt: 0, day: 1 }))).toBe('badName');

    await t.run((ctx) => ctx.storage.delete(storageId));
    expect(await refusalOf(backUp(ada.session, storageId))).toBe('noFile');

    for (let i = 0; i < MAX_SAVES; i++) await backUp(ada.session, await upload(t, '{}'), `greenhollow.save.scene-${i}`);
    expect(await refusalOf(backUp(ada.session, await upload(t, '{}'), 'greenhollow.save.one-more'))).toBe('tooMany');
  });

  test('deleting a solo world deletes its backup and the file', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await upload(t, '{}');
    const backup = await backUp(ada.session, storageId);
    if (!backup.ok) throw new Error('the backup was refused');
    await ada.session.mutation(api.worlds.remove, { worldId: backup.worldId });
    expect(await fileExists(t, storageId)).toBe(false);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
    expect(await refusalOf(ada.session.query(api.saves.downloadUrl, { worldId: backup.worldId }))).toBe('notFound');
  });
});
