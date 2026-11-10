// The one list of what each key does in the running game. Settings shows it, the panels view binds
// the panel keys from it, and tools/play-ui.mjs presses every key a hint names and checks what happens.
//
// The movement, camera, slot and mouse keys are bound in src/game/shell/keys.ts. This file only names
// them. When a binding changes there, change the row here and the hint in src/game/content/hints.ts.
import type { KeyHint, PanelName } from '../ui/index.ui.ts';

/** What a panel key opens: one of createGameUi's panels, the full map, or the pause menu. */
export type PanelKeyTarget = Extract<PanelName, 'bag' | 'almanac' | 'quests' | 'pause'> | 'map';

/** `KeyboardEvent.code` to what it opens. Each of these toggles: the same key closes what it opened. */
export const PANEL_KEYS: Readonly<Record<string, PanelKeyTarget>> = {
  KeyI: 'bag',
  KeyB: 'bag',
  Tab: 'almanac',
  KeyJ: 'quests',
  KeyM: 'map',
  Escape: 'pause',
};

/** The keys a conversation reads, beside a click and the number keys for a choice. E comes through the shell's keys. */
export const TALK_ADVANCE_CODES: readonly string[] = ['Space', 'Enter', 'NumpadEnter'];

/** The list in Settings, in the order a new player needs them. */
export const KEY_LIST: readonly KeyHint[] = [
  { action: 'Move', keys: ['W', 'A', 'S', 'D'] },
  { action: 'Walk softly', keys: ['Shift'] },
  { action: 'Jump', keys: ['Space'] },
  { action: 'Turn the camera', keys: ['Q', 'R'] },
  { action: 'Zoom', keys: ['Wheel'] },
  { action: 'Talk, or use what is near', keys: ['E'] },
  { action: 'Gather or break (hold)', keys: ['Left button'] },
  { action: 'Use or set down what you hold', keys: ['Right button'] },
  { action: 'Pick a quick slot', keys: ['1 to 9'] },
  { action: 'Bag', keys: ['I', 'B'] },
  { action: 'Almanac', keys: ['Tab'] },
  { action: 'Quests', keys: ['J'] },
  { action: 'Map', keys: ['M'] },
  { action: 'Pause', keys: ['Esc'] },
];
