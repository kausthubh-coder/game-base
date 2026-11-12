import { describe, expect, test } from 'bun:test';
import { agoText, asideKey, clerkAddress, markKey, readMark, readSaveText, refusalText, replaceSave, sizeText, syncStep, writeMark, type SaveStorage } from './logic.ts';

const SAVE = JSON.stringify({ version: 1, at: 5_000, world: { version: 1, seed: 1, edits: [] }, game: { version: 1, clock: { day: 3, timeOfDay: 0.4, seconds: 900 } }, shell: { wheat: 2, blocks: 5 } });

/** localStorage as a map. `full` makes every write fail, as a full disk or a private window does. */
function storage(start: Record<string, string> = {}, full = false): SaveStorage & { items: Record<string, string> } {
  const items = { ...start };
  return {
    items,
    getItem: (key) => items[key] ?? null,
    setItem(key, value) {
      if (full) throw new Error('QuotaExceededError');
      items[key] = value;
    },
  };
}

describe('reading a save', () => {
  test('the facts of a save the game wrote', () => {
    expect(readSaveText(SAVE)).toEqual({ at: 5_000, day: 3, bytes: SAVE.length });
  });

  test('bytes are counted as the file is sent, not as letters', () => {
    const text = JSON.stringify({ version: 1, at: 1, world: {}, game: { note: 'é' } });
    expect(readSaveText(text)?.bytes).toBe(text.length + 1);
  });

  test('anything else is not a save', () => {
    for (const text of ['', 'not json', 'null', '[]', '{}', '{"version":2,"world":{},"game":{}}', '{"version":1,"world":{}}', '{"version":1,"world":[],"game":{}}', '{"version":1,"world":{},"game":null}']) {
      expect(readSaveText(text), text).toBeNull();
    }
  });

  test('a save with no clock or time still reads, as day 1', () => {
    expect(readSaveText('{"version":1,"world":{},"game":{}}')).toMatchObject({ at: 0, day: 1 });
  });
});

describe('replacing a save', () => {
  test('the replaced save is kept under another key', () => {
    const store = storage({ 'greenhollow.save': 'old world', other: 'untouched' });
    expect(replaceSave(store, 'greenhollow.save', 'restored world')).toBe(true);
    expect(store.items).toEqual({ 'greenhollow.save': 'restored world', 'greenhollow.save.before-restore': 'old world', other: 'untouched' });
    expect(asideKey('greenhollow.save.build')).toBe('greenhollow.save.build.before-restore');
  });

  test('with no save to replace, nothing is kept aside', () => {
    const store = storage();
    expect(replaceSave(store, 'greenhollow.save', 'restored world')).toBe(true);
    expect(store.items).toEqual({ 'greenhollow.save': 'restored world' });
  });

  test('restoring the same save twice does not lose the world kept the first time', () => {
    const store = storage({ 'greenhollow.save': 'old world' });
    replaceSave(store, 'greenhollow.save', 'restored world');
    replaceSave(store, 'greenhollow.save', 'restored world');
    expect(store.items['greenhollow.save.before-restore']).toBe('old world');
  });

  test('a browser that will not store it replaces nothing', () => {
    const store = storage({ 'greenhollow.save': 'old world' }, true);
    expect(replaceSave(store, 'greenhollow.save', 'restored world')).toBe(false);
    expect(store.items).toEqual({ 'greenhollow.save': 'old world' });
  });
});

