// The parts of the account with no page and no network in them: reading a save's text, deciding which way
// a save goes, the words on the panel, and swapping a save for the account's. Tested in logic.test.ts.

/** The account's copy of a save, as `saves.mine` in convex/saves.ts returns it. */
export interface CloudSave {
  bytes: number;
  /** When the browser that sent it wrote it, and when it reached the account. Milliseconds since 1970. */
  savedAt: number;
  uploadedAt: number;
  day: number;
}

/** What a save's text says about itself. */
export interface SaveFacts {
  /** When it was written, in milliseconds since 1970. */
  at: number;
  /** The day on the game's clock. */
  day: number;
  /** Its size as a file. */
  bytes: number;
}

/** Where a save's text is kept: `localStorage`, or a stand-in for it in a test. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The facts of a save, or null when the text is not a save this game loads. It asks for what
 * `readSave` in src/game/shell/save.ts asks for: version 1, a world and a game.
 */
export function readSaveText(text: string): SaveFacts | null {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(file) || file.version !== 1 || !isObject(file.world) || !isObject(file.game)) return null;
  const clock = isObject(file.game.clock) ? file.game.clock : {};
  return {
    at: typeof file.at === 'number' && Number.isFinite(file.at) ? file.at : 0,
    day: typeof clock.day === 'number' && Number.isFinite(clock.day) ? clock.day : 1,
    bytes: new TextEncoder().encode(text).length,
  };
}

/** The key a replaced save is kept under. */
export const asideKey = (key: string): string => `${key}.before-restore`;

/** The key the last time this browser and the account agreed is kept under. */
export const markKey = (key: string): string => `${key}.synced`;

/**
 * The last time this browser's save and the account's were the same save: whose account, the `at` of the
 * save here and the `savedAt` of the copy there. A save that differs from its side of the mark has changed
 * since. Both sides are kept because the account dates a save from a fast clock to its own time.
 */
export interface SyncMark {
  player: string;
  here: number;
  there: number;
}

export function readMark(storage: SaveStorage, key: string): SyncMark | null {
  try {
    const mark = JSON.parse(storage.getItem(markKey(key)) ?? 'null') as unknown;
    if (!isObject(mark) || typeof mark.player !== 'string' || typeof mark.here !== 'number' || typeof mark.there !== 'number') return null;
    return { player: mark.player, here: mark.here, there: mark.there };
  } catch {
    return null;
  }
}

/** False when the browser would not store it. The next sign-in then asks once more. */
export function writeMark(storage: SaveStorage, key: string, mark: SyncMark): boolean {
  try {
    storage.setItem(markKey(key), JSON.stringify(mark));
    return true;
  } catch {
    return false;
  }
}

/**
 * Which way the save goes between this browser and the account. `send` the save here, `fetch` the account's,
 * `ask` the player because both changed, or one is a stranger to the other. `same`: nothing to move, but the
 * mark is new. `none`: nothing to do.
 */
export type SyncStep = 'send' | 'fetch' | 'ask' | 'same' | 'none';

export function syncStep(here: Pick<SaveFacts, 'at'> | null, there: Pick<CloudSave, 'savedAt'> | null, mark: SyncMark | null, player: string): SyncStep {
  if (!there) return here ? 'send' : 'none';
  if (!here) return 'fetch';
  // A save this browser never matched with this account: a guest's game, or another player's.
  if (!mark || mark.player !== player) return here.at === there.savedAt ? 'same' : 'ask';
  const changedHere = here.at !== mark.here;
  const changedThere = there.savedAt !== mark.there;
  if (changedHere && changedThere) return 'ask';
  if (changedHere) return 'send';
  if (changedThere) return 'fetch';
  return 'none';
}

/**
 * Puts `text` where the save is, and first copies the save it replaces to `asideKey(key)`. False when the
 * browser would not store one of them. Then nothing was replaced: the copy is written before the save.
 */
export function replaceSave(storage: SaveStorage, key: string, text: string): boolean {
  try {
    const before = storage.getItem(key);
    if (before !== null && before !== text) storage.setItem(asideKey(key), before);
    storage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? '' : 's'}`;

/** How long ago `then` was, in words: `just now`, `5 minutes ago`, `yesterday`, `12 days ago`. */
export function agoText(then: number, now: number): string {
  const seconds = Math.max(0, (now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** A file's size in words: `850 bytes`, `9 KB`, `1.4 MB`. */
export function sizeText(bytes: number): string {
  if (bytes < 1000) return plural(bytes, 'byte');
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Why Convex refused a call, in the player's words. Convex sends `{ code, message }` (convex/model/auth.ts). */
export function refusalText(error: unknown, fallback: string): string {
  const data = isObject(error) && isObject(error.data) ? error.data : null;
  if (!data) return fallback;
  if (data.code === 'signedOut') return 'You are signed out. Sign in and try again.';
  return typeof data.message === 'string' && data.message ? data.message : fallback;
}

/**
 * The address of a Clerk instance's Frontend API, which is written inside its publishable key:
 * `pk_test_` and then the address and a `$`, in base64. Null when the key is not one.
 */
export function clerkAddress(publishableKey: string): string | null {
  const encoded = publishableKey.split('_')[2];
  if (!/^pk_(test|live)_/.test(publishableKey) || !encoded) return null;
  try {
    const address = atob(encoded);
    return /^[a-z0-9.-]+\$$/i.test(address) ? address.slice(0, -1) : null;
  } catch {
    return null;
  }
}
