// Crafting: which recipes the player can reach, and making one from the bag.
import { recipes, stationReach } from '../content/recipes.ts';
import type { CraftingApi, Game, Recipe } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

export function createCrafting(game: Game): CraftingApi {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  // Reused by available(), so asking every frame allocates nothing.
  const open: Recipe[] = [];

  const reachable = (recipe: Recipe): boolean =>
    recipe.station === 'hand' || game.systems.placeables.near(recipe.station, game.player.pos, stationReach);

  const api: CraftingApi = {
    recipes: () => recipes,

    available() {
      open.length = 0;
      for (const recipe of recipes) if (reachable(recipe)) open.push(recipe);
      return open;
    },

    canMake(id) {
      const recipe = byId.get(id);
      if (!recipe || !reachable(recipe)) return false;
      const bag = game.systems.inventory;
      for (const need of recipe.needs) if (bag.count(need.id) < need.count) return false;
      return true;
    },

    make(id) {
      const recipe = byId.get(id);
      if (!recipe || !api.canMake(id)) return false;
      const bag = game.systems.inventory;
      for (const need of recipe.needs) bag.remove(need.id, need.count);
      const left = bag.add(recipe.makes.id, recipe.makes.count);
      if (left > 0) {
        // No room for what was made: put the bag back as it was.
        if (left < recipe.makes.count) bag.remove(recipe.makes.id, recipe.makes.count - left);
        for (const need of recipe.needs) bag.add(need.id, need.count);
        game.events.emit('toast', { text: 'Your bag is full.' });
        return false;
      }
      game.events.emit('item.crafted', { id: recipe.makes.id, count: recipe.makes.count, station: recipe.station });
      return true;
    },
  };
  return api;
}

export function install(kernel: Kernel): void {
  kernel.add('crafting', createCrafting(kernel.game), {});
}
