// Greenhollow's outdoor mix. Rates are calls per second; pitches are Hz, levels are linear gain.
export const outdoorSound = {
  wind: { gain: 0.16, power: 1.7, highpass: 160, center: 520, sweep: 500, fade: 0.9 },
  leaves: { gain: 0.24, floor: 0.018, fade: 0.65 },
  water: { gain: 0.16, fade: 0.8 },
  rain: { gain: 0.23, fade: 0.8 },
  // Longer than two minutes even at the fastest bed playback rate (1.2).
  noiseSeconds: 151,
  bird: { gain: 0.09, variation: 0.1 },
  cricket: { gain: 0.075, variation: 0.04 },
  owl: { rate: 1 / 16, gain: 0.14, pitch: 470, spread: 110, seconds: 1.5 },
  murmur: { rate: 0.38, gain: 0.16, pitch: 145, spread: 90, seconds: 1.6 },
  bucket: { rate: 1 / 18, gain: 0.09, pitch: 720, spread: 180, seconds: 0.9 },
  stone: { rate: 0.18, gain: 0.08, pitch: 1250, spread: 350, seconds: 0.55 },
} as const;
