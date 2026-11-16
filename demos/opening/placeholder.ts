// A stand-in picture for a way that is not built yet: a card with the shot's name. It keeps the page running
// while each way is built in its own branch. A way's index.ts stops using it once the way draws.
import type { CreateRenderer, Shot } from './types.ts';

const W = 1280, H = 720;

export const placeholder = (way: string): CreateRenderer => (film) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  let mine: readonly Shot[] = [];
  return {
    canvas,
    load: async (shots) => { mine = shots; },
    draw(t) {
      const last = mine[mine.length - 1];
      const shot = last && t >= last.at + last.len ? last : film.at(t);
      const p = (t - shot.at) / shot.len;
      c.fillStyle = shot.part ? '#1f2a38' : '#ead8b4';
      c.fillRect(0, 0, W, H);
      c.fillStyle = shot.part ? '#f4efe2' : '#4a3b1e';
      c.textAlign = 'center';
      c.font = '600 44px ui-sans-serif, system-ui, sans-serif';
      c.fillText(`${shot.n + 1}. ${shot.title}`, W / 2, H / 2 - 10);
      c.font = '400 22px ui-sans-serif, system-ui, sans-serif';
      c.fillText(`${way}: not built yet`, W / 2, H / 2 + 34);
      c.fillRect(W * 0.2, H * 0.62, W * 0.6 * Math.min(1, Math.max(0, p)), 4);
    },
    dispose() {},
  };
};
