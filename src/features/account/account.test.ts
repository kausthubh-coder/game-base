// The account's rules, with stand-ins for Clerk, Convex and localStorage: a guest loads nothing, a save
// changed here goes up, one changed on another device comes down and restarts the game, a conflict waits
// for the player, and an answer for the player before is dropped.
import { describe, expect, test } from 'bun:test';
import type { ViewContext } from '../../engine/system.ts';
import { createAccount, type AccountOptions } from './account.ts';
import { markKey, type CloudSave } from './logic.ts';
import type { Database, Session, SessionUser, UploadLabel, UploadResult } from './session.ts';

const KEY = 'greenhollow.save';
const MARK = markKey(KEY);
const ctx = {} as ViewContext;
const saveText = (day: number, at = 5_000): string => JSON.stringify({ version: 1, at, world: { edits: [] }, game: { clock: { day } } });
const cloud = (day: number, savedAt: number): CloudSave => ({ bytes: 100, savedAt, uploadedAt: savedAt + 1, day });
const markText = (here: number, there: number, player = 'profile_ada'): string => JSON.stringify({ player, here, there });
const ADA: SessionUser = { name: 'Ada Lovelace', email: 'ada@example.com' };

/** Lets every promise that is already settled run its `then`. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Stage {
  options: AccountOptions;
  items: Record<string, string>;
  /** Signs a player in or out, as Clerk's listener would report it. */
  sign(user: SessionUser | null): void;
  /** Sends the account's copy of the save, as Convex's live query would. */
  there(save: CloudSave | null): void;
  calls: string[];
  uploads: { text: string; label: UploadLabel }[];
  /** What the next upload answers, the text a download gives back, and whether Convex accepts the sign-in. */
  uploadResult: UploadResult | Error | null;
  /** A promise holds the download until it settles. */
  download: string | Error | Promise<string>;
  accepts: boolean;
  connects: number;
}

function stage(start: Record<string, string> = {}, keys = true): Stage {
  const items = { ...start };
  let onUser: ((user: SessionUser | null) => void) | null = null;
  let onSave: ((save: CloudSave | null) => void) | null = null;
  const database: Database = {
    async ensureProfile(name) {
      s.calls.push(`ensureProfile ${name}`);
      return { _id: 'profile_ada', name: `${name} (profile)` };
    },
    async rename(name) {
      s.calls.push(`rename ${name}`);
      if (!name.trim()) throw { data: { code: 'badName', message: 'A name needs at least one letter.' } };
      return name.trim();
    },
    watchSave(slot, fn) {
      s.calls.push(`watch ${slot}`);
      onSave = fn;
      return () => { onSave = null; s.calls.push('stop watch'); };
    },
    async uploadSave(text, label) {
      s.uploads.push({ text, label });
      if (s.uploadResult instanceof Error) throw s.uploadResult;
      return s.uploadResult ?? { ok: true, bytes: text.length, savedAt: label.savedAt };
    },
    async downloadSave(slot) {
      s.calls.push(`download ${slot}`);
      if (s.download instanceof Error) throw s.download;
      return await s.download;
    },
  };
  const session: Session = {
    onUser(fn) {
      onUser = fn;
      return () => { onUser = null; };
    },
    openSignIn: () => { s.calls.push('openSignIn'); },
    async signOut() {
      s.calls.push('signOut');
      onUser?.(null);
    },
    async database() {
      if (!s.accepts) throw new Error('Convex did not accept the sign-in');
      return database;
    },
    dispose: () => { s.calls.push('dispose'); },
  };
  const s: Stage = {
    items,
    calls: [],
    uploads: [],
    uploadResult: null,
    download: saveText(9, 8_000),
    accepts: true,
    connects: 0,
    sign: (user) => onUser?.(user),
    there: (save) => onSave?.(save),
    options: {
      clerkKey: keys ? 'pk_test_x' : undefined,
      convexUrl: keys ? 'https://example.convex.cloud' : undefined,
      now: () => 10_000,
      syncEvery: 0,
      save: {
        key: KEY,
        storage: { getItem: (key) => items[key] ?? null, setItem: (key, value) => { items[key] = value; } },
        flush: () => { s.calls.push('flush'); },
        restart: () => { s.calls.push('restart'); },
      },
      async connect() {
        s.connects++;
        return session;
      },
    },
  };
  return s;
}

/** Signs Ada in and sends the account's copy of the save, then lets the sync that follows run. */
async function signedIn(s: Stage, there: CloudSave | null = null) {
  const account = createAccount(ctx, s.options);
  await account.connect();
  s.sign(ADA);
  await settle();
  s.there(there);
  await settle();
  return account;
}

