// Act 1's moments: every place, room and scene a player sees, how the game reaches it, and the approved sheets it
// must match. `tools/look-beside.mjs` plays these; `docs/act1-look.md` lists the same ids with their grades.
//
// A moment:
//   id       the name on the command line and the file name
//   title    what the player sees
//   url      extra address words: `opening` (a grant-day step), `at` (a region place to start at)
//   quest    the quest `skipTo` puts the game at, or none for a new game
//   setup    a name in SETUPS below, run in the page after the skip: build the plot, call the people
//   time     the time of day: 0.25 sunrise, 0.5 noon, 0.75 sunset
//   day      the day number, for market day
//   stand    where the hero stands: a region place, or [x, z]
//   off      blocks east and south of `stand`
//   face     the hero's facing, in radians (0 looks north, PI south)
//   quarter  quarter turns of the 2.5D camera from its start (1 to the right)
//   zoom     steps in from the default zoom (0 is the default, the farthest; 2 the nearest)
//   scene    a scene of chapter 22 to start there: the hero stands at `stand`, and the picture is taken once its
//            conversation is open and the camera has framed it. `lines` turns that many lines first.
//   sheets   the approved pictures, best first: a path in the repo, or `playthrough:<path>` in the playthrough site
//            (~/dev/sandbox/game-look-test/playthrough/assets)
//   owner    the system of docs/act1-foundation.md that owns how it looks

/** Things a moment needs that `skipTo` does not do. Each runs in the page on its own, after the skip. */
export const SETUPS = {
  /** The homestead of the kitchen quest: a cottage, the oven and table, a lamp, and the dinner table, which brings its own benches. */
  homestead: () => {
    const g = window.__game;
    const sys = g.view.game.systems;
    const r = sys.region.grant(), y = sys.region.place('grant.center').at.y;
    const set = [['cottage', 4, 4, 2], ['oven', 12, 5, 2], ['prep_table', 15, 6, 2], ['lantern', 10, 9], ['dinner_table', 11, 12]];
    for (const [kind, dx, dz, turns] of set) sys.placeables.place(kind, r.x + dx, y, r.z + dz, turns ?? 0);
    g.view.game.flags.set('farm.moss.living', true);
    g.advance(1.5);
  },
  /** The homestead, then Gus home with the others, so the first dinner is on: Gus's and Hobb's asks. The table brings its own benches. */
  dinner: () => {
    const g = window.__game;
    const sys = g.view.game.systems;
    const r = sys.region.grant(), y = sys.region.place('grant.center').at.y;
    const set = [['cottage', 4, 4, 2], ['oven', 12, 5, 2], ['prep_table', 15, 6, 2], ['lantern', 10, 9], ['dinner_table', 11, 12]];
    for (const [kind, dx, dz, turns] of set) sys.placeables.place(kind, r.x + dx, y, r.z + dz, turns ?? 0);
    g.view.game.flags.set('fight.5.won', true);
    g.setTime(0.74);
    g.advance(2);
    // Sit down before the people reach the table: there, their own prompts are nearer than the table's.
    // The door is the middle of the table's north side: 3 blocks in on a 6-long table, 1 on an older 2 by 2 one.
    const t = sys.placeables.all().find((p) => p.kind === 'dinner_table');
    for (const dx of [3, 1]) {
      g.teleport(t.x + dx, undefined, t.z - 1, Math.PI);
      g.advance(0.1);
      if (sys.interact.nearest()?.prompt() === 'Sit down to dinner') { g.interact(); break; }
    }
    // Then they come to the table and sit, as a player sees them once the panel is up.
    g.advance(20);
    if (!sys.settlement.dinner()) throw new Error('the dinner did not open');
  },
  /** The hamlet of the roofs quest: three homes, the map room, lamps and the workrooms. */
  hamlet: () => {
    const g = window.__game;
    const sys = g.view.game.systems;
    const r = sys.region.grant(), y = sys.region.place('grant.center').at.y;
    const set = [['cottage', 4, 4, 2], ['oven', 12, 5, 2], ['prep_table', 15, 6, 2], ['lantern', 10, 9], ['dinner_table', 11, 12],
      ['cottage', 18, 2, 2], ['map_room', 20, 10, 2], ['lantern', 17, 8], ['lantern', 24, 17], ['smokehouse', 1, 12, 1], ['beast_yard', 2, 20, 2], ['watch_post', 22, 22]];
    for (const [kind, dx, dz, turns] of set) sys.placeables.place(kind, r.x + dx, y, r.z + dz, turns ?? 0);
    g.view.game.flags.set('fight.5.won', true);
    g.advance(25);
  },
  /** Market day: day 7. */
  marketDay: () => {
    const g = window.__game;
    g.view.game.clock.day = 7;
    g.view.game.events.emit('day.started', { day: 7 });
    g.advance(2);
  },
};

