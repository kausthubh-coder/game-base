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
} as const;