describe('a guest', () => {
  test('with no keys the account is off and never connects', async () => {
    const s = stage({ [KEY]: saveText(3) }, false);
    const account = createAccount(ctx, s.options);
    expect(account.state.status).toBe('off');
    await account.connect();
    account.open();
    await account.sync();
    expect(account.state.status).toBe('off');
    expect(s.connects).toBe(0);
    expect(s.uploads).toEqual([]);
    expect(s.items).toEqual({ [KEY]: saveText(3) });
  });

  test('with keys nothing is loaded until the account is asked to connect', async () => {
    const s = stage({ [KEY]: saveText(3) });
    const account = createAccount(ctx, s.options);
    expect(account.state.status).toBe('guest');
    expect(s.connects).toBe(0);
    await account.connect();
    await account.connect();
    expect(s.connects).toBe(1);
    s.sign(null);
    expect(account.state).toMatchObject({ status: 'signedOut', name: null, cloud: undefined });
    await account.sync();
    expect(s.uploads).toEqual([]);
  });

  test('when Clerk cannot be reached the account says so and can be tried again', async () => {
    const s = stage();
    let fail = true;
    const connect = s.options.connect!;
    s.options.connect = (keys) => (fail ? Promise.reject(new Error('offline')) : connect(keys));
    const warn = console.warn;
    console.warn = () => {};
    const account = createAccount(ctx, s.options);
    await account.connect();
    console.warn = warn;
    expect(account.state.status).toBe('failed');
    fail = false;
    await account.connect();
    expect(account.state.status).toBe('loading');
    expect(s.connects).toBe(1);
  });
});

describe('signed in', () => {
  test('the profile is made, then the account\'s copy of this save is watched', async () => {
    const s = stage();
    const account = createAccount(ctx, s.options);
    await account.connect();
    s.sign(ADA);
    expect(account.state).toMatchObject({ status: 'signedIn', name: 'Ada Lovelace', email: 'ada@example.com', ready: false, cloud: undefined });
    await settle();
    expect(s.calls).toEqual(['ensureProfile Ada Lovelace', `watch ${KEY}`]);
    expect(account.state).toMatchObject({ name: 'Ada Lovelace (profile)', ready: true, cloud: undefined });
    s.there(cloud(4, 7_000));
    expect(account.state.cloud).toEqual(cloud(4, 7_000));
  });

  test('a sign-in Convex does not accept leaves the player signed in, with the reason, and sends nothing', async () => {
    const s = stage({ [KEY]: saveText(3) });
    s.accepts = false;
    const account = await signedIn(s);
    expect(account.state).toMatchObject({ status: 'signedIn', ready: false, note: { kind: 'problem' } });
    await account.sync();
    expect(s.uploads).toEqual([]);
  });

  test('signing out sends what was played first, then forgets the player and stops watching', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(4_000, 4_000) });
    const account = await signedIn(s, cloud(2, 4_000));
    s.uploads.length = 0;
    s.items[KEY] = saveText(3, 6_000);
    await account.signOut();
    expect(s.uploads.map((u) => u.label.savedAt)).toEqual([6_000]);
    expect(s.calls).toContain('stop watch');
    expect(account.state).toMatchObject({ status: 'signedOut', name: null, email: null, ready: false, cloud: undefined, busy: null });
    // The save stays in this browser.
    expect(s.items[KEY]).toBe(saveText(3, 6_000));
  });

  test('a rename is stored as Convex returns it, and a refused one says why', async () => {
    const s = stage();
    const account = await signedIn(s);
    expect(await account.rename('  Ada  ')).toBe(true);
    expect(account.state).toMatchObject({ name: 'Ada', busy: null, note: null });
    expect(await account.rename('   ')).toBe(false);
    expect(account.state).toMatchObject({ name: 'Ada', busy: null, note: { kind: 'problem', text: 'A name needs at least one letter.' } });
  });

  test('opening sign-in writes the game down first', async () => {
    const s = stage();
    const account = createAccount(ctx, s.options);
    await account.connect();
    s.sign(null);
    account.signIn();
    expect(s.calls).toEqual(['flush', 'openSignIn']);
  });
});

