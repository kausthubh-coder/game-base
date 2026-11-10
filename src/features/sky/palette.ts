// The look of the sky at each hour. No Three.js here: plain numbers in, plain numbers out.
// The colors come from the earlier test scene, re-timed so sunrise is at 0.25 and sunset at 0.75. From mid
// morning to late afternoon the haze is a pale blue, so far land fades into the sky the way it does in Genshin's
// fields; sunrise and sunset stay warm. The day haze is a clear pale blue, never milk, and the fill is strong
// enough that shade stays light and cool, as it does in Genshin's fields.

export type Rgb = [number, number, number];

/** Everything that changes with the hour. Colors are linear RGB. */
export interface SkyKey {
  /** The sky straight up, a third of the way up, and at the horizon. */
  top: Rgb;
  mid: Rgb;
  bot: Rgb;
  /** The light of the sun by day and the moon at night. Gentler than the sky's own colors, so the land keeps its greens at sunset. */
  sun: Rgb;
  /** How strong that light is. It reaches 0 at the two moments the light changes hands. */
  sunStrength: number;
  /** The fill light from the sky and the light bounced off the ground. */
  skyFill: Rgb;
  groundFill: Rgb;
  fillStrength: number;
  fog: Rgb;
  cloudLit: Rgb;
  cloudShade: Rgb;
  stars: number;
  /** 0 by day, 1 at night. */
  night: number;
}

/** The sun lights the world between these times. Outside them the moon does. */
export const SUN_UP = 0.215;
export const SUN_DOWN = 0.785;

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgb(hex: number): Rgb {
  return [linear((hex >> 16) & 255), linear((hex >> 8) & 255), linear(hex & 255)];
}

type Row = [time: number, top: number, mid: number, bot: number, sun: number, sunStrength: number, skyFill: number, groundFill: number, fillStrength: number, fog: number, cloudLit: number, cloudShade: number, stars: number, night: number];

// Night is dark blue, never black: the fill light stays up and the moon is a soft blue.
// The world is seen from above, where a low sun reaches little of the ground, so the fill is stronger at dawn and dusk.
const NIGHT: Row = [0, 0x0a0f2e, 0x16244f, 0x2e4072, 0x9fb6ff, 1.15, 0x5870c0, 0x2b2548, 1.6, 0x1f2c58, 0x5d6cb0, 0x232850, 1, 1];
const at = (time: number, row: Row): Row => [time, ...(row.slice(1) as number[])] as Row;

const ROWS: Row[] = [
  at(0, NIGHT),
  at(0.18, NIGHT),
  [SUN_UP, 0x2a3878, 0x8a6aa0, 0xe89a90, 0xffa070, 0, 0x8080c0, 0x4a3a58, 1.6, 0x9a7aa0, 0xf0a8a0, 0x6a5088, 0.4, 0.7],
  [0.262, 0x4a66b8, 0xe8a0b0, 0xffd2a0, 0xffc088, 2.1, 0xc0b4de, 0x70525e, 1.85, 0xecb8b0, 0xffd6b8, 0xa0709c, 0, 0.25],
  [0.35, 0x3a88e0, 0x7cc0f0, 0xc8e6f6, 0xfff0d8, 1.95, 0xc4e2ff, 0x8c7c5c, 1.4, 0xaed2ee, 0xffffff, 0xb4c6e2, 0, 0],
  [0.5, 0x2a78de, 0x68b2ee, 0xc0e0f6, 0xfff6e2, 2.1, 0xc4e2ff, 0x908060, 1.45, 0xa8ccec, 0xffffff, 0xb8cce8, 0, 0],
  [0.65, 0x3680dc, 0x7cbaee, 0xd2e6f2, 0xffe8bc, 2.05, 0xcadcf8, 0x947a5c, 1.4, 0xb2d0ea, 0xfff8ec, 0xb4c0dc, 0, 0],
  [0.715, 0x5268c4, 0xd6a0b4, 0xffcc96, 0xffc078, 2.2, 0xd2bce8, 0x84546c, 1.4, 0xf0b8a8, 0xffcca4, 0xa672b2, 0, 0.15],
  [0.762, 0x3a4290, 0xc08a9a, 0xffa868, 0xffa468, 2.1, 0xb0a4dc, 0x62425c, 1.9, 0xc0907e, 0xffaa82, 0x6e5890, 0.25, 0.6],
  [SUN_DOWN, 0x1c2662, 0x56508e, 0xc07a72, 0xff8048, 0, 0x6a68b8, 0x3a2e50, 1.6, 0x5a5480, 0x9a74a0, 0x3a3468, 0.7, 0.9],
  at(0.83, NIGHT),
  at(1, NIGHT),
];

