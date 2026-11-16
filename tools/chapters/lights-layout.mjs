// Read-only DOM measurements. The host judges these and retains the raw rectangles.
export function readLightsLayout({ hatch = false, deliver = false } = {}) {
  const rect = (r) => ({
    left: r.left,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  });
  const read = (el, selector) => {
    const style = getComputedStyle(el),
      r = el.getBoundingClientRect(),
      range = document.createRange();
    range.selectNodeContents(el);
    return {
      selector,
      text: el.textContent,
      visible:
        !el.hidden &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        Number(style.opacity) > 0.01 &&
        r.width > 0 &&
        r.height > 0,
      pointerEvents: style.pointerEvents,
      rect: rect(r),
      textRects: [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).map(rect),
    };
  };
  const selectors = [
    '.gu-toast',
    '.gu-toast-text',
    '.bd-bar',
    '.bd-what',
    '.hp-banner',
    '.hp-banner-kicker',
    '.hp-banner-title',
    '.hp-banner-text',
  ];
  if (hatch) selectors.push('.gu-recipe:has([data-key="make:hatch"])');
  if (deliver) selectors.push('.gd-page [data-key="deliver"]');
  return {
    width: innerWidth,
    height: innerHeight,
    elements: selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((el) => read(el, selector)),
    ),
    hud: ['.ui-heart', '.gb-hud-quest'].flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((el) => read(el, selector)),
    ),
    footer: document.querySelector('.gd-ledger:not([hidden]) .gd-foot')
      ? rect(document.querySelector('.gd-ledger:not([hidden]) .gd-foot').getBoundingClientRect())
      : null,
  };
}
export function lightsLayoutIssues(frame) {
  const issues = [],
    outside = (r) =>
      r.left < -0.75 ||
      r.top < -0.75 ||
      r.right > frame.width + 0.75 ||
      r.bottom > frame.height + 0.75;
  const overlap = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const el of frame.elements.filter((e) => e.visible)) {
    if (outside(el.rect) || el.textRects.some(outside))
      issues.push(el.selector + ' leaves viewport');
    if (el.selector.includes('deliver') && frame.footer && el.rect.bottom > frame.footer.top + 0.75)
      issues.push('Deliver target covered by footer');
  }
  const banner = frame.elements.find((e) => e.selector === '.hp-banner' && e.visible);
  if (banner)
    for (const hud of frame.hud) {
      if (hud.visible && overlap(banner.rect, hud.rect))
        issues.push('arrival overlaps ' + hud.selector);
      if (frame.width < 560 && (hud.visible || hud.pointerEvents !== 'none'))
        issues.push('phone arrival HUD is visible or hit-enabled: ' + hud.selector);
    }
  return issues;
}
