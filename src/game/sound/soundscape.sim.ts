// The town's sound as numbers: how much the hero is in each zone, how loud each recorded bed should be for
// where they stand and the hour, when the next spot sound is due, and what a foot is standing on. No Web
// Audio here: src/game/views/core-sound.view.ts reads these and drives the engine.
import { BEDS, MUSIC_BANDS, MUSIC_REGIONS, REGION_OF_BIOME, SPOTS, ZONES, type BedRule, type MusicRegion, type SoundBand, type SoundHours, type SoundZone, type SpotRule, type ZoneId } from '../content/soundscape.ts';
import { toMap } from '../content/greenhollow.ts';
import { biomeAt, highRoadDistance, riverBank } from '../region/greenhollow.sim.ts';
import type { Surface } from '../../engine/types.ts';

/** What a foot is on, finer than a block's surface. The same names as the sound engine's. */
export type StepMaterial = 'grass' | 'dirt' | 'path' | 'cobble' | 'stone' | 'wood' | 'floor' | 'sand' | 'water' | 'leaves';

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** 1 inside the zone's rectangle, easing to 0 over its `fade` blocks outside it. */
export function zoneWeight(zone: SoundZone, x: number, z: number): number {
  const { rect, fade } = zone;
  const dx = Math.max(rect.x0 - x, 0, x - rect.x1);
  const dz = Math.max(rect.z0 - z, 0, z - rect.z1);
  return 1 - smooth(0, fade, Math.hypot(dx, dz));
}

/** How much an hour of the clock (0 to 24) belongs to day, night or the working day. */
export function hoursWeight(hours: SoundHours, hour: number): number {
  const day = smooth(5.2, 7.2, hour) * (1 - smooth(19.2, 21.2, hour));
  switch (hours) {
    case 'day': return day;
    case 'night': return 1 - day;
    case 'work': return smooth(7.2, 8.8, hour) * (1 - smooth(17.6, 19.4, hour));
    case 'always': return 1;
  }
}

export interface Where {
  x: number;
  z: number;
  /** 0 to 24. */
  hour: number;
  /** 0 to 1: how much of the sky above is tree crowns. */
  forest: number;
  /** The weight of each region and band here, from `regionsAt`. A bed with a `region` is silent without it. */
  regions?: Readonly<Record<string, number>>;
}

export type Zones = Record<ZoneId, number>;

/** A weight for every region with music, which sum to 1, and for each band, 0 to 1 on its own. */
export type Regions = Record<MusicRegion | SoundBand, number>;

export function newRegions(): Regions {
  const out = { river: 0, sea: 0, road: 0 } as Regions;
  for (const id of MUSIC_REGIONS) out[id] = id === 'meadow' ? 1 : 0;
  return out;
}

/** Lays a band over the regions: everything else gives up `weight` of its share, and `id` takes it. */
function overlay(out: Regions, id: MusicRegion, weight: number): void {
  if (weight <= 0) return;
  for (const other of MUSIC_REGIONS) out[other] *= 1 - weight;
  out[id] += weight;
}

/**
 * Which region's music plays at a column, as weights that sum to 1, and how much of each band is there. The
 * kinds of land are sampled round the hero, so crossing an edge moves the weights a little each block; the
 * High Road, the river and the sea air are laid over them, and the town's sound zone last of all. Every part
 * is a function of position, so walking back undoes it and nothing ever jumps.
 */
export function regionsAt(x: number, z: number, town: number, out: Regions): Regions {
  for (const id of MUSIC_REGIONS) out[id] = 0;
  // The grid is skewed by a fifth of a step a row, so no two samples share a row or a column: the land's edges
  // run along the map's axes, and an edge crossed in one block turns one sample over, never a whole row of five.
  const step = MUSIC_BANDS.spacing, skew = step / 5;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) out[REGION_OF_BIOME[biomeAt(x + dx * step + dz * skew, z + dz * step - dx * skew)]] += 1 / 25;
  const { road, river, sea } = MUSIC_BANDS;
  const my = toMap(x, z)[1];
  out.road = road.weight * (1 - smooth(road.near, road.far, highRoadDistance(x, z)));
  out.river = river.weight * (1 - smooth(river.near, river.far, riverBank(x, z))) * smooth(river.from, river.to, my);
  out.sea = sea.weight * smooth(sea.from, sea.to, my);
  // The river and the sea air are the Mere's music where they run through open meadow; in the marsh, the
  // forests and the hills the land keeps its own tune and the water is only heard in its bed.
  const open = out.meadow;
  overlay(out, 'highRoad', out.road);
  overlay(out, 'mere', Math.max(out.river, out.sea) * open);
  overlay(out, 'town', clamp01(town));
  return out;
}

