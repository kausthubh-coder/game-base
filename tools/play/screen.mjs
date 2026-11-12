// What a player can read or press on the page, and what a machine can tell looks wrong with it.
// `readScreen` runs inside the page (it is installed there as `window.__playScreen`), so it uses nothing
// from outside its own body. `findWrong` is pure: it takes the boxes `readScreen` gives.

/** Runs in the page. Each visible piece of interface: its text, whether it can be pressed, its box. */
export function readScreen() {
  const W = window.innerWidth, H = window.innerHeight;
  const PRESS = 'button,a[href],input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=link],[role=checkbox],[role=radio],[role=option],[role=switch],[role=slider],[tabindex]:not([tabindex="-1"])';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'svg', 'CANVAS']);
  const words = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const shown = (el) => el.checkVisibility
    ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
    : getComputedStyle(el).visibility !== 'hidden';
  const label = (el) => {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['button', 'submit', 'reset'].includes(type)) return words(el.value);
      if (['checkbox', 'radio'].includes(type)) return words(el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.name);
      const name = words(el.getAttribute('aria-label') || el.placeholder || el.labels?.[0]?.innerText || el.name);
      return el.value ? `${name}${name ? ': ' : ''}${words(el.value)}` : name;
    }
    if (tag === 'SELECT') return words(el.selectedOptions?.[0]?.text);
    // The accessible name first, as a screen reader says it: a quick slot's label names its item, its text only the key.
    return words(el.getAttribute('aria-label')) || words(el.innerText) || words(el.getAttribute('title') || el.querySelector('img[alt]')?.alt);
  };
  /** The text in el that is not inside something pressable, for a block of text that holds a button. */
  const ownText = (el) => {
    let text = '';
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const parent = n.parentElement, owner = parent?.closest(PRESS);
      if (!parent || (owner && owner !== el && el.contains(owner)) || !shown(parent)) continue;
      text += ' ' + n.data;
    }
    return words(text);
  };
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim());
  const clip = (el) => {
    const cs = getComputedStyle(el);
    const clips = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
    return { clips, sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight };
  };
  const describe = (el) => {
    if (!el) return null;
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = words(el.innerText).slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };
  /**
   * How much of el's box its scrolling and clipping ancestors leave showing, from 0 to 1, and the ancestor that
   * hides the rest. A fixed box is clipped by nobody, an absolute one only by its containing blocks.
   */
  const shownPart = (el, r) => {
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom, by = null;
    let position = getComputedStyle(el).position;
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement && position !== 'fixed'; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (position === 'absolute' && cs.position === 'static') continue;
      position = cs.position;
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowX !== 'visible') {
        if (pr.left > left) { left = pr.left; by = p; }
        if (pr.right < right) { right = pr.right; by = p; }
      }
      if (cs.overflowY !== 'visible') {
        if (pr.top > top) { top = pr.top; by = p; }
        if (pr.bottom < bottom) { bottom = pr.bottom; by = p; }
      }
    }
    const share = (Math.max(0, right - left) * Math.max(0, bottom - top)) / (r.width * r.height);
    return { share: Math.round(share * 100) / 100, by, left, top, right, bottom, cx: (Math.max(left, 0) + Math.min(right, W)) / 2, cy: (Math.max(top, 0) + Math.min(bottom, H)) / 2 };
  };
  /**
   * What is drawn on top of el at a point, or null. `layer` says it belongs to something over half the screen
   * (a menu, the dialogue): el is under it, which is a modal doing its job. Otherwise a small thing covers el.
   * Text that lets clicks through is made to take them for the length of the test, or the test would skip it.
   */
  const onTop = (el, x, y) => {
    const through = getComputedStyle(el).pointerEvents === 'none', before = el.style.pointerEvents;
    if (through) el.style.pointerEvents = 'auto';
    const stack = document.elementsFromPoint(Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y)));
    if (through) el.style.pointerEvents = before;
    // An unseen thing on top hides nothing. When it is a control (a radio laid over its label), the piece under it takes its clicks.
    const hit = stack.find((e) => shown(e));
    const control = stack[0] !== hit && stack[0]?.matches(PRESS) && !stack[0].disabled;
    if (!hit || hit === el || el.contains(hit) || hit.contains(el)) return control ? { control: true } : null;
    let layer = false;
    for (let top = hit; top && !top.contains(el) && !layer; top = top.parentElement) {
      const h = top.getBoundingClientRect();
      const big = (Math.max(0, Math.min(h.right, W) - Math.max(h.left, 0)) * Math.max(0, Math.min(h.bottom, H) - Math.max(h.top, 0))) / (W * H) >= 0.5;
      if (!big) continue;
      // The HUD's root is as big as the screen and is no layer: it paints nothing and lets clicks through.
      const cs = getComputedStyle(top);
      layer = cs.pointerEvents !== 'none' || cs.backgroundImage !== 'none' || !/^(transparent|rgba\(.*,\s*0\))$/.test(cs.backgroundColor);
    }
    return { what: describe(hit), layer };
  };
  const items = [];
  /** Pieces scrolled wholly out of a box, counted by the box: a player has to scroll to read them. */
  const outOfSight = new Map();
  const visit = (el, insideText) => {
    if (SKIP.has(el.tagName) || el.tagName.toLowerCase() === 'svg') return;
    if (el.hidden) return;
    if (!shown(el)) {
      // A hidden parent can hold a shown child only with visibility, which checkVisibility reports per element.
      if (getComputedStyle(el).display === 'none') return;
      for (const child of el.children) visit(child, insideText);
      return;
    }
    // A thing with a hand cursor and words of its own takes clicks, whatever its tag. A layer that only holds
    // other pieces (the dialogue, which a click anywhere advances) is not one piece: its lines are listed.
    const press = el.matches(PRESS) || (getComputedStyle(el).cursor === 'pointer' && (el.children.length === 0 || hasOwnText(el))
      && (!el.parentElement || getComputedStyle(el.parentElement).cursor !== 'pointer'));
    const text = press ? label(el) : (!insideText && hasOwnText(el) ? ownText(el) : '');
    if (press || text) {
      const r = el.getBoundingClientRect();
      const inView = r.right > 0 && r.bottom > 0 && r.left < W && r.top < H;
      // 2 px or less is a line kept for screen readers (the visually hidden pattern), not something a player sees.
      const part = r.width > 2 && r.height > 2 && inView ? shownPart(el, r) : null;
      // A piece scrolled wholly out of its box is not on the screen at all.
      if (part && part.share > 0) {
        const item = {
          text, press, kind: press ? (el.getAttribute('role') || el.tagName.toLowerCase()) : 'text',
          disabled: press && (el.disabled === true || el.getAttribute('aria-disabled') === 'true'),
          // The part of the box its scrolling ancestors leave showing: that is what a player sees and can press.
          box: { x: Math.round(part.left), y: Math.round(part.top), w: Math.round(part.right - part.left), h: Math.round(part.bottom - part.top) },
          clip: clip(el), what: describe(el),
        };
        if (part.share < 1) { item.shown = part.share; item.clippedBy = describe(part.by); }
        const above = onTop(el, part.cx, part.cy);
        if (above?.control) item.press = true;
        else if (above) { if (above.layer) item.blockedBy = above.what; else item.coveredBy = above.what; }
        items.push(item);
      } else if (part && part.by) {
        const box = describe(part.by);
        outOfSight.set(box, (outOfSight.get(box) ?? 0) + 1);
      }
    }
    // Inside a pressable thing only other pressable things are listed; inside a text block only those too.
    for (const child of el.children) visit(child, insideText || press || Boolean(text));
  };
  if (document.body) visit(document.body, false);
  return { viewport: { w: W, h: H }, items, outOfSight: [...outOfSight].map(([box, count]) => ({ in: box, count })) };
}

