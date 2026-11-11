// The event bus of a browser in an online world, cut in two.
//
// The systems were installed first and hear the bus they were installed with. In an online world they must
// not hear anything: they do not decide what happened, and a quest that heard a block break would move on
// in the browser as well as on the server. So once the systems are in, `game.events` is pointed at a second
// bus that only what comes after hears: the shell's own listeners and every view. The server's events are
// emitted there, and so is anything a view emits for itself, such as a click sound.
//
// A system's own emit goes there too, so a view still hears it. While a copy of the server's state is being
// loaded those are dropped (`quietly`): the server sends the events that go with it.
import type { EventName, Events, GameEvents } from '../api.sim.ts';
import { createEvents } from '../kernel.sim.ts';

export interface Relay {
  /** Emits an event the server sent, to every view. */
  fromServer(name: string, data: unknown): void;
  /** Runs `fn` with every emit dropped. */
  quietly<T>(fn: () => T): T;
}

export function splitEvents(events: Events): Relay {
  const views = createEvents();
  let quiet = 0;
  events.on = views.on;
  events.onAny = views.onAny;
  events.emit = (name, data) => {
    if (quiet === 0) views.emit(name, data);
  };
  return {
    fromServer(name, data) {
      views.emit(name as EventName, data as GameEvents[EventName]);
    },
    quietly(fn) {
      quiet++;
      try {
        return fn();
      } finally {
        quiet--;
      }
    },
  };
}
