// The clock and the weather. A day is 12 minutes and starts at dawn, when the day number goes up.
// The weather is the machine in src/features/weather, driven from here: this system keeps it on the
// game's clock, holds a kind when the story asks for one, and copies its numbers into `game.ambient`.
import { calmNoon, type Vec3 } from '../../engine/types.ts';
import type { WeatherKind } from '../../content/weather.ts';
import { DAY_SECONDS, dayPartAt, daySecondAt, timeOfDayAt } from '../../features/weather/clock.sim.ts';
import { createWeather, type Weather } from '../../features/weather/weather.sim.ts';
import type { Game, SimSystem, TimeApi } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

/** Seconds of real time in one game day. */
export const DAY_LENGTH = 720;
/** The time of day the player wakes at, and the time a new game starts at. */
export const MORNING = 0.27;
/** Sleep is allowed from here until dawn. */
export const EVENING = 0.66;
const DAWN = 0.23;
/** A bed this many blocks away or closer counts as near. */
export const BED_REACH = 4;

// The weather feature's clock gives a day four parts of unequal length over 20 minutes. This day has
// the same parts in the same proportions, squeezed into 12.
const SCALE = DAY_SECONDS / DAY_LENGTH;
/** The time of day at a number of seconds after dawn began. */
const dialAt = (daySecond: number): number => timeOfDayAt(daySecond * SCALE);
/** The seconds after dawn began at which the dial shows this time of day. */
const secondAt = (timeOfDay: number): number => daySecondAt(timeOfDay) / SCALE;

interface TimeSave {
  day: number;
  daySecond: number;
  seconds: number;
  dayAnnounced: number;
  nightAnnounced: number;
  forced: WeatherKind | null;
  weather: { kind: WeatherKind; held: boolean; seed: number; elapsed: number };
}

export interface Time {
  api: TimeApi;
  system: SimSystem;
}

export function createTime(game: Game): Time {
  const { clock, events } = game;

  let day = clock.day;
  /** Seconds since dawn began on this day, 0 to DAY_LENGTH. */
  let daySecond = secondAt(clock.timeOfDay);
  /** Seconds of game time since the game began. It never goes back. */
  let seconds = clock.seconds;
  // The last day `day.started` and `night.started` were sent for, so each goes out once a day.
  let dayAnnounced = 0;
  let nightAnnounced = 0;
  /** The kind the story asked for, or null. */
  let forced: WeatherKind | null = null;

  const thunderListeners = new Set<(at: Vec3) => void>();
  let weatherSeed = Math.floor(game.random() * 0x100000000) >>> 0;
  let weather = makeWeather('clear');

  function makeWeather(start: WeatherKind): Weather {
    return createWeather({
      seed: weatherSeed,
      ambient: calmNoon(),
      world: game.world,
      start,
      startTimeOfDay: dialAt(daySecond),
      emit(event) {
        if (event.type === 'thunder') for (const listener of thunderListeners) listener(event.at);
      },
    });
  }

  /** Brings the machine in line with what is asked: a forced kind, clear on day 1, or its own choice. */
  function steerWeather(): void {
    const kind = forced ?? (day <= 1 ? 'clear' : null);
    if (kind) {
      if (weather.kind !== kind || weather.auto) weather.set(kind, { hold: true });
    } else if (!weather.auto) {
      // Handing back: held weather other than clear leaves first, so a scripted shower ends when it is let go.
      if (weather.kind === 'clear') weather.resume();
      else weather.set('clear');
    }
  }

  function writeClock(): void {
    clock.day = day;
    clock.timeOfDay = dialAt(daySecond);
    clock.seconds = seconds;
    game.ambient.timeOfDay = clock.timeOfDay;
  }

  function writeAmbient(): void {
    const to = game.ambient, from = weather.ambient;
    to.rain = from.rain;
    to.cloud = from.cloud;
    to.fog = from.fog;
    to.wind = from.wind;
    to.windDir = from.windDir;
    to.wetness = from.wetness;
    to.flash = from.flash;
  }

  /** Sends `day.started` and `night.started`, each once for a day. */
  function announce(): void {
    if (dayAnnounced < day) {
      dayAnnounced = day;
      steerWeather();
      events.emit('day.started', { day });
    }
    if (nightAnnounced < day) {
      const part = dayPartAt(daySecond * SCALE);
      if (part === 'dusk' || part === 'night') {
        nightAnnounced = day;
        events.emit('night.started', { day });
      }
    }
  }

  const api: TimeApi = {
    dayLength: DAY_LENGTH,

    canSleep() {
      const time = clock.timeOfDay;
      if (time < EVENING && time >= DAWN) return false;
      const at = game.player.pos;
      if (game.world.openSky(at.x, at.y + 0.5, at.z)) return false;
      return game.systems.placeables.near('bed', at, BED_REACH);
    },

    sleep() {
      const wake = secondAt(MORNING);
      seconds += DAY_LENGTH - daySecond + wake;
      day += 1;
      daySecond = wake;
      // Tonight's dusk is skipped, and tomorrow's is still to come.
      nightAnnounced = day - 1;
      writeClock();
      announce();
      events.emit('slept', { day });
    },

    setWeather(kind) {
      forced = kind;
      steerWeather();
    },

    setTimeOfDay(timeOfDay) {
      const next = secondAt(timeOfDay);
      if (next > daySecond) seconds += next - daySecond;
      daySecond = next;
      writeClock();
    },

    onThunder(listener) {
      thunderListeners.add(listener);
      return () => thunderListeners.delete(listener);
    },
  };

  const system: SimSystem = {
    step(dt) {
      daySecond += dt;
      seconds += dt;
      if (daySecond >= DAY_LENGTH) {
        daySecond -= DAY_LENGTH;
        day += 1;
      }
      writeClock();
      announce();
      // The machine has a clock of its own. Keep it on this one, so fog comes in the morning and ground dries by day.
      weather.clock.setTimeOfDay(clock.timeOfDay);
      weather.step(dt, game.player.pos);
      writeAmbient();
    },

    save(): TimeSave {
      return {
        day, daySecond, seconds, dayAnnounced, nightAnnounced, forced,
        weather: { kind: weather.kind, held: !weather.auto, seed: weatherSeed, elapsed: weather.elapsed },
      };
    },

    load(data) {
      const save = data as TimeSave | null;
      // A save without a clock in it leaves the game where it is.
      if (!save || !Number.isFinite(save.day) || !Number.isFinite(save.daySecond) || !save.weather) return;
      day = save.day;
      daySecond = save.daySecond;
      seconds = save.seconds;
      dayAnnounced = save.dayAnnounced;
      nightAnnounced = save.nightAnnounced;
      forced = save.forced ?? null;
      // The machine cannot be rewound to the middle of a front, so it starts again settled in the saved kind,
      // on a new seed so the weather after a load is not the weather after the last one.
      weatherSeed = (save.weather.seed ^ Math.imul(Math.floor(save.weather.elapsed) + 1, 0x9e3779b1)) >>> 0;
      weather = makeWeather(save.weather.kind);
      weather.set(save.weather.kind, { hold: save.weather.held, instant: true });
      steerWeather();
      writeClock();
      weather.step(0, game.player.pos);
      writeAmbient();
    },
  };

  steerWeather();
  writeClock();
  writeAmbient();
  return { api, system };
}

export function install(kernel: Kernel): void {
  const time = createTime(kernel.game);
  kernel.add('time', time.api, time.system);
}
