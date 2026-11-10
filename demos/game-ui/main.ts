// The panels alone, over a fake game: stub systems, sample data, and buttons that open each panel.
//
//   ?panel=bag|hand|make|almanac|quests|title|pause|settings|end   opens that panel at the start and hides the buttons
//   ?extras=1    shows the prompt, a hint, toasts, the Almanac's note and the breaking ring
//   ?save=0      the title has nothing to continue
//   ?art=0       leaves out the manifest's ui pictures, to show the CSS fallback
// `window.__ui` is the interface and `window.__demo` the fake game, for scripts.

import type {
  ActionsApi, AlmanacApi, AlmanacPage, CraftingApi, Game, InteractApi, InventoryApi, ItemDef, ItemsApi, QuestView, QuestsApi, Recipe, Stack, Systems, TalkApi,
} from '../../src/game/api.sim.ts';
import { createEvents, createFlags } from '../../src/game/kernel.sim.ts';
import { calmNoon } from '../../src/engine/types.ts';
import { createGameUi, type IconRef, type PanelName, type PictureRef } from '../../src/game/ui/index.ui.ts';

// ---------------------------------------------------------------------------------------- sample data

const item = (id: string, name: string, icon: string, description: string, stack = 99): ItemDef => ({ id, name, icon, stack, description });
const ITEMS: ItemDef[] = [
  item('axe', 'Axe', 'axe', 'Tamsin’s old axe. It cuts logs three times faster than hands do.', 1),
  item('hoe', 'Hoe', 'hoe', 'Turns grass or dirt into soil a seed can take.', 1),
  item('can', 'Watering can', 'can', 'Wets the soil under a crop for three minutes.', 1),
  item('almanac', 'The Almanac', 'book', 'Blank for forty years. It writes down what a living thing needs and what it gives.', 1),
  item('log', 'Oak log', 'wood', 'A length of oak. One log makes four planks by hand.'),
  item('planks', 'Planks', 'planks', 'Sawn oak. Benches, beds and chests start here.'),
  item('fiber', 'Fiber', 'fiber', 'Tough strands from leaves and grass.'),
  item('berry', 'Berries', 'berry', 'Sweet and a little sharp. A leaftail will come a long way for one.'),
  item('seed', 'Wheat seeds', 'seed', 'Plant them in tilled soil and keep it wet.'),
  item('wheat', 'Wheat', 'wheat', 'A ripe sheaf. Queen Maren wants twenty by the festival.'),
  item('moss', 'Moss tuft', 'moss', 'Left by a mossling on damp ground. Soft, and it holds a little light.'),
  item('workbench', 'Workbench', 'workbench', 'Set it down and stand near it to make bigger things.', 1),
  item('bed', 'Bed', 'bed', 'Sleep in it under a roof to skip to morning.', 1),
  item('chest', 'Chest', 'chest', 'Holds what the bag cannot.', 1),
  item('lamp', 'Lamp', 'lantern', 'A small light for the dark end of the day.', 16),
];

const RECIPES: Recipe[] = [
  { id: 'planks', makes: { id: 'planks', count: 4 }, needs: [{ id: 'log', count: 1 }], station: 'hand' },
  { id: 'workbench', makes: { id: 'workbench', count: 1 }, needs: [{ id: 'planks', count: 4 }], station: 'hand' },
  { id: 'bed', makes: { id: 'bed', count: 1 }, needs: [{ id: 'planks', count: 6 }, { id: 'fiber', count: 3 }], station: 'workbench' },
  { id: 'chest', makes: { id: 'chest', count: 1 }, needs: [{ id: 'planks', count: 8 }], station: 'workbench' },
  { id: 'lamp', makes: { id: 'lamp', count: 1 }, needs: [{ id: 'planks', count: 1 }, { id: 'moss', count: 1 }], station: 'workbench' },
];

