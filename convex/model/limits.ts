// The caps that keep every list short enough to read in one go, and the text a player may type.

/** Saves one player may keep: the game's own and its test scenes'. */
export const MAX_SAVES = 8;
/** The largest save kept. A browser's localStorage holds about 5 MB, so no real save is bigger. */
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;

export const MAX_PLAYER_NAME = 24;

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
