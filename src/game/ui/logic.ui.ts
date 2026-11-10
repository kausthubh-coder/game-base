// The parts of the interface that are plain data in, plain data out. No page here, so tests can run them.

import type { AlmanacPage, ItemDef, Recipe } from '../api.sim.ts';
import type { KeyHint, Quality, Settings } from './types.ui.ts';

export const DEFAULT_SETTINGS: Settings = { quality: 'auto', music: 0.7, ambience: 0.7, effects: 0.8, voice: 0.8, size: 1 };
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high', 'auto'];
export const SIZES: readonly number[] = [0.9, 1, 1.15];

export const DEFAULT_KEYS: readonly KeyHint[] = [
  { action: 'Move', keys: ['W', 'A', 'S', 'D'] },
  { action: 'Walk slowly', keys: ['Shift'] },
  { action: 'Jump', keys: ['Space'] },
  { action: 'Talk, or use what is near', keys: ['E'] },
  { action: 'Break or gather', keys: ['Left click'] },
  { action: 'Place or use what you hold', keys: ['Right click'] },
  { action: 'Pick a quick slot', keys: ['1 to 9'] },
  { action: 'Bag', keys: ['I', 'B'] },
  { action: 'Almanac', keys: ['Tab'] },
  { action: 'Quests', keys: ['J'] },
  { action: 'Pause', keys: ['Esc'] },
];

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;

/** Turns what localStorage held into settings. Anything missing or wrong falls back to the default. */
export function readSettings(text: string | null): Settings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (typeof parsed === 'object' && parsed !== null) raw = parsed as Record<string, unknown>;
  } catch {
    // A broken value means the defaults.
  }
  const d = DEFAULT_SETTINGS;
  return {
    quality: QUALITIES.includes(raw.quality as Quality) ? (raw.quality as Quality) : d.quality,
    music: clamp01(raw.music, d.music),
    ambience: clamp01(raw.ambience, d.ambience),
    effects: clamp01(raw.effects, d.effects),
    voice: clamp01(raw.voice, d.voice),
    size: SIZES.includes(raw.size as number) ? (raw.size as number) : d.size,
  };
}

/** The two letters drawn when an item has no icon. */
export function initials(name: string): string {
  const letters = name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return letters ? letters[0].toUpperCase() + letters.slice(1).toLowerCase() : '?';
}

/** Why a recipe cannot be made, in words for the player, or null when it can. */
export function missingReason(recipe: Recipe, have: (id: string) => number, nameOf: (id: string) => string, canMake: boolean): string | null {
  const short = recipe.needs.filter((need) => have(need.id) < need.count).map((need) => nameOf(need.id).toLowerCase());
  if (short.length === 0) return canMake ? null : 'Cannot make this right now';
  const last = short.pop();
  return `Not enough ${short.length ? short.join(', ') + ' and ' : ''}${last}`;
}

export interface ToastLine {
  key: number;
  text: string;
  icon?: string;
  count: number;
  /** The time it leaves, in milliseconds on the caller's clock. */
  until: number;
}

export const TOAST_LIFE = 3000;
/** At most this many toasts show. Three lines are read at a glance; a fourth pushes the oldest out. */
export const TOAST_MAX = 3;
let toastKey = 0;

/** Adds a toast. A repeat of a line still showing raises its count and restarts its time. Returns the line. */
export function addToast(lines: ToastLine[], text: string, icon: string | undefined, now: number): ToastLine {
  const same = lines.find((line) => line.text === text);
  if (same) {
    same.count += 1;
    same.until = now + TOAST_LIFE;
    return same;
  }
  const line: ToastLine = { key: ++toastKey, text, icon, count: 1, until: now + TOAST_LIFE };
  lines.push(line);
  while (lines.length > TOAST_MAX) lines.shift();
  return line;
}

/** Drops the toasts whose time is up. Returns true when any left. */
export function expireToasts(lines: ToastLine[], now: number): boolean {
  let changed = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].until <= now) {
      lines.splice(i, 1);
      changed = true;
    }
  }
  return changed;
}