const PAGES: AlmanacPage[] = [
  {
    id: 'mossling', title: 'Mossling', picture: 'critter', kind: 'creature', seen: true, complete: false,
    facts: [
      { id: 'needs', column: 'needs', text: 'Shade and mossy stone', known: true },
      { id: 'gives', column: 'gives', text: 'A moss tuft, when the ground under it is damp', known: false },
    ],
  },
  {
    id: 'leaftail', title: 'Leaftail', picture: 'pet', kind: 'pet', seen: true, complete: false,
    facts: [
      { id: 'needs', column: 'needs', text: 'Berries, and someone who walks slowly', known: false },
      { id: 'gives', column: 'gives', text: 'A wheat seed dug from the grass, about once a minute', known: false },
    ],
  },
  {
    id: 'wheat', title: 'Wheat', picture: 'wheat', kind: 'crop', seen: true, complete: true,
    facts: [
      { id: 'soil', column: 'needs', text: 'Tilled soil', known: true },
      { id: 'water', column: 'needs', text: 'Water every three minutes, or rain', known: true },
      { id: 'gives', column: 'gives', text: 'Two wheat, and sometimes a seed', known: true },
    ],
  },
  { id: 'gus', title: 'Gus', picture: 'villager-a', kind: 'person', seen: false, complete: false, facts: [{ id: 'needs', column: 'needs', text: 'Rain', known: false }] },
];

const QUESTS: QuestView[] = [
  {
    id: 'plot', title: 'A plot of your own', summary: 'Tamsin gave you the grant and a blank book.', state: 'done',
    steps: [
      { id: 'meet', text: 'Talk to Tamsin at the grant stone', done: true },
      { id: 'watch', text: 'Watch a mossling until both columns of its page fill', done: true },
      { id: 'tell', text: 'Tell Tamsin what you saw', done: true },
    ],
  },
  {
    id: 'roof', title: 'A roof before dark', summary: 'Night is cold on open ground. Build somewhere to sleep.', state: 'active',
    steps: [
      { id: 'wood', text: 'Chop 12 wood', done: true, have: 12, need: 12 },
      { id: 'bench', text: 'Make a workbench and set it down', done: true },
      { id: 'shelter', text: 'Put a bed under a roof', done: false },
      { id: 'sleep', text: 'Sleep until morning', done: false },
    ],
  },
  {
    id: 'bread', title: 'The queen’s bread', summary: 'Queen Maren needs twenty sheaves by the festival.', state: 'active',
    steps: [
      { id: 'town', text: 'Walk to Hollowmere', done: true },
      { id: 'queen', text: 'Talk to Queen Maren in the granary', done: true },
      { id: 'seeds', text: 'Get seeds from Gus', done: true },
      { id: 'grow', text: 'Harvest wheat', done: false, have: 7, need: 20 },
      { id: 'deliver', text: 'Bring the wheat to Maren', done: false },
    ],
  },
  { id: 'festival', title: 'The harvest festival', summary: '', state: 'hidden', steps: [] },
];

// ---------------------------------------------------------------------------------------- the fake game

const events = createEvents();
const itemsById = new Map(ITEMS.map((def) => [def.id, def]));
const items: ItemsApi = {
  get: (id) => itemsById.get(id) ?? item(id, id, id, ''),
  all: () => ITEMS,
};

const slots: (Stack | null)[] = Array.from({ length: 36 }, () => null);
const put = (index: number, id: string, count: number): void => { slots[index] = { id, count }; };
put(0, 'axe', 1); put(1, 'hoe', 1); put(2, 'can', 1); put(3, 'seed', 12); put(4, 'berry', 3); put(8, 'almanac', 1);
put(9, 'log', 14); put(10, 'planks', 5); put(11, 'fiber', 2); put(12, 'wheat', 7); put(13, 'moss', 1); put(20, 'lamp', 2); put(35, 'workbench', 1);

