// What the game tells the performance meter (src/features/perf):
//
// - Which feature each object of the scene belongs to, so `window.__game.costs()` can say what the land, the
//   grass, the trees, the town and the rest each cost in draw calls and triangles.
// - When to warm the shaders. While the title is up and the land in view has arrived, everything in the scene
//   is compiled in the background, the hidden things too: the build grid, the lamps, the town across the river.
//   A start that comes sooner (a reload into the game, a test through the debug door) has it compiled at the
//   start of the first frame instead, before that frame's picture.
//
// The shell has no hook for "a game is about to start", so this view puts itself in front of `view.newGame`
// and `view.continueGame`. A hook in the shell would be the cleaner place.
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

/** Frames with nothing left to mesh before the land in view counts as arrived. */
const SETTLED = 3;

export function install(view: GameView): void {
  const { costs, warm } = view.perf;
  costs.names(FEATURES);

  let quiet = 0, asked = false;
  view.onFrame(() => {
    if (asked) return;
    quiet = view.world.stats.queue === 0 ? quiet + 1 : 0;
    if (quiet < SETTLED) return;
    asked = true;
    void warm.start();
  });

  const newGame = view.newGame, continueGame = view.continueGame;
  view.newGame = () => {
    if (!view.started) warm.finish();
    newGame();
  };
  view.continueGame = () => {
    if (!view.started) warm.finish();
    return continueGame();
  };
}