/** The summed weight of a rule's regions and bands, or 1 for a rule that names none. */
function regionShare(names: readonly string[] | undefined, regions: Readonly<Record<string, number>> | undefined): number {
  if (!names) return 1;
  if (!regions) return 0;
  let sum = 0;
  for (const id of names) sum += regions[id] ?? 0;
  return clamp01(sum);
}

export function zonesAt(x: number, z: number, into: Zones): Zones {
  for (const id of Object.keys(ZONES) as ZoneId[]) into[id] = zoneWeight(ZONES[id], x, z);
  return into;
}

/** The level of one bed, 0 to 1, for where the hero is and the hour. */
export function bedLevel(rule: BedRule, zones: Zones, where: Where): number {
  let level = rule.gain * hoursWeight(rule.hours, where.hour);
  if (rule.in) {
    let inside = 1;
    for (const id of rule.in) inside *= zones[id];
    const floor = rule.floor ?? 0;
    // A floor keeps a little of the bed wherever the first zone holds: the town murmurs off the square too.
    level *= rule.floor !== undefined ? Math.max(inside, floor * zones[rule.in[0] as ZoneId]) : inside;
  }
  for (const id of rule.out ?? []) level *= 1 - zones[id];
  if (rule.wild === 'open') level *= 1 - where.forest;
  else if (rule.wild === 'forest') level *= where.forest;
  level *= regionShare(rule.region, where.regions);
  return clamp01(level);
}

/** Every bed's level, by id. */
export function bedLevels(zones: Zones, where: Where, into: Record<string, number>): Record<string, number> {
  for (const rule of BEDS) into[rule.id] = bedLevel(rule, zones, where);
  return into;
}

/** How much a spot rule's zone holds where the hero is. `wild` is everywhere outside town. */
export function spotWeight(rule: SpotRule, zones: Zones, hour: number, regions?: Readonly<Record<string, number>>): number {
  const zone = rule.zone === 'wild' ? 1 - zones.town : zones[rule.zone];
  return zone * hoursWeight(rule.hours, hour) * regionShare(rule.region, regions);
}

/**
 * When each spot sound is next due. A rule out of its zone or hours waits, and starts its count again when
 * it comes back, so walking into the square does not set off five sounds at once.
 */
export class SpotClock {
  private readonly next: number[];
  constructor(private readonly rng: () => number, readonly rules: readonly SpotRule[] = SPOTS) {
    this.next = rules.map(() => -1);
  }

  /** Calls `fire` for each rule due at `now`, with its weight (0 to 1) where the hero is. */
  step(now: number, zones: Zones, hour: number, fire: (rule: SpotRule, weight: number) => void, regions?: Readonly<Record<string, number>>): void {
    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i] as SpotRule;
      const weight = spotWeight(rule, zones, hour, regions);
      if (weight < 0.15) {
        this.next[i] = -1;
        continue;
      }
      const [lo, hi] = rule.every;
      if (this.next[i] as number < 0) this.next[i] = now + lo * 0.4 + this.rng() * (hi - lo) * 0.6;
      if (now >= (this.next[i] as number)) {
        // A thin zone hears it less often as well as more softly.
        if (this.rng() < 0.35 + 0.65 * weight) fire(rule, weight);
        this.next[i] = now + lo + this.rng() * (hi - lo);
      }
    }
  }
}

/**
 * What a foot is on, from the block under it. A path, a floor, a quay and cobbles each sound like themselves.
 * Wood under a roof is a floor; wood under the sky is a bridge or a dock.
 */
export function stepMaterial(blockKey: string, surface: Surface, indoors: boolean): StepMaterial | null {
  if (surface === 'water') return 'water';
  switch (blockKey) {
    case 'path': return 'path';
    case 'cobble': case 'stone_brick': return 'cobble';
    case 'stone': case 'mossy_stone': return 'stone';
    case 'sand': return 'sand';
    case 'dirt': case 'tilled_soil': case 'clay': return 'dirt';
    case 'oak_plank': case 'oak_log': case 'birch_log': case 'pine_log': case 'barrier': return indoors ? 'floor' : 'wood';
    case 'grass': case 'thatch': return 'grass';
    case 'oak_leaves': case 'pine_needles': return 'leaves';
  }
  switch (surface) {
    case 'grass': case 'tallGrass': return 'grass';
    case 'dirt': return 'dirt';
    case 'stone': return 'cobble';
    case 'wood': return indoors ? 'floor' : 'wood';
    case 'sand': return 'sand';
    case 'leaves': return 'leaves';
    default: return null;
  }
}

/** The hero's pace: under 2.8 blocks a second is a soft walk, over 5.6 a run. */
export function gaitOf(speed: number): 'soft' | 'walk' | 'run' {
  return speed < 2.8 ? 'soft' : speed > 5.6 ? 'run' : 'walk';
}
