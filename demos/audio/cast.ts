// The demo's people: three you can talk to, each with a voice of its own. The lines talk about the sound,
// because the game's story is not written yet.
import type { VoiceSpec } from '../../src/features/audio/index.ts';
import { TOWNS } from './world.ts';

export interface Npc {
  name: string;
  x: number;
  z: number;
  color: string;
  voice: VoiceSpec;
  lines: string[];
}

const town = (land: string): { x: number; z: number } => {
  const t = TOWNS.find((t) => t.land === land);
  return { x: t?.x ?? 0, z: t?.z ?? 0 };
};

export const NPCS: Npc[] = [
  {
    name: 'Old gardener',
    ...{ x: town('meadow').x - 9, z: town('meadow').z + 9 },
    color: '#e8c070',
    // Low, round and unhurried.
    voice: { pitch: 50, wave: 'triangle', speed: 19, bright: 1400 },
    lines: [
      'Morning. Hear the harp? It plays the same tune everywhere, in a different scale.',
      'Walk west and the flute turns into a reed. The tune stays.',
      'Step inside my house. The music comes through the wall.',
    ],
  },
  {
    name: 'Caravan trader',
    ...{ x: town('desert').x + 10, z: town('desert').z + 6 },
    color: '#e07a50',
    // Mid, bright and quick.
    voice: { pitch: 62, wave: 'square', speed: 30, bright: 2600 },
    lines: [
      'Three, three, two! That is how a caravan walks. Count it on the lute.',
      'Pick things up fast and the notes climb. Try the row by the meadow.',
      'When the drums come in, run or fight. Press F and listen to the tempo.',
    ],
  },
  {
    name: 'Bell student',
    ...{ x: town('highlands').x - 8, z: town('highlands').z + 10 },
    color: '#9ad0f0',
    // High, pure and fast.
    voice: { pitch: 76, wave: 'sine', speed: 38, bright: 3600 },
    lines: [
      'Our chimes play the tune you heard in the meadow. Did you notice?',
      'At night the lead changes and the drums go home.',
      'Stand between two lands. You will hear both, on the notes they share.',
    ],
  },
];
