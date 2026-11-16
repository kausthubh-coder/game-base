import { SCENES } from '../../src/game/content/scenes.ts';
import manifest from '../../public/assets/manifest.json' with {type:'json'};

// Direct observations of first-night actors. sight() deliberately ignores sprite occlusion.
export function companionBounds(sprite) {
  if(sprite==='fox') {
    const sheet=manifest.sprites.fox;
    // Full sheet envelope, including transparent space, at the renderer's scale 1.
    return {height:sheet.worldHeight,halfWidth:sheet.worldHeight*sheet.frame[0]/sheet.frame[1]/2};
  }
  return {height:1.8, halfWidth:.45};
}
export async function firstnightFrame(page) {
  return page.evaluate((foxBounds) => {
    const g = window.__game, v = g.view, lens = v.ctx.camera;
    const h = innerHeight;
    const clear = parseFloat(getComputedStyle(v.root).getPropertyValue('--ui-talk-clear')) || 0;
    const top = document.querySelector('.ui-talk-bars:not([hidden]) .ui-talk-bar-top')?.offsetHeight || 0;
    const bottom = h - Math.max(clear, document.querySelector('.ui-talk-bars:not([hidden]) .ui-talk-bar-bottom')?.offsetHeight || 0);
    const m = lens.matrixWorld.elements, len = Math.hypot(m[0], m[2]);
    const rx = m[0] / len, rz = m[2] / len;
    const fight = window.__fights?.state();
    const candidates = [...v.game.actors.values()];
    const companion = fight && v.game.systems.fights.running()?.fight.companion;
    if (companion) candidates.push({id:'fight-companion:'+companion.def.kind,sprite:companion.def.kind,visible:true,pos:{x:companion.x,y:v.game.world.heightAt(Math.floor(companion.x),Math.floor(companion.z)),z:companion.z},anim:'idle'});
    const actors = candidates.filter(a => (a.visible || (a.id === 'player' && fight)) && (a.id === 'player' || a.id.startsWith('npc:') || a.id.startsWith('stage:') || a.id.startsWith('crowd:') || a.id.startsWith('fight-companion:'))).map(a => {
      // Combat intentionally hides the ordinary actor and draws the hero as a fight figure.
      const fighting = a.id === 'player' && !a.visible && fight;
      const p = fighting ? { x: fight.hero.x, y: v.game.world.heightAt(Math.floor(fight.hero.x), Math.floor(fight.hero.z)), z: fight.hero.z } : a.pos;
      const small = a.sprite === 'custodian-wake';
      // Custodian atlas: 96px frame, anchor y88, 1.11m sheet height. Its face and body sit below the winding key.
      const fox = a.sprite === 'fox';
      const height = fox ? foxBounds.height : small ? .70 : 1.8, halfWidth = fox ? foxBounds.halfWidth : small ? .38 : .45;
      // Conservative central-body samples, not a claim about every opaque pixel of the atlas.
      const foot = v.project(p.x, p.y + .1, p.z), face = v.project(p.x, p.y + (small ? .45 : height * .92), p.z);
      const chest = v.project(p.x, p.y + (small ? .25 : height * .56), p.z);
      const corners = [.1, height * .92].flatMap(y => [-halfWidth, halfWidth].map(x => v.project(p.x + rx * x, p.y + y, p.z + rz * x)));
      const box = corners.every(Boolean) ? { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)), top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) } : null;
      const depth = (p.x - lens.position.x) * m[8] + (p.y - lens.position.y) * m[9] + (p.z - lens.position.z) * m[10];
      return { id: a.id, source: fighting ? 'fight-figure' : a.id === 'stage:echo-fox' ? 'memory-stage' : 'actor', sprite: a.sprite, anim: a.anim, pos: { ...p }, foot, face, chest, box, depth, inFrame: !!foot && !!face && foot.y < bottom && face.y > top && foot.x > 0 && foot.x < innerWidth && face.x > 0 && face.x < innerWidth };
    });
    return { line: v.game.systems.talk.current(), yaw: v.camera.yaw, camera: { ...lens.position }, top, bottom, actors, fightCompanion: companion?.def.kind ?? null, sight: g.sight(), costs: g.costs() };
  }, companionBounds('fox'));
}

export function firstnightIssues(frame) {
  const required = new Set(frame.sight.map(a => a.who));
  // Memories show the past cast; story-stage intentionally hides the present-day hero.
  if (!SCENES.find(s=>s.n===frame.line?.scene)?.memory) required.add('player');
  if (frame.line?.scene === 12) required.add('npc:custodian');
  if (frame.line?.scene === 15) { required.add('stage:tamsin'); required.add('stage:aldric'); }
  if (frame.line?.scene === 16) for (const who of ['elowen','calla','aldric','tamsin']) required.add('stage:'+who);
  if (frame.fightCompanion && frame.line?.npc === frame.fightCompanion) required.add('fight-companion:'+frame.fightCompanion);
  const problems = [];
  if(frame.fightCompanion && frame.actors.some(a=>a.id==='stage:'+frame.fightCompanion)) problems.push('duplicate stage and fight companion: '+frame.fightCompanion);
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
  for (const body of frame.sight) {
    if (!body.inFrame) problems.push(`${body.who}: scenery sight out of frame`);
    if (body.hiddenBy) problems.push(`${body.who}: hidden by ${body.hiddenBy}`);
  }
  return problems;
}
// Camera convergence, bounded in wall time; no rule time is supplied.
export async function settleDialogue(page) {
  let last, stable = 0;
  for (let i = 0; i < 240; i++) {
    const sample = await page.evaluate(() => { const v = window.__game.view; return { film: v.game.systems.talk.active && v.game.systems.talk.current()?.kind === 'film', pose: [...v.ctx.camera.position.toArray(), ...v.ctx.camera.quaternion.toArray()] }; });
    const now = sample.pose;
    // Films deliberately keep drifting. Wait for the fast entry glide to end, not for that drift to stop.
    const tolerance = sample.film ? .05 : .002;
    if (last && now.every((v, i) => Math.abs(v - last[i]) < tolerance)) stable++; else stable = 0;
    if (stable >= 4) return;
    last = now;
    await page.waitForTimeout(50);
  }
  throw Error('dialogue camera did not settle');
}
