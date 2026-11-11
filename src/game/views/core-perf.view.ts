// What the game tells the performance meter (src/features/perf): which feature each object of the scene
// belongs to, so `window.__game.costs()` can say what the land, the grass, the trees, the town and the rest
// each cost in draw calls and triangles.
import type { GameView } from '../shell/view.ts';

/** The feature of each named object in the scene. An object with no name here is listed as `other: <its name>`. */
const FEATURES: Readonly<Record<string, string>> = {
  // The ground and what grows on it.
  land: 'land',
  'far-land': 'far land',
  world: 'blocks',
  grass: 'grass',
  'painted-trees': 'trees',
  'great-oak': 'trees',
  'model trees and rocks': 'trees',
  'far-trees': 'far trees',
  boulders: 'rocks and bushes',
  bushes: 'rocks and bushes',
  props: 'props',
  crops: 'crops',
  'wet-soil': 'crops',
  'painted-water': 'water',
  // What people made.
  'town models': 'town',
  'river-lamps': 'lamps',
  'river-lamp-glow': 'lamps',
  // The sky.
  sky: 'sky',
  'sky-phenomena': 'sky',
  'cloud-shadows': 'sky',
  backdrop: 'sky',
  // People and creatures.
  sprites: 'people',
  'sprite-shadows': 'people',
  hero: 'people',
  // Particles.
  effects: 'effects',
  // Marks the game draws over the world: the aim box, the ghost of what would be placed, build mode's grid, the quest beam.
  aim: 'markers',
  ghost: 'markers',
  'build-tiles': 'markers',
  'build-ghost': 'markers',
  'build-lift': 'markers',
  'waypoint-beam': 'markers',
};

export function install(view: GameView): void {
  view.perf.costs.names(FEATURES);
}