describe('the save goes up', () => {
  test('the first sign-in with a save here and none in the account sends it, and marks them matched', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000) });
    const account = await signedIn(s, null);
    expect(s.uploads).toEqual([{ text: saveText(3, 5_000), label: { slot: KEY, savedAt: 5_000, day: 3, over: null } }]);
    expect(JSON.parse(s.items[MARK])).toEqual({ player: 'profile_ada', here: 5_000, there: 5_000 });
    expect(account.state).toMatchObject({ sync: 'idle', note: null, conflict: null });
    expect(s.calls).not.toContain('restart');
  });

  test('a save that changed here since they matched goes up over the copy it was matched with', async () => {
    const s = stage({ [KEY]: saveText(5, 9_000), [MARK]: markText(5_000, 5_100) });
    await signedIn(s, cloud(3, 5_100));
    expect(s.uploads.map((u) => u.label)).toEqual([{ slot: KEY, savedAt: 9_000, day: 5, over: 5_100 }]);
    // The account dated it to its own clock: the mark keeps both sides.
    expect(JSON.parse(s.items[MARK])).toEqual({ player: 'profile_ada', here: 9_000, there: 9_000 });
  });

  test('when nothing changed nothing is sent, and a later look sends what was played since', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
    const account = await signedIn(s, cloud(3, 5_000));
    expect(s.uploads).toEqual([]);
    s.items[KEY] = saveText(4, 6_000);
    await account.sync();
    expect(s.uploads.map((u) => u.label.savedAt)).toEqual([6_000]);
  });

  test('a save the account finds too big is kept here, said, and not sent again', async () => {
    const s = stage({ [KEY]: saveText(3) });
    s.uploadResult = { ok: false, reason: 'tooBig', bytes: 9_000_000, limit: 8_388_608 };
    const account = await signedIn(s, null);
    expect(account.state.note).toEqual({ kind: 'problem', text: 'This save is too big for your account. It is 9.0 MB and the limit is 8.4 MB. It is kept in this browser.' });
    await account.sync();
    expect(s.uploads).toHaveLength(1);
    expect(s.items[MARK]).toBeUndefined();
  });

  test('an upload that fails is said, and the next look tries again', async () => {
    const s = stage({ [KEY]: saveText(3) });
    s.uploadResult = new Error('offline');
    const account = await signedIn(s, null);
    expect(account.state).toMatchObject({ sync: 'idle', note: { kind: 'problem' } });
    s.uploadResult = null;
    await account.sync();
    expect(s.uploads).toHaveLength(2);
    expect(s.items[MARK]).toBeDefined();
  });

  test('an upload another device beat is dropped, and the newer copy that arrives is asked about', async () => {
    const s = stage({ [KEY]: saveText(5, 9_000), [MARK]: markText(5_000, 5_000) });
    s.uploadResult = { ok: false, reason: 'stale', savedAt: 8_000 };
    const account = await signedIn(s, cloud(3, 5_000));
    expect(s.items[MARK]).toBe(markText(5_000, 5_000));
    s.there(cloud(6, 8_000));
    await settle();
    expect(account.state.conflict).toEqual({ here: { at: 9_000, day: 5, bytes: saveText(5, 9_000).length }, there: cloud(6, 8_000) });
  });

  test('a save here that is not one is not sent', async () => {
    const s = stage({ [KEY]: 'not a save' });
    const account = await signedIn(s, null);
    expect(s.uploads).toEqual([]);
    expect(account.state.note?.kind).toBe('problem');
  });
});