const inventory: InventoryApi = {
  slots,
  selected: 0,
  held() { return slots[this.selected]; },
  count: (id) => slots.reduce((sum, stack) => sum + (stack?.id === id ? stack.count : 0), 0),
  add(id, count) {
    const same = slots.find((stack) => stack?.id === id);
    if (same) same.count += count;
    else {
      const free = slots.indexOf(null);
      if (free < 0) return count;
      slots[free] = { id, count };
    }
    events.emit('inventory.changed', {});
    return 0;
  },
  remove(id, count) {
    if (this.count(id) < count) return false;
    let left = count;
    slots.forEach((stack, index) => {
      if (!stack || stack.id !== id || left === 0) return;
      const take = Math.min(stack.count, left);
      stack.count -= take;
      left -= take;
      if (stack.count === 0) slots[index] = null;
    });
    events.emit('inventory.changed', {});
    return true;
  },
  move(from, to) {
    const a = slots[from], b = slots[to];
    if (a && b && a.id === b.id) {
      b.count += a.count;
      slots[from] = null;
    } else {
      slots[to] = a;
      slots[from] = b;
    }
    events.emit('inventory.changed', {});
  },
};

/** True when the demo pretends a workbench stands in reach. */
let atBench = false;
const crafting: CraftingApi = {
  recipes: () => RECIPES,
  available: () => RECIPES.filter((recipe) => recipe.station === 'hand' || atBench),
  canMake: (id) => RECIPES.find((recipe) => recipe.id === id)?.needs.every((need) => inventory.count(need.id) >= need.count) ?? false,
  make(id) {
    const recipe = RECIPES.find((entry) => entry.id === id);
    if (!recipe || !this.canMake(id)) return false;
    for (const need of recipe.needs) inventory.remove(need.id, need.count);
    inventory.add(recipe.makes.id, recipe.makes.count);
    events.emit('item.crafted', { ...recipe.makes, station: recipe.station });
    return true;
  },
};

const almanac: AlmanacApi = {
  pages: () => PAGES,
  page: (id) => PAGES.find((page) => page.id === id),
  learn(pageId, factId) {
    const page = this.page(pageId);
    const fact = page?.facts.find((entry) => entry.id === factId);
    if (!page || !fact || fact.known) return;
    fact.known = true;
    page.seen = true;
    events.emit('fact.learned', { page: pageId, column: fact.column, fact: factId });
    if (page.facts.every((entry) => entry.known)) {
      page.complete = true;
      events.emit('page.completed', { page: pageId });
    }
  },
  meet(pageId) {
    const page = this.page(pageId);
    if (page) page.seen = true;
  },
};

const quests: QuestsApi = { all: () => QUESTS, tracked: () => QUESTS[1], start() {}, skipTo() {} };

let promptOn = false;
const tamsin = { id: 'npc:tamsin', pos: () => ({ x: 0, y: 0, z: 0 }), radius: 3, prompt: () => 'Talk to Tamsin', act() {} };
const interact: InteractApi = { add() {}, remove() {}, nearest: () => (promptOn ? tamsin : null), act: () => promptOn };

let breakStart: number | null = null;
const breaking = { x: 0, y: 0, z: 0, progress: 0 };
const actions: ActionsApi = {
  use: () => false,
  addHandler() {},
  hold: () => false,
  breaking() {
    if (breakStart === null) return null;
    breaking.progress = Math.min(1, ((performance.now() - breakStart) % 2400) / 2000);
    return breaking;
  },
  reach: 5,
};

const talk = { active: false } as TalkApi;
const game: Game = {
  world: null as unknown as Game['world'],
  events,
  flags: createFlags(events),
  player: { pos: { x: 0, y: 0, z: 0 }, facing: 0, onGround: true, inWater: false, busy: false },
  clock: { day: 3, timeOfDay: 0.4, seconds: 0 },
  ambient: calmNoon(),
  actors: new Map(),
  systems: { items, inventory, crafting, almanac, quests, interact, actions, talk } as unknown as Systems,
  random: () => 0.5,
};

// ---------------------------------------------------------------------------------------- the page

interface DemoManifest {
  sprites: Record<string, { sheet: string; frame: [number, number] }>;
  icons?: { tile: number; sheet: string; names: Record<string, [number, number]> };
  ui?: { title?: string; panel?: string; button?: string };
}

const query = new URLSearchParams(location.search);
const manifest: DemoManifest = await fetch('./assets/manifest.json').then((response) => response.json());

