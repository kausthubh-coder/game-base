# inventory

The bag. It implements `InventoryApi`.

## What it exports

- `install(kernel)` from `index.sim.ts`. It adds `game.systems.inventory`.
- `SLOTS` (36) and `QUICK_SLOTS` (9).
- `slots` is the live array of 36 `Stack | null`. Slots 0 to 8 are the quick slots. Read it, do not write it.
- `selected` is the quick slot in the hand, 0 to 8. Setting it wraps, so `selected += 1` from 8 gives 0 and `selected -= 1` from 0 gives 8.
- `held()` is the stack in the selected slot, or null.
- `add(id, count, at?)` fills stacks of the same item first, then the first empty slots. It returns how many did not fit.
- `remove(id, count)` removes only when the bag has that many, and returns whether it did. It takes from the held slot first, then from the last slot backward.
- `count(id)` is the total across all slots.
- `move(from, to, count?)` merges two stacks of the same item up to the stack size, and swaps otherwise. With `count` (a split: the bag's right-drag takes half) only that many go, onto an empty slot or the same item; onto another item nothing moves, since part of a stack cannot swap.

## Events

| Event | When |
|---|---|
| `item.gained { id, count, at? }` | `add` put at least one in. `count` is what fit. `at` is the third argument of `add`. |
| `item.lost { id, count }` | `remove` succeeded |
| `inventory.changed {}` | After any change to a slot or to `selected`, and after a load |

## Contract change

`InventoryApi.add` has an optional third argument, `at?: Vec3`. Breaking a block passes the middle of the block, so effects can fly the item from there.

## Wiring

```ts
import { install as installInventory } from './inventory/index.sim.ts';
installInventory(kernel);                       // needs game.systems.items by the first add()
const bag = game.systems.inventory;
game.events.on('inventory.changed', () => hud.draw(bag.slots, bag.selected));
keys.onDigit((n) => { bag.selected = n - 1; }); // keys 1 to 9
keys.onWheel((step) => { bag.selected += step; });
bag.add('axe', 1);                              // window.__game.give
```

The save holds the slots and the selected slot. A load drops any item whose id is no longer in the table.

## The Almanac

The book is never a thing in the bag: Kausthubh asked that it not act as an item, since the game needs it. `add('almanac')` sets the flag `has.almanac` (`ALMANAC_BOOK` in `src/game/content/almanac.ts`), takes no slot and sends no `item.gained`. `count('almanac')` is 1 once the flag is set, so `{ bag: 'almanac' }` conditions still hold. `remove('almanac')` is always false. A save from before this, with the book in a slot, loads with the flag set and the slot empty.