/** Reading order, with duplicates (same text, same box) left out. */
export function order(items) {
  const band = (y) => Math.round(y / 12);
  const sorted = [...items].sort((a, b) => band(a.box.y) - band(b.box.y) || a.box.x - b.box.x);
  const seen = new Set();
  return sorted.filter((item) => {
    const key = `${item.text}|${item.box.x},${item.box.y},${item.box.w},${item.box.h}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** A piece is readable when at least this share of its box shows inside its scrolling and clipping ancestors. */
export const READABLE = 0.6;
/** Can a player read or press this piece now: enough of it shows and nothing sits on top of it. */
export const readable = (item) => (item.shown ?? 1) >= READABLE && !item.coveredBy;

const overlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 2 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 2;
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

/**
 * What looks wrong, each with its kind, the piece and its box:
 * `cut` text clipped by its box or mostly scrolled out of sight, `off` partly outside the viewport, `over` a pressable thing covered at its
 * centre, two pressable things that overlap, text drawn over other text or over a pressable thing, `small` a pressable
 * thing under 24 px on a side.
 */
export function findWrong(items, viewport, { minSize = 24 } = {}) {
  const wrong = [];
  const name = (item) => item.text || item.what || item.kind;
  for (const item of items) {
    const { box, clip } = item;
    // Two pixels of height are a font's descenders reaching past the line box, which draw fine.
    if (clip && item.text && clip.clips && (clip.sw > clip.cw + 1 || clip.sh > clip.ch + 2)) {
      wrong.push({ kind: 'cut', what: name(item), box, why: clip.sw > clip.cw + 1 ? `text ${clip.sw} px wide in ${clip.cw}` : `text ${clip.sh} px tall in ${clip.ch}` });
    }
    if (box.x < 0 || box.y < 0 || box.x + box.w > viewport.w || box.y + box.h > viewport.h) {
      wrong.push({ kind: 'off', what: name(item), box, why: 'partly outside the screen' });
    }
    if (item.clippedBy && item.shown < READABLE) {
      wrong.push({ kind: 'cut', what: name(item), box, why: `${Math.round((1 - item.shown) * 100)}% of it is hidden past the edge of ${item.clippedBy}` });
    }
    if (item.press && item.coveredBy) wrong.push({ kind: 'over', what: name(item), box, why: `covered at its centre by ${item.coveredBy}` });
    if (!item.press && item.coveredBy) wrong.push({ kind: 'over', what: name(item), box, why: `covered by ${item.coveredBy}` });
    if (item.press && !item.disabled && (box.w < minSize || box.h < minSize)) {
      wrong.push({ kind: 'small', what: name(item), box, why: `${box.w}x${box.h}, under ${minSize} px` });
    }
  }
  // A piece under a menu or the dialogue is not what the player is looking at: it takes no part in overlaps.
  const press = items.filter((item) => item.press && !item.blockedBy);
  for (let i = 0; i < press.length; i++) {
    for (let j = i + 1; j < press.length; j++) {
      const a = press[i], b = press[j];
      // A button inside another pressable box is a nested control, which the covering check already sees.
      if (!overlap(a.box, b.box) || inside(a.box, b.box) || inside(b.box, a.box)) continue;
      // Named once: a piece already flagged as covered gets its overlap said by the other.
      const [one, other] = a.coveredBy ? [b, a] : [a, b];
      if (one.coveredBy) continue;
      wrong.push({ kind: 'over', what: name(one), box: one.box, why: `overlaps ${name(other)} at ${other.box.x},${other.box.y} ${other.box.w}x${other.box.h}` });
    }
  }
  const text = items.filter((item) => !item.press && item.text && !item.blockedBy);
  for (let i = 0; i < text.length; i++) {
    for (let j = i + 1; j < text.length; j++) {
      const a = text[i], b = text[j];
      if (!overlap(a.box, b.box) || inside(a.box, b.box) || inside(b.box, a.box)) continue;
      wrong.push({ kind: 'over', what: name(a), box: a.box, why: `text over text: ${name(b)} at ${b.box.x},${b.box.y} ${b.box.w}x${b.box.h}` });
    }
  }
  // Text is never listed from inside a pressable thing, so text over one is a stranger: a world marker
  // drawn across the quick slots. A block of text that holds the button is left alone.
  for (const a of text) {
    // Text already said to be covered is not said again for the thing that covers it.
    if (a.coveredBy) continue;
    for (const b of press) {
      if (!overlap(a.box, b.box) || inside(b.box, a.box)) continue;
      wrong.push({ kind: 'over', what: name(a), box: a.box, why: `text over ${name(b)} at ${b.box.x},${b.box.y} ${b.box.w}x${b.box.h}` });
    }
  }
  return wrong;
}
