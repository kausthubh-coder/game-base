// The HUD: bars, the minimap's corner, the clock and weather, quick slots, the tracked quest and messages.
export { createHud, type HudOptions, type HudQuest, type HudSlot, type HudStorage, type HudView, type Vital } from './hud.ui.ts';
export {
  BOOK, HUD_SCALE_MAX, HUD_SCALE_MIN, WEATHER_NAMES, barFraction, clampScale, clockText, contrast, isDay, weatherIcon,
  type WeatherIcon,
} from './hud.sim.ts';
