# interact

The "E" prompt registry. It implements `InteractApi`.

## What it exports

- `install(kernel)` from `index.sim.ts`. It adds `game.systems.interact`.
- `add(target)` registers an `Interactable`. A target with an id that is already there replaces the old one.
- `remove(id)` takes one out.
- `nearest()` returns the closest target that is within its own `radius` of the player and whose `prompt()` is not null. The distance runs from `game.player.pos` (the feet) to `target.pos()` and counts height.
- `act()` runs `nearest().act()` and returns true, or returns false when there is none.

While `game.player.busy` is true, `nearest()` returns null and `act()` returns false. So a prompt never shows under a conversation or a panel.

## Events

None. A target's own `act()` sends what it needs.

## Wiring

```ts
import { install as installInteract } from './interact/index.sim.ts';
installInteract(kernel);
const interact = game.systems.interact;
// each frame
const target = interact.nearest();
hud.prompt(target ? `E: ${target.prompt()}` : null);
// on the E key, and in window.__game.interact()
interact.act();
```

Placed stations add themselves as `placeable:<id>`. People, pets and anything else add their own targets. Nothing here is saved, so each owner adds its targets again after a load.
