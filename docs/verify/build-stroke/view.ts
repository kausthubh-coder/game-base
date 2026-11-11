// The words the chart of Stroke.tla uses. The statechart skill reads this file.
type Vars = {
  active: boolean; busy: boolean; primary: boolean;
  stroke: { on: boolean; item: string };
  cell: Record<string, string>;
  journal: Record<string, string>;
};

export const title = 'A stroke in build mode';

const tilled = (v: Vars): boolean => Object.values(v.cell).some((c) => c !== 'grass');
const planted = (v: Vars): boolean => Object.values(v.cell).some((c) => c === 'crop' || c === 'grown');
const same = (a: Vars, b: Vars): boolean => JSON.stringify(a.cell) === JSON.stringify(b.cell);

export const state = (v: Vars) => ({
  Mode: v.busy ? (v.active ? 'A panel is open, build mode still on' : 'A panel is open') : v.active ? 'Build mode' : 'Playing',
  Stroke: v.stroke.on ? 'Dragging a stroke' : v.primary ? 'Button down, no stroke' : 'No stroke',
  Ground: (planted(v) ? 'Planted' : tilled(v) ? 'Tilled' : 'Grass') + (Object.values(v.journal).some((j) => j !== 'none') ? ', can be undone' : ''),
});

const WORDS: Record<string, string> = {
  ButtonDown: 'you press the left button',
  Drag: 'you drag',
  ButtonUp: 'you let go of the button',
  ExtraRelease: 'the release runs again',
  ButtonLost: 'the window loses the button',
  RightPress: 'you press the right button',
  SwitchHand: 'you pick another item',
  ToggleMode: 'you press G',
  BusyOn: 'a panel opens',
  BusyOff: 'the panel closes',
  Step: 'the rules take a step',
  Undo: 'you press Z',
  WorldTills: 'something else tills a cell',
  WorldPlants: 'something else plants a cell',
  WorldGrows: 'a crop grows',
  WorldUproots: 'a crop is pulled up',
  WorldBuilds: 'something is built on a cell',
  BagGains: 'the bag gains a seed',
  BagLoses: 'the bag loses a seed',
};

export const step = (action: string, from: Vars, to: Vars): string | null => {
  // A second release with no stroke changes nothing a reader can see.
  if (action === 'ExtraRelease' && !from.stroke.on) return null;
  if (action === 'ButtonUp' && from.stroke.on) return same(from, to) ? 'you let go: nothing changes' : 'you let go: the stroke is applied';
  if (action === 'ExtraRelease') return same(from, to) ? 'the release runs again: nothing changes' : 'the release runs again: the stroke is applied';
  return WORDS[action] ?? action;
};

export const group = (v: Vars): string => (v.stroke.on ? 'stroke' : v.active ? 'build' : 'play');
export const colors = { stroke: 'orange', build: 'teal', play: 'tan' };
