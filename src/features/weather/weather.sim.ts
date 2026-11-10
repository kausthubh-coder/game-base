// The weather machine. Game rules: it writes the shared Ambient numbers and emits `thunder`, and draws nothing.
//
// Everything is scheduled on the machine's own time line from a seed, so the same seed gives the same weather
// whatever the frame rate. A change of weather is a front: each number eases to its new value after its own delay
// (content/weather.ts), which is why the wind rises before the cloud and the cloud before the rain.
import { calmNoon, type Ambient, type Vec3 } from '../../engine/types.ts';
import type { GameEvent } from '../../engine/events.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import { frontTiming, lightningRules, rainbowRules, weatherTable, wetnessRules, type WeatherKind } from '../../content/weather.ts';
import { createClock, timeOfDayAt, type Clock } from './clock.sim.ts';

export const WEATHER_KINDS = Object.keys(weatherTable) as WeatherKind[];

type Channel = 'wind' | 'cloud' | 'fog' | 'rain' | 'motes';
const CHANNELS: Channel[] = ['wind', 'cloud', 'fog', 'rain', 'motes'];

export interface WeatherOptions {
  /** The same seed gives the same weather. */
  seed: number;
  /** The shared numbers to write. One is made when this is left out. */
  ambient?: Ambient;
  /** Where `thunder` goes, usually `bus.emit`. */
  emit?: (event: GameEvent) => void;
  /** Used for the ground height under a strike. */
  world?: WorldQuery;
  start?: WeatherKind;
  startTimeOfDay?: number;
}

/** The last lightning strike. `count` goes up by one with each strike. */
export interface Strike {
  x: number;
  y: number;
  z: number;
  /** Meters from the listener. */
  distance: number;
  count: number;
}

export interface Weather {
  readonly ambient: Ambient;
  readonly clock: Clock;
  readonly kind: WeatherKind;
  /** True while the machine picks the weather itself. */
  readonly auto: boolean;
  /** Seconds until the machine changes the weather. Infinity while a kind is held. */
  readonly changeIn: number;
  /** Seconds the machine has run. */
  readonly elapsed: number;
  /** Glowing motes in the air, 0 to 1. Not in Ambient yet, so views take it from here. */
  readonly motes: number;
  /** How strong the rainbow is, 0 to 1. */
  readonly rainbow: number;
  readonly strike: Readonly<Strike>;
  /** Moves the clock and the weather on. `listener` is where the player is, for lightning and thunder. */
  step(dt: number, listener?: Vec3): void;
  /**
   * Starts a front toward this kind now. `hold` keeps it until `resume`. `instant` skips the front and settles
   * the ground too: soaked in rain, dry otherwise.
   */
  set(kind: WeatherKind, how?: { hold?: boolean; instant?: boolean }): void;
  /** Hands the weather back to the machine. */
  resume(): void;
  /** Strikes now, this far from the listener. For tests and demos. */
  strikeNow(distance?: number): void;
}

/** A small seeded generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;

/** The flash after a strike: a hard flash, then a second flicker, gone within a second. */
function flashAfter(seconds: number): number {
  if (seconds < 0) return 0;
  const first = Math.exp(-8 * seconds);
  const second = seconds > 0.12 ? 0.7 * Math.exp(-10 * (seconds - 0.12)) : 0;
  const flash = Math.max(first, second);
  return flash < 0.004 ? 0 : flash;
}

