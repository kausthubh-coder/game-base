# Almanac

The book of pages that fill in as the player sees what a thing needs and what it gives. The pages are data in `src/game/content/almanac.ts`: mossling, leaftail, wheat, lanternfly and the eight people.

## Exports

`index.sim.ts`:

- `install(kernel: Kernel, pages = ALMANAC): void` adds `game.systems.almanac` (`AlmanacApi`: `pages()`, `page(id)`, `learn(page, fact)`, `meet(page)`). The game passes no `pages`.
- `createAlmanac(game, pages)` returns `{ api, system }` for a caller that has no kernel.
- `AlmanacSave` is the shape of the save: met pages and known fact ids.

`pages()` returns the same page objects every time, changed in place. Draw from them, do not keep copies.

Every page except wheat has two facts with the ids `needs` and `gives`. Wheat has `needs`, `time` and `gives`.

## Events

It sends:

- `fact.learned { page, column, fact }` the first time a fact is learned. `fact` is the fact's id. The text is `almanac.page(page).facts`.
- `page.completed { page }` right after the `fact.learned` of a page's last fact.

`meet` sends nothing. `learn` on a known fact, an unknown fact or an unknown page does nothing. Loading a save sends nothing.

It hears:

| Event | What it does |
|---|---|
| `talk.started { npc }` | Meets that person's page |
| `flag.changed` for `fact.<page>.<fact>` with a true value | Learns that fact. `wants` and `need` count as `needs`, `give` and `gift` as `gives`. |
| `pet.startled`, `pet.fed` of a leaftail | Meets the leaftail page. `pet.fed` also learns `needs`. |
| `pet.bonded` of a leaftail | Learns leaftail `gives` |
| `crop.planted` of wheat | Meets the wheat page |
| `crop.watered` on soil where wheat grows | Learns wheat `needs` |
| `crop.grew` of wheat | Learns wheat `time` |
| `crop.harvested` of wheat | Learns wheat `gives` |

The mossling and lanternfly facts come from the creatures engine, which calls `learn` when the player watches. Dialogue and quest effects that call `almanac.learn(page, 'needs' | 'gives')` work for every page.

## Wiring

```ts
import { install as installAlmanac } from './almanac/index.sim.ts';

installAlmanac(kernel);
// It reads crops.at and pets.all only inside event handlers, so the install order does not matter.
// The interface shows game.systems.almanac.pages() and hears fact.learned and page.completed.
// The end card counts pages().filter((page) => page.complete).
```

## Tests

`bun test src/game/almanac`.
