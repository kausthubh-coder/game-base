// The fight lab's log: every fight that ended, with its numbers and the answer to "Again?". It is kept in the
// browser under its own key, apart from any save, and can be copied or saved as a file. With `log=1` in the
// address the page also sends each change to `fight-log` beside it, where the lab's own server
// (`tools/fight-serve.mjs`) writes it to `.artifacts/fight/ratings.jsonl`.
import type { FightRecord } from '../fight/fight.sim.ts';

const KEY = 'lab.fight.log';

export interface LoggedFight extends FightRecord {
  /** When the fight ended, in milliseconds since 1970. */
  at: number;
}

export interface FightLog {
  all(): readonly LoggedFight[];
  /** Adds a fight that just ended and returns it. */
  add(record: FightRecord): LoggedFight;
  /** Sets the answer to "Again?" for a fight in the log. */
  rate(fight: LoggedFight, again: number): void;
  /** The whole log as text, for the clipboard or a file. */
  text(): string;
  clear(): void;
}

export function createLog(): FightLog {
  let list: LoggedFight[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (Array.isArray(stored)) list = stored as LoggedFight[];
  } catch {
    // No storage, or something else's text under the key: the log starts empty.
  }

  function store(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // The log still holds for this visit.
    }
  }

  // Only a page opened with `log=1` in its address sends anything: a server without the door would answer 404,
  // and the browser writes every 404 to the console as an error.
  const sends = typeof location !== 'undefined' && new URLSearchParams(location.search).get('log') === '1';

  /** Tells the lab's server. Nothing depends on the answer. */
  function send(fight: LoggedFight): void {
    if (!sends) return;
    try {
      void fetch('fight-log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fight), keepalive: true }).catch(() => undefined);
    } catch {
      // No network is no reason to stop.
    }
  }

  return {
    all: () => list,
    add(record) {
      const fight: LoggedFight = { ...record, at: Date.now() };
      list.push(fight);
      store();
      send(fight);
      return fight;
    },
    rate(fight, again) {
      fight.again = again;
      store();
      send(fight);
    },
    text: () => JSON.stringify(list, null, 2),
    clear() {
      list = [];
      store();
    },
  };
}
