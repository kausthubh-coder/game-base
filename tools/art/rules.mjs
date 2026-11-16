// The rules a 2D asset is held to, each a measure against a limit from assets-src/art-style.json. `sheetFaults`
// returns the rules a sprite sheet breaks, `portraitFaults` and `iconFaults` the same for faces and icons.
// A fault is `{ rule, detail }`; the rule's name is what the ledger and the skill's failure table use.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { at, characterOf, cosine, cut, differ, frames, measure, pixels, portraitRank } from './lib.mjs';

/** What a sheet is, for the ledger: its file and the manifest values that change how it is drawn. */
export function shaOf(entry) {
  const h = createHash('sha256').update(fs.readFileSync(at('public/assets/' + entry.sheet)));
  h.update(JSON.stringify([entry.frame, entry.anchor, entry.worldHeight, entry.animations]));
  return h.digest('hex').slice(0, 12);
}

const spread = (list) => Math.max(...list) - Math.min(...list);
const pct = (v) => (v * 100).toFixed(1) + '%';

/** A sheet's frames, their measures and the facts the rules and the card share. */
export async function facts(name, m, c) {
  const entry = m.sprites[name], who = characterOf(name, c), list = await frames(entry), ms = list.map((f) => measure(f));
  const first = Object.keys(entry.animations)[0];
  const standing = ms.filter((x, i) => !x.empty && list[i].anim === (entry.animations.idle ? 'idle' : first));
  const tall = Math.max(...standing.map((x) => x.height));
  return { name, entry, who, list, ms, tall, blocks: (tall * entry.worldHeight) / entry.frame[1], density: entry.frame[1] / entry.worldHeight, stands: Boolean(entry.animations.idle) };
}