const P = (path) => `playthrough:${path}`;
const C = (path) => `assets-src/concept/${path}`;

/** @type {Array<Record<string, any>>} */
export const MOMENTS = [
  // ---------------------------------------------------------------------------- Saltgate, grant day
  { id: 'sg-bunks', title: 'Scene 1: waking in the bunk room under the painted wall', kind: 'scene', url: { opening: 'wake' }, time: 0.3,
    sheets: [C('rooms/guildHall.webp'), P('cine/p1-wall.jpg')], owner: 'The opening' },
  { id: 'sg-kitchen', title: 'Breakfast in Hobb\'s kitchen at the guild', kind: 'room', url: { opening: 'breakfast' }, time: 0.3,
    sheets: [C('rooms/guildHall.webp')], owner: 'The opening' },
  { id: 'sg-maps', title: 'Scene 3: the map wall, Mina on the ladder', kind: 'scene', url: { opening: 'map' }, time: 0.35,
    sheets: [C('rooms/guildHall.webp'), P('scenes/03-book.jpg')], owner: 'The opening' },
  { id: 'sg-yard', title: 'Scene 4 and 5: the guild yard, the rack and the grant table', kind: 'scene', url: { opening: 'deed' }, time: 0.5,
    sheets: [C('rooms/guildHall.webp'), P('scenes/02-grant.jpg')], owner: 'The opening' },
  { id: 'sg-quay', title: 'Scene 6: the quay and the ferry', kind: 'scene', url: { opening: 'quay' }, time: 0.55,
    sheets: [C('region-saltgate/vista-harbour.webp'), C('region-saltgate/kit-port.webp')], owner: 'The opening' },
  { id: 'sg-street', title: 'Guild Street outside the hall', kind: 'place', url: { opening: 'deed' }, time: 0.5, off: [8, 12],
    sheets: [C('region-saltgate/vista-guild.webp'), C('region-saltgate/kit-saltgate.webp')], owner: 'The opening' },

  // ---------------------------------------------------------------------------- home, chapter 1
  { id: 'landing', title: 'Scene 7: the landing, ground nobody wanted', kind: 'place', quest: 'ground', stand: 'landing', time: 0.45,
    sheets: [C('region-home/vista-arrival.webp'), C('4-water/jetty.webp'), P('scenes/01-ferry.jpg')], owner: 'The world' },
  { id: 'plot-tired', title: 'The plot on the first day: tired ground, the pond, the stone', kind: 'place', quest: 'ground', stand: 'plot', time: 0.4,
    sheets: [C('region-home/vista-tired.webp'), C('region-home/plan.webp')], owner: 'The world' },
  { id: 'pond', title: 'The pond and the dry field the ditch must reach', kind: 'place', quest: 'ground', stand: 'plot.pond', off: [-3, 3], time: 0.45,
    sheets: [C('region-home/vista-tired.webp'), C('region-home/kit-meadow.webp')], owner: 'The world' },
  { id: 'door-day', title: 'Scene 8: the shut door in the hill, by day', kind: 'place', quest: 'night', stand: 'shut.door', off: [3, 5], time: 0.45,
    sheets: [C('3-sacred/hallDoor.webp'), P('cine/p9-doorstep-day.jpg'), C('3-sacred/vista.webp')], owner: 'The world' },
  { id: 'camp-dusk', title: 'Scene 9: dusk at the camp, the fire and the tent', kind: 'scene', quest: 'night', stand: 'camp', off: [0, 3], time: 0.77,
    sheets: [C('settlement/camp.webp'), C('region-home/vista-night.webp'), P('scenes/04-fox.jpg')], owner: 'People and the settlement' },
  { id: 'door-night', title: 'Scene 10: the door at night, the fox behind', kind: 'scene', quest: 'night', stand: 'shut.door', off: [3, 4], time: 0.85,
    sheets: [P('scenes/05-door.jpg'), C('3-sacred/hallDoor.webp')], owner: 'The world' },
  { id: 'hall-heart', title: 'Scene 11 and 14: Ilara\'s Hall, the Heartstone in its court', kind: 'room', quest: 'greywood', stand: 'hall.heart', off: [0, 6], time: 0.55,
    sheets: [C('rooms/hallInside.webp'), C('settlement/heartstone.webp'), P('scenes/06-hall.jpg')], owner: 'People and the settlement' },
  { id: 'hall-custodian', title: 'Scene 12: the Custodian on its plinth', kind: 'room', quest: 'greywood', stand: 'hall.custodian', off: [0, 4], time: 0.55, zoom: 1,
    sheets: [C('rooms/hallInside.webp'), C('people-old/custodian.webp')], owner: 'People and the settlement' },
  { id: 'hall-night', title: 'The Hall at night, the lamps awake', kind: 'room', quest: 'greywood', stand: 'hall.heart', off: [0, 6], time: 0.9,
    sheets: [C('rooms/hallInside.webp'), P('cine/p3-hall.jpg')], owner: 'People and the settlement' },
  { id: 'hall-mural', title: 'Scene 24: the mural and the dull stone', kind: 'room', quest: 'echo', stand: 'hall.mural', off: [0, 4], time: 0.5, zoom: 1,
    sheets: [C('rooms/hallInside.webp'), C('6-ruins/muralWall.webp')], owner: 'Ruins and vaults' },

  // ---------------------------------------------------------------------------- home, chapter 2
  { id: 'blessing', title: 'Scene 16: the blessing at the grant stone', kind: 'scene', quest: 'blessing', stand: 'grant.stone', off: [0, 8], time: 0.4, scene: { n: 16 },
    sheets: [P('scenes/08-blessing.jpg'), C('people-world/elowen.webp')], owner: 'Quests and scenes' },
  { id: 'hobb-dax', title: 'Scene 18: Hobb and Dax come up the path', kind: 'scene', quest: 'kitchen', stand: 'grant.stone', off: [0, 8], time: 0.45, scene: { n: 18 },
    sheets: [P('scenes/09-kitchen.jpg'), C('people-home/hobb.webp')], owner: 'Quests and scenes' },
  { id: 'homestead', title: 'The homestead: cottage, kitchen and oven, the first lamp', kind: 'place', quest: 'greywood', setup: 'homestead', stand: 'grant', off: [7, 14], time: 0.42,
    sheets: [C('settlement/stages.webp'), C('settlement/kitchen.webp'), C('settlement/homes.webp')], owner: 'People and the settlement' },
  { id: 'dinner', title: 'The first dinner on the green, the choice asked at the table', kind: 'scene', quest: 'echo', setup: 'dinner', time: 0.76,
    sheets: [C('settlement/dinner.webp'), P('scenes/29-dinner.jpg'), C('interface/dinner.webp')], owner: 'People and the settlement' },
  { id: 'hamlet', title: 'The hamlet: three roofs, the map room, the workrooms', kind: 'place', quest: 'roofs', setup: 'hamlet', stand: 'grant', off: [14, 24], time: 0.45,
    sheets: [C('settlement/stages.webp'), P('scenes/21-hamlet.jpg'), C('settlement/workrooms.webp')], owner: 'People and the settlement' },
  { id: 'oak-shrine', title: 'The oak hill and its shrine', kind: 'place', quest: 'copper', stand: 'shrine-oak', off: [4, 4], time: 0.45,
    sheets: [C('3-sacred/shrine.webp'), C('3-sacred/vista.webp')], owner: 'Ruins and vaults' },
  { id: 'dead-garden', title: 'The dead garden and its cottage', kind: 'place', quest: 'copper', stand: 'garden', off: [0, 6], time: 0.45,
    sheets: [C('region-home/kit-garden.webp'), C('6-ruins/deadCottage.webp')], owner: 'The world' },
  { id: 'home-alive', title: 'The plot after the Stag: green overnight', kind: 'place', quest: 'pilgrimage', setup: 'hamlet', stand: 'grant', off: [14, 24], time: 0.45,
    sheets: [C('region-home/vista-alive.webp'), C('settlement/stages.webp')], owner: 'The world' },

  // ---------------------------------------------------------------------------- the valley
  // Where a player stands for each fight, on the game's own camera: the foxes' ground (424,210) and by the boar (438,204).
  // The High Road's deck stands between that camera and the clearing; the sight rule cuts it away under the grey wood.
  { id: 'greywood', title: 'Scene 20: the grey wood under the High Road', kind: 'place', quest: 'greywood', stand: 'boar', off: [-14, 6], time: 0.3,
    sheets: [C('region-forests/vista-grey.webp'), P('cine/p6-grey-wood.jpg'), P('scenes/18-wren.jpg')], owner: 'The world' },
  { id: 'boar', title: 'Scene 21: not yet, the boar as big as a cart', kind: 'place', quest: 'greywood', stand: 'boar', off: [-4, 3], time: 0.4,
    sheets: [P('scenes/11-boar.jpg'), C('creatures/boar.webp')], owner: 'Fights in the world' },
  { id: 'high-road', title: 'The High Road\'s arches across the valley', kind: 'place', quest: 'count', stand: 'arches', off: [6, 8], time: 0.45,
    sheets: [C('1-high-road/vista.webp'), C('region-north/vista-road.webp')], owner: 'The world' },
  { id: 'arches-lit', title: 'Scene 23: the road is lit, gold along the arches at dusk', kind: 'place', quest: 'count', stand: 'arches', off: [6, 8], time: 0.78,
    sheets: [P('scenes/16-road.jpg'), P('scenes/23-relit.jpg'), C('region-north/vista-road.webp')], owner: 'The world' },
  { id: 'bridge', title: 'Hollowmere from the bridge', kind: 'place', quest: 'count', stand: 'bridge', time: 0.45,
    sheets: [C('region-hollowmere/vista-wide.webp')], owner: 'The world' },
  { id: 'town-gate', title: 'The town gate', kind: 'place', quest: 'count', stand: 'town.gate', off: [-4, 6], time: 0.45,
    sheets: [C('region-hollowmere/vista-wide.webp'), C('region-hollowmere/kit-street.webp')], owner: 'The world' },
  { id: 'town-square', title: 'The square and the Hollow Oak', kind: 'place', quest: 'count', stand: 'town.square', off: [0, 8], time: 0.45,
    sheets: [C('region-hollowmere/vista-street.webp'), C('region-hollowmere/plan.webp')], owner: 'The world' },
  { id: 'market', title: 'The market on market day', kind: 'place', quest: 'count', setup: 'marketDay', stand: 'town.market', off: [0, 8], time: 0.42,
    sheets: [C('region-hollowmere/vista-marketday.webp'), C('region-hollowmere/kit-parts.webp')], owner: 'People and the settlement, goods' },
  { id: 'granary', title: 'Scene 22: the queen\'s count in the granary', kind: 'scene', quest: 'count', stand: 'town.granary', off: [0, 5], time: 0.45,
    sheets: [P('scenes/19-granary.jpg'), C('people-world/maren.webp')], owner: 'The world' },
  { id: 'chapel', title: 'The chapel on its rise', kind: 'place', quest: 'count', stand: 'town.chapel', off: [7, 7], time: 0.45,
    sheets: [C('5-order/chapel.webp'), C('5-order/vista.webp')], owner: 'The world' },
  { id: 'town-quay', title: 'The town quay and warehouses', kind: 'place', quest: 'count', stand: 'town.quay', off: [0, 6], time: 0.5,
    sheets: [C('region-hollowmere/kit-quay.webp'), P('scenes/25-quay.jpg')], owner: 'The world' },
  { id: 'town-night', title: 'Hollowmere at night', kind: 'place', quest: 'count', stand: 'town.square', off: [0, 8], time: 0.9,
    sheets: [C('region-hollowmere/vista-night.webp')], owner: 'The world' },
  { id: 'mill', title: 'The old mill and its wheel', kind: 'place', quest: 'copper', stand: 'ruin-mill', off: [6, 6], time: 0.45,
    sheets: [C('4-water/oldMill.webp')], owner: 'The world' },
  { id: 'pumphouse', title: 'The Pump House on the river', kind: 'place', quest: 'pump', stand: 'pumphouse', off: [8, 4], time: 0.45,
    sheets: [C('4-water/pumpHouse.webp'), C('region-southeast/vista-pumphouse.webp'), P('scenes/12-pump-house.jpg')], owner: 'Ruins and vaults' },
  { id: 'caves', title: 'The root caves', kind: 'place', quest: 'gallery', stand: 'caves', off: [0, 6], time: 0.45,
    sheets: [C('region-southeast/vista-caves.webp'), C('7-ways-down/caveMouth.webp')], owner: 'The world' },
  { id: 'gallery', title: 'The Lamp Gallery\'s mouth', kind: 'place', quest: 'gallery', stand: 'lampgallery', off: [5, 5], time: 0.45,
    sheets: [C('7-ways-down/galleryMouth.webp'), P('scenes/13-gallery.jpg')], owner: 'Ruins and vaults' },
  { id: 'seedvault', title: 'The Seed Vault in the Old Forest', kind: 'place', quest: 'seeds', stand: 'seedvault', time: 0.45,
    sheets: [C('region-forests/vista-seedvault.webp'), C('7-ways-down/vaultRoots.webp')], owner: 'Ruins and vaults' },
  // On the west path among the giants, between the knoll and the forest stair.
  { id: 'old-forest', title: 'The Old Forest\'s groves', kind: 'place', quest: 'seeds', stand: [-220, -252], time: 0.45,
    sheets: [C('region-forests/vista-oldforest.webp'), C('region-forests/kit-trees.webp')], owner: 'The world' },
  { id: 'forest-stair', title: 'The forest stair under its gap in the crowns', kind: 'place', quest: 'seeds', stand: 'ruin-stair', time: 0.45,
    sheets: [C('region-forests/kit-ruins.webp'), C('region-forests/plan.webp')], owner: 'The world' },
  { id: 'forest-shrine', title: 'The forest shrine in its clearing', kind: 'place', quest: 'seeds', stand: 'shrine-forest', time: 0.45,
    sheets: [C('region-forests/kit-ruins.webp'), C('region-forests/plan.webp')], owner: 'The world' },
  { id: 'forest-grove', title: 'The cathedral grove under the giants', kind: 'place', quest: 'seeds', stand: [-325, -148], time: 0.45,
    sheets: [C('region-forests/plan.webp'), C('region-forests/vista-oldforest.webp')], owner: 'The world' },
  // In the clearing's north part, its grey giants round the top of the picture and the High Road's stair tower well
  // below it. Wren's camp is south of the road, 28 blocks off: the game camera cannot hold both.
  { id: 'bramble-camp', title: 'Bramble\'s clearing under its grey giants', kind: 'place', quest: 'greywood', stand: 'boar', off: [-4, -4], time: 0.4,
    sheets: [C('region-forests/vista-edge.webp'), C('region-forests/kit-grey.webp')], owner: 'The world' },
  { id: 'marsh', title: 'Lantern Marsh and its shrine', kind: 'place', quest: 'pump', stand: 'shrine-marsh', off: [0, 8], time: 0.5,
    sheets: [C('region-southeast/vista-marsh-day.webp'), C('8-set-pieces/boardwalk.webp')], owner: 'The world' },
  { id: 'sunk-tower', title: 'The sunk tower', kind: 'place', quest: 'copper', stand: 'ruin-tower', off: [6, 6], time: 0.45,
    sheets: [C('6-ruins/sunkTower.webp')], owner: 'The world' },
  { id: 'terraces', title: 'Scene 32: the terraces and the Old Gate', kind: 'place', quest: 'keystones', stand: 'terraces', off: [8, 8], time: 0.45,
    sheets: [C('2-terraces/vista.webp'), C('2-terraces/oldGate.webp'), C('region-north/vista-terraces.webp')], owner: 'The world' },
  { id: 'stag', title: 'Scene 33: the Verdant Stag in chains', kind: 'place', quest: 'stag', stand: 'terraces', off: [6, 6], time: 0.45,
    sheets: [C('rooms/stagHall.webp'), P('scenes/15-stag.jpg'), C('people-old/stag.webp')], owner: 'Fights in the world, ruins' },
  { id: 'dawn', title: 'The Dawn on the northern horizon', kind: 'place', quest: 'pilgrimage', stand: 'terraces', off: [0, 0], time: 0.3, quarter: 2,
    sheets: [C('region-north/vista-dawn.webp'), C('5-order/dawnDome.webp')], owner: 'The world' },
  { id: 'second-blessing', title: 'Scene 36: the second blessing on the green', kind: 'scene', quest: 'pilgrimage', stand: 'town.square', off: [0, 8], time: 0.5,
    sheets: [P('scenes/22-band.jpg'), C('region-hollowmere/vista-street.webp')], owner: 'Quests and scenes' },
];
