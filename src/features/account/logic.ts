// The parts of the account with no page and no network in them: reading a save's text, the words on the
// panel, and swapping a save for a restored one. Tested in logic.test.ts.

/** A world's card, as `worlds.list` in convex/worlds.ts returns it. */
export interface WorldCard {
  _id: string;
  name: string;
  kind: 'solo' | 'online';
  role: 'owner' | 'member';
  ownerName: string;
  /** Milliseconds since 1970. */
  lastPlayedAt: number;
  playersNow: { playerId: string; name: string }[];
  /** The owner's backup of a solo world, or null. */
  backup: { slot: string; bytes: number; savedAt: number; uploadedAt: number; day: number } | null;
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

/** The backup of the save in `slot` among the player's worlds, with the world it belongs to. */
export function backupOf(worlds: readonly WorldCard[], slot: string): (NonNullable<WorldCard['backup']> & { worldId: string }) | null {
  for (const world of worlds) if (world.role === 'owner' && world.backup?.slot === slot) return { ...world.backup, worldId: world._id };
  return null;
}

/** The line under a world's name in the list. */
export function worldLine(world: WorldCard, now: number): string {
  if (world.kind === 'solo') {
    const backup = world.backup;
    return backup ? `Solo. Day ${backup.day}, backed up ${agoText(backup.uploadedAt, now)}.` : 'Solo.';
  }
  const whose = world.role === 'owner' ? 'Yours' : `${world.ownerName}'s`;
  const names = world.playersNow.map((player) => player.name);
  const inIt = names.length === 0 ? `Last played ${agoText(world.lastPlayedAt, now)}.` : `${names.length} in it now: ${names.join(', ')}.`;
  return `Online. ${whose}. ${inIt}`;
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
