// The item table: looks an item up by its id. The data is src/game/content/items.ts.
import type { ItemDef, ItemId, ItemsApi } from '../api.sim.ts';
import { ITEMS } from '../content/items.ts';
import type { Kernel } from '../kernel.sim.ts';

export function install(kernel: Kernel): void {
  const byId = new Map<ItemId, ItemDef>(ITEMS.map((item) => [item.id, item]));
  const api: ItemsApi = {
    /** It throws on an id that is not in the table, so a typo fails early. */
    get(id) {
      const def = byId.get(id);
      if (!def) throw new Error(`no item called ${id}`);
      return def;
    },
    all: () => ITEMS,
  };
  kernel.add('items', api, {});
}