const icon = (name: string): IconRef | null => {
  const cell = manifest.icons?.names[name];
  if (!manifest.icons || !cell) return null;
  const size = manifest.icons.tile;
  return { url: `./assets/${manifest.icons.sheet}`, x: cell[0] * size, y: cell[1] * size, size };
};
const picture = (name: string): PictureRef | null => {
  const sprite = manifest.sprites[name];
  return sprite ? { url: `./assets/${sprite.sheet}`, x: 0, y: 0, width: sprite.frame[0], height: sprite.frame[1] } : null;
};

/** A picture from the manifest's `ui` entry, or nothing with ?art=0, which shows the CSS fallback. */
const art = (name: 'title' | 'panel' | 'button'): string | undefined => {
  const path = query.get('art') === '0' ? undefined : manifest.ui?.[name];
  return path ? `./assets/${path}` : undefined;
};

let saved = query.get('save') !== '0';
const log = (text: string): void => console.info(`[demo] ${text}`);
const root = document.querySelector<HTMLElement>('#ui')!;
const ui = createGameUi(root, game, {
  icon,
  picture,
  project: () => ({ x: root.clientWidth * 0.5, y: root.clientHeight * 0.56 }),
  stats: () => ({ days: 3, wheat: 24, blocks: 61, pages: PAGES.filter((page) => page.complete).length }),
  hasSave: () => saved,
  newGame: () => { saved = true; log('new game'); },
  continueGame: () => log('continue'),
  saveAndQuit: () => { saved = true; log('saved'); },
  setQuality: (quality) => log(`quality ${quality}`),
  setVolume: (channel, value) => log(`${channel} ${value}`),
  setInterfaceSize: (size) => log(`size ${size}`),
  art: {
    title: art('title'),
    panel: art('panel') ? { url: art('panel')! } : undefined,
    button: art('button') ? { url: art('button')! } : undefined,
  },
});

const showExtras = (): void => {
  promptOn = true;
  breakStart = performance.now();
  events.emit('hint', { id: 'slow', text: 'Hold Shift to walk slowly. Wild things startle when you rush them.' });
  events.emit('toast', { text: 'Oak log', icon: 'wood' });
  events.emit('toast', { text: 'Oak log', icon: 'wood' });
  events.emit('toast', { text: 'Oak log', icon: 'wood' });
  events.emit('toast', { text: 'Fiber', icon: 'fiber' });
  almanac.learn('mossling', 'gives');
};

const controls = document.querySelector<HTMLElement>('#controls')!;
const control = (label: string, run: () => void): void => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', run);
  controls.append(button);
};
const open = (name: string): void => {
  atBench = name === 'make';
  if (name === 'hand') ui.open('bag', 'hand');
  else ui.open(name as PanelName);
};
for (const name of ['bag', 'make', 'almanac', 'quests', 'title', 'pause', 'settings']) control(name[0].toUpperCase() + name.slice(1), () => open(name));
control('End card', () => events.emit('act.ended', { act: 1 }));
control('Workbench (event)', () => { atBench = true; events.emit('ui.open', { panel: 'make' }); });
control('Add a fact', () => {
  const next = PAGES.flatMap((page) => page.facts.filter((fact) => !fact.known).map((fact) => [page.id, fact.id] as const))[0];
  if (next) almanac.learn(next[0], next[1]);
});
control('Hint', () => events.emit('hint', { id: `hint-${Date.now()}`, text: 'Wet soil grows wheat. Dry soil only holds it.' }));
control('Toast', () => events.emit('toast', { text: 'Oak log', icon: 'wood' }));
control('Other toast', () => events.emit('toast', { text: 'Berries', icon: 'berry' }));
control('Prompt', () => { promptOn = !promptOn; });
control('Breaking ring', () => { breakStart = breakStart === null ? performance.now() : null; });

const panel = query.get('panel');
if (panel) {
  controls.hidden = true;
  open(panel);
}
if (query.get('extras') === '1') showExtras();

Object.assign(window, { __ui: ui, __demo: { game, almanac, showExtras, open } });
