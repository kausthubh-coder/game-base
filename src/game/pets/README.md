# pets

The leaftail: wild at the dead garden, then a companion. It implements `PetsApi`. The data is `src/game/content/pets.ts`.

## What it exports

| Export | What it is |
|---|---|
| `install(kernel)` | Adds the system as `game.systems.pets` with one leaftail |
| `createPets(game, defs?)` | The same system without a kernel. It returns `{ api, system }`. |
| `PetsSave` | The shape `save()` returns |

## The pet

- Its `PetState.id`, its actor id and its Interactable id are all `pet:leaftail:1`. The sprite is `leaftail`, and `anim` is `walk` or `idle`.
- The actor's mark is `heart` for 3 seconds after it eats and `alert` while it backs off.

## Wild

- It walks between five spots around the place `dead.garden`, the furthest about 4 blocks from it, and rests 3 to 6 seconds at each. It only does so while the player is within 60 blocks.
- The player startles it by moving faster than 2.4 blocks a second within 6 blocks. The speed is the mean over the last 0.3 seconds. A jump of more than 12 blocks a second counts as a teleport and startles nothing.
- Startled, it backs off 6 blocks and will not eat for 15 seconds. Trust is kept.
- A secondary click with a treat in the hand, with a wild pet within 3 blocks, holds the treat out. The handler returns true whether or not the pet eats, so the berry is not used on anything else.
- The pet eats when the player has stood still for 1 second and it is not wary. If that is already so, it eats on the click. If not, a toast says what it waits for, and it eats as soon as both hold. Walking more than 3 blocks away or startling it takes the offer back.
- Eating removes one treat, raises trust by 1 and takes 3 seconds. It takes nothing more until it is done.
- At trust 3 it bonds and the flag `pet.leaftail.bonded` is set.
- `bond(petId)` bonds a wild pet without a berry. Trust goes to 3, the flag is set, `pet.bonded` goes out, and the pet appears beside the player when it is more than 3 blocks away. It returns false for an id it does not know and for a pet that has bonded. `quests.skipTo` calls it for a game that skips the leaftail quest. No `pet.fed` is sent.
- The Interactable `Offer a berry` (radius 3) shows while the pet is wild and the player has a berry in the hand or the bag. It does the same as the click.
- A treat is the item `berry`, or any item whose `ItemDef.treat` is true.

## Bonded

- It follows within 3 blocks. It trots at 5 blocks a second and runs at 7.5 when more than 4 blocks behind. It goes around walls and stays out of water.
- More than 30 blocks away, or stuck for 4 seconds, it appears on a free block beside the player.
- While the block under the player's feet has the surface `grass`, a timer runs. Every 50 to 70 seconds it calls `inventory.add('wheat_seeds', 1, petPos)` and sends the toast `Your leaftail found a seed.` The bag sends `item.gained` with `at`. A full bag gets no seed and no toast.

## Events it sends

| Event | When |
|---|---|
| `pet.startled { pet }` | Once each time it is startled |
| `pet.fed { pet, trust }` | Each time it eats. `trust` is the new value, 1 to 3. |
| `pet.bonded { pet }` | Once, right after the third `pet.fed`, or from `bond()` |
| `toast { text }` | A seed found, and the reason a treat was not taken yet |
| `flag.changed` | Through `flags.set('pet.leaftail.bonded', true)` |

`item.gained` for a seed comes from the inventory, not from here.

## Wiring

```ts
import { install as installNav } from './nav/index.sim.ts';
import { install as installPets } from './pets/index.sim.ts';

installNav(kernel);
installPets(kernel);                     // any order among the systems
// On its first step or first api call it reads region and nav, makes the pet,
// adds its prompt to interact and its click handler to actions.
kernel.game.systems.pets.feed('pet:leaftail:1');   // true when it ate
kernel.game.systems.pets.bond?.('pet:leaftail:1'); // true when it bonded now
```

## Contract change

`PetsApi.bond?` is new. It is optional in the type so that a fake without it still fits. The real system always has it.

It needs `region` (with the place `dead.garden`), `nav`, `inventory`, `interact` and `actions` before the first step. `items` is optional. Each step it reads how far `game.player.pos` moved since its last step.

Save holds position, facing, trust, bonded, the wary time left and the seed timer. A load before the first step is kept and applied on that step.
