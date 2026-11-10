// The day clock and the moon. Game rules: no drawing here.
//
// A day starts at dawn. `timeOfDay` follows the contract in engine/types (0 midnight, 0.25 sunrise, 0.5 noon,
// 0.75 sunset), but the four parts of the day do not take equal time, so the dial runs about twice as fast at night.
import { calendar } from '../../content/weather.ts';

export type DayPart = 'dawn' | 'day' | 'dusk' | 'night';

export const DAY_SECONDS = calendar.dawnSeconds + calendar.lightSeconds + calendar.duskSeconds + calendar.nightSeconds;

// timeOfDay at the start of each part. Night runs from 0.77 through midnight to 0.23.
const DAWN = 0.23;
const DAY = 0.27;
const DUSK = 0.73;
const NIGHT = 0.77;

interface Part {
  name: DayPart;
  from: number;
  seconds: number;
  dialFrom: number;
  dial: number;
}

const PARTS: Part[] = [];
{
  const spans: [DayPart, number, number, number][] = [
    ['dawn', calendar.dawnSeconds, DAWN, DAY - DAWN],
    ['day', calendar.lightSeconds, DAY, DUSK - DAY],
    ['dusk', calendar.duskSeconds, DUSK, NIGHT - DUSK],
    ['night', calendar.nightSeconds, NIGHT, 1 - NIGHT + DAWN],
  ];
  let from = 0;
  for (const [name, seconds, dialFrom, dial] of spans) {
    PARTS.push({ name, from, seconds, dialFrom, dial });
    from += seconds;
  }
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function partAt(daySecond: number): Part {
  const s = wrap(daySecond, DAY_SECONDS);
  for (let i = PARTS.length - 1; i >= 0; i--) if (s >= PARTS[i].from) return PARTS[i];
  return PARTS[0];
}

/** The timeOfDay at a number of seconds after dawn began. */
export function timeOfDayAt(daySecond: number): number {
  const s = wrap(daySecond, DAY_SECONDS);
  const part = partAt(s);
  return wrap(part.dialFrom + ((s - part.from) / part.seconds) * part.dial, 1);
}

/** The seconds after dawn began at which the dial shows this timeOfDay. */
export function daySecondAt(timeOfDay: number): number {
  // Measure the dial from the start of dawn so the four parts are in order.
  const dial = wrap(timeOfDay - DAWN, 1);
  let start = 0;
  for (const part of PARTS) {
    if (dial < start + part.dial) return part.from + ((dial - start) / part.dial) * part.seconds;
    start += part.dial;
  }
  return 0;
}

export function dayPartAt(daySecond: number): DayPart {
  return partAt(daySecond).name;
}

/** The moon's phase on a day: 0 is new, 4 is full. A phase lasts three and a half days. */
export function moonPhaseOn(day: number): number {
  const inMonth = wrap(Math.floor(day), calendar.daysInMonth);
  const step = Math.floor((inMonth * calendar.moonPhases) / calendar.daysInMonth);
  return (calendar.firstMoonPhase + step) % calendar.moonPhases;
}

export interface Clock {
  /** Seconds of game time since dawn on day 0. */
  seconds: number;
  /** Whole days passed. It goes up at dawn, so one night has one moon. */
  readonly day: number;
  readonly timeOfDay: number;
  readonly part: DayPart;
  readonly moonPhase: number;
  advance(dt: number): void;
  /** Jumps to this time on the same day. */
  setTimeOfDay(timeOfDay: number): void;
  /** The time as a 24-hour label such as 06:00. */
  label(): string;
}

export function createClock(startTimeOfDay = 0.3): Clock {
  const clock: Clock = {
    seconds: daySecondAt(startTimeOfDay),
    get day() {
      return Math.floor(clock.seconds / DAY_SECONDS);
    },
    get timeOfDay() {
      return timeOfDayAt(clock.seconds);
    },
    get part() {
      return dayPartAt(clock.seconds);
    },
    get moonPhase() {
      return moonPhaseOn(clock.day);
    },
    advance(dt) {
      clock.seconds += dt;
    },
    setTimeOfDay(timeOfDay) {
      clock.seconds = clock.day * DAY_SECONDS + daySecondAt(timeOfDay);
    },
    label() {
      const minutes = Math.floor(clock.timeOfDay * 24 * 60);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
    },
  };
  return clock;
}
