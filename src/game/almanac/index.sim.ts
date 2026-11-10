// The Almanac: a book of pages that fill in as the player sees what a thing needs and what it gives.
// The pages are data in content/almanac.ts. This file keeps what is known, hears the events and flags
// that teach a fact, and sends `fact.learned` and `page.completed`.

import { ALMANAC, type AlmanacPageDef, type AlmanacTrigger } from '../content/almanac.ts';
import type { AlmanacApi, AlmanacFact, AlmanacPage, EventName, Game, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

export interface AlmanacSave {
  version: 1;
  /** One row for each page that is met or has a known fact: its id, whether it is met, and the known fact ids. */
  pages: [id: string, seen: boolean, known: string[]][];
}

/** Other words a dialogue flag may use for the two column names. */
const ALIAS: Record<string, string> = { need: 'needs', want: 'needs', wants: 'needs', give: 'gives', gift: 'gives' };

interface Hook {
  where: AlmanacTrigger['where'];
  page: string;
  /** The fact to learn, or null to only meet the page. */
  fact: string | null;
}

export function createAlmanac(game: Game, defs: readonly AlmanacPageDef[] = ALMANAC): { api: AlmanacApi; system: SimSystem } {
  const pages: AlmanacPage[] = defs.map((def) => ({
    id: def.id,
    title: def.title,
    picture: def.picture,
    kind: def.kind,
    facts: def.facts.map((f) => ({ id: f.id, column: f.column, text: f.text, known: false })),
    complete: false,
    seen: false,
  }));
  const byId = new Map(pages.map((page) => [page.id, page]));

  const factOf = (page: AlmanacPage, id: string): AlmanacFact | undefined => {
    for (const fact of page.facts) if (fact.id === id) return fact;
    const other = ALIAS[id];
    if (other) for (const fact of page.facts) if (fact.id === other) return fact;
    return undefined;
  };

  const allKnown = (page: AlmanacPage): boolean => {
    for (const fact of page.facts) if (!fact.known) return false;
    return page.facts.length > 0;
  };

  const meet = (id: string): void => {
    const page = byId.get(id);
    if (page) page.seen = true;
  };

  const learn = (id: string, factId: string): void => {
    const page = byId.get(id);
    if (!page) return;
    const fact = factOf(page, factId);
    if (!fact || fact.known) return;
    fact.known = true;
    page.seen = true;
    game.events.emit('fact.learned', { page: page.id, column: fact.column, fact: fact.id });
    if (allKnown(page)) {
      page.complete = true;
      game.events.emit('page.completed', { page: page.id });
    }
  };

  // Events that teach a fact or put a page in the book.
  const hooks = new Map<EventName, Hook[]>();
  const hook = (trigger: AlmanacTrigger, page: string, fact: string | null): void => {
    let list = hooks.get(trigger.event);
    if (!list) hooks.set(trigger.event, (list = []));
    list.push({ where: trigger.where, page, fact });
  };
  for (const def of defs) {
    for (const trigger of def.meetOn ?? []) hook(trigger, def.id, null);
    for (const fact of def.facts) for (const trigger of fact.on ?? []) hook(trigger, def.id, fact.id);
  }
  for (const [event, list] of hooks) {
    game.events.on(event, (data) => {
      for (const h of list) {
        if (!matches(game, h.where, data as unknown as Record<string, unknown>)) continue;
        if (h.fact === null) meet(h.page);
        else learn(h.page, h.fact);
      }
    });
  }

  // Dialogue teaches a fact by setting the flag `fact.<page>.<fact>`.
  game.events.on('flag.changed', ({ flag, value }) => {
    if (!value || !flag.startsWith('fact.')) return;
    const dot = flag.indexOf('.', 5);
    if (dot > 5) learn(flag.slice(5, dot), flag.slice(dot + 1));
  });

  const api: AlmanacApi = {
    pages: () => pages,
    page: (id) => byId.get(id),
    learn,
    meet,
  };

  const system: SimSystem = {
    save(): AlmanacSave {
      const rows: AlmanacSave['pages'] = [];
      for (const page of pages) {
        const known = page.facts.filter((f) => f.known).map((f) => f.id);
        if (page.seen || known.length) rows.push([page.id, page.seen, known]);
      }
      return { version: 1, pages: rows };
    },
    load(data) {
      for (const page of pages) {
        page.seen = false;
        page.complete = false;
        for (const fact of page.facts) fact.known = false;
      }
      const rows = (data as Partial<AlmanacSave> | null)?.pages;
      if (!Array.isArray(rows)) return;
      for (const [id, seen, known] of rows) {
        const page = byId.get(id);
        if (!page) continue;
        page.seen = Boolean(seen);
        for (const fact of page.facts) fact.known = known.includes(fact.id);
        page.complete = allKnown(page);
      }
    },
  };

  return { api, system };
}

/** True when the event's fields match what the trigger asks for. */
function matches(game: Game, where: AlmanacTrigger['where'], data: Record<string, unknown>): boolean {
  if (!where) return true;
  for (const key in where) {
    const want = where[key];
    let have = data[key];
    if (have === undefined && key === 'crop') have = cropAt(game, data);
    if (have === want) continue;
    if (typeof have === 'string' && typeof want === 'string') {
      if (have.split(':').includes(want)) continue;
      if (key === 'pet' && petKind(game, have) === want) continue;
    }
    return false;
  }
  return true;
}

/** The crop on the soil block an event points at. Some events carry the plant's block, one above the soil. */
function cropAt(game: Game, data: Record<string, unknown>): string | undefined {
  const crops = game.systems.crops;
  const { x, y, z } = data;
  if (!crops || typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return undefined;
  return (crops.at(x, y, z) ?? crops.at(x, y - 1, z))?.crop;
}

function petKind(game: Game, id: string): string | undefined {
  const pets = game.systems.pets;
  if (!pets) return undefined;
  for (const pet of pets.all()) if (pet.id === id || pet.name === id) return pet.kind;
  return undefined;
}

export function install(kernel: Kernel, defs: readonly AlmanacPageDef[] = ALMANAC): void {
  const { api, system } = createAlmanac(kernel.game, defs);
  kernel.add('almanac', api, system);
}