describe('the save comes down', () => {
  test('on a device with no save the account\'s is put here and the game restarts from it', async () => {
    const s = stage();
    const account = await signedIn(s, cloud(9, 8_000));
    expect(s.calls).toEqual(['ensureProfile Ada Lovelace', `watch ${KEY}`, `download ${KEY}`, 'restart']);
    expect(s.items[KEY]).toBe(saveText(9, 8_000));
    expect(JSON.parse(s.items[MARK])).toEqual({ player: 'profile_ada', here: 8_000, there: 8_000 });
    expect(account.state.note?.kind).toBe('done');
    expect(s.uploads).toEqual([]);
  });

  test('a save another device sent while this one sat still comes down, and the one it replaces is kept aside', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
    await signedIn(s, cloud(3, 5_000));
    expect(s.calls).not.toContain('restart');
    s.there(cloud(9, 8_000));
    await settle();
    expect(s.items[KEY]).toBe(saveText(9, 8_000));
    expect(s.items[`${KEY}.before-restore`]).toBe(saveText(3, 5_000));
    expect(s.calls).toContain('restart');
  });

  test('once the game is starting again from the fetched save, nothing here is sent over it', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
    const account = await signedIn(s, cloud(9, 8_000));
    expect(s.calls).toContain('restart');
    // The running game is written as the page unloads, after the fetched save was put back.
    s.items[KEY] = saveText(3, 9_000);
    const before = s.calls.length;
    await account.sync();
    account.open();
    await settle();
    expect(s.uploads).toEqual([]);
    expect(s.calls.slice(before)).not.toContain('flush');
  });

  test('a download that cannot be read or fetched replaces nothing and does not restart', async () => {
    for (const download of ['not a save', new Error('offline')]) {
      const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
      s.download = download;
      const account = await signedIn(s, cloud(9, 8_000));
      expect(s.items[KEY]).toBe(saveText(3, 5_000));
      expect(s.calls).not.toContain('restart');
      expect(account.state).toMatchObject({ sync: 'idle', note: { kind: 'problem' } });
    }
  });

  test('a browser that will not store it replaces nothing and does not restart', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
    s.options.save = { ...s.options.save, storage: { getItem: (key) => s.items[key] ?? null, setItem: () => { throw new Error('QuotaExceededError'); } } };
    const account = await signedIn(s, cloud(9, 8_000));
    expect(s.calls).not.toContain('restart');
    expect(account.state.note?.text).toBe('This browser would not store the save from your account, so the one here was kept.');
  });

  test('a player who signs out while the save is on its way keeps the one here', async () => {
    const s = stage({ [KEY]: saveText(3, 5_000), [MARK]: markText(5_000, 5_000) });
    let release: (text: string) => void = () => {};
    s.download = new Promise<string>((done) => { release = done; });
    const account = await signedIn(s, cloud(9, 8_000));
    expect(account.state.sync).toBe('fetching');
    s.sign(null);
    release(saveText(9, 8_000));
    await settle();
    expect(account.state).toMatchObject({ status: 'signedOut', sync: 'idle' });
    expect(s.items[KEY]).toBe(saveText(3, 5_000));
    expect(s.calls).not.toContain('restart');
  });
});

describe('a conflict', () => {
  test('a guest\'s save and an account save the browser never matched wait for the player', async () => {
    const s = stage({ [KEY]: saveText(2, 9_000) });
    const account = await signedIn(s, cloud(7, 6_000));
    expect(account.state.conflict).toEqual({ here: { at: 9_000, day: 2, bytes: saveText(2, 9_000).length }, there: cloud(7, 6_000) });
    expect(s.uploads).toEqual([]);
    expect(s.calls).not.toContain(`download ${KEY}`);
    // Looks while it waits change nothing.
    await account.sync();
    expect(s.uploads).toEqual([]);
  });

  test('keeping the account\'s puts it here, keeps this browser\'s aside, and restarts', async () => {
    const s = stage({ [KEY]: saveText(2, 9_000) });
    const account = await signedIn(s, cloud(7, 6_000));
    s.download = saveText(7, 6_000);
    await account.keep('there');
    expect(s.items[KEY]).toBe(saveText(7, 6_000));
    expect(s.items[`${KEY}.before-restore`]).toBe(saveText(2, 9_000));
    expect(s.calls.slice(-3)).toEqual(['flush', `download ${KEY}`, 'restart']);
    expect(account.state.conflict).toBeNull();
  });

  test('keeping this browser\'s sends it over the account\'s copy', async () => {
    const s = stage({ [KEY]: saveText(2, 9_000) });
    const account = await signedIn(s, cloud(7, 6_000));
    await account.keep('here');
    expect(s.uploads.map((u) => u.label)).toEqual([{ slot: KEY, savedAt: 9_000, day: 2, over: 6_000 }]);
    expect(account.state.conflict).toBeNull();
    expect(JSON.parse(s.items[MARK])).toEqual({ player: 'profile_ada', here: 9_000, there: 9_000 });
    expect(s.calls).not.toContain('restart');
  });

  test('the same save on both sides is only marked', async () => {
    const s = stage({ [KEY]: saveText(4, 6_000) });
    const account = await signedIn(s, cloud(4, 6_000));
    expect(account.state.conflict).toBeNull();
    expect(s.uploads).toEqual([]);
    expect(JSON.parse(s.items[MARK])).toEqual({ player: 'profile_ada', here: 6_000, there: 6_000 });
  });
});

describe('the end', () => {
  test('dispose lets go of Clerk and stops listening', async () => {
    const s = stage();
    const account = await signedIn(s);
    let heard = 0;
    account.onChange(() => heard++);
    account.dispose();
    expect(s.calls).toContain('dispose');
    expect(s.calls).toContain('stop watch');
    s.sign(null);
    s.there(null);
    expect(heard).toBe(0);
  });
});
