// Which Hollowmere to lay out. `b` is the town: the Hollow Oak on its Lantern Green (b.ts beside this file).
// `now` is the first town, built of blocks, and `a` is the other redesign, the Queen's Granary. Both are
// kept so they can still be looked at.
//
// The page asks with `?town=a`. The chunk worker cannot read the page's address, so the world view names
// the worker after the page's query and it is read back here from the worker's `name`. A build can set
// its own default with VITE_TOWN=a, and `?town=b` still shows the Hollow Oak in that build.
// A server or a test has neither, and gets the VITE_TOWN of its environment or the Hollow Oak.

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
  return NAMES.find((n) => n === built) ?? 'b';
}

/** The layout this page, worker or test lays out. Read once, as the region plan is made once. */
export const TOWN: TownName = askedTown();
