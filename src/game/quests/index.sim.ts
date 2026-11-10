// The quest system. It reads the quests in content/quests.ts, checks the open step's condition twice a
// second and after any event, keeps the flags `quest.<id>.started`, `quest.<id>.done` and
// `quest.<id>.step`, and puts the quest mark over whoever the open step asks the player to talk to.

import type { Vec3 } from '../../engine/types.ts';
import type { EventName, Game, NpcId, QuestId, QuestStepView, QuestView, QuestsApi, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { QUESTS, type QuestDef, type StepDef } from '../content/quests.ts';
import { apply, bagCount, holds, petOf, placeAt, questState, walk, type QuestState } from './rules.sim.ts';

/** Seconds between two checks when nothing happened. */
const CHECK_EVERY = 0.5;
/** Events that change nothing a step could ask about. They do not trigger a check. */
const QUIET: ReadonlySet<EventName> = new Set<EventName>(['footstep', 'jump', 'land', 'toast', 'hint', 'ui.sound', 'quest.step', 'quest.started', 'quest.completed']);

interface Progress {
  state: QuestState;
  /** The index of the open step. Equal to the number of steps when the quest is done. */
  step: number;
}

interface QuestsSave {
  quests: Record<string, { state: QuestState; step: string | null }>;
  seen: string[];
}

export interface Quests {
  api: QuestsApi;
  system: SimSystem;
}

export function createQuests(game: Game, defs: readonly QuestDef[] = QUESTS): Quests {
  const { events, flags } = game;
  const progress = new Map<QuestId, Progress>(defs.map((def) => [def.id, { state: 'hidden', step: 0 }]));
  /** `quest.step` keys whose event arrived while the quest was active. */
  const seen = new Set<string>();
  /** People this system put the quest mark over. */
  const marked = new Set<NpcId>();
  let views: QuestView[] = [];
  let tracked: QuestView | null = null;
  let sinceCheck = CHECK_EVERY;
  let dirty = true;
  /** True after a load, when marks left by the saved game have to be matched to this one. */
  let resync = false;
  /** Messages of checks that failed, so each is logged once. */
  const warned = new Set<string>();

  // Places a step asks for with `ever`, so having been there counts even before the step opens.
  const everPlaces: { place: string; within: number }[] = [];
  // Steps that wait for an event, by event name.
  const waiting = new Map<EventName, { quest: QuestId; index: number; key: string }[]>();
  for (const def of defs) {
    def.steps.forEach((step, index) => {
      walk(step.done, (part) => {
        if ('place' in part && part.ever) everPlaces.push({ place: part.place, within: part.within });
        if ('event' in part) {
          const list = waiting.get(part.event) ?? [];
          list.push({ quest: def.id, index, key: `${def.id}.${step.id}` });
          waiting.set(part.event, list);
        }
      });
    });
  }

  events.onAny((name) => {
    const list = waiting.get(name);
    if (list) {
      for (const wait of list) {
        const p = progress.get(wait.quest)!;
        if (p.state === 'active' && wait.index >= p.step) seen.add(wait.key);
      }
    }
    if (!QUIET.has(name)) dirty = true;
  });

  const stepDone = (def: QuestDef, step: StepDef): boolean => holds(game, step.done, () => seen.has(`${def.id}.${step.id}`));

  function writeFlags(def: QuestDef, p: Progress): void {
    flags.set(`quest.${def.id}.started`, p.state !== 'hidden');
    flags.set(`quest.${def.id}.done`, p.state === 'done');
    flags.set(`quest.${def.id}.step`, p.state === 'active' ? def.steps[p.step].id : '');
  }

  function start(id: QuestId): void {
    const def = defs.find((d) => d.id === id);
    const p = progress.get(id);
    if (!def || !p || p.state !== 'hidden') return;
    p.state = 'active';
    p.step = 0;
    writeFlags(def, p);
    events.emit('quest.started', { quest: id });
    dirty = true;
    refresh();
  }

  /** Finishes every step the world already satisfies, in order. Returns true when anything moved. */
  function advance(def: QuestDef, p: Progress): boolean {
    // The furthest step that is done. A gate that is still open hides everything behind it.
    let reach = -1;
    for (let i = p.step; i < def.steps.length; i++) {
      if (stepDone(def, def.steps[i])) reach = i;
      else if (def.steps[i].gate) break;
    }
    if (reach < 0) return false;
    for (let i = p.step; i <= reach; i++) {
      p.step = i + 1;
      if (p.step < def.steps.length) flags.set(`quest.${def.id}.step`, def.steps[p.step].id);
      events.emit('quest.step', { quest: def.id, step: def.steps[i].id });
    }
    if (p.step >= def.steps.length) {
      p.state = 'done';
      writeFlags(def, p);
      events.emit('quest.completed', { quest: def.id });
      for (const next of defs) if (typeof next.starts === 'object' && next.starts.after === def.id) start(next.id);
    }
    return true;
  }

  function check(): void {
    dirty = false;
    sinceCheck = 0;
    for (const ever of everPlaces) {
      const at = placeAt(game, ever.place);
      if (at && distance2d(game.player.pos, at) <= ever.within) flags.set(`been.${ever.place}`, true);
    }
    // A new game starts its first quest. A loaded or skipped game has flags that say it began already.
    for (const def of defs) {
      if (def.starts === 'new game' && progress.get(def.id)!.state === 'hidden' && questState(game, def.id) === 'hidden') start(def.id);
    }
    // One quest finishing can start the next, whose first step may already hold.
    for (let pass = 0, moved = true; moved && pass < 8; pass++) {
      moved = false;
      for (const def of defs) {
        const p = progress.get(def.id)!;
        if (p.state === 'active' && advance(def, p)) moved = true;
      }
    }
    mark();
    refresh();
  }

  /** Puts the quest mark over the people the open steps point at, and takes it off everyone else it marked. */
  function mark(): void {
    const people = game.systems.people;
    if (!people) return;
    const wanted = new Set<NpcId>();
    for (const def of defs) {
      const p = progress.get(def.id)!;
      if (p.state === 'active') for (const npc of def.steps[p.step].npc ?? []) wanted.add(npc);
    }
    if (resync) {
      resync = false;
      for (const npc of people.all()) if (game.actors.get(`npc:${npc.id}`)?.mark === 'quest') marked.add(npc.id);
    }
    for (const npc of marked) {
      if (wanted.has(npc)) continue;
      people.setMark(npc, '');
      marked.delete(npc);
    }
    // Set again at every check, so a mark another system cleared comes back.
    for (const npc of wanted) {
      people.setMark(npc, 'quest');
      marked.add(npc);
    }
  }

  function waypoint(step: StepDef): Vec3 | undefined {
    if (step.npc) {
      let best: Vec3 | undefined;
      let bestDistance = Infinity;
      for (const id of step.npc) {
        const npc = game.systems.people?.get(id);
        if (!npc) continue;
        const d = distance2d(npc.pos, game.player.pos);
        if (d < bestDistance) {
          bestDistance = d;
          best = npc.pos;
        }
      }
      if (best) return { x: best.x, y: best.y, z: best.z };
    }
    if (step.pet) {
      const pet = petOf(game, step.pet);
      if (pet) return { x: pet.pos.x, y: pet.pos.y, z: pet.pos.z };
    }
    const at = step.place ? placeAt(game, step.place) : null;
    return at ? { x: at.x, y: at.y, z: at.z } : undefined;
  }

  function stepView(step: StepDef, done: boolean, open: boolean): QuestStepView {
    const view: QuestStepView = { id: step.id, text: step.text, done };
    const count = step.count;
    if (count) {
      if ('bag' in count) {
        view.need = count.need;
        view.have = done ? count.need : Math.min(count.need, bagCount(game, count.bag));
      } else if ('page' in count) {
        const facts = game.systems.almanac?.page(count.page)?.facts ?? [];
        view.need = facts.length;
        view.have = done ? facts.length : facts.filter((fact) => fact.known).length;
      } else {
        view.need = count.need;
        view.have = done ? count.need : Math.min(count.need, petOf(game, count.trust)?.trust ?? 0);
      }
    }
    if (open) {
      const at = waypoint(step);
      if (at) view.at = at;
    }
    return view;
  }

  /** Rebuilds what `all()` and `tracked()` hand out. They return the same objects until the next check. */
  function refresh(): void {
    views = defs.map((def) => {
      const p = progress.get(def.id)!;
      return {
        id: def.id,
        title: def.title,
        summary: def.summary,
        state: p.state,
        steps: def.steps.map((step, i) => stepView(step, p.state === 'done' || i < p.step, p.state === 'active' && i === p.step)),
      };
    });
    tracked = views.find((view) => view.state === 'active') ?? null;
  }

  /** Marks a quest finished without sending its events, and gives what finishing it would have given. */
  function pass(def: QuestDef): void {
    const p = progress.get(def.id)!;
    p.state = 'done';
    p.step = def.steps.length;
    writeFlags(def, p);
    for (const effect of def.skip) apply(game, effect);
  }

  const api: QuestsApi = {
    all: () => views,
    tracked: () => tracked,
    start,
    skipTo(id) {
      const target = defs.findIndex((def) => def.id === id);
      if (target < 0) return;
      seen.clear();
      defs.forEach((def, i) => {
        const p = progress.get(def.id)!;
        if (i < target) {
          if (p.state !== 'done') pass(def);
        } else {
          p.state = 'hidden';
          p.step = 0;
          writeFlags(def, p);
        }
      });
      // Tamsin waits at the grant stone until the first quest is done, then keeps the lodge.
      game.systems.people?.send('tamsin', target === 0 ? 'grant.stone' : 'lodge');
      start(id);
      check();
    },
  };

  const system: SimSystem = {
    step(dt) {
      sinceCheck += dt;
      if (!dirty && sinceCheck < CHECK_EVERY) return;
      // The shell switches a system off for good when its step throws, and without quests the game cannot
      // go on. So a check that fails is reported once and tried again at the next one.
      try {
        check();
      } catch (error) {
        dirty = false;
        sinceCheck = 0;
        const message = error instanceof Error ? error.message : String(error);
        if (!warned.has(message)) {
          warned.add(message);
          console.error('[quests] a check failed and will be tried again:', error);
        }
      }
    },
    save(): QuestsSave {
      const quests: QuestsSave['quests'] = {};
      for (const def of defs) {
        const p = progress.get(def.id)!;
        quests[def.id] = { state: p.state, step: p.state === 'active' ? def.steps[p.step].id : null };
      }
      return { quests, seen: [...seen] };
    },
    load(data) {
      const save = data as Partial<QuestsSave> | null;
      seen.clear();
      for (const key of save?.seen ?? []) seen.add(key);
      for (const def of defs) {
        const p = progress.get(def.id)!;
        const saved = save?.quests?.[def.id];
        p.state = saved?.state ?? 'hidden';
        // A step is found by its id, so a save still fits after a step is added before it.
        const index = saved?.step ? def.steps.findIndex((step) => step.id === saved.step) : -1;
        p.step = p.state === 'done' ? def.steps.length : Math.max(0, index);
      }
      marked.clear();
      resync = true;
      dirty = true;
      views = [];
      tracked = null;
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const quests = createQuests(kernel.game);
  kernel.add('quests', quests.api, quests.system);
}