export async function sheetFaults(name, { m, s, c, cache = new Map() }) {
  const get = async (n) => { if (!cache.has(n)) cache.set(n, await facts(n, m, c)); return cache.get(n); };
  const f = await get(name), { entry, who, list, ms } = f, L = s.limits, faults = [];
  const fault = (rule, detail) => faults.push({ rule, detail });
  const kind = who.kind && s.kinds[who.kind], vocabulary = new Set([...c.poses.loops, ...c.poses.once, ...c.poses.held]);
  const isBase = who.id === name, isVariant = who.variants?.includes(name);

  // The frame and the poses.
  if (!kind) fault('contract', `no character in assets-src/art-contract.json lists this sheet, so it has no kind`);
  else {
    const frameOk = kind.frame ? entry.frame[0] === kind.frame && entry.anchor[0] === kind.anchor[0] && entry.anchor[1] === kind.anchor[1] : kind.frames.includes(entry.frame[0]);
    if (!frameOk) fault('frame', `frame ${entry.frame.join('x')} anchor ${entry.anchor.join(',')}; a ${who.kind} is ${kind.frame ? `${kind.frame} square, anchor ${kind.anchor.join(',')}` : kind.frames.join(' or ') + ' square'}`);
    if (isBase || isVariant) for (const [anim, need] of Object.entries(c.kinds[who.kind].required)) {
      const a = entry.animations[anim];
      if (!a) { if (!(isVariant && !entry.animations.idle)) fault('contract', `no "${anim}" animation; every ${who.kind} has one`); continue; }
      if (a.frames < need.frames) fault('contract', `"${anim}" has ${a.frames} frames; a ${who.kind} needs ${need.frames}`);
      for (const dir of need.dirs) if (a.rows?.[dir] === undefined) fault('contract', `"${anim}" has no ${dir} row`);
    }
  }
  for (const anim of Object.keys(entry.animations)) if (!vocabulary.has(anim)) fault('contract', `animation "${anim}" is not a pose name in the contract's list`);

  // Size: the pixels against the hero's, the height against the sheet's stated one, and against its own other sheets.
  const [lo, hi] = L.density[who.kind ?? 'creature'];
  if (f.density < lo || f.density > hi) fault('density', `${f.density.toFixed(0)} pixels a block; a ${who.kind} is drawn at ${lo} to ${hi} (the hero is ${s.pixelsPerBlock})`);
  const hero = await get('hero'), stated = c.characters[who.id]?.stated;
  if (stated && !stated.exaggerated && f.stands && (isBase || isVariant)) {
    const want = (stated.metres ?? stated.blocks) / stated.hero, got = f.blocks / hero.blocks, off = got / want - 1;
    const allow = stated.of ? L.scale.part : L.scale[who.kind === 'person' ? 'person' : 'creature'];
    if (Math.abs(off) > allow) fault('scale', `${got.toFixed(2)} heroes tall; its sheet says ${want.toFixed(2)}${stated.of ? ` to the ${stated.of}` : ''} (${off > 0 ? '+' : ''}${(off * 100).toFixed(0)}%, limit ${(allow * 100).toFixed(0)}%). worldHeight ${(entry.worldHeight * want / got).toFixed(2)} would match`);
  }
  if (!isBase && m.sprites[who.id]) {
    const base = await get(who.id);
    // Two standing sheets are compared by how tall they stand; a sheet of poses by its pixels a block.
    if (f.stands && base.stands) { if (Math.abs(f.blocks / base.blocks - 1) > L.sameSize.height) fault('same-size', `stands ${f.blocks.toFixed(2)} blocks and ${who.id} stands ${base.blocks.toFixed(2)}: the figure changes size when the game swaps sheets. \`bun tools/art/repair.mjs ${name} --height\` sets it`); }
    else if (Math.abs(f.density / base.density - 1) > L.sameSize.density) fault('same-size', `${f.density.toFixed(0)} pixels a block and ${who.id} is ${base.density.toFixed(0)}: the figure changes size when the game swaps sheets`);
    // The same person: the colours of the first front frame against the base sheet's.
    if (!isVariant && !who.mixed?.includes(name)) {
      const mine = ms[list.findIndex((x) => x.dir === 'front')], theirs = base.ms[base.list.findIndex((x) => x.dir === 'front')];
      const like = cosine(mine.families, theirs.families);
      if (like < L.identity.sheet) fault('identity', `front colours match ${who.id}'s by ${like.toFixed(2)} (limit ${L.identity.sheet}): hair, skin or clothes changed colour`);
    }
  }

  // Frame by frame, one animation and direction at a time.
  const groups = new Map();
  list.forEach((x, i) => { const k = `${x.anim} ${x.dir}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  const worst = {};
  const note = (rule, value, detail) => { if (!worst[rule] || value > worst[rule].value) worst[rule] = { value, detail }; };
  for (const [key, idx] of groups) {
    const anim = key.split(' ')[0], loop = c.poses.loops.includes(anim), on = idx.filter((i) => !ms[i].empty);
    if (on.length < idx.length) fault('contract', `${key}: ${idx.length - on.length} empty frames`);
    if (!on.length) continue;
    for (const i of on) {
      const x = ms[i], at_ = `${key} frame ${list[i].col + 1}`;
      if (Math.abs(x.bottom - entry.anchor[1]) > L.baseline && !who.flies) note('baseline', Math.abs(x.bottom - entry.anchor[1]), `${at_}: feet on row ${x.bottom}, the anchor is row ${entry.anchor[1]}`);
      if (x.pale > L.fringe.pale) note('fringe', x.pale, `${at_}: ${pct(x.pale)} of the outline is near white`);
      if (x.halo > L.fringe.halo) note('fringe', x.halo + 1, `${at_}: ${pct(x.halo)} of the outline is a light rim over darker pixels`);
      if (x.soft) note('fringe', 2, `${at_}: ${x.soft} half-transparent pixels`);
      if (x.black > L.outline.black) note('outline', x.black, `${at_}: ${pct(x.black)} of the outline is pure black`);
      const like = cosine(x.families, ms[on[0]].families);
      if (like < L.identity.frame && !who.mixed?.includes(name)) note('identity', 1 - like, `${at_}: colours match the first ${list[i].dir} frame by ${like.toFixed(2)} (limit ${L.identity.frame})`);
    }
    if (loop) {
      const limit = anim === 'idle' ? L.steady.idle : L.steady.loop, sway = spread(on.map((i) => ms[i].body));
      if (sway > limit) note('steady', sway / limit, `${key}: the body moves ${sway.toFixed(1)} pixels sideways between frames (limit ${limit})`);
      const grow = Math.max(...on.map((i) => ms[i].area)) / Math.min(...on.map((i) => ms[i].area)), most = anim === 'idle' ? L.jump.idle : L.jump.loop;
      if (grow > most && !who.flies) note('jump', grow / most, `${key}: one frame covers ${grow.toFixed(2)} times the pixels of another (limit ${most})`);
      if (on.length > 2) {
        const steps = on.map((i, k) => differ(list[i], list[on[(k + 1) % on.length]]));
        const seam = steps[steps.length - 1], inner = Math.max(...steps.slice(0, -1));
        if (seam > inner * L.loop.seam && seam > 0.25) note('loop', seam / inner, `${key}: the last frame to the first changes ${pct(seam)} of the figure, the largest other step ${pct(inner)}`);
        if (steps.some((v) => v === 0)) note('loop', 1, `${key}: two neighbouring frames are the same picture`);
      }
    }
  }
  const solidOnes = ms.filter((x) => !x.empty), bare = solidOnes.reduce((sum, x) => sum + x.bare, 0) / solidOnes.length;
  if (bare > L.outline.bare && !who.glow?.includes(name)) fault('outline', `${pct(bare)} of the figure's edge has no dark outline pixel (limit ${pct(L.outline.bare)})`);
  for (const [rule, w] of Object.entries(worst)) fault(rule, w.detail);
  return faults;
}

/** The share of a figure's height a portrait shows: head and shoulders. */
export const HEAD = [0, 0.6];

/** Each named face against the head and shoulders of the sprite of the same name: the colours must pick out their own sprite. */
export async function portraitFaults({ m, s, c }) {
  const sheet = await pixels(m.portraits.sheet), tile = m.portraits.tile, heads = {}, out = {};
  for (const [n, e] of Object.entries(m.sprites)) { const f = (await frames(e)).find((x) => x.dir === 'front'); if (f) heads[n] = measure(f, HEAD).families; }
  for (const [key, [col, row]] of Object.entries(m.portraits.names)) {
    const who = key.replace(/-(calm|glad|troubled)$/, '');
    if (!heads[who] || characterOf(who, c).kind === 'giant') continue;
    const fam = measure(cut(sheet, col * tile, row * tile, tile, tile)).families;
    const { rank, like, nearest } = portraitRank(fam, heads, who, c);
    if (rank > s.limits.portrait.rank || like < s.limits.portrait.like) (out[who] ??= []).push({ rule: 'portrait', detail: `${key}: colours match the ${who} sprite's head by ${like.toFixed(2)}, and ${rank - 1} other characters match better (nearest ${nearest})` });
  }
  // One fault a person: the worst face says it.
  return Object.fromEntries(Object.entries(out).map(([who, list]) => [who, [list[0]]]));
}

/** Icons of the sets the style names: inside the cell's margin, and no two of a set the same mark at 32 pixels. */
export async function iconFaults({ m, s }) {
  const out = {};
  for (const [set, def] of [['main', m.icons], ...Object.entries(m.icons.sheets ?? {})]) {
    const p = await pixels(def.sheet), cells = new Map();
    for (const [n, [col, row]] of Object.entries(def.names)) if (!cells.has(col + ',' + row)) cells.set(col + ',' + row, { n, f: cut(p, col * def.tile, row * def.tile, def.tile, def.tile) });
    const icons = [...cells.values()].map((x) => ({ ...x, x: measure(x.f) })).filter((i) => !i.x.empty);
    for (const i of icons) {
      const faults = [], margin = s.limits.icon.margin;
      if (i.x.left < margin || i.x.top < margin || i.x.right > def.tile - 1 - margin || i.x.bottom > def.tile - 1 - margin) faults.push({ rule: 'icon-margin', detail: `drawn from ${i.x.left},${i.x.top} to ${i.x.right},${i.x.bottom}; an icon keeps ${margin} clear pixels on every side` });
      if (Math.min(i.x.width, i.x.height) < s.limits.icon.fill) faults.push({ rule: 'icon-thin', detail: `drawn ${i.x.width} by ${i.x.height} in a ${def.tile} cell; the shorter side is ${s.limits.icon.fill} pixels or more. A long thing lies on the diagonal, as the first sheet's sword and staff do, so it fills its slot` });
      if (i.x.soft) faults.push({ rule: 'fringe', detail: `${i.x.soft} half-transparent pixels` });
      if (i.x.bare > s.limits.icon.bare || i.x.rimLuma > s.limits.icon.rim) faults.push({ rule: 'icon-outline', detail: `${pct(i.x.bare)} of its edge has no dark outline and the edge is ${i.x.rimLuma.toFixed(2)} light (limits ${pct(s.limits.icon.bare)} and ${s.limits.icon.rim}): it fades into parchment` });
      for (const j of icons) {
        if (j === i) continue;
        let both = 0, either = 0;
        for (let k = 3; k < i.f.data.length; k += 4) { const a = i.f.data[k] > 127, b = j.f.data[k] > 127; if (a || b) either++; if (a && b) both++; }
        if (both / either > s.limits.icon.twinShape && cosine(i.x.families, j.x.families) > s.limits.icon.twinColour) faults.push({ rule: 'icon-twin', detail: `reads as ${set}/${j.n} at 32 pixels: ${pct(both / either)} of the two marks overlap and the colours match` });
      }
      if (faults.length) out[`${set}/${i.n}`] = faults;
    }
  }
  return out;
}
