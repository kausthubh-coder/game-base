// The save: the kernel's state and the world's changed blocks, as one string in localStorage under one key.
// Every read and write is inside try and catch: a private window or a full disk must not stop the game.
import type { WorldSave } from '../../features/world/index.ts';
import type { GameSave } from '../kernel.sim.ts';

/** A test scene (`?scene=build` in the address) keeps its own save, so trying things there never touches the real game's. */
const scene = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('scene');
/** The playtest copy at /playtest/ and the experiment copy at /experiment/ keep their own saves too, so the game at / still opens on its own save. */
const path = typeof location === 'undefined' ? '' : location.pathname;
const SAVE_ROOT = path.startsWith('/playtest') ? 'greenhollow.playtest.save' : path.startsWith('/experiment') ? 'greenhollow.experiment.save' : 'greenhollow.save';
export const SAVE_KEY = scene ? `${SAVE_ROOT}.${scene}` : SAVE_ROOT;
/** What the page should do straight after it reloads: a game already in progress cannot be reset in place. */
const AFTER_RELOAD_KEY = 'greenhollow.after-reload';

export interface SaveFile {
  version: 1;
  /** When it was written, in milliseconds since 1970. */
  at: number;
  world: WorldSave;
  game: GameSave;
  /** What the shell itself keeps: the counts for the end card. */
  shell: { wheat: number; blocks: number };
}

export function readSave(): SaveFile | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const file = JSON.parse(text) as Partial<SaveFile>;
    if (file.version !== 1 || !file.world || !file.game) return null;
    return { shell: { wheat: 0, blocks: 0 }, ...file } as SaveFile;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null && readSave() !== null;
  } catch {
    return false;
  }
}

export function writeSave(file: SaveFile): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch (error) {
    console.warn('[game] the save was not stored:', error);
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear where nothing can be stored.
  }
}

/** Reloads the page and has it start a new game or continue the saved one as soon as it is up. */
export function reloadInto(what: 'new' | 'continue'): void {
  try {
    sessionStorage.setItem(AFTER_RELOAD_KEY, what);
  } catch {
    // Without session storage the page comes back at its title, which is still a way forward.
  }
  location.reload();
}

/** What the last page asked this one to do, read once. */
export function takeAfterReload(): 'new' | 'continue' | null {
  try {
    const what = sessionStorage.getItem(AFTER_RELOAD_KEY);
    sessionStorage.removeItem(AFTER_RELOAD_KEY);
    return what === 'new' || what === 'continue' ? what : null;
  } catch {
    return null;
  }
}
