// The bag: 36 slots, the first 9 are the quick slots. Stacks of one item merge up to the item's stack size.
//
// The Almanac is not a thing in the bag. It is the flag `has.almanac`: adding it sets the flag, it never
// takes a slot, and it can never be removed, moved, stacked or dropped. `count('almanac')` is 1 once it is
// given, so conditions that ask for it in the bag still hold. An old save with it in a slot gives the book.
import { ALMANAC_BOOK } from '../content/almanac.ts';
import type { InventoryApi, ItemId, Stack } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

export const SLOTS = 36;
export const QUICK_SLOTS = 9;

export interface InventorySave {
  selected: number;
  slots: (Stack | null)[];
}

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const slots: (Stack | null)[] = new Array<Stack | null>(SLOTS).fill(null);
  let selected = 0;

  const changed = (): void => game.events.emit('inventory.changed', {});
  const stackSize = (id: ItemId): number => game.systems.items.get(id).stack;
  const validSlot = (n: number): boolean => Number.isInteger(n) && n >= 0 && n < SLOTS;

  const isBook = (id: ItemId): boolean => id === ALMANAC_BOOK.item;
  const giveBook = (): void => game.flags.set(ALMANAC_BOOK.flag, true);

  function count(id: ItemId): number {
    if (isBook(id)) return game.flags.is(ALMANAC_BOOK.flag) ? 1 : 0;
    let total = 0;
    for (const slot of slots) if (slot && slot.id === id) total += slot.count;
    return total;
  }

  /** Takes up to `want` from one slot and returns how many it took. */
  function takeFrom(index: number, id: ItemId, want: number): number {
    const slot = slots[index];
    if (!slot || slot.id !== id || want <= 0) return 0;
    const taken = Math.min(slot.count, want);
    slot.count -= taken;
    if (slot.count === 0) slots[index] = null;
    return taken;
  }

  const api: InventoryApi = {
    slots,
    get selected() {
      return selected;
    },
    /** Any whole number works: 9 wraps to 0 and -1 to 8, so a scroll wheel can add or subtract one. */
    set selected(n: number) {
      if (!Number.isFinite(n)) return;
      const next = ((Math.floor(n) % QUICK_SLOTS) + QUICK_SLOTS) % QUICK_SLOTS;
      if (next === selected) return;
      selected = next;
      changed();
    },
    held: () => slots[selected],
    add(id, amount, at) {
      const wanted = Math.floor(amount);
      if (!(wanted > 0)) return 0;
      if (isBook(id)) {
        giveBook();
        return 0;
      }
      const max = stackSize(id);
      let left = wanted;
      for (let i = 0; i < SLOTS && left > 0; i++) {
        const slot = slots[i];
        if (!slot || slot.id !== id || slot.count >= max) continue;
        const fit = Math.min(max - slot.count, left);
        slot.count += fit;
        left -= fit;
      }
      for (let i = 0; i < SLOTS && left > 0; i++) {
        if (slots[i]) continue;
        const fit = Math.min(max, left);
        slots[i] = { id, count: fit };
        left -= fit;
      }
      const added = wanted - left;
      if (added > 0) {
        game.events.emit('item.gained', at ? { id, count: added, at: { x: at.x, y: at.y, z: at.z } } : { id, count: added });
        changed();
      }
      return left;
    },
    remove(id, amount) {
      const wanted = Math.floor(amount);
      if (!(wanted > 0)) return wanted === 0;
      // The book is kept for good.
      if (isBook(id) || count(id) < wanted) return false;
      // The held stack goes first, so placing a block counts down the slot in the player's hand.
      let left = wanted - takeFrom(selected, id, wanted);
      for (let i = SLOTS - 1; i >= 0 && left > 0; i--) left -= takeFrom(i, id, left);
      game.events.emit('item.lost', { id, count: wanted });
      changed();
      return true;
    },
    count,
    move(from, to) {
      if (!validSlot(from) || !validSlot(to) || from === to) return;
      const a = slots[from], b = slots[to];
      if (!a && !b) return;
      if (a && b && a.id === b.id) {
        const fit = Math.min(stackSize(a.id) - b.count, a.count);
        if (fit > 0) {
          b.count += fit;
          a.count -= fit;
          if (a.count === 0) slots[from] = null;
          changed();
          return;
        }
      }
      slots[from] = b;
      slots[to] = a;
      changed();
    },
  };

  kernel.add('inventory', api, {
    save(): InventorySave {
      return { selected, slots: slots.map((slot) => (slot ? { id: slot.id, count: slot.count } : null)) };
    },
    load(data) {
      const save = data as Partial<InventorySave> | null;
      const known = new Set(game.systems.items.all().map((item) => item.id));
      for (let i = 0; i < SLOTS; i++) {
        const slot = save?.slots?.[i];
        // A save from before the book left the bag: the book is given and its slot is free.
        if (slot && isBook(slot.id)) {
          giveBook();
          slots[i] = null;
          continue;
        }
        const count = slot ? Math.floor(slot.count) : 0;
        // An item that no longer exists is dropped, so an old save still opens.
        slots[i] = slot && count > 0 && known.has(slot.id) ? { id: slot.id, count } : null;
      }
      const index = Number(save?.selected);
      selected = Number.isInteger(index) && index >= 0 && index < QUICK_SLOTS ? index : 0;
      changed();
    },
  });
}
