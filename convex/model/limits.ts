// The caps that keep every list short enough to read in one go, and the text a player may type.

/** Worlds one player may own, solo and online together. */
export const MAX_WORLDS_OWNED = 20;
/** Worlds one player may be a member of. */
export const MAX_WORLDS_JOINED = 50;
/** Members of a world beside its owner: the plan is 8 players a world. */
export const MAX_MEMBERS = 7;
/** Invites of one world that are still open. */
export const MAX_OPEN_INVITES = 20;
/** Invites of one world kept at all, used ones too. */
export const MAX_INVITES_KEPT = 100;
/** Players the world server may list as in a world now. */
export const MAX_PLAYERS_NOW = 64;
/** Saves one player may back up: the game's own and its test scenes'. */
export const MAX_SAVES = 8;
/** The largest save kept. A browser's localStorage holds about 5 MB, so no real save is bigger. */
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const INVITE_LIFE_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_PLAYER_NAME = 24;
export const MAX_WORLD_NAME = 40;

/** Control characters, and the invisible ones that hide or reorder text. */
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\ufeff]', 'g');

/** A name as it is stored: no control characters, single spaces, trimmed and cut to `max`. Empty when nothing is left. */
export function cleanName(text: string, max: number): string {
  return text
    .replace(CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** A save slot is the game's localStorage key: `greenhollow.save` or `greenhollow.save.<scene>`. */
export const isSlot = (slot: string): boolean => /^[a-z0-9][a-z0-9.-]{0,63}$/.test(slot);
