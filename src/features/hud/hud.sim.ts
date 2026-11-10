// What the HUD shows, worked out as plain values: the clock, which weather picture to draw, how
// full a bar is. No page here, so it can be tested.
import type { Ambient } from '../../engine/types.ts';

/** The time as a 24 hour clock, '06:30'. `timeOfDay` is 0 at midnight and 0.5 at noon. */
export function clockText(timeOfDay: number): string {
  const minutes = clockMinutes(timeOfDay);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Minutes since midnight, 0 to 1439. The HUD compares it so the clock's text changes once a minute. */
export function clockMinutes(timeOfDay: number): number {
  const wrapped = ((timeOfDay % 1) + 1) % 1;
  return Math.floor(wrapped * 1440 + 1e-6) % 1440;
}

/** True while the sun is up: from sunrise at 0.25 to sunset at 0.75. */
export function isDay(timeOfDay: number): boolean {
  const wrapped = ((timeOfDay % 1) + 1) % 1;
  return wrapped >= 0.25 && wrapped < 0.75;
}

export type WeatherIcon = 'sun' | 'moon' | 'cloud' | 'rain' | 'storm' | 'fog' | 'wind';

export const WEATHER_NAMES: Record<WeatherIcon, string> = {
  sun: 'Clear', moon: 'Clear night', cloud: 'Cloudy', rain: 'Rain', storm: 'Storm', fog: 'Fog', wind: 'Windy',
};

/**
 * The one picture that sums up the sky. The worst thing wins: a storm over rain, rain over fog,
 * fog over cloud, cloud over wind, and otherwise the sun or the moon.
 */
export function weatherIcon(ambient: Ambient): WeatherIcon {
  if (ambient.rain >= 0.8 || (ambient.rain >= 0.3 && ambient.flash > 0)) return 'storm';
  if (ambient.rain >= 0.15) return 'rain';
  if (ambient.fog >= 0.5) return 'fog';
  if (ambient.cloud >= 0.6) return 'cloud';
  if (ambient.wind >= 0.5) return 'wind';
  return isDay(ambient.timeOfDay) ? 'sun' : 'moon';
}

/** How full a bar is, 0 to 1. */
export function barFraction(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(1, Math.max(0, value / max));
}

export const HUD_SCALE_MIN = 0.8;
export const HUD_SCALE_MAX = 1.4;

/** The size setting kept inside what the layout can take. Anything that is not a number gives 1. */
export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, scale));
}

/** WCAG contrast between two 0xRRGGBB colors, 1 to 21. Text needs 4.5. */
export function contrast(a: number, b: number): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function luminance(color: number): number {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((color >> 16) & 0xff) + 0.7152 * channel((color >> 8) & 0xff) + 0.0722 * channel(color & 0xff);
}

/** The book theme's colors. The stylesheet uses the same values. */
export const BOOK = {
  parchment: 0xecdcb9,
  parchmentDeep: 0xdcc797,
  ink: 0x33241a,
  inkSoft: 0x5a4330,
  brass: 0xb88a3e,
  brassLight: 0xe6c476,
} as const;
