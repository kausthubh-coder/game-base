// Which Hollowmere to lay out. `now` is the town as it stands; `a` and `b` are the two redesigns
// Kausthubh is choosing between (a.ts and b.ts beside this file).
//
// The page asks with `?town=a`. The chunk worker cannot read the page's address, so the world view names
// the worker after the page's query and it is read back here from the worker's `name`. A build can set
// its own default with VITE_TOWN=a, and `?town=now` still shows today's town in that build.
// A server or a test has neither, and gets the VITE_TOWN of its environment or today's town.

export type TownName = 'now' | 'a' | 'b';

const NAMES: readonly TownName[] = ['now', 'a', 'b'];

function fromQuery(text: unknown): TownName | null {
  if (typeof text !== 'string') return null;
  const asked = /[?&]town=([a-z]+)/.exec(text)?.[1];
  return NAMES.find((n) => n === asked) ?? null;
}

export function askedTown(): TownName {
  const scope = globalThis as { location?: { search?: string }; name?: unknown };
  const asked = fromQuery(scope.location?.search) ?? fromQuery(scope.name);
  if (asked) return asked;
  const built: unknown = import.meta.env.VITE_TOWN;
  return NAMES.find((n) => n === built) ?? 'now';
}

/** The layout this page, worker or test lays out. Read once, as the region plan is made once. */
export const TOWN: TownName = askedTown();
