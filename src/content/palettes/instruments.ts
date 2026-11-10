// The instruments the palettes share. Each one imitates something real with one of four recipes.
import type { Patch } from './types.ts';

// Plucked and struck
export const harp: Patch = { kind: 'pluck', wave: 'harp', decay: 1.9, bright: 6, attack: 0.004 };
export const lute: Patch = { kind: 'pluck', wave: 'lute', decay: 1.0, bright: 8, attack: 0.003, detune: 6 };
export const santoor: Patch = { kind: 'pluck', wave: 'harp', decay: 0.8, bright: 10, attack: 0.002, detune: 9 };
export const droneString: Patch = { kind: 'pluck', wave: 'string', decay: 5.5, bright: 9, attack: 0.03, detune: 4 };
export const bendString: Patch = { kind: 'pluck', wave: 'string', decay: 1.5, bright: 8, attack: 0.004, detune: 3, bendTime: 0.11 };
export const pizzicato: Patch = { kind: 'pluck', wave: 'triangle', decay: 0.42, bright: 5, attack: 0.003, damp: true };
export const dulcimer: Patch = { kind: 'pluck', wave: 'lute', decay: 1.3, bright: 5, attack: 0.004, detune: 5 };
export const softBass: Patch = { kind: 'pluck', wave: 'soft', decay: 1.5, bright: 4, attack: 0.01, damp: true };
export const subBass: Patch = { kind: 'pluck', wave: 'sine', decay: 2.2, bright: 3, attack: 0.02, damp: true };
export const deepBass: Patch = { kind: 'pluck', wave: 'reed', decay: 1.3, bright: 3, attack: 0.008, damp: true };

// Bells
export const musicBox: Patch = { kind: 'bell', ratio: 4, index: 0.7, decay: 1.5 };
export const glassBell: Patch = { kind: 'bell', ratio: 2.76, index: 0.9, decay: 2.8 };
export const chime: Patch = { kind: 'bell', ratio: 3.5, index: 1.3, decay: 1.2 };
export const tinyBell: Patch = { kind: 'bell', ratio: 7, index: 0.8, decay: 0.9 };
export const fingerCymbal: Patch = { kind: 'bell', ratio: 5.4, index: 1.2, decay: 0.7 };
export const ironTing: Patch = { kind: 'bell', ratio: 1.47, index: 1.6, decay: 0.8 };

// Blown
export const flute: Patch = { kind: 'wind', wave: 'soft', breath: 0.1, vibrato: 8, attack: 0.07, release: 0.2 };
export const reedFlute: Patch = { kind: 'wind', wave: 'reed', breath: 0.22, vibrato: 12, attack: 0.05, release: 0.16, cutoff: 3000 };
export const glassLead: Patch = { kind: 'wind', wave: 'glass', breath: 0.03, vibrato: 5, attack: 0.16, release: 0.5 };
export const horn: Patch = { kind: 'wind', wave: 'choir', breath: 0.03, vibrato: 5, attack: 0.09, release: 0.28, cutoff: 1500 };

// Held
export const softPad: Patch = { kind: 'pad', wave: 'triangle', voices: 2, detune: 6, cutoff: 1500, attack: 1.3, release: 1.8 };
export const bowedPad: Patch = { kind: 'pad', wave: 'string', voices: 3, detune: 9, cutoff: 1000, attack: 1.9, release: 2.4 };
export const lightStrings: Patch = { kind: 'pad', wave: 'sawtooth', voices: 3, detune: 8, cutoff: 2200, attack: 0.3, release: 0.8 };
export const lowReed: Patch = { kind: 'pad', wave: 'reed', voices: 2, detune: 4, cutoff: 650, attack: 1.0, release: 1.4 };
export const choirPad: Patch = { kind: 'pad', wave: 'choir', voices: 3, detune: 10, cutoff: 900, attack: 0.9, release: 1.5, formants: [520, 1050] };
export const stillPad: Patch = { kind: 'pad', wave: 'triangle', voices: 3, detune: 5, cutoff: 1200, attack: 3.2, release: 4.5 };

// Laid over every land by the engine
export const tensionPad: Patch = { kind: 'pad', wave: 'reed', voices: 2, detune: 12, cutoff: 380, attack: 0.5, release: 1.0 };
export const bossBrass: Patch = { kind: 'pad', wave: 'sawtooth', voices: 2, detune: 7, cutoff: 950, attack: 0.05, release: 0.3 };
export const stingerBell: Patch = { kind: 'bell', ratio: 2, index: 1.0, decay: 1.6 };
export const pickupBell: Patch = { kind: 'bell', ratio: 3, index: 0.9, decay: 0.5 };
