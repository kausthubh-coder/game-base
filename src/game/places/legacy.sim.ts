// The world as it was built before the place system, seen as subjects of the place check: every landmark the land
// lays (src/game/region/greenhollow-land.sim.ts, `landmarkSites`), gathered under the plan's place it belongs to.
// So the check runs over the whole map today. A place that moves to the place system (src/game/content/places)
// leaves these lists, and its subject comes from build.sim.ts instead.
import { PLACES } from '../content/greenhollow.ts';
import { landmarkSites, planStands, siteBase, type Site } from '../region/greenhollow-land.sim.ts';
import type { PieceFact, Sit, Subject } from './check.sim.ts';

/** Models whose foot goes down into the ground by design: the High Road's piers and towers, the terraces' faces. */
const ROOTED = new Set(['highRoadArch', 'roadStair', 'terraceWall', 'terraceStair']);
/** Models that stand in water by design, whatever the plan's `wet` says. */
const IN_WATER = new Set(['boardwalk', 'jetty', 'weir', 'pumpHouse', 'citySkiff', 'cityDock', 'stiltHut']);

function sitOf(s: Site): Sit {
  if (s.size.deck) return 'deck';
  if (s.size.wet || IN_WATER.has(s.model)) return 'water';
  if (s.model === 'forestStair') return 'sunk';
  if (ROOTED.has(s.model)) return 'rooted';
  return 'ground';
}

/** One landmark site as the check sees it. `groundAt` is the top of the ground at a column. */
export function pieceOfSite(s: Site, groundAt: (x: number, z: number) => number): PieceFact {
  return {
    id: s.id, model: s.model, variant: s.variant, x: s.x, z: s.z, rotation: s.rotation,
    base: siteBase(s, groundAt),
    size: { w: s.size.w, d: s.size.d, h: s.size.h },
    sit: sitOf(s),
    solid: !s.size.open && !s.size.dress && !s.size.walk,
    bank: !!s.size.back,
    joins: s.laid,
    standIn: '',
  };
}

/**
 * The landmark sites as subjects, one for each place of the plan that has any. `skip` names the places the place
 * system has taken over.
 */
export function legacySubjects(groundAt: (x: number, z: number) => number, skip: ReadonlySet<string> = new Set()): Subject[] {
  const stands = planStands();
  const byPlace = new Map<string, Site[]>();
  for (const s of landmarkSites()) {
    // The Dawn's dome is on the horizon, drawn at any distance: it stands on no ground a player sees.
    if (s.model === 'dawnDome' || skip.has(s.place)) continue;
    let list = byPlace.get(s.place);
    if (!list) byPlace.set(s.place, (list = []));
    list.push(s);
  }
  const out: Subject[] = [];
  for (const [id, sites] of byPlace) {
    const plan = PLACES.find((p) => p.id === id);
    const stand = stands.find((p) => p.id === id);
    out.push({
      id, name: plan?.name ?? id, declared: false,
      pieces: sites.map((s) => pieceOfSite(s, groundAt)),
      // The High Road and the paths' boardwalks have no one point to stand at.
      stands: stand && plan && id !== 'highroad' ? [{ id, x: stand.x, z: stand.z }] : [],
      links: [], sky: 'open', cleared: [], budget: null, cameras: [], lamps: 0,
    });
  }
  return out;
}
