// A soft axe knock, then wood bending, a crown of leaves and a padded landing.
interface Grain { kind: 'grain'; at: number; color: 'white' | 'pink' | 'brown'; filter: 'bandpass' | 'lowpass'; hz: number; q: number; level: number; attack: number; decay: number; sweep?: number }
interface Tone { kind: 'tone'; at: number; from: number; to: number; glide: number; level: number; decay: number }
interface TreeSound { seconds: number; gain: number; layers: readonly (Grain | Tone)[] }
export const treeSounds: { chopEvery: number; logGain: number; maxExtraLogs: number; chop: TreeSound; fall: TreeSound } = {
  chopEvery: 0.3, logGain: 0.025, maxExtraLogs: 12,
  chop: { seconds: 0.19, gain: 0.65, layers: [
    { kind: 'grain', at: 0, color: 'white', filter: 'bandpass', hz: 850, q: 1.7, level: 0.32, attack: 0.006, decay: 0.08 },
    { kind: 'tone', at: 0, from: 390, to: 310, glide: 0.04, level: 0.14, decay: 0.12 },
  ] },
  fall: { seconds: 1.9, gain: 0.85, layers: [
    { kind: 'grain', at: 0, color: 'pink', filter: 'bandpass', hz: 230, q: 5, level: 0.42, attack: 0.12, decay: 0.7, sweep: 125 },
    { kind: 'grain', at: 0.2, color: 'white', filter: 'bandpass', hz: 3400, q: 0.7, level: 0.27, attack: 0.24, decay: 1.25, sweep: 1700 },
    { kind: 'tone', at: 0.85, from: 125, to: 72, glide: 0.13, level: 0.24, decay: 0.42 },
    { kind: 'grain', at: 0.85, color: 'pink', filter: 'lowpass', hz: 640, q: 0.6, level: 0.35, attack: 0.025, decay: 0.28 },
  ] },
};
