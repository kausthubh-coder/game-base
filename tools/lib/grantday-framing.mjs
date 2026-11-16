// Direct observations of the opening's real actors. sight() deliberately ignores sprite occlusion.
export async function openingFrame(page) {
  return page.evaluate(() => {
    const g = window.__game, v = g.view, lens = v.ctx.camera;
    const h = innerHeight;
    const clear = parseFloat(getComputedStyle(v.root).getPropertyValue('--ui-talk-clear')) || 0;
    const top = document.querySelector('.ui-talk-bars:not([hidden]) .ui-talk-bar-top')?.offsetHeight || 0;
    const bottom = h - Math.max(clear, document.querySelector('.ui-talk-bars:not([hidden]) .ui-talk-bar-bottom')?.offsetHeight || 0);
    const m = lens.matrixWorld.elements, len = Math.hypot(m[0], m[2]);
    const rx = m[0] / len, rz = m[2] / len;
    const actors = [...v.game.actors.values()].filter(a => a.visible && (a.id === 'player' || a.id.startsWith('saltgate:') || a.id.startsWith('stage:'))).map(a => {
      const p = a.pos;
      // Conservative central-body samples, not a claim about every opaque pixel of the atlas.
      const foot = v.project(p.x, p.y + .1, p.z), face = v.project(p.x, p.y + 1.65, p.z);
      const chest = v.project(p.x, p.y + 1, p.z);
      const corners = [.15, 1.65].flatMap(y => [-.45, .45].map(x => v.project(p.x + rx * x, p.y + y, p.z + rz * x)));
      const box = corners.every(Boolean) ? { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) } : null;
      const depth = (p.x - lens.position.x) * m[8] + (p.y - lens.position.y) * m[9] + (p.z - lens.position.z) * m[10];
      return { id: a.id, pos: { ...p }, foot, face, chest, box, depth, inFrame: !!foot && !!face && foot.y < bottom && face.y > top };
    });
    return { line: v.game.systems.talk.current(), camera: { ...lens.position }, top, bottom, actors, sight: g.sight(), costs: g.costs() };
  });
}

export function framingIssues(frame) {
  const cast = frame.line.scene === 5 ? ['guildmaster', 'hobb'] : ['hobb', 'dax'];
  const required = ['player', ...cast.map(who => frame.actors.find(a => a.id === 'stage:' + who)?.id ?? 'saltgate:' + who)];
  const problems = [];
  for (const id of required) {
    const a = frame.actors.find(a => a.id === id);
    if (!a?.inFrame) problems.push(`${id}: body cropped`);
    if (!a) continue;
    for (const b of frame.actors) {
      if (a === b || !b.box || b.depth <= a.depth + .01) continue;
      for (const sample of ['face', 'chest']) {
        const p = a[sample], box = b.box;
        if (p && p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom) problems.push(`${id}: ${sample} overlapped by ${b.id}`);
      }
    }
  }
  return problems;
}
