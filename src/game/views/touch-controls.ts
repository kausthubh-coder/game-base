/** A circular stick with a small dead zone. Screen y grows down; forward grows up. */
export function stick(x: number, y: number, radius: number): { right: number; forward: number } {
  const distance = Math.hypot(x, y);
  if (distance < radius * .15) return { right: 0, forward: 0 };
  const strength = Math.min(1, (distance / radius - .15) / .85);
  return { right: x / distance * strength, forward: -y / distance * strength };
}

/** Each control owns one finger. Another finger cannot release or steal it. */
export function touchPointer(element: HTMLElement, callbacks: {
  start(e: PointerEvent): void;
  move?(e: PointerEvent): void;
  end(cancelled: boolean): void;
}): () => void {
  let id: number | null = null;
  const stop = new AbortController();
  const options = { signal: stop.signal };
  function end(cancelled: boolean): void {
    if (id === null) return;
    const old = id;
    id = null;
    callbacks.end(cancelled);
    if (element.hasPointerCapture(old)) element.releasePointerCapture(old);
  }
  element.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || id !== null) return;
    e.preventDefault();
    id = e.pointerId;
    element.setPointerCapture(id);
    callbacks.start(e);
  }, options);
  element.addEventListener('pointermove', e => {
    if (e.pointerId === id) { e.preventDefault(); callbacks.move?.(e); }
  }, options);
  element.addEventListener('pointerup', e => { if (e.pointerId === id) end(false); }, options);
  for (const name of ['pointercancel', 'lostpointercapture']) {
    element.addEventListener(name, e => { if ((e as PointerEvent).pointerId === id) end(true); }, options);
  }
  return () => { end(true); stop.abort(); };
}