const TIMES = ROWS.map((row) => row[0]);
const KEYS: SkyKey[] = ROWS.map((row) => ({
  top: rgb(row[1]),
  mid: rgb(row[2]),
  bot: rgb(row[3]),
  sun: rgb(row[4]),
  sunStrength: row[5],
  skyFill: rgb(row[6]),
  groundFill: rgb(row[7]),
  fillStrength: row[8],
  fog: rgb(row[9]),
  cloudLit: rgb(row[10]),
  cloudShade: rgb(row[11]),
  stars: row[12],
  night: row[13],
}));

export function emptySkyKey(): SkyKey {
  const zero = (): Rgb => [0, 0, 0];
  return { top: zero(), mid: zero(), bot: zero(), sun: zero(), sunStrength: 0, skyFill: zero(), groundFill: zero(), fillStrength: 0, fog: zero(), cloudLit: zero(), cloudShade: zero(), stars: 0, night: 0 };
}

const COLORS = ['top', 'mid', 'bot', 'sun', 'skyFill', 'groundFill', 'fog', 'cloudLit', 'cloudShade'] as const;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fills `out` with the look of the sky at this time of day. It allocates nothing. */
export function sampleSky(timeOfDay: number, out: SkyKey): SkyKey {
  const time = ((timeOfDay % 1) + 1) % 1;
  let i = 0;
  while (i < KEYS.length - 2 && TIMES[i + 1] <= time) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (time - TIMES[i]) / (TIMES[i + 1] - TIMES[i])));
  for (let c = 0; c < COLORS.length; c++) {
    const name = COLORS[c];
    const from = a[name];
    const to = b[name];
    const color = out[name];
    color[0] = mix(from[0], to[0], t);
    color[1] = mix(from[1], to[1], t);
    color[2] = mix(from[2], to[2], t);
  }
  out.sunStrength = mix(a.sunStrength, b.sunStrength, t);
  out.fillStrength = mix(a.fillStrength, b.fillStrength, t);
  out.stars = mix(a.stars, b.stars, t);
  out.night = mix(a.night, b.night, t);
  return out;
}

/** Washes a color toward grey and darkens it, for an overcast sky. */
export function dull(color: Rgb, overcast: number, darken: number): void {
  const grey = color[0] * 0.3 + color[1] * 0.5 + color[2] * 0.2;
  const k = overcast * 0.75;
  const scale = 1 - overcast * darken;
  color[0] = mix(color[0], grey * 0.92, k) * scale;
  color[1] = mix(color[1], grey * 0.97, k) * scale;
  color[2] = mix(color[2], grey * 1.06, k) * scale;
}

/**
 * Where the sun or the moon is, as a direction from the ground toward it. `arc` runs from 0 as it rises in the
 * east (+x) to 1 as it sets in the west (-x). The path leans south (+z) and a little west, so the light comes
 * from the top left of the default view and never from straight overhead.
 */
export function arcDirection(arc: number, out: { x: number; y: number; z: number }): void {
  const angle = arc * Math.PI;
  const x = Math.cos(angle) - 0.25;
  const y = Math.sin(angle) * 0.92 + 0.2;
  const z = 0.45;
  const length = Math.hypot(x, y, z);
  out.x = x / length;
  out.y = y / length;
  out.z = z / length;
}

/** The sun's place on its arc. It is below 0 before sunrise and above 1 after sunset. */
export function sunArc(timeOfDay: number): number {
  return (timeOfDay - 0.25) / 0.5;
}

/** The moon's place on its arc. It rises as the sun sets. */
export function moonArc(timeOfDay: number): number {
  const sinceSunset = (((timeOfDay - 0.75) % 1) + 1) % 1;
  // The second half of the dial is the day: keep the moon just under the horizon then.
  return sinceSunset <= 0.75 ? sinceSunset / 0.5 : (sinceSunset - 1) / 0.5;
}

/** How much of the moon is lit, 0 to 1, for a phase 0 to 7 where 0 is new and 4 is full. */
export function moonLit(phase: number): number {
  return (1 - Math.cos((phase / 8) * Math.PI * 2)) / 2;
}
