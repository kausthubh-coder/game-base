// What changed in the game between two `window.__game.state()` reads, and what a player knows from the HUD,
// both in words. Pure: no browser here.

const round1 = (n) => Math.round(n * 10) / 10;

/** The compass word for a step on the ground. North is -z, east is +x. */
export function heading(dx, dz) {
  const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
  const angle = Math.atan2(dz, dx); // 0 east, +pi/2 south
  return names[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}

/** 0.27 of a day as 06:29. */
export function clockText(timeOfDay) {
  const minutes = Math.floor((((timeOfDay % 1) + 1) % 1) * 24 * 60 + 1e-6);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const quote = (s) => JSON.stringify(s);
const stepWords = (step) => `${step.id}${step.need > 1 ? ` ${step.have ?? 0}/${step.need}` : ''}`;

/** The step a player is on in a quest: the first not done. */
function currentStep(quest) {
  return quest?.steps?.find((step) => !step.done) ?? null;
}

function bagCounts(bag) {
  const counts = new Map();
  for (const slot of bag ?? []) counts.set(slot.id, (counts.get(slot.id) ?? 0) + slot.count);
  return counts;
}

/** Lines that say what changed from `before` to `after`. An empty list means nothing a player would notice. */
export function changes(before, after) {
  if (!after) return [];
  if (!before) return ['first look of this session'];
  const out = [];
  if (before.started !== after.started) out.push(after.started ? 'a game started' : 'back at the title');
  if (before.paused !== after.paused) out.push(after.paused ? 'paused' : 'unpaused');
  const a = before.player, b = after.player;
  if (a && b) {
    const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y, far = Math.hypot(dx, dz);
    if (far >= 0.1) out.push(`hero moved ${round1(far)} m ${heading(dx, dz)}${Math.abs(dy) >= 0.5 ? `, ${dy > 0 ? 'up' : 'down'} ${round1(Math.abs(dy))} m` : ''}`);
    else if (Math.abs(dy) >= 0.5) out.push(`hero went ${dy > 0 ? 'up' : 'down'} ${round1(Math.abs(dy))} m`);
    if (a.busy !== b.busy) out.push(b.busy ? 'hero is busy (cannot move)' : 'hero can move');
    if (a.inWater !== b.inWater) out.push(b.inWater ? 'hero is in water' : 'hero left the water');
  }
  if (before.prompt !== after.prompt) out.push(after.prompt ? `prompt: ${quote(after.prompt)}` : 'prompt gone');
  const talkKey = (t) => (t ? `${t.npc}|${t.text}` : '');
  if (talkKey(before.talk) !== talkKey(after.talk)) {
    if (after.talk) out.push(`talk: ${after.talk.name ?? after.talk.npc}: ${quote(after.talk.text)}${after.talk.choices?.length ? ` [${after.talk.choices.join(' | ')}]` : ''}`);
    else out.push('talk ended');
  }
  // A hidden quest is not on any screen yet, so it is not news until it shows.
  const seen = (quests) => (quests ?? []).filter((q) => q.state !== 'hidden');
  const oldQuests = new Map(seen(before.quests).map((q) => [q.id, q]));
  for (const quest of seen(after.quests)) {
    const old = oldQuests.get(quest.id);
    if (!old) { out.push(`new quest ${quest.id} (${quest.state})`); continue; }
    if (old.state !== quest.state) out.push(`quest ${quest.id}: ${old.state} -> ${quest.state}`);
    const oldSteps = new Map(old.steps.map((s) => [s.id, s]));
    for (const step of quest.steps) {
      const was = oldSteps.get(step.id);
      if (step.done && !was?.done) out.push(`quest ${quest.id}: step ${step.id} done`);
      else if (!step.done && was && (was.have ?? 0) !== (step.have ?? 0)) out.push(`quest ${quest.id}: ${stepWords(step)}`);
    }
  }
  if (before.tracked !== after.tracked) out.push(after.tracked ? `tracking ${after.tracked}` : 'no quest tracked');
  const oldBag = bagCounts(before.bag), newBag = bagCounts(after.bag);
  const gained = [], lost = [];
  for (const [id, n] of newBag) { const d = n - (oldBag.get(id) ?? 0); if (d > 0) gained.push(`${id} x${d}`); else if (d < 0) lost.push(`${id} x${-d}`); }
  for (const [id, n] of oldBag) if (!newBag.has(id)) lost.push(`${id} x${n}`);
  if (gained.length) out.push(`bag +${gained.join(', ')}`);
  if (lost.length) out.push(`bag -${lost.join(', ')}`);
  if (before.held !== after.held) out.push(after.held ? `holding ${after.held}` : 'hands empty');
  const ca = before.clock, cb = after.clock;
  if (ca && cb) {
    const minutes = Math.round(((cb.day + cb.timeOfDay) - (ca.day + ca.timeOfDay)) * 24 * 60);
    if (minutes !== 0) out.push(`${minutes > 0 ? '' : 'back '}${Math.abs(minutes) >= 120 ? `${round1(Math.abs(minutes) / 60)} h` : `${Math.abs(minutes)} min`} of game time${minutes > 0 ? ' passed' : ''}, now ${cb.day !== ca.day ? `day ${cb.day} ` : ''}${clockText(cb.timeOfDay)}`);
  }
  const oldErrors = new Set(before.viewErrors ?? []);
  for (const error of after.viewErrors ?? []) if (!oldErrors.has(error)) out.push(`view error: ${String(error).slice(0, 160)}`);
  for (const [system, why] of Object.entries(after.failed ?? {})) if (!(system in (before.failed ?? {}))) out.push(`system failed: ${system}: ${String(why).slice(0, 160)}`);
  return out;
}

/** The few facts a player would know from the HUD. */
export function now(state) {
  if (!state) return [];
  if (!state.started) return ['at the title'];
  const out = [];
  const p = state.player;
  if (p) out.push(`hero at x ${round1(p.x)}, z ${round1(p.z)} (y ${round1(p.y)})${p.busy ? ', busy' : ''}${p.inWater ? ', in water' : ''}`);
  if (state.clock) out.push(`day ${state.clock.day}, ${clockText(state.clock.timeOfDay)}${state.paused ? ', paused' : ''}`);
  if (state.prompt) out.push(`prompt: ${quote(state.prompt)}`);
  if (state.talk) out.push(`talk: ${state.talk.name ?? state.talk.npc}: ${quote(state.talk.text)}${state.talk.choices?.length ? ` [${state.talk.choices.join(' | ')}]` : ''}`);
  const quest = (state.quests ?? []).find((q) => q.id === state.tracked);
  const step = currentStep(quest);
  if (quest) out.push(`quest ${quest.id}: ${step ? stepWords(step) : quest.state}`);
  out.push(state.held ? `holding ${state.held}` : 'hands empty');
  return out;
}
