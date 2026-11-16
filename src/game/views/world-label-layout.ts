// Shared placement for home and production tags. Caller-owned rectangles are reused.
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function overlaps(a: LabelBox, b: LabelBox, gap = 8): boolean {
  return (
    a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
  );
}
/** False means there is no clear position. Never return a colliding fallback. */
export function fitLabel(
  box: LabelBox,
  anchorX: number,
  anchorY: number,
  width: number,
  height: number,
  blockers: readonly LabelBox[],
  count = blockers.length,
  reach = Infinity,
): boolean {
  const wantedX = Math.max(8, Math.min(width - box.w - 8, anchorX - box.w / 2));
  const wantedY = Math.max(72, Math.min(height - box.h - 100, anchorY - box.h));
  box.x = wantedX;
  box.y = wantedY;
  let clear = true;
  for (let i = 0; i < count; i++)
    if (overlaps(box, blockers[i])) {
      clear = false;
      break;
    }
  if (clear && box.x + box.w <= width - 8 && box.y + box.h <= height - 8) return true;
  let best = Infinity,
    bestX = wantedX,
    bestY = wantedY;
  // Search both axes. The displacement bound keeps farm tags near their actual anchor.
  for (
    let x = Math.max(8, wantedX - reach);
    x <= Math.min(width - box.w - 8, wantedX + reach);
    x += 8
  ) {
    for (
      let y = Math.max(72, wantedY - reach);
      y <= Math.min(height - box.h - 100, wantedY + reach);
      y += 4
    ) {
      const cost = (x - wantedX) ** 2 + (y - wantedY) ** 2;
      if (cost >= best) continue;
      box.x = x;
      box.y = y;
      let clear = true;
      for (let i = 0; i < count; i++)
        if (overlaps(box, blockers[i])) {
          clear = false;
          break;
        }
      if (clear) {
        best = cost;
        bestX = x;
        bestY = y;
      }
    }
  }
  box.x = bestX;
  box.y = bestY;
  return best !== Infinity;
}
interface Entry extends LabelBox {
  node: HTMLElement;
}
const layouts = new WeakMap<HTMLElement, ReturnType<typeof makeLayout>>();
const HUD =
  '.gu-note,.gu-hint,.ui-bookbtn,.gb-hud-quest,.ui-day,.ui-pips,.ui-heart,.gb-minimap,.gb-hud-slots,.gu-prompt,.gb-beacon-chip,.gb-beacon-arrow,.gu-toasts';
function makeLayout(root: HTMLElement) {
  const entries: Entry[] = [],
    blockers: LabelBox[] = [];
  const hero: LabelBox = { x: -10000, y: -10000, w: 0, h: 0 };
  let hud = root.querySelectorAll<HTMLElement>(HUD),
    dirty = false;
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  observer.observe(root, { childList: true, subtree: true });
  return {
    protectHero(feet: { x: number; y: number } | null, head: { x: number; y: number } | null) {
      hero.x = feet && head ? Math.min(feet.x, head.x) - 28 : -10000;
      hero.y = feet && head ? Math.min(feet.y, head.y) - 10 : -10000;
      hero.w = feet && head ? Math.abs(feet.x - head.x) + 56 : 0;
      hero.h = feet && head ? Math.abs(feet.y - head.y) + 20 : 0;
    },
    register(node: HTMLElement) {
      const entry: Entry = { node, x: 0, y: 0, w: 0, h: 0 };
      entries.push(entry);
      return (x: number, y: number, reach = Infinity): boolean => {
        entry.w = node.offsetWidth;
        entry.h = node.offsetHeight;
        // Prompts and other tags register dynamically. Do not retain a startup NodeList.
        let count = 0;
        if (dirty) {
          hud = root.querySelectorAll<HTMLElement>(HUD);
          dirty = false;
        }
        for (const target of hud) {
          const rect = target.getBoundingClientRect();
          if (!rect.width || !rect.height || getComputedStyle(target).visibility === 'hidden')
            continue;
          const box = blockers[count] ?? { x: 0, y: 0, w: 0, h: 0 };
          box.x = rect.x;
          box.y = rect.y;
          box.w = rect.width;
          box.h = rect.height;
          blockers[count++] = box;
        }
        // Copy into scratch rectangles, never overwrite the registered entries.
        for (const other of entries) {
          if (
            other === entry ||
            other.node.hidden ||
            other.node.style.display === 'none' ||
            other.node.style.visibility === 'hidden'
          )
            continue;
          const box = blockers[count] ?? { x: 0, y: 0, w: 0, h: 0 };
          box.x = other.x;
          box.y = other.y;
          box.w = other.w;
          box.h = other.h;
          blockers[count++] = box;
        }
        const box = blockers[count] ?? { x: 0, y: 0, w: 0, h: 0 };
        Object.assign(box, hero);
        blockers[count++] = box;
        const clear = fitLabel(
          entry,
          x,
          y,
          root.clientWidth,
          root.clientHeight,
          blockers,
          count,
          reach,
        );
        node.style.visibility = clear ? '' : 'hidden';
        node.style.transform = `translate(${Math.round(entry.x)}px, ${Math.round(entry.y)}px)`;
        return clear;
      };
    },
  };
}
export function worldLabelLayout(root: HTMLElement) {
  let layout = layouts.get(root);
  if (!layout) {
    layout = makeLayout(root);
    layouts.set(root, layout);
  }
  return layout;
}
