import { describe, expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { MAX_SAVES, MAX_SAVE_BYTES } from './model/limits';
import { as, newBackend, player, refusalOf, type Backend } from './test.setup';

const SLOT = 'greenhollow.save';

/** Puts a file in storage, as the browser does when it POSTs a save to the upload address. */
const upload = (t: Backend, text: string): Promise<Id<'_storage'>> => t.run((ctx) => ctx.storage.store(new Blob([text], { type: 'application/json' })));

const fileExists = (t: Backend, storageId: Id<'_storage'>): Promise<boolean> => t.run(async (ctx) => (await ctx.storage.get(storageId)) !== null);

const commit = (session: ReturnType<typeof as>, storageId: Id<'_storage'>, { slot = SLOT, savedAt = 1_000, day = 3, over = null as number | null } = {}) =>
  session.mutation(api.saves.commit, { storageId, slot, savedAt, day, over });

describe('the cloud copy of a save', () => {
  test('a signed-out caller uploads, saves and reads nothing', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    await commit(ada.session, await upload(t, '{"version":1}'));

    expect(await refusalOf(t.mutation(api.saves.uploadUrl, {}))).toBe('signedOut');
    expect(await refusalOf(commit(t, await upload(t, '{}')))).toBe('signedOut');
    expect(await refusalOf(t.query(api.saves.mine, { slot: SLOT }))).toBe('signedOut');
    expect(await refusalOf(t.query(api.saves.downloadUrl, { slot: SLOT }))).toBe('signedOut');
  });

  test('a signed-in player with no profile yet is refused too', async () => {
    const t = newBackend();
    const fresh = as(t, 'user_new');
    expect(await refusalOf(fresh.mutation(api.saves.uploadUrl, {}))).toBe('noProfile');
    expect(await refusalOf(commit(fresh, await upload(t, '{}')))).toBe('noProfile');
  });

  test('a save is kept and can be fetched again by its owner', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
    expect(await refusalOf(ada.session.query(api.saves.downloadUrl, { slot: SLOT }))).toBe('notFound');
    expect(await ada.session.mutation(api.saves.uploadUrl, {})).toMatch(/^https?:\/\//);

    const text = JSON.stringify({ version: 1, at: 1_000, world: { edits: [] }, game: {} });
    expect(await commit(ada.session, await upload(t, text))).toEqual({ ok: true, bytes: text.length, savedAt: 1_000 });
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ bytes: text.length, savedAt: 1_000, day: 3 });
    expect(await ada.session.query(api.saves.downloadUrl, { slot: SLOT })).toMatch(/^https?:\/\//);
  });

  test('player B cannot read, fetch, replace or claim player A\'s save', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const bo = await player(t, 'user_bo');
    const adaFile = await upload(t, '{"owner":"ada"}');
    await commit(ada.session, adaFile);

    expect(await bo.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
    expect(await refusalOf(bo.session.query(api.saves.downloadUrl, { slot: SLOT }))).toBe('notFound');

    // B cannot make A's file their own save, and A cannot use the same file twice.
    expect(await refusalOf(commit(bo.session, adaFile))).toBe('forbidden');
    expect(await refusalOf(commit(ada.session, adaFile, { slot: 'greenhollow.save.build' }))).toBe('forbidden');

    // B's own save in the same slot is theirs, and A's is untouched.
    await commit(bo.session, await upload(t, '{"owner":"bo"}'), { savedAt: 5_000 });
    expect(await fileExists(t, adaFile)).toBe(true);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ bytes: '{"owner":"ada"}'.length, savedAt: 1_000 });
    expect(await bo.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ savedAt: 5_000 });
  });

  test('a save over the copy the browser saw replaces it and deletes its file', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const first = await upload(t, '{"day":1}');
    await commit(ada.session, first);
    const second = await upload(t, '{"day":2,"more":true}');

    expect(await commit(ada.session, second, { savedAt: 2_000, day: 4, over: 1_000 })).toEqual({ ok: true, bytes: '{"day":2,"more":true}'.length, savedAt: 2_000 });
    expect(await fileExists(t, first)).toBe(false);
    expect(await fileExists(t, second)).toBe(true);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ savedAt: 2_000, day: 4 });
    expect(await t.run((ctx) => ctx.db.query('saves').take(5))).toHaveLength(1);
  });

  test('a save over a copy the browser never saw is refused as stale, and the newer one is kept', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    // The phone saved at 2,000. The laptop last saw the copy from 1,000, or none at all.
    const phone = await upload(t, '{"from":"phone"}');
    await commit(ada.session, phone, { savedAt: 2_000 });
    for (const over of [1_000, null]) {
      const laptop = await upload(t, '{"from":"laptop"}');
      expect(await commit(ada.session, laptop, { savedAt: 3_000, over })).toEqual({ ok: false, reason: 'stale', savedAt: 2_000 });
      expect(await fileExists(t, laptop)).toBe(false);
    }
    expect(await fileExists(t, phone)).toBe(true);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toMatchObject({ savedAt: 2_000 });
  });

  test('a save from the future is dated now, and a test scene keeps its own save', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const far = Date.now() + 1e9;
    await commit(ada.session, await upload(t, '{}'), { savedAt: far, day: 1 });
    expect((await ada.session.query(api.saves.mine, { slot: SLOT }))?.savedAt).toBeLessThan(far);
    await commit(ada.session, await upload(t, '{}'), { slot: 'greenhollow.save.build', savedAt: 7 });
    expect(await ada.session.query(api.saves.mine, { slot: 'greenhollow.save.build' })).toMatchObject({ savedAt: 7 });
    expect(await t.run((ctx) => ctx.db.query('saves').take(5))).toHaveLength(2);
  });

  test('a file that is too big is deleted and reported', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(MAX_SAVE_BYTES + 1)])));
    expect(await commit(ada.session, storageId)).toEqual({ ok: false, reason: 'tooBig', bytes: MAX_SAVE_BYTES + 1, limit: MAX_SAVE_BYTES });
    expect(await fileExists(t, storageId)).toBe(false);
    expect(await ada.session.query(api.saves.mine, { slot: SLOT })).toBeNull();
  });

  test('a bad slot, a missing file and too many saves are refused', async () => {
    const t = newBackend();
    const ada = await player(t, 'user_ada');
    const storageId = await upload(t, '{}');
    for (const slot of ['', 'Has Spaces', '../etc', 'x'.repeat(65)]) expect(await refusalOf(commit(ada.session, storageId, { slot }))).toBe('badSlot');

    await t.run((ctx) => ctx.storage.delete(storageId));
    expect(await refusalOf(commit(ada.session, storageId))).toBe('noFile');

    for (let i = 0; i < MAX_SAVES; i++) await commit(ada.session, await upload(t, '{}'), { slot: `greenhollow.save.scene-${i}` });
    expect(await refusalOf(commit(ada.session, await upload(t, '{}'), { slot: 'greenhollow.save.one-more' }))).toBe('tooMany');
  });
});
