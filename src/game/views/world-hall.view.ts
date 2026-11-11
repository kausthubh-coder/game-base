// Draws Ilara's Hall: the stone door, shut or open, the Heartstone and how brightly it glows, the dead Gate,
// the four lamps that wake with the Mark, the mural, the plinth and the broken pillars. The rules are
// src/game/hall, and where each thing stands is `HALL` in content/region.ts.
//
// Nothing is sent when a save is loaded, so the flags are read twice a second and a prop whose look has
// changed is set down again.
import type { Systems } from '../api.sim.ts';
import { HALL } from '../content/region.ts';
import type { GameView } from '../shell/view.ts';
import { worldProps } from '../worldview/props.ts';

/** Seconds between two looks at the flags. */
const EVERY = 0.5;
/** From this level the Heartstone glows fully. Below it, with the Mark on the player's hand, it glows faintly. */
const BRIGHT = 10;
/** The Gate's opening faces east. A prop's front faces south at no rotation. */
const EAST = Math.PI / 2;

interface Piece {
  kind: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  /** The variant to show now. */
  variant: () => number;
  handle: number;
  shown: number;
}

export function install(view: GameView): void {
  const { game } = view;
  const { flags } = game;
  const props = worldProps(view);

  const piece = (kind: string, at: { x: number; y: number; z: number }, variant: () => number, rotation = 0): Piece =>
    ({ kind, x: at.x, y: at.y, z: at.z, rotation, variant, handle: 0, shown: -1 });
  const lit = (): number => (flags.is('hall.lit') ? 1 : 0);
  const glow = (): number => {
    if (!flags.is('mark')) return 0;
    const level = (game.systems as Partial<Systems>).hall?.heart().level ?? 0;
    return level >= BRIGHT ? 2 : 1;
  };

  const pieces: Piece[] = [
    piece('shutDoor', HALL.doorAt, () => (flags.is('door.open') ? 1 : 0)),
    piece('heartstone', HALL.heartstone, glow),
    piece('gateArch', HALL.gate, () => 0, EAST),
    piece('muralSlab', HALL.mural, () => 0),
    piece('plinth', HALL.plinth, () => 0),
    ...HALL.lamps.map((at) => piece('hallLamp', at, lit)),
    ...HALL.pillars.map((at, i) => piece('ruinPillar', at, () => at.variant, i * 1.3)),
  ];

  let since = EVERY;
  view.onFrame((dt) => {
    since += dt;
    if (since < EVERY) return;
    since = 0;
    for (const p of pieces) {
      if (!props.has(p.kind)) continue;
      const variant = p.variant();
      if (variant === p.shown) continue;
      props.remove(p.handle);
      p.handle = props.place(p.kind, variant, p.x, p.y, p.z, p.rotation, 1, true);
      p.shown = variant;
    }
  });
}