const KINDS: readonly { kind: AlmanacPage['kind']; label: string }[] = [
  { kind: 'creature', label: 'Creatures' },
  { kind: 'pet', label: 'Pets' },
  { kind: 'crop', label: 'Crops' },
  { kind: 'person', label: 'People' },
  { kind: 'place', label: 'Places' },
];

export interface PageGroup {
  kind: AlmanacPage['kind'];
  label: string;
  pages: AlmanacPage[];
}

/** The pages the player has met, grouped by kind in a fixed order. Empty groups are left out. */
export function groupPages(pages: readonly AlmanacPage[]): PageGroup[] {
  const groups: PageGroup[] = [];
  for (const { kind, label } of KINDS) {
    const met = pages.filter((page) => page.seen && page.kind === kind);
    if (met.length) groups.push({ kind, label, pages: met });
  }
  return groups;
}

/** Where an arrow key moves the focus in a grid of `total` cells and `columns` columns. Stays put at an edge. */
export function gridMove(index: number, key: string, columns: number, total: number): number {
  const column = index % columns;
  if (key === 'ArrowLeft') return column > 0 ? index - 1 : index;
  if (key === 'ArrowRight') return column < columns - 1 && index + 1 < total ? index + 1 : index;
  if (key === 'ArrowUp') return index - columns >= 0 ? index - columns : index;
  if (key === 'ArrowDown') return index + columns < total ? index + columns : index;
  if (key === 'Home') return index - column;
  if (key === 'End') return Math.min(total - 1, index - column + columns - 1);
  return index;
}

/** The quick row and the rest of the bag, each laid out on its own grid of the same number of columns. */
export const QUICK_COUNT = 9;

/**
 * Where an arrow key moves the focus in the bag: the 9 quick slots and the 27 slots after them, each block on its own
 * grid of `columns`. Down from the quick row's last line goes into the bag, up from the bag's first line comes back.
 */
export function slotMove(index: number, key: string, columns: number, total: number): number {
  const quick = Math.min(QUICK_COUNT, total);
  const inQuick = index < quick;
  const start = inQuick ? 0 : quick, size = inQuick ? quick : total - quick;
  const local = index - start;
  const row = Math.floor(local / columns), column = local % columns;
  const rows = Math.ceil(size / columns);
  const at = (blockStart: number, blockSize: number, r: number, c: number): number => blockStart + Math.min(blockSize - 1, r * columns + c);
  if (key === 'ArrowLeft') return column > 0 ? index - 1 : index;
  if (key === 'ArrowRight') return column < columns - 1 && local + 1 < size ? index + 1 : index;
  if (key === 'Home') return index - column;
  if (key === 'End') return start + Math.min(size - 1, row * columns + columns - 1);
  if (key === 'ArrowDown') {
    if (row + 1 < rows) return at(start, size, row + 1, column);
    return inQuick && total > quick ? at(quick, total - quick, 0, column) : index;
  }
  if (key === 'ArrowUp') {
    if (row > 0) return at(start, size, row - 1, column);
    return !inQuick ? at(0, quick, Math.ceil(quick / columns) - 1, column) : index;
  }
  return index;
}

/** How many a split takes: the bigger half, so a stack of one moves whole. */
export const half = (count: number): number => Math.ceil(count / 2);

/** What an item is for, in one line for its tooltip, or null when its description says it all. */
export function itemUse(def: ItemDef): string | null {
  switch (def.tool?.kind) {
    case 'axe': return 'Tool. Hold the left button on a tree to fell it.';
    case 'pickaxe': return 'Tool. Hold the left button on stone to break it.';
    case 'hoe': return 'Tool. The right button tills grass or dirt.';
    case 'can': return 'Tool. The right button waters tilled soil.';
    case 'shovel': return 'Tool. Digs dirt and sand faster.';
    case 'hammer': return 'Tool. Takes down what you built.';
  }
  if (def.seed) return 'The right button plants it in tilled soil.';
  if (def.placeable) return 'The right button sets it down.';
  if (def.block !== undefined) return 'The right button builds with it.';
  if (def.treat) return 'Pets like it. Hold it out with the right button.';
  return null;
}