describe('which way the save goes', () => {
  const ADA = 'profile_ada';
  const here = (at: number) => ({ at });
  const there = (savedAt: number) => ({ savedAt });
  const mark = (h: number, t: number, player = ADA) => ({ player, here: h, there: t });

  test('with a save on one side only, it goes to the other', () => {
    expect(syncStep(null, null, null, ADA)).toBe('none');
    expect(syncStep(here(5), null, null, ADA)).toBe('send');
    expect(syncStep(null, there(5), null, ADA)).toBe('fetch');
    // A mark from before, when the account's copy is gone: this browser's goes up again.
    expect(syncStep(here(5), null, mark(5, 5), ADA)).toBe('send');
  });

  test('after they matched, the side that changed wins', () => {
    expect(syncStep(here(5), there(6), mark(5, 6), ADA)).toBe('none');
    expect(syncStep(here(9), there(6), mark(5, 6), ADA)).toBe('send');
    expect(syncStep(here(5), there(9), mark(5, 6), ADA)).toBe('fetch');
    // An older save on the other device is still a change: the mark says what was agreed, not which is newer.
    expect(syncStep(here(5), there(2), mark(5, 6), ADA)).toBe('fetch');
  });

  test('when both changed since they matched, the player is asked', () => {
    expect(syncStep(here(9), there(8), mark(5, 6), ADA)).toBe('ask');
  });

  test('a save this browser never matched with this account is asked about, unless it is the same save', () => {
    // A guest's game, then the first sign-in on this device.
    expect(syncStep(here(9), there(8), null, ADA)).toBe('ask');
    // A mark of another player who signed in on this browser.
    expect(syncStep(here(5), there(6), mark(5, 6, 'profile_bo'), ADA)).toBe('ask');
    expect(syncStep(here(8), there(8), null, ADA)).toBe('same');
  });

  test('the mark is kept beside the save and read back, and anything else is no mark', () => {
    const store = storage();
    expect(readMark(store, 'greenhollow.save')).toBeNull();
    expect(writeMark(store, 'greenhollow.save', mark(5, 6))).toBe(true);
    expect(markKey('greenhollow.save')).toBe('greenhollow.save.synced');
    expect(readMark(store, 'greenhollow.save')).toEqual(mark(5, 6));
    for (const text of ['', 'null', '{"player":1,"here":2,"there":3}', '[1,2]', 'not json']) {
      store.items['greenhollow.save.synced'] = text;
      expect(readMark(store, 'greenhollow.save')).toBeNull();
    }
    expect(writeMark(storage({}, true), 'greenhollow.save', mark(5, 6))).toBe(false);
  });
});

describe('the words on the panel', () => {
  test('how long ago', () => {
    const now = 1_000_000_000_000;
    const ago = (seconds: number): string => agoText(now - seconds * 1000, now);
    expect([0, 59, 60, 119, 120, 3599, 3600, 7200, 86399].map(ago)).toEqual(['just now', 'just now', '1 minute ago', '1 minute ago', '2 minutes ago', '59 minutes ago', '1 hour ago', '2 hours ago', '23 hours ago']);
    expect([86400, 2 * 86400, 59 * 86400, 60 * 86400, 400 * 86400].map(ago)).toEqual(['yesterday', '2 days ago', '59 days ago', '2 months ago', '13 months ago']);
    // A clock that is a little ahead on the other device is not "in the future".
    expect(agoText(now + 5000, now)).toBe('just now');
  });

  test('a file size', () => {
    expect([0, 1, 999, 1000, 9376, 376_383, 999_499, 1_466_238].map(sizeText)).toEqual(['0 bytes', '1 byte', '999 bytes', '1 KB', '9 KB', '376 KB', '999 KB', '1.5 MB']);
  });

  test('why Convex refused, in the player\'s words', () => {
    expect(refusalText({ data: { code: 'tooMany', message: 'You have too many saves.' } }, 'fallback')).toBe('You have too many saves.');
    expect(refusalText({ data: { code: 'signedOut', message: 'Sign in first.' } }, 'fallback')).toBe('You are signed out. Sign in and try again.');
    for (const error of [new Error('network'), null, 'text', { data: 'text' }, { data: {} }]) expect(refusalText(error, 'fallback')).toBe('fallback');
  });
});

describe('a Clerk publishable key', () => {
  test('holds the address of the Clerk instance', () => {
    expect(clerkAddress(`pk_test_${btoa('wealthy-raptor-5827.clerk.accounts.dev$')}`)).toBe('wealthy-raptor-5827.clerk.accounts.dev');
    expect(clerkAddress(`pk_live_${btoa('clerk.example.com$')}`)).toBe('clerk.example.com');
  });

  test('anything else is not a key', () => {
    for (const key of ['', 'pk_test_', 'sk_test_abc', 'pk_test_!!!', `pk_test_${btoa('no-dollar.example.com')}`, `pk_test_${btoa('evil.example.com/path$')}`]) expect(clerkAddress(key), key).toBeNull();
  });
});
