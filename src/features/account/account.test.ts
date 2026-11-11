// The account's rules, with stand-ins for Clerk, Convex and localStorage: a guest loads nothing, a backup
// sends the save, a restore keeps the replaced save, and an answer for the player before is dropped.
import { describe, expect, test } from 'bun:test';
import type { ViewContext } from '../../engine/system.ts';
import { createAccount, type AccountOptions } from './account.ts';
import type { WorldCard } from './logic.ts';
import type { BackupLabel, BackupResult, Database, Session, SessionUser } from './session.ts';

const KEY = 'greenhollow.save';
const ctx = {} as ViewContext;
const saveText = (day: number, at = 5_000): string => JSON.stringify({ version: 1, at, world: { edits: [] }, game: { clock: { day } } });
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
  /** Sends the world list, as Convex's live query would. */
  worlds(cards: WorldCard[]): void;
  calls: string[];
  uploads: { text: string; label: BackupLabel }[];
  /** What the next upload answers, the text a download gives back, and whether Convex accepts the sign-in. */
  uploadResult: BackupResult | Error;
  download: string | Error;
  accepts: boolean;
  connects: number;
}

function stage(start: Record<string, string> = {}, keys = true): Stage {
  const items = { ...start };
  let onUser: ((user: SessionUser | null) => void) | null = null;
  let onWorlds: ((cards: WorldCard[]) => void) | null = null;
  const database: Database = {
    async ensureProfile(name) {
      s.calls.push(`ensureProfile ${name}`);
      return { name: `${name} (profile)` };
    },
    async rename(name) {
      s.calls.push(`rename ${name}`);
      if (!name.trim()) throw { data: { code: 'badName', message: 'A name needs at least one letter.' } };
      return name.trim();
    },
    watchWorlds(fn) {
      onWorlds = fn;
      return () => { onWorlds = null; s.calls.push('stop worlds'); };
    },
    async uploadSave(text, label) {
      s.uploads.push({ text, label });
      if (s.uploadResult instanceof Error) throw s.uploadResult;
      return s.uploadResult;
    },
    async downloadSave(worldId) {
      s.calls.push(`download ${worldId}`);
      if (s.download instanceof Error) throw s.download;
      return s.download;
    },
    async createWorld(name) {
      s.calls.push(`createWorld ${name}`);
      return 'world_online';
    },
    async invite(worldId) {
      s.calls.push(`invite ${worldId}`);
      return `CODE${s.calls.length}`;
    },
    async acceptInvite(code) {
      s.calls.push(`accept ${code}`);
      if (code === 'USED') throw { data: { code: 'inviteUsed', message: 'That invite was already used.' } };
      return { worldId: 'world_online', name: 'A world' };
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
    token: async () => 'token-of-ada',
    dispose: () => { s.calls.push('dispose'); },
  };
  const s: Stage = {
    items,
    calls: [],
    uploads: [],
    uploadResult: { ok: true, bytes: 9_376 },
    download: saveText(2),
    accepts: true,
    connects: 0,
    sign: (user) => onUser?.(user),
    worlds: (cards) => onWorlds?.(cards),
    options: {
      clerkKey: keys ? 'pk_test_x' : undefined,
      convexUrl: keys ? 'https://example.convex.cloud' : undefined,
      worldName: 'A plot of your own',
      now: () => 10_000,
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

const backupCard = (day: number): WorldCard => ({
  _id: 'world_solo', name: 'A plot of your own', kind: 'solo', role: 'owner', ownerName: 'Ada', lastPlayedAt: 1, playersNow: [],
  backup: { slot: KEY, bytes: 9_376, savedAt: 1, uploadedAt: 2, day },
});

async function signedIn(s: Stage) {
  const account = createAccount(ctx, s.options);
  await account.connect();
  s.sign(ADA);
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
    await settle();
    expect(account.state.status).toBe('off');
    expect(s.connects).toBe(0);
    expect(await account.backUp()).toBe(false);
    expect(await account.restore()).toBe(false);
    expect(s.items).toEqual({ [KEY]: saveText(3) });
  });

  test('with keys nothing is loaded until the account is asked to connect', async () => {
    const s = stage();
    const account = createAccount(ctx, s.options);
    expect(account.state.status).toBe('guest');
    expect(s.connects).toBe(0);
    await account.connect();
    await account.connect();
    expect(s.connects).toBe(1);
    s.sign(null);
    expect(account.state).toMatchObject({ status: 'signedOut', name: null, worlds: null });
    expect(await account.backUp()).toBe(false);
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
  test('the profile is made, and the worlds arrive live', async () => {
    const s = stage();
    const seen: string[] = [];
    const account = createAccount(ctx, s.options);
    account.onChange((state) => seen.push(`${state.status} ${state.name} ${state.ready}`));
    await account.connect();
    s.sign(ADA);
    expect(account.state).toMatchObject({ status: 'signedIn', name: 'Ada Lovelace', email: 'ada@example.com', ready: false, worlds: null });
    await settle();
    expect(s.calls).toEqual(['ensureProfile Ada Lovelace']);
    expect(account.state).toMatchObject({ name: 'Ada Lovelace (profile)', ready: true, worlds: null });
    s.worlds([backupCard(3)]);
    expect(account.state.worlds).toEqual([backupCard(3)]);
    expect(seen).toEqual(['loading null false', 'signedIn Ada Lovelace false', 'signedIn Ada Lovelace (profile) true', 'signedIn Ada Lovelace (profile) true']);
  });

  test('a sign-in Convex does not accept leaves the player signed in, with the reason, and no backup', async () => {
    const s = stage({ [KEY]: saveText(3) });
    s.accepts = false;
    const account = await signedIn(s);
    expect(account.state).toMatchObject({ status: 'signedIn', ready: false, note: { kind: 'problem' } });
    expect(await account.backUp()).toBe(false);
    expect(s.uploads).toEqual([]);
  });

  test('signing out forgets the player and stops the world list', async () => {
    const s = stage();
    const account = await signedIn(s);
    s.worlds([backupCard(3)]);
    await account.signOut();
    expect(account.state).toMatchObject({ status: 'signedOut', name: null, email: null, ready: false, worlds: null, busy: null });
    expect(s.calls).toContain('stop worlds');
    expect(await account.restore()).toBe(false);
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

describe('backing up', () => {
  test('the save in this browser is written, then sent with its slot, day and time', async () => {
    const s = stage({ [KEY]: saveText(3, 7_000) });
    const account = await signedIn(s);
    s.calls.length = 0;
    expect(await account.backUp()).toBe(true);
    expect(s.calls).toEqual(['flush']);
    expect(s.uploads).toEqual([{ text: saveText(3, 7_000), label: { slot: KEY, name: 'A plot of your own', savedAt: 7_000, day: 3 } }]);
    expect(account.state).toMatchObject({ busy: null, note: { kind: 'done', text: 'Backed up day 3, 9 KB.' } });
    expect(account.localSave()).toMatchObject({ day: 3, at: 7_000 });
  });

  test('nothing saved, or a save that is not one, is not sent', async () => {
    const s = stage();
    const account = await signedIn(s);
    expect(await account.backUp()).toBe(false);
    expect(account.state.note).toEqual({ kind: 'problem', text: 'There is nothing to back up yet. Play a little first.' });
    s.items[KEY] = '{"version":7}';
    expect(await account.backUp()).toBe(false);
    expect(s.uploads).toEqual([]);
    expect(account.localSave()).toBeNull();
  });

  test('a save Convex finds too big, and an upload that fails, are reported', async () => {
    const s = stage({ [KEY]: saveText(3) });
    const account = await signedIn(s);
    s.uploadResult = { ok: false, reason: 'tooBig', bytes: 9_000_000, limit: 8_388_608 };
    expect(await account.backUp()).toBe(false);
    expect(account.state.note).toEqual({ kind: 'problem', text: 'This world is too big to back up. It is 9.0 MB and the limit is 8.4 MB.' });
    s.uploadResult = new Error('offline');
    expect(await account.backUp()).toBe(false);
    expect(account.state).toMatchObject({ busy: null, note: { kind: 'problem', text: 'The backup did not go through. Check the connection and try again.' } });
  });

  test('a second press while one backup is under way does nothing', async () => {
    const s = stage({ [KEY]: saveText(3) });
    const account = await signedIn(s);
    const first = account.backUp();
    expect(account.state.busy).toBe('backup');
    expect(await account.backUp()).toBe(false);
    expect(await first).toBe(true);
    expect(s.uploads).toHaveLength(1);
  });
});

describe('restoring', () => {
  test('the backup replaces the save, the replaced save is kept under another key, and the game restarts', async () => {
    const s = stage({ [KEY]: saveText(5) });
    const account = await signedIn(s);
    s.worlds([backupCard(2)]);
    s.calls.length = 0;
    expect(await account.restore()).toBe(true);
    expect(s.calls).toEqual(['download world_solo', 'flush', 'restart']);
    expect(s.items).toEqual({ [KEY]: saveText(2), [`${KEY}.before-restore`]: saveText(5) });
  });

  test('on a device with no save there is nothing to keep aside', async () => {
    const s = stage();
    const account = await signedIn(s);
    s.worlds([backupCard(2)]);
    expect(await account.restore()).toBe(true);
    expect(s.items).toEqual({ [KEY]: saveText(2) });
  });

  test('with no backup of this slot there is nothing to restore', async () => {
    const s = stage({ [KEY]: saveText(5) });
    const account = await signedIn(s);
    expect(await account.restore()).toBe(false);
    s.worlds([{ ...backupCard(2), backup: { ...backupCard(2).backup!, slot: 'greenhollow.save.build' } }]);
    expect(await account.restore()).toBe(false);
    expect(s.calls).not.toContain('restart');
    expect(s.items).toEqual({ [KEY]: saveText(5) });
  });

  test('a backup that cannot be read or fetched replaces nothing', async () => {
    const s = stage({ [KEY]: saveText(5) });
    const account = await signedIn(s);
    s.worlds([backupCard(2)]);
    s.download = '<html>not a save</html>';
    expect(await account.restore()).toBe(false);
    expect(account.state.note).toEqual({ kind: 'problem', text: 'The backup could not be read, so nothing was replaced.' });
    s.download = new Error('offline');
    expect(await account.restore()).toBe(false);
    expect(s.calls).not.toContain('restart');
    expect(s.items).toEqual({ [KEY]: saveText(5) });
  });

  test('a browser that will not store the backup replaces nothing and does not restart', async () => {
    const s = stage({ [KEY]: saveText(5) });
    s.options.save = { ...s.options.save, storage: { getItem: (key) => s.items[key] ?? null, setItem: () => { throw new Error('QuotaExceededError'); } } };
    const account = await signedIn(s);
    s.worlds([backupCard(2)]);
    expect(await account.restore()).toBe(false);
    expect(account.state.note?.text).toBe('This browser would not store the backup, so nothing was replaced.');
    expect(s.calls).not.toContain('restart');
    expect(s.items).toEqual({ [KEY]: saveText(5) });
  });

  test('a player who signs out while the backup is on its way keeps their world', async () => {
    const s = stage({ [KEY]: saveText(5) });
    const account = await signedIn(s);
    s.worlds([backupCard(2)]);
    const restoring = account.restore();
    s.sign(null);
    expect(await restoring).toBe(false);
    expect(s.calls).not.toContain('restart');
    expect(s.items).toEqual({ [KEY]: saveText(5) });
  });
});

describe('playing together', () => {
  const online = (s: Stage, entered: string[]): void => {
    s.options.online = { address: (world, invite) => `https://game.example/?world=${world}${invite ? `&invite=${invite}` : ''}`, enter: (world) => entered.push(world) };
  };

  test('Play together makes an online world and a link that lets one friend in', async () => {
    const s = stage();
    const entered: string[] = [];
    online(s, entered);
    const account = await signedIn(s);
    expect(await account.playTogether()).toBe(true);
    expect(s.calls).toContain('createWorld Ada Lovelace (profile)\'s world');
    expect(s.calls).toContain('invite world_online');
    expect(account.state.link?.url).toMatch(/^https:\/\/game\.example\/\?world=world_online&invite=CODE\d+$/);
    const first = account.state.link?.url;
    expect(await account.inviteTo('world_online')).toBe(true);
    expect(account.state.link?.url).not.toBe(first);
    account.enter('world_online');
    expect(entered).toEqual(['world_online']);
  });

  test('without a way to open online worlds there is no Play together', async () => {
    const s = stage();
    const account = await signedIn(s);
    expect(account.online).toBe(false);
    expect(await account.playTogether()).toBe(false);
    expect(s.calls.some((call) => call.startsWith('createWorld'))).toBe(false);
  });

  test('an invite that was used says so, and the token is the signed-in player\'s', async () => {
    const s = stage();
    const account = await signedIn(s);
    expect(await account.acceptInvite('USED')).toBe(false);
    expect(account.state.note?.text).toBe('That invite was already used.');
    expect(await account.acceptInvite('GOOD')).toBe(true);
    expect(await account.token()).toBe('token-of-ada');
    s.sign(null);
    await settle();
    expect(account.state.link).toBeNull();
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
    s.sign(null);
    s.worlds([]);
    expect(heard).toBe(0);
  });
});
