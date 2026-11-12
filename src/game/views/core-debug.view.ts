// Two of the three debug overlays in the top left (the third, the performance meter, is the shell's):
//
// - The frame-rate counter: the frames a second and the milliseconds between frames, green, amber or red.
// - The debug panel: where the hero is, the block and chunk, the nearest named place, the time and weather,
//   the camera, what is aimed at and held, the world's load and the picture's cost. The graphics chip's name is
//   long, so it is left to the meter's copied report.
//
// Settings > Debug turns each on and off (`view.settings.debug`). The numbers are the performance meter's,
// which measures whether or not its own panel is shown. Both are rewritten four times a second.
import { BLOCKS } from '../../content/blocks.ts';
import { CHUNK } from '../../features/world/index.ts';
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';

// The column stands over the HUD and the story's black bars (50), so the numbers show in a cut scene too. While a
// menu or the map is open it goes under the interface (20), so it never covers a button there.
const STYLE = `
.debug-stack { z-index: 55; max-width: calc(100% - 16px); }
.ui-covered > .debug-stack { z-index: 19; }
.debug-stack > [hidden] { display: none; }
.debug-fps, .debug-info { margin: 0; padding: 4px 9px; pointer-events: none;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums;
  color: #e8eaee; background: rgba(16, 20, 26, 0.78); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; }
.debug-fps { font-size: 12px; font-weight: 700; }
.debug-fps b { font-weight: inherit; }
.debug-fps[data-band="good"] b { color: #8fe39a; }
.debug-fps[data-band="fair"] b { color: #ffd166; }
.debug-fps[data-band="poor"] b { color: #ff7a6b; }
.debug-info { max-width: 100%; padding: 7px 10px; overflow: hidden; white-space: pre; text-overflow: ellipsis; }
`;

/** Seconds between two rewrites of the text. */
const EVERY = 0.25;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const CAMERA_NAMES = { tilt: '2.5D', free: 'free', first: 'first person' } as const;

const fixed = (n: number, digits = 1): string => n.toFixed(digits);
/** A facing in radians, 0 north and clockwise, as a compass point. */
const compass = (radians: number): string => COMPASS[(Math.round(radians / (Math.PI / 4)) % 8 + 8) % 8];
const clock = (timeOfDay: number): string => {
  const minutes = Math.floor(timeOfDay * 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
const thousands = (n: number): string => (n >= 10000 ? `${fixed(n / 1000, 0)}k` : String(n));

export function install(view: GameView): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  const fps = document.createElement('div');
  fps.className = 'debug-fps';
  fps.dataset.key = 'debug:fps';
  const rate = document.createElement('b');
  const rest = document.createTextNode('');
  fps.append(rate, rest);
  view.debugStack.prepend(fps);

  const info = document.createElement('pre');
  info.className = 'debug-info';
  info.dataset.key = 'debug:info';
  view.debugStack.append(info);

  const sys = view.game.systems as Partial<Systems>;
  const s = view.perf.snapshot;
  let since = EVERY;

  function show(): void {
    fps.hidden = !view.settings.debug.fps;
    info.hidden = !view.settings.debug.info;
    since = EVERY;
  }
  show();
  view.settings.onChange((setting) => { if (setting === 'debug') show(); });

  function nearestPlace(x: number, z: number): string {
    let best = '', far = Infinity;
    for (const place of sys.region?.places() ?? []) {
      const d = Math.hypot(place.at.x - x, place.at.z - z);
      if (d < far) { far = d; best = place.name; }
    }
    return best ? `${best}, ${fixed(far, 0)} m` : 'none';
  }

  function infoText(): string {
    const p = view.game.player.pos, a = view.game.ambient, c = view.camera;
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const aim = view.aim;
    const held = sys.inventory?.held()?.id ?? 'nothing';
    return [
      `x ${fixed(p.x).padStart(7)}  y ${fixed(p.y).padStart(5)}  z ${fixed(p.z).padStart(7)}`,
      `block ${bx} ${by} ${bz}   chunk ${Math.floor(bx / CHUNK)} ${Math.floor(bz / CHUNK)}`,
      `facing ${compass(view.game.player.facing)}   ${view.game.player.onGround ? 'on ground' : view.game.player.inWater ? 'in water' : 'in the air'}`,
      `near ${nearestPlace(p.x, p.z)}`,
      `day ${view.game.clock.day}  ${clock(view.game.clock.timeOfDay)}   rain ${fixed(a.rain, 2)}  cloud ${fixed(a.cloud, 2)}  wind ${fixed(a.wind, 2)}`,
      `camera ${CAMERA_NAMES[view.settings.camera]}  zoom ${c.zoom}  yaw ${fixed((c.yaw * 180) / Math.PI, 0)}°`,
      `aim ${aim ? `${BLOCKS[aim.id]?.name ?? `block ${aim.id}`} at ${aim.x} ${aim.y} ${aim.z}` : 'nothing in reach'}`,
      `held ${held}   actors ${view.game.actors.size}`,
      `chunks ${s.chunks} loaded, ${s.meshQueue} waiting`,
      `draw calls ${s.drawCalls}  tris ${thousands(s.triangles)}  programs ${s.programs}`,
      `${s.quality}${s.auto ? ' (auto)' : ''}  scale ${fixed(s.renderScale, 2)}${view.paused ? '  paused' : ''}`,
    ].join('\n');
  }

  view.onFrame((dt) => {
    const show = view.settings.debug;
    if (!show.fps && !show.info) return;
    since += dt;
    if (since < EVERY) return;
    since = 0;
    if (show.fps) {
      fps.dataset.band = s.fps >= 55 ? 'good' : s.fps >= 30 ? 'fair' : 'poor';
      rate.textContent = `${fixed(s.fps, 0)} fps`;
      rest.data = `  ${fixed(s.frameMs)} ms`;
    }
    if (show.info) info.textContent = infoText();
  });
}