export function createWeather(options: WeatherOptions): Weather {
  const ambient = options.ambient ?? calmNoon();
  const clock = createClock(options.startTimeOfDay ?? 0.3);
  // Two streams, so a strike fired by hand never shifts which weather comes next.
  const pickRandom = seeded(options.seed);
  const strikeRandom = seeded(options.seed ^ 0x9e3779b9);

  let elapsed = 0;
  let kind: WeatherKind = options.start ?? 'clear';
  let auto = true;
  let changeAt = 0;

  // The front: each number eases from `from` to `to`, counted from `frontStart`.
  const first = weatherTable[kind];
  const from: Record<Channel, number> = { wind: first.wind, cloud: first.cloud, fog: first.fog, rain: first.rain, motes: first.motes };
  const to: Record<Channel, number> = { ...from };
  let frontStart = -1000;
  let dirFrom = pickRandom() * TAU;
  let dirTo = dirFrom;

  let wetness = 0;
  let motes = first.motes;
  let rainbowStart = Infinity;
  let rainbow = 0;

  let nextStrike = Infinity;
  let lastStrikeAt = -1000;
  const strike: Strike = { x: 0, y: 0, z: 0, distance: 0, count: 0 };
  const thunder: { at: Vec3; due: number }[] = [];
  const listener: Vec3 = { x: 0, y: 0, z: 0 };

  function channelAt(channel: Channel, age: number): number {
    const a = from[channel];
    const b = to[channel];
    const [delay, ramp] = (b >= a ? frontTiming.arrive : frontTiming.leave)[channel];
    return a + (b - a) * ease((age - delay) / ramp);
  }

  function windDirAt(age: number): number {
    return dirFrom + (dirTo - dirFrom) * ease(age / frontTiming.turnSeconds);
  }

  /** The timeOfDay when the machine's time line reaches `at`. */
  function timeOfDayWhen(at: number): number {
    return timeOfDayAt(clock.seconds + (at - elapsed));
  }

  function strikeGap(): number {
    const perMinute = weatherTable[kind].lightning;
    if (perMinute <= 0) return Infinity;
    return (60 / perMinute) * (0.4 + 1.2 * strikeRandom());
  }

  function beginFront(next: WeatherKind, at: number): void {
    const age = at - frontStart;
    const wasRaining = to.rain > 0;
    const entry = weatherTable[next];
    for (const channel of CHANNELS) {
      from[channel] = channelAt(channel, age);
      to[channel] = entry[channel];
    }
    dirFrom = windDirAt(age);
    dirTo = dirFrom + (pickRandom() * 2 - 1) * frontTiming.maxTurn;
    frontStart = at;
    kind = next;

    // Always roll, so the stream stays in step whether or not it rained.
    const roll = pickRandom();
    const time = timeOfDayWhen(at);
    if (wasRaining && entry.rain === 0 && time > 0.27 && time < 0.7 && roll < rainbowRules.chance) {
      rainbowStart = at + rainbowRules.delay;
    }

    nextStrike = entry.lightning > 0 ? at + frontTiming.arrive.rain[0] + frontTiming.arrive.rain[1] * 0.6 + strikeGap() : Infinity;
  }

  function stayFor(next: WeatherKind): number {
    const [shortest, longest] = weatherTable[next].lasts;
    return frontTiming.seconds + shortest + (longest - shortest) * pickRandom();
  }

  function weightOf(candidate: WeatherKind, time: number): number {
    const entry = weatherTable[candidate];
    if (!entry.hours) return entry.weight;
    const inHours = time >= entry.hours[0] && time <= entry.hours[1];
    return inHours ? entry.weight : entry.weight * (entry.offHours ?? 1);
  }

  function pick(at: number): WeatherKind {
    const time = timeOfDayWhen(at);
    let total = 0;
    for (const candidate of WEATHER_KINDS) if (candidate !== kind) total += weightOf(candidate, time);
    let roll = pickRandom() * total;
    for (const candidate of WEATHER_KINDS) {
      if (candidate === kind) continue;
      roll -= weightOf(candidate, time);
      if (roll <= 0) return candidate;
    }
    return 'clear';
  }

  function strikeAt(at: number, distance?: number): void {
    const far = distance ?? lightningRules.nearest + (lightningRules.farthest - lightningRules.nearest) * Math.pow(strikeRandom(), 1.6);
    const angle = strikeRandom() * TAU;
    strike.x = listener.x + Math.cos(angle) * far;
    strike.z = listener.z + Math.sin(angle) * far;
    strike.y = options.world ? options.world.heightAt(strike.x, strike.z) : listener.y;
    strike.distance = far;
    strike.count += 1;
    lastStrikeAt = at;
    // Keep the queue in the order the claps are due: a near strike after a far one is heard first.
    const due = at + far / lightningRules.soundSpeed;
    let slot = thunder.length;
    while (slot > 0 && thunder[slot - 1].due > due) slot--;
    thunder.splice(slot, 0, { at: { x: strike.x, y: strike.y, z: strike.z }, due });
  }

  changeAt = stayFor(kind) - frontTiming.seconds;

  const weather: Weather = {
    ambient,
    clock,
    strike,
    get kind() {
      return kind;
    },
    get auto() {
      return auto;
    },
    get changeIn() {
      return auto ? changeAt - elapsed : Infinity;
    },
    get elapsed() {
      return elapsed;
    },
    get motes() {
      return motes;
    },
    get rainbow() {
      return rainbow;
    },

    step(dt, where) {
      if (where) {
        listener.x = where.x;
        listener.y = where.y;
        listener.z = where.z;
      }
      const end = elapsed + dt;

      while (auto && changeAt <= end) {
        const at = changeAt;
        const next = pick(at);
        beginFront(next, at);
        changeAt = at + stayFor(next);
      }

      let struck = false;
      while (nextStrike <= end) {
        const at = nextStrike;
        nextStrike = at + strikeGap();
        // Lightning waits for the rain to arrive.
        if (channelAt('rain', at - frontStart) > 0.5) {
          strikeAt(at);
          struck = true;
        }
      }

      clock.advance(dt);
      elapsed = end;
      const age = end - frontStart;

      const gust = 1 + 0.12 * Math.sin(end * 0.7) * Math.sin(end * 0.23 + 1.3);
      ambient.timeOfDay = clock.timeOfDay;
      ambient.wind = clamp01(channelAt('wind', age) * gust);
      ambient.cloud = clamp01(channelAt('cloud', age));
      ambient.fog = clamp01(channelAt('fog', age));
      ambient.rain = clamp01(channelAt('rain', age));
      ambient.windDir = ((windDirAt(age) % TAU) + TAU) % TAU;
      motes = clamp01(channelAt('motes', age));

      // Open ground soaks in rain and dries afterwards, faster under a clear midday sky.
      if (ambient.rain > 0.05) {
        wetness += (ambient.rain / wetnessRules.soakSeconds) * dt;
      } else {
        const daylight = clamp01(Math.sin((ambient.timeOfDay - 0.25) * TAU) * 2 + 0.5);
        wetness -= ((1 - 0.6 * ambient.cloud) * (0.4 + 0.6 * daylight) * dt) / wetnessRules.drySeconds;
      }
      wetness = clamp01(wetness);
      ambient.wetness = wetness;

      ambient.flash = struck ? 1 : flashAfter(end - lastStrikeAt);

      while (thunder.length > 0 && thunder[0].due <= end) {
        const clap = thunder.shift();
        if (clap && options.emit) options.emit({ type: 'thunder', at: clap.at });
      }

      const shown = end - rainbowStart;
      rainbow = shown < 0 || shown > rainbowRules.lasts ? 0 : ease(shown / 20) * ease((rainbowRules.lasts - shown) / 30) * (1 - ambient.rain);
      if (shown > rainbowRules.lasts) rainbowStart = Infinity;
    },

    set(next, how) {
      beginFront(next, elapsed);
      if (how?.instant) {
        frontStart = elapsed - 1000;
        wetness = weatherTable[next].rain > 0 ? 1 : 0;
        if (weatherTable[next].lightning > 0) nextStrike = elapsed + strikeGap();
      }
      auto = !how?.hold;
      changeAt = auto ? elapsed + stayFor(next) : Infinity;
    },

    resume() {
      if (auto) return;
      auto = true;
      changeAt = elapsed + stayFor(kind) - frontTiming.seconds;
    },

    strikeNow(distance) {
      strikeAt(elapsed, distance);
      ambient.flash = 1;
    },
  };

  weather.step(0);
  return weather;
}
